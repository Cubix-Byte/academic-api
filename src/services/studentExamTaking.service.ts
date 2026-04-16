import * as examRepository from "../repositories/exam.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examStudentRepository from "../repositories/examStudent.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examAnswerRepository from "../repositories/examAnswer.repository";
import * as activityLogService from "./activityLog.service";
import * as notificationService from "./notification.service";
import * as parentChildService from "./parentChild.service";
const mongoose = require("mongoose");
import {
  buildActivityDescription,
  fetchUserNames,
} from "@/utils/activityLog.helper";
import { ActivityService } from "./activity.service";
import {
  StartExamRequest,
  StartExamResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SubmitExamRequest,
  SubmitExamResponse,
  GetAttemptStatusResponse,
  GetStudentExamsRequest,
  GetStudentExamsResponse,
  StudentExamCard,
  GetStudentAttemptHistoryResponse,
  GetExamInstructionsResponse,
  SaveDraftAnswerRequest,
  SaveDraftAnswerResponse,
  GetDraftAnswersResponse,
  FlagQuestionRequest,
  FlagQuestionResponse,
} from "@/types/examAttempt.types";
import StudentExamProgress from "../models/studentExamProgress.schema";

/**
 * Student Exam Taking Service - Business logic for student exam operations
 */

// Start exam - Create new attempt and return exam with questions (with resume support)
export const startExam = async (
  data: StartExamRequest,
  studentId: string,
  tenantId: string
): Promise<StartExamResponse> => {
  try {
    console.log("🔍 Start Exam Debug:", {
      examId: data.examId,
      studentId,
      tenantId,
    });

    // Get exam details
    const exam = await examRepository.findExamById(data.examId);
    if (!exam) {
      console.log("❌ Exam not found");
      throw new Error("EXAM_NOT_FOUND");
    }
    console.log("✅ Exam found:", exam.examTitle, "Status:", exam.examStatus);

    // Check if exam is published
    if (exam.examStatus !== "Published") {
      console.log("❌ Exam not published:", exam.examStatus);
      throw new Error("EXAM_NOT_PUBLISHED");
    }

    // Check if student is assigned to exam
    const examStudentRecord = await examStudentRepository.getExamStudentRecord(
      data.examId,
      studentId
    );
    console.log(
      "🔍 Exam Student Record:",
      examStudentRecord ? "Found" : "Not Found"
    );
    if (!examStudentRecord) {
      console.log("❌ Student not assigned to exam");
      throw new Error("STUDENT_NOT_ASSIGNED");
    }

    // Check if exam is already completed
    if (examStudentRecord.status === "Completed") {
      throw new Error("EXAM_ALREADY_COMPLETED");
    }

    // Validate current time is within allowed window
    const now = new Date();
    const examStartTime = new Date(exam.startOn);
    const examEndTime = new Date(exam.endOn);

    console.log("🕒 Time Check:", {
      now: now.toISOString(),
      examStartTime: examStartTime.toISOString(),
      examEndTime: examEndTime.toISOString(),
      beforeStart: now < examStartTime,
      afterEnd: now > examEndTime,
    });

    // Check if exam has not started yet
    if (now < examStartTime) {
      console.log("❌ Exam has not started yet");
      throw new Error("EXAM_NOT_STARTED");
    }

    // Check if exam window has expired
    if (now > examEndTime) {
      console.log("❌ Exam time is over");
      throw new Error("EXAM_TIME_OVER");
    }
    console.log("✅ Time validation passed");

    // Check if student has active attempt (Resume functionality)
    const activeAttempt =
      await examAttemptRepository.getActiveAttemptForStudent(
        studentId,
        data.examId
      );

    if (activeAttempt) {
      // Resume existing attempt
      // Calculate time remaining and cap end time at examEndTime
      const rawEndTime = new Date(
        activeAttempt.startedAt!.getTime() + exam.durationInMinutes * 60000
      );
      const attemptEndTime =
        rawEndTime > examEndTime ? examEndTime : rawEndTime;
      const timeRemaining = Math.max(
        0,
        Math.floor((attemptEndTime.getTime() - now.getTime()) / 1000)
      );

      // Check if attempt time has expired
      if (timeRemaining === 0) {
        throw new Error("EXAM_TIME_OVER");
      }

      // Get exam questions
      const questions = await examQuestionRepository.findQuestionsByExamId(
        data.examId
      );

      // Get previously saved answers
      const savedAnswers = await examAnswerRepository.findAnswersByAttemptId(
        activeAttempt._id.toString()
      );

      // Get flagged questions
      const flaggedQuestionIds = await examAnswerRepository.getFlaggedQuestions(
        activeAttempt._id.toString()
      );

      // Map answers to questions
      const questionsWithAnswers = questions.map((q) => {
        const savedAnswer = savedAnswers.find(
          (a) => a.questionId.toString() === q._id.toString()
        );
        const isFlagged = flaggedQuestionIds.includes(q._id.toString());
        return {
          _id: q._id.toString(),
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          questionText: q.questionText,
          options: q.options
            ? q.options.map((opt: any) => opt.text || opt)
            : undefined,
          marks: q.marks,
          imageUrl: q.imageUrl !== undefined ? q.imageUrl : undefined,
          savedAnswer: savedAnswer ? savedAnswer.studentAnswer : undefined,
          isFlagged: isFlagged,
        };
      });

      return {
        attemptId: activeAttempt._id.toString(),
        exam: {
          _id: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          durationInMinutes: exam.durationInMinutes,
          totalMarks: exam.totalMarks,
          startOn: exam.startOn,
          endOn: exam.endOn,
          allowedAttempts: exam.allowedAttempts,
        },
        questions: questionsWithAnswers,
        attemptNumber: activeAttempt.attemptNumber,
        startedAt: activeAttempt.startedAt!,
        endTime: attemptEndTime,
        isResuming: true,
      };
    }

    // Count previous attempts
    const attemptCount =
      await examAttemptRepository.countAttemptsByStudentAndExam(
        studentId,
        data.examId
      );

    // Check if student has exceeded allowed attempts
    if (attemptCount >= exam.allowedAttempts) {
      throw new Error("MAX_ATTEMPTS_REACHED");
    }

    // Get exam questions
    const questions = await examQuestionRepository.findQuestionsByExamId(
      data.examId
    );
    if (questions.length === 0) {
      throw new Error("EXAM_HAS_NO_QUESTIONS");
    }

    // Calculate end time for this attempt
    const startedAt = new Date();
    const endTime = new Date(
      startedAt.getTime() + exam.durationInMinutes * 60000
    );

    // Ensure attempt end time doesn't exceed exam end time
    const actualEndTime = endTime > examEndTime ? examEndTime : endTime;

    // Create new attempt
    const mongoose = require("mongoose");
    const attempt = await examAttemptRepository.createExamAttempt({
      examId: exam._id,
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: exam.classId,
      subjectId: exam.subjectId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptNumber: attemptCount + 1,
      startedAt: startedAt,
      attemptStatus: "In Progress",
      totalMarks: exam.totalMarks,
    });

    // Mark exam student as "Started"
    await examStudentRepository.updateExamStudentStatus(
      data.examId,
      studentId,
      "Started"
    );

    // Return exam with questions (without answers)
    return {
      attemptId: attempt._id.toString(),
      exam: {
        _id: exam._id.toString(),
        examTitle: exam.examTitle,
        description: exam.description,
        durationInMinutes: exam.durationInMinutes,
        totalMarks: exam.totalMarks,
        startOn: exam.startOn,
        endOn: exam.endOn,
        allowedAttempts: exam.allowedAttempts,
      },
      questions: questions.map((q) => ({
        _id: q._id.toString(),
        questionNumber: q.questionNumber,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options
          ? q.options.map((opt: any) => opt.text || opt)
          : undefined,
        marks: q.marks,
        imageUrl: q.imageUrl !== undefined ? q.imageUrl : undefined,
        isFlagged: false, // New attempts start with no flags
      })),
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt!,
      endTime: actualEndTime,
      isResuming: false,
    };
  } catch (error) {
    console.error("Start exam error:", error);
    throw error;
  }
};

// Submit answer - Save student's answer for a question (supports single or multiple answers)
export const submitAnswer = async (
  data:
    | SubmitAnswerRequest
    | {
        attemptId: string;
        answers: Array<{ questionId: string; answer: any; timeTaken?: number }>;
      },
  studentId: string,
  tenantId: string
): Promise<SubmitAnswerResponse> => {
  try {
    // Handle both single answer and multiple answers
    const isBulk = "answers" in data;
    const attemptId = data.attemptId;
    const answers = isBulk
      ? data.answers
      : [
          {
            questionId: (data as SubmitAnswerRequest).questionId,
            answer: (data as SubmitAnswerRequest).answer,
            timeTaken: (data as SubmitAnswerRequest).timeTaken,
          },
        ];

    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Check if attempt is in progress
    if (attempt.attemptStatus !== "In Progress") {
      throw new Error("ATTEMPT_NOT_IN_PROGRESS");
    }

    // Get exam to verify
    const exam = await examRepository.findExamById(attempt.examId.toString());
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Save each answer
    for (const answerData of answers) {
      // Get question details
      const question = await examQuestionRepository.findExamQuestionById(
        answerData.questionId
      );
      if (!question) {
        console.warn(
          `Question ${answerData.questionId} not found, skipping...`
        );
        continue;
      }

      // Verify question belongs to exam
      if (question.examId.toString() !== attempt.examId.toString()) {
        console.warn(
          `Question ${answerData.questionId} doesn't belong to exam, skipping...`
        );
        continue;
      }

      // Upsert answer
      await examAnswerRepository.upsertExamAnswer(
        attemptId,
        answerData.questionId,
        {
          attemptId: new mongoose.Types.ObjectId(attemptId),
          examId: new mongoose.Types.ObjectId(attempt.examId),
          questionId: new mongoose.Types.ObjectId(answerData.questionId),
          studentId: new mongoose.Types.ObjectId(studentId),
          questionNumber: question.questionNumber,
          questionType: question.questionType,
          studentAnswer: answerData.answer,
          correctAnswer: question.correctAnswer,
          maxMarks: question.marks,
          timeTakenInSeconds: answerData.timeTaken || 0,
          tenantId: new mongoose.Types.ObjectId(tenantId),
        }
      );
    }

    // Check if all questions have been answered
    const totalQuestions = await examQuestionRepository.countExamQuestions(
      attempt.examId.toString()
    );
    const answeredQuestions = await examAnswerRepository.countAnsweredQuestions(
      attemptId
    );

    let isCompleted = answeredQuestions >= totalQuestions;

    return {
      success: true,
      message: isBulk
        ? `${answers.length} answer(s) saved successfully`
        : "Answer saved successfully",
      savedAt: new Date(),
      answeredQuestions: answeredQuestions,
      totalQuestions: totalQuestions,
      isCompleted: isCompleted,
    };
  } catch (error) {
    console.error("Submit answer error:", error);
    throw error;
  }
};

// Submit exam - Finalize attempt and trigger grading
export const submitExam = async (
  data: SubmitExamRequest,
  studentId: string,
  tenantId: string
): Promise<SubmitExamResponse> => {
  try {
    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(
      data.attemptId
    );
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Check if attempt is in progress or paused
    if (
      attempt.attemptStatus !== "In Progress" &&
      attempt.attemptStatus !== "Paused"
    ) {
      throw new Error("ATTEMPT_ALREADY_SUBMITTED");
    }

    // Save all answers
    const mongoose = require("mongoose");
    for (const answer of data.answers) {
      const question = await examQuestionRepository.findExamQuestionById(
        answer.questionId
      );
      if (question) {
        await examAnswerRepository.upsertExamAnswer(
          data.attemptId,
          answer.questionId,
          {
            attemptId: new mongoose.Types.ObjectId(data.attemptId),
            examId: new mongoose.Types.ObjectId(attempt.examId),
            questionId: new mongoose.Types.ObjectId(answer.questionId),
            studentId: new mongoose.Types.ObjectId(studentId),
            questionNumber: question.questionNumber,
            questionType: question.questionType,
            studentAnswer: answer.answer,
            correctAnswer: question.correctAnswer,
            maxMarks: question.marks,
            timeTakenInSeconds: answer.timeTaken,
            tenantId: new mongoose.Types.ObjectId(tenantId),
          }
        );
      }
    }

    // Calculate total time taken
    const submittedAt = new Date();
    const timeTaken = Math.floor(
      (submittedAt.getTime() - attempt.startedAt!.getTime()) / 1000
    );

    // Update attempt status to submitted
    await examAttemptRepository.submitExamAttempt(data.attemptId, {
      submittedAt: submittedAt,
      timeTakenInSeconds: timeTaken,
      attemptStatus: "Submitted",
    });

    // Update exam student status to Completed
    await examStudentRepository.updateExamStudentStatus(
      attempt.examId.toString(),
      studentId,
      "Completed"
    );

    // Log student activity

    try {
      const exam = await examRepository.findExamById(attempt.examId.toString());

      if (exam) {
        const studentName = await fetchUserNames([studentId]).then(
          (names) => names[studentId] || "Student"
        );

        const activityType: "ExamCompleted" | "PracticeCompleted" =
          exam.examType === "Practice" ? "PracticeCompleted" : "ExamCompleted";

        const activityDescription = buildActivityDescription(
          studentName,
          activityType,
          exam.examTitle
        );

        // Handle classId and subjectId - they might be populated objects or ObjectIds
        // If populated, extract _id, otherwise use the value directly
        const classIdString = (exam.classId as any)?._id
          ? String((exam.classId as any)._id)
          : String(exam.classId);

        const subjectIdString = (exam.subjectId as any)?._id
          ? String((exam.subjectId as any)._id)
          : String(exam.subjectId);

        await activityLogService.createStudentActivityLog({
          studentId,
          activityType,
          activityDescription,
          relatedEntityId: exam._id.toString(),
          relatedEntityType:
            exam.examType === "Practice" ? "PracticeExam" : "Exam",
          classId: classIdString,
          subjectId: subjectIdString,
          tenantId,
        });
      }
    } catch (logError: any) {
      console.error("Error creating student activity log:", logError.message);
      // Don't throw - logging failure shouldn't break exam submission
    }

    // Send notification to teacher about exam submission
    try {
      const exam = await examRepository.findExamById(attempt.examId.toString());
      if (exam) {
        const studentName = await fetchUserNames([studentId]).then(
          (names) => names[studentId] || "A student"
        );

        const teacherId = exam.teacherId.toString();

        // Format submission time
        const submissionTime = submittedAt.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        // Format time taken
        const minutes = Math.floor(timeTaken / 60);
        const seconds = timeTaken % 60;
        const timeTakenFormatted = `${minutes}m ${seconds}s`;

        // Single
        const teacherNotification: notificationService.INotificationRequest = {
          receiverId: teacherId,
          receiverRole: "TEACHER",
          title: `Exam Submitted: ${exam.examTitle}`,
          content: `${studentName} has ${
            data.isAutoSubmit ? "auto-" : ""
          }submitted the ${exam.examType.toLowerCase()} exam "${
            exam.examTitle
          }" on ${submissionTime}. Time taken: ${timeTakenFormatted}.`,
          senderId: studentId,
          senderRole: "STUDENT",
          tenantId,
          meta: {
            entityId: exam._id.toString(),
            entityType: "Exam",
            attemptId: data.attemptId,
            examTitle: exam.examTitle,
            examType: exam.examType,
            studentId: studentId,
            studentName: studentName,
            submittedAt: submittedAt,
            timeTakenInSeconds: timeTaken,
            isAutoSubmit: data.isAutoSubmit || false,
            notificationType: "exam_submitted",
          },
        };

        const studentNotification: notificationService.INotificationRequest = {
          receiverId: studentId,
          receiverRole: "STUDENT",
          title: `Submission Received: ${exam.examTitle}`,
          content: "Exams submitted succesfuuly.",
          senderId: teacherId,
          senderRole: "TEACHER",
          tenantId,
          meta: {
            entityId: exam._id.toString(),
            entityType: "Exam",
            attemptId: data.attemptId,
            examTitle: exam.examTitle,
            examType: exam.examType,
            studentId: studentId,
            studentName: studentName,
            submittedAt: submittedAt,
            timeTakenInSeconds: timeTaken,
            isAutoSubmit: data.isAutoSubmit || false,
            notificationType: "exam_submitted",
          },
        };

        const notifications: notificationService.INotificationRequest[] = [
          teacherNotification,
          studentNotification,
        ];

        // Notify parents of the submission
        try {
          console.log(`📧 [submitExam] Starting parent notifications for student ${studentId}...`);
          const parentsResult = await parentChildService.getParentsByChildId(studentId);
          
          console.log(`🔍 [submitExam] Fetched parents for student ${studentId}:`, {
            success: parentsResult.success,
            dataLength: parentsResult.data ? parentsResult.data.length : 0,
            data: parentsResult.data,
          });

          if (parentsResult.success && parentsResult.data && Array.isArray(parentsResult.data)) {
            const parentIds = new Set<string>();
            console.log(`📌 [submitExam] Found ${parentsResult.data.length} parent relationship(s)`);
            
            parentsResult.data.forEach((parentRel: any) => {
              let parentId = null;
              
              // Handle both populated object and string references
              if (parentRel.parentId) {
                if (typeof parentRel.parentId === 'string') {
                  parentId = parentRel.parentId;
                } else if (parentRel.parentId._id) {
                  // Populated object with _id field
                  parentId = parentRel.parentId._id.toString();
                } else if (typeof parentRel.parentId === 'object' && parentRel.parentId.toString) {
                  // ObjectId instance
                  parentId = parentRel.parentId.toString();
                }
              }
              
              console.log(`  → Parent ID: ${parentId}, Valid: ${parentId && mongoose.Types.ObjectId.isValid(parentId)}, parentRel.parentId type: ${typeof parentRel.parentId}`);
              
              if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
                parentIds.add(parentId);
              }
            });

            console.log(`🎯 [submitExam] Total unique parents found: ${parentIds.size}`);

            if (parentIds.size > 0) {
              const parentNotifications: notificationService.INotificationRequest[] = Array.from(parentIds).map(
                (parentId) => ({
                  receiverId: parentId,
                  receiverRole: "PARENT",
                  title: `Child Submitted Exam: ${exam.examTitle}`,
                  content: `${studentName} submitted the ${exam.examType.toLowerCase()} exam "${exam.examTitle}" on ${submissionTime}.`,
                  senderId: teacherId,
                  senderRole: "TEACHER",
                  tenantId,
                  meta: {
                    entityId: exam._id.toString(),
                    entityType: "Exam",
                    attemptId: data.attemptId,
                    examTitle: exam.examTitle,
                    examType: exam.examType,
                    studentId: studentId,
                    studentName: studentName,
                    submittedAt: submittedAt,
                    timeTakenInSeconds: timeTaken,
                    isAutoSubmit: data.isAutoSubmit || false,
                    notificationType: "exam_submitted_child",
                  },
                })
              );

              const batchSize = 100;
              for (let i = 0; i < parentNotifications.length; i += batchSize) {
                const batch = parentNotifications.slice(i, i + batchSize);
                notifications.push(...batch);
              }
              console.log(`✅ [submitExam] Added ${parentIds.size} parent notification(s) to send queue`);
            } else {
              console.log(`ℹ️  [submitExam] No parents to notify for student ${studentId}`);
            }
          } else {
            console.log(`ℹ️  [submitExam] No parent data returned for student ${studentId}`);
          }
        } catch (parentNotifErr: any) {
          console.warn("⚠️ Error preparing parent submission notifications:", parentNotifErr.message);
        }

        await notificationService.sendNotifications(notifications);
        console.log(
          `✅ Sent exam submission notifications to teacher ${teacherId}, student ${studentId}${notifications.length > 2 ? `, and ${notifications.length - 2} parent notification(s)` : ""}`
        );
      }
    } catch (notificationError) {
      console.error(
        "Error sending exam submission notification:",
        notificationError
      );
      // Don't throw - notification failure shouldn't break exam submission
    }

    return {
      success: true,
      attemptId: data.attemptId,
      submittedAt: submittedAt,
      totalTimeTaken: timeTaken,
      message: data.isAutoSubmit
        ? "Exam auto-submitted successfully"
        : "Exam submitted successfully",
    };
  } catch (error) {
    console.error("Submit exam error:", error);
    throw error;
  }
};

// Get attempt status - Return current state of student's attempt
export const getAttemptStatus = async (
  attemptId: string,
  studentId: string
): Promise<GetAttemptStatusResponse> => {
  try {
    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Get exam details
    const exam = await examRepository.findExamById(attempt.examId.toString());
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get all answers for this attempt
    const answers = await examAnswerRepository.findAnswersByAttemptId(
      attemptId
    );

    // Calculate time remaining
    const now = new Date();
    const endTime = new Date(
      attempt.startedAt!.getTime() + exam.durationInMinutes * 60000
    );
    const timeRemaining = Math.max(
      0,
      Math.floor((endTime.getTime() - now.getTime()) / 1000)
    );

    // Count total questions
    const totalQuestions = await examQuestionRepository.countExamQuestions(
      attempt.examId.toString()
    );

    return {
      attemptId: attempt._id.toString(),
      examId: attempt.examId.toString(),
      examTitle: exam.examTitle,
      status: attempt.attemptStatus,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt!,
      submittedAt: attempt.submittedAt,
      timeRemaining:
        attempt.attemptStatus === "In Progress" ? timeRemaining : 0,
      questionsAnswered: answers.length,
      totalQuestions: totalQuestions,
      obtainedMarks: attempt.obtainedMarks,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      result: attempt.result,
      answers: answers.map((a) => ({
        questionId: a.questionId.toString(),
        questionNumber: a.questionNumber,
        answer: a.studentAnswer,
        timeTaken: a.timeTakenInSeconds,
        isCorrect: a.isCorrect === null ? undefined : a.isCorrect,
        marksObtained: a.marksObtained,
        maxMarks: a.maxMarks,
      })),
    };
  } catch (error) {
    console.error("Get attempt status error:", error);
    throw error;
  }
};

// Get student exams - List all exams available/taken by student
export const getStudentExams = async (
  params: GetStudentExamsRequest & { studentId: string; tenantId: string }
): Promise<GetStudentExamsResponse> => {
  try {
    // Get student's assigned exams
    const assignedExams = await examStudentRepository.findExamsByStudent(
      params.studentId
    );
    const examIds = assignedExams.map((ae) => ae.examId.toString());

    // Get exam details
    const exams = await examRepository.findExamsByIds(examIds);

    // Enrich with attempt information
    const enrichedExams: StudentExamCard[] = await Promise.all(
      exams.map(async (exam) => {
        const attempts =
          await examAttemptRepository.findAttemptsByStudentAndExam(
            params.studentId,
            exam._id.toString()
          );

        const attemptsTaken = attempts.length;
        const bestAttempt =
          await examAttemptRepository.getBestAttemptForStudent(
            params.studentId,
            exam._id.toString()
          );
        const activeAttempt =
          await examAttemptRepository.getActiveAttemptForStudent(
            params.studentId,
            exam._id.toString()
          );

        const now = new Date();
        const canAttempt =
          exam.examStatus === "Published" &&
          now >= new Date(exam.startOn) &&
          now <= new Date(exam.endOn) &&
          attemptsTaken < exam.allowedAttempts;

        let attemptStatus = "Not Started";
        if (activeAttempt) {
          attemptStatus = activeAttempt.attemptStatus;
        } else if (attemptsTaken > 0) {
          const lastAttempt = attempts[0];
          attemptStatus = lastAttempt.attemptStatus;
        }

        return {
          _id: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          examType: exam.examType,
          examStatus: exam.examStatus,
          totalMarks: exam.totalMarks,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          allowedAttempts: exam.allowedAttempts,
          attemptsTaken: attemptsTaken,
          bestScore: bestAttempt?.obtainedMarks,
          lastAttemptAt:
            attempts.length > 0 ? attempts[0].startedAt : undefined,
          canAttempt: canAttempt,
          attemptStatus: attemptStatus,
        } as StudentExamCard;
      })
    );

    // Apply filters
    let filteredExams = enrichedExams;
    if (params.examStatus) {
      filteredExams = filteredExams.filter(
        (e) => e.examStatus === params.examStatus
      );
    }
    if (params.examType) {
      filteredExams = filteredExams.filter(
        (e) => e.examType === params.examType
      );
    }
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredExams = filteredExams.filter(
        (e) =>
          e.examTitle.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedExams = filteredExams.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      exams: paginatedExams,
      pagination: {
        total: filteredExams.length,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(filteredExams.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get student exams error:", error);
    throw error;
  }
};

// Get student attempt history - List all attempts for an exam
export const getStudentAttemptHistory = async (
  examId: string,
  studentId: string
): Promise<GetStudentAttemptHistoryResponse> => {
  try {
    // Get exam details
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get all attempts
    const attempts = await examAttemptRepository.getStudentAttemptHistory(
      studentId,
      examId
    );

    return {
      examId: examId,
      examTitle: exam.examTitle,
      attempts: attempts.map((a) => ({
        attemptId: a._id.toString(),
        attemptNumber: a.attemptNumber,
        startedAt: a.startedAt!,
        submittedAt: a.submittedAt,
        timeTaken: a.timeTakenInSeconds || 0,
        status: a.attemptStatus,
        obtainedMarks: a.obtainedMarks,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        result: a.result,
      })),
    };
  } catch (error) {
    console.error("Get student attempt history error:", error);
    throw error;
  }
};

// Get exam instructions - Show exam details before starting
export const getExamInstructions = async (
  examId: string,
  studentId: string
): Promise<GetExamInstructionsResponse> => {
  try {
    // Get exam details
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Check if student is assigned
    const isAssigned = await examStudentRepository.checkStudentAssignedToExam(
      examId,
      studentId
    );
    if (!isAssigned) {
      throw new Error("STUDENT_NOT_ASSIGNED");
    }

    // Get questions distribution
    const questions = await examQuestionRepository.findQuestionsByExamId(
      examId
    );
    const totalQuestions = questions.length;

    // Calculate distribution by type
    const typeDistribution = questions.reduce((acc, q) => {
      const existing = acc.find((item) => item.questionType === q.questionType);
      if (existing) {
        existing.count++;
        existing.marks += q.marks;
      } else {
        acc.push({
          questionType: q.questionType,
          count: 1,
          marks: q.marks,
        });
      }
      return acc;
    }, [] as Array<{ questionType: string; count: number; marks: number }>);

    // Calculate distribution by difficulty
    const difficultyDistribution = questions.reduce((acc, q) => {
      const existing = acc.find((item) => item.difficulty === q.difficulty);
      if (existing) {
        existing.count++;
      } else {
        acc.push({
          difficulty: q.difficulty,
          count: 1,
        });
      }
      return acc;
    }, [] as Array<{ difficulty: string; count: number }>);

    // Get attempts taken
    const attemptsTaken =
      await examAttemptRepository.countAttemptsByStudentAndExam(
        studentId,
        examId
      );

    // Map maxAttempts to allowedAttempts (since .lean() doesn't include virtual properties)
    const allowedAttempts = exam.maxAttempts || exam.allowedAttempts || 1;

    // Check if can attempt
    const now = new Date();
    // const activeAttempt =
    //   await examAttemptRepository.getActiveAttemptForStudent(studentId, examId);
    const canAttempt =
      exam.examStatus === "Published" &&
      now >= new Date(exam.startOn) &&
      now <= new Date(exam.endOn) &&
      attemptsTaken < allowedAttempts;

    return {
      examId: exam._id.toString(),
      examTitle: exam.examTitle,
      description: exam.description,
      examType: exam.examType,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      durationInMinutes: exam.durationInMinutes,
      totalQuestions: totalQuestions,
      questionDistribution: typeDistribution,
      difficultyDistribution: difficultyDistribution,
      instructions: [
        `This exam has ${totalQuestions} questions`,
        `Total marks: ${exam.totalMarks}`,
        `Duration: ${exam.durationInMinutes} minutes`,
        `You have ${allowedAttempts} attempts allowed`,
        `Once started, the timer cannot be paused`,
        `Make sure you have stable internet connection`,
        `Click 'Start Exam' when you are ready`,
      ],
      maxAttempts: exam.maxAttempts,
      allowedAttempts: allowedAttempts,
      attemptsTaken: attemptsTaken,
      canAttempt: canAttempt,
      startOn: exam.startOn,
      endOn: exam.endOn,
    };
  } catch (error) {
    console.error("Get exam instructions error:", error);
    throw error;
  }
};

// Save draft answer - Auto-save functionality
export const saveDraftAnswer = async (
  data: SaveDraftAnswerRequest,
  studentId: string,
  tenantId: string
): Promise<SaveDraftAnswerResponse> => {
  try {
    // Reuse submit answer logic
    const result = await submitAnswer(
      {
        attemptId: data.attemptId,
        questionId: data.questionId,
        answer: data.answer,
        timeTaken: 0, // Draft save doesn't track time
      },
      studentId,
      tenantId
    );

    return {
      success: result.success,
      savedAt: result.savedAt,
    };
  } catch (error) {
    console.error("Save draft answer error:", error);
    throw error;
  }
};

// Get draft answers - Retrieve auto-saved answers
export const getDraftAnswers = async (
  attemptId: string,
  studentId: string
): Promise<GetDraftAnswersResponse> => {
  try {
    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Get all saved answers
    const answers = await examAnswerRepository.findAnswersByAttemptId(
      attemptId
    );

    return {
      attemptId: attemptId,
      draftAnswers: answers.map((a) => ({
        questionId: a.questionId.toString(),
        questionNumber: a.questionNumber,
        answer: a.studentAnswer,
        savedAt: a.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Get draft answers error:", error);
    throw error;
  }
};

// Flag question - Mark a question for review
export const flagQuestion = async (
  data: FlagQuestionRequest,
  studentId: string,
  tenantId: string
): Promise<FlagQuestionResponse> => {
  try {
    const mongoose = require("mongoose");

    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(
      data.attemptId
    );
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Check if attempt is in progress
    if (attempt.attemptStatus !== "In Progress") {
      throw new Error("ATTEMPT_NOT_IN_PROGRESS");
    }

    // Get question details
    const question = await examQuestionRepository.findExamQuestionById(
      data.questionId
    );
    if (!question) {
      throw new Error("QUESTION_NOT_FOUND");
    }

    // Check if question already has an answer record
    const existingAnswer =
      await examAnswerRepository.findAnswerByAttemptAndQuestion(
        data.attemptId,
        data.questionId
      );

    // Prepare answer data for flagging
    const answerData: any = {
      attemptId: new mongoose.Types.ObjectId(data.attemptId),
      examId: attempt.examId,
      questionId: new mongoose.Types.ObjectId(data.questionId),
      studentId: new mongoose.Types.ObjectId(studentId),
      questionNumber: question.questionNumber,
      questionType: question.questionType,
      correctAnswer: question.correctAnswer,
      maxMarks: question.marks,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isFlagged: true,
    };

    // If answer exists, preserve it; otherwise set studentAnswer to null
    if (
      existingAnswer &&
      existingAnswer.studentAnswer !== null &&
      existingAnswer.studentAnswer !== undefined
    ) {
      answerData.studentAnswer = existingAnswer.studentAnswer;
      answerData.timeTakenInSeconds = existingAnswer.timeTakenInSeconds || 0;
    } else {
      answerData.studentAnswer = null;
      answerData.timeTakenInSeconds = 0;
    }

    // Flag the question
    await examAnswerRepository.flagQuestion(
      data.attemptId,
      data.questionId,
      answerData
    );

    // Update or create StudentExamProgress
    const flaggedCount = await examAnswerRepository.countFlaggedQuestions(
      data.attemptId
    );

    await StudentExamProgress.findOneAndUpdate(
      { attemptId: new mongoose.Types.ObjectId(data.attemptId) },
      {
        $set: {
          flaggedQuestions: flaggedCount,
          lastActivityAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      isFlagged: true,
      flaggedCount: flaggedCount,
    };
  } catch (error) {
    console.error("Flag question error:", error);
    throw error;
  }
};

// Unflag question - Remove flag from a question
export const unflagQuestion = async (
  data: FlagQuestionRequest,
  studentId: string,
  tenantId: string
): Promise<FlagQuestionResponse> => {
  try {
    const mongoose = require("mongoose");

    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(
      data.attemptId
    );
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify attempt belongs to student
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Check if attempt is in progress
    if (attempt.attemptStatus !== "In Progress") {
      throw new Error("ATTEMPT_NOT_IN_PROGRESS");
    }

    // Unflag the question
    await examAnswerRepository.unflagQuestion(data.attemptId, data.questionId);

    // Update StudentExamProgress
    const flaggedCount = await examAnswerRepository.countFlaggedQuestions(
      data.attemptId
    );

    await StudentExamProgress.findOneAndUpdate(
      { attemptId: new mongoose.Types.ObjectId(data.attemptId) },
      {
        $set: {
          flaggedQuestions: flaggedCount,
          lastActivityAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      isFlagged: false,
      flaggedCount: flaggedCount,
    };
  } catch (error) {
    console.error("Unflag question error:", error);
    throw error;
  }
};

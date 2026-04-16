import * as gradingRepository from "../repositories/grading.repository";
import * as examRepository from "../repositories/exam.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examAnswerRepository from "../repositories/examAnswer.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import * as classTopicPerformanceRepository from "../repositories/classTopicPerformance.repository";
import * as studentTopicPerformanceRepository from "../repositories/studentTopicPerformance.repository";
import { Class } from "../models/class.schema";
import { Subject } from "../models/subject.schema";
import { Batch } from "../models/batch.schema";
import {
  GetGradingListRequest,
  GetGradingListResponse,
  GradingListItem,
  GetExamGradingDetailsResponse,
  GetStudentAnswersRequest,
  GetStudentAnswersResponse,
  SubmitGradingRequest,
  SubmitGradingResponse,
  QuestionAnswerForGrading,
} from "@/types/grading.types";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { sourceContentService } from "./sourceContent.service";
import { AIGradingRequestData } from "@/types/grading.types";
import mongoose from "mongoose";

/**
 * Grading Service - Business logic for teacher grading operations
 */

// Get grading list for teacher
export const getGradingList = async (
  params: GetGradingListRequest & { teacherId: string; tenantId: string },
): Promise<GetGradingListResponse> => {
  try {
    // Get exams for grading
    const filters: {
      gradingTypeStatus?: string;
      search?: string;
      classId?: string;
      class?: string;
      subjectId?: string;
      batchId?: string;
      examModeId?: string;
      clientTime?: string;
    } = {
      gradingTypeStatus: params.gradingTypeStatus,
      search: params.search,
      classId: params.classId,
      class: params.class,
      subjectId: params.subjectId,
      batchId: params.batchId,
      examModeId: params.examModeId,
      clientTime: params.clientTime,
    };

    const exams = await gradingRepository.findExamsForGrading(
      params.teacherId,
      params.tenantId,
      filters,
    );

    // Enrich with student counts and meta (class/subject/batch/questions)
    const enrichedExams: GradingListItem[] = await Promise.all(
      exams.map(async (exam) => {
        const studentCounts = await gradingRepository.countStudentsByStatus(
          exam._id.toString(),
        );
        const [numQuestions, questionTypesAgg, cls, subj, batch, gradedExams] =
          await Promise.all([
            examQuestionRepository.countExamQuestions(exam._id.toString()),
            examQuestionRepository.countQuestionsByType(exam._id.toString()),
            Class.findById(exam.classId).lean(),
            Subject.findById(exam.subjectId).lean(),
            Batch.findById(exam.batchId).lean(),
            gradingRepository.countGradedStudents(exam._id.toString()),
          ]);

        const questionTypes = (questionTypesAgg || []).map(
          (qt: any) => qt.type,
        );

        // Calculate grading progress percentage
        const gradingProgress =
          studentCounts.totalStudents > 0
            ? Math.round((gradedExams / studentCounts.totalStudents) * 100)
            : 0;

        // Determine gradingTypeStatus: if all students expired (no attempts and exam ended) or no students, set to Completed
        let gradingTypeStatus = exam.gradingTypeStatus;
        const now = new Date();
        const examEnded = new Date(exam.endOn) < now;

        if (studentCounts.totalStudents === 0) {
          // No students in the class - set to Completed
          gradingTypeStatus = "Completed";
          // Update exam in database if status is different
          if (exam.gradingTypeStatus !== "Completed") {
            await gradingRepository.updateExamGradingStatus(
              exam._id.toString(),
              "Completed",
            );
          }
        } else if (
          examEnded &&
          studentCounts.studentsCompleted === 0 &&
          studentCounts.studentsStarted === 0
        ) {
          // Exam ended and no students attempted - all expired, set to Completed
          gradingTypeStatus = "Completed";
          // Update exam in database if status is different
          if (exam.gradingTypeStatus !== "Completed") {
            await gradingRepository.updateExamGradingStatus(
              exam._id.toString(),
              "Completed",
            );
          }
        }

        return {
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          gradingTypeStatus: gradingTypeStatus,
          totalStudents: studentCounts.totalStudents,
          studentsCompleted: studentCounts.studentsCompleted,
          studentsStarted: studentCounts.studentsStarted,
          studentsNotAttempted: studentCounts.studentsNotAttempted,
          numQuestions: numQuestions,
          questionTypes: questionTypes,
          className: (cls && (cls as any).name) || "Class",
          subjectName: (subj && (subj as any).name) || "Subject",
          batchName: (batch && (batch as any).batchName) || "Batch",
          createdAt: exam.createdAt,
          examSubmissions: studentCounts.studentsCompleted,
          gradedExams: gradedExams,
          gradingProgress: gradingProgress,
          examStatus: exam.examStatus,
        };
      }),
    );

    // Sort
    if (params.sortBy && params.sortOrder) {
      enrichedExams.sort((a, b) => {
        const valueA = (a[params.sortBy as keyof GradingListItem] as any) ?? 0;
        const valueB = (b[params.sortBy as keyof GradingListItem] as any) ?? 0;

        if (params.sortOrder === "asc") {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    }

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedExams = enrichedExams.slice(
      startIndex,
      startIndex + pageSize,
    );

    const totalExams = enrichedExams.length;
    const totalPages = Math.ceil(totalExams / pageSize);

    return {
      success: true,
      message: "Grading list retrieved successfully",
      data: {
        exams: paginatedExams,
        pagination: {
          currentPage: pageNo,
          totalPages,
          totalExams,
          pageSize,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
        filters: {
          gradingTypeStatus: params.gradingTypeStatus,
          classId: params.classId,
          class: params.class,
          subjectId: params.subjectId,
        },
      },
    };
  } catch (error) {
    console.error("Get grading list error:", error);
    throw error;
  }
};

// Get exam grading details
export const getExamGradingDetails = async (
  examId: string,
  teacherId: string,
): Promise<GetExamGradingDetailsResponse> => {
  try {
    // Get exam
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Check ownership
    if (exam.teacherId.toString() !== teacherId) {
      throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
    }

    // Get student counts
    const studentCounts = await gradingRepository.countStudentsByStatus(examId);

    // Get exam statistics
    const statistics =
      await gradingRepository.getExamStatisticsForGrading(examId);

    // Meta: question counts/types and names
    const [numQuestions, questionTypesAgg, cls, subj, batch] =
      await Promise.all([
        examQuestionRepository.countExamQuestions(examId),
        examQuestionRepository.countQuestionsByType(examId),
        Class.findById(exam.classId).lean(),
        Subject.findById(exam.subjectId).lean(),
        Batch.findById(exam.batchId).lean(),
      ]);
    const questionTypes = (questionTypesAgg || []).map((qt: any) => qt.type);

    // Get students with their attempts
    const examStudents = await gradingRepository.getStudentsForGrading(examId);

    // Fetch student names from user-api in bulk
    const studentIds = examStudents.map((es) => es.studentId.toString());
    let studentNameMap: Record<string, string> = {};

    try {
      if (studentIds.length > 0) {
        const usersResponse =
          await UserApiIntegrationService.getUsersByIds(studentIds);
        const users = usersResponse?.data?.users || usersResponse?.users || [];

        // Create a map of userId -> fullName
        users.forEach((user: any) => {
          const userId = user._id?.toString() || user.id?.toString();
          if (userId) {
            const fullName = `${user.firstName || ""} ${
              user.lastName || ""
            }`.trim();
            studentNameMap[userId] = fullName || "Student";
          }
        });
      }
    } catch (error) {
      console.error("Error fetching student names from user-api:", error);
      // Continue with default names if user-api fails
    }

    const students = await Promise.all(
      examStudents.map(async (es) => {
        // Get latest attempt
        const attempts =
          await examAttemptRepository.findAttemptsByStudentAndExam(
            es.studentId.toString(),
            examId,
          );

        const latestAttempt = attempts[0];
        const totalQuestionsForExam =
          await examQuestionRepository.countExamQuestions(examId);
        let gradedCount = 0;
        if (latestAttempt) {
          gradedCount = await examAnswerRepository.countGradedAnswersForAttempt(
            latestAttempt._id.toString(),
            es.studentId.toString(),
          );
        }

        const studentIdStr = es.studentId.toString();
        const studentName = studentNameMap[studentIdStr] || "Student";

        // Check if this is an auto-created zero attempt (student didn't actually attempt)
        const isAutoCreatedAttempt =
          latestAttempt &&
          latestAttempt.timeTakenInSeconds === 0 &&
          latestAttempt.startedAt &&
          latestAttempt.submittedAt &&
          Math.abs(
            latestAttempt.startedAt.getTime() -
              latestAttempt.submittedAt.getTime(),
          ) < 5000; // Within 5 seconds (auto-created attempts have same timestamp)

        // Determine status based on attempt existence and attempt status
        let status:
          | "Waiting for Grading"
          | "In Progress"
          | "Completed"
          | "Pending"
          | "Expired";
        const now = new Date();
        const examEnded = new Date(exam.endOn) < now;

        if (!latestAttempt) {
          // No attempt exists - student hasn't attempted the exam
          status = examEnded ? "Expired" : "Pending";
        } else if (isAutoCreatedAttempt) {
          // Auto-created attempt - student didn't actually attempt
          status = examEnded ? "Expired" : "Pending";
        } else {
          // Real attempt exists - determine status based on attempt status and grading progress
          // Priority: Check attempt status first, then check grading progress
          if (latestAttempt.attemptStatus === "Graded") {
            // Attempt is marked as fully graded - status should be Completed
            // Even if student missed some questions, if teacher graded all, status is Completed
            status = "Completed";
          } else if (latestAttempt.attemptStatus === "In Progress") {
            // Attempt status is In Progress - means grading has started
            // Check if all questions are graded (even if student missed some)
            if (
              gradedCount >= totalQuestionsForExam &&
              totalQuestionsForExam > 0
            ) {
              status = "Completed";
            } else if (gradedCount > 0) {
              status = "In Progress";
            } else {
              // This shouldn't happen, but handle it
              status = "Waiting for Grading";
            }
          } else if (
            latestAttempt.attemptStatus === "Submitted" ||
            latestAttempt.attemptStatus === "Paused"
          ) {
            // Submitted or paused - check grading progress
            // If all questions are graded (even if student missed some), status is Completed
            if (
              gradedCount >= totalQuestionsForExam &&
              totalQuestionsForExam > 0
            ) {
              status = "Completed";
            } else if (gradedCount > 0) {
              status = "In Progress";
            } else {
              status = "Waiting for Grading";
            }
          } else {
            // Abandoned or other status - check grading progress
            if (
              gradedCount >= totalQuestionsForExam &&
              totalQuestionsForExam > 0
            ) {
              status = "Completed";
            } else if (gradedCount > 0) {
              status = "In Progress";
            } else {
              status = "Waiting for Grading";
            }
          }
        }

        return {
          studentId: studentIdStr,
          studentName: studentName,
          rollNumber: undefined,
          attemptId: latestAttempt?._id.toString(),
          score: latestAttempt?.obtainedMarks,
          percentage: latestAttempt?.percentage,
          grade: es.grade,
          status: status,
          hasAttempted: !!latestAttempt && !isAutoCreatedAttempt, // False if auto-created attempt
          submittedAt: latestAttempt?.submittedAt,
          timeTaken: latestAttempt?.timeTakenInSeconds,
          questionsGraded: gradedCount,
          questionsPending: Math.max(0, totalQuestionsForExam - gradedCount),
        };
      }),
    );

    // Build per-question stats
    const questions =
      await examQuestionRepository.findQuestionsByExamId(examId);
    const questionSummaries = await Promise.all(
      questions.map(async (q) => {
        const stats = await examAnswerRepository.getQuestionAnswerStatistics(
          q._id.toString(),
          examId,
        );
        const averageMarksObtained = stats.averageMarks || 0;
        const averageMarksPercentage =
          q.marks > 0
            ? Math.round((averageMarksObtained / q.marks) * 100 * 100) / 100
            : 0;
        return {
          questionId: q._id.toString(),
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          questionText: q.questionText,
          questionContent: q.questionContent,
          imageUrl: q.imageUrl,
          videoUrl: q.videoUrl,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          marks: q.marks,
          averageMarksObtained:
            Math.round((averageMarksObtained + Number.EPSILON) * 100) / 100,
          averageMarksPercentage,
          correctPercentage:
            Math.round((stats.successRate + Number.EPSILON) * 100) / 100,
          averageCorrectPercentage: q.averageCorrectPercentage,
        };
      }),
    );

    // Determine gradingTypeStatus based on student statuses
    // If all students have "Expired" status (or no students), set to "Completed"
    let gradingTypeStatus = exam.gradingTypeStatus;

    if (students.length === 0) {
      // No students in the class - set to Completed
      gradingTypeStatus = "Completed";
      // Update exam in database if status is different
      if (exam.gradingTypeStatus !== "Completed") {
        await gradingRepository.updateExamGradingStatus(examId, "Completed");
      }
    } else {
      // Check if all students have "Expired" status
      const allExpired = students.every((s) => s.status === "Expired");
      if (allExpired) {
        // All students expired - set to Completed
        gradingTypeStatus = "Completed";
        // Update exam in database if status is different
        if (exam.gradingTypeStatus !== "Completed") {
          await gradingRepository.updateExamGradingStatus(examId, "Completed");
        }
      }
    }

    // Only send calculated statistics when grading is Completed AND exam is released
    const isReleased = !!exam.releasedAt;
    const shouldIncludeCalculatedStatistics =
      gradingTypeStatus === "Completed" && isReleased;

    const finalStatistics = shouldIncludeCalculatedStatistics
      ? { ...studentCounts, ...statistics }
      : {
          totalStudents: 0,
          studentsCompleted: 0,
          studentsStarted: 0,
          studentsNotAttempted: 0,
          passRate: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
        };

    return {
      success: true,
      message: "Exam grading details retrieved successfully",
      data: {
        exam: {
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          durationInMinutes: exam.durationInMinutes,
          numQuestions: numQuestions,
          questionTypes: questionTypes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          gradingTypeStatus: gradingTypeStatus,
          releasedAt: exam.releasedAt,
          className: (cls && (cls as any).name) || "Class",
          subjectName: (subj && (subj as any).name) || "Subject",
          batchName: (batch && (batch as any).batchName) || "Batch",
        },
        statistics: finalStatistics,
        questions: questionSummaries,
        students,
      },
    };
  } catch (error) {
    console.error("Get exam grading details error:", error);
    throw error;
  }
};

// Get student answers for grading
export const getStudentAnswers = async (
  params: GetStudentAnswersRequest,
): Promise<GetStudentAnswersResponse> => {
  try {
    const { examId, studentId } = params;

    // Get exam to get exam title
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get latest attempt
    const attempts = await examAttemptRepository.findAttemptsByStudentAndExam(
      studentId,
      examId,
    );
    if (attempts.length === 0) {
      throw new Error("NO_ATTEMPT_FOUND");
    }

    const attempt = attempts[0];
    console.log("***** [getStudentAnswers] Found attempt:", attempt);

    // Fetch student name from user-api
    let studentName = "Student";
    try {
      const userResponse =
        await UserApiIntegrationService.getUserById(studentId);
      const user = userResponse?.data || userResponse;
      if (user) {
        const fullName = `${user.firstName || ""} ${
          user.lastName || ""
        }`.trim();
        studentName = fullName || "Student";
      }
    } catch (error) {
      console.error("Error fetching student name from user-api:", error);
      // Continue with default name if user-api fails
    }

    // Get exam questions
    const questions =
      await examQuestionRepository.findQuestionsByExamId(examId);

    // Get student answers
    const answers = await examAnswerRepository.findAnswersByAttemptId(
      attempt._id.toString(),
    );

    // Get topicBreakdown from exam
    const topicBreakdown = (exam as any).topicBreakdown || exam.topicBreakdown;

    // Map questions with answers
    const questionsWithAnswers: QuestionAnswerForGrading[] = questions.map(
      (q) => {
        const answer = answers.find(
          (a) => a.questionId.toString() === q._id.toString(),
        );

        return {
          questionId: q._id.toString(),
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          questionText: q.questionText,
          marks: q.marks,
          correctAnswer: q.correctAnswer,
          studentAnswer: answer?.studentAnswer || "",
          isCorrect:
            answer?.isCorrect === true
              ? true
              : answer?.isCorrect === false
                ? false
                : undefined,
          marksObtained: answer?.marksObtained,
          teacherComment: answer?.teacherComment,
          options: q.options,
          // AI Grading fields
          aiGradingNotes: answer?.aiGradingNotes,
          aiConfidence: answer?.aiConfidence,
          aiFeedback: answer?.aiFeedback,
          aiMarksObtained: answer?.aiMarksObtained,
          gradedBy: answer?.gradedBy,
          aiGradedAt: answer?.aiGradedAt,
        };
      },
    );

    // Build AI grading data if exam has aiExamId (for new exam flow)
    let aiGradingData: AIGradingRequestData | undefined;
    if (exam.aiExamId && topicBreakdown && topicBreakdown.length > 0) {
      // Sort questions by questionNumber to ensure correct order
      const sortedQuestions = [...questions].sort((a, b) => {
        const numA = a.questionNumber || 0;
        const numB = b.questionNumber || 0;
        return numA - numB;
      });

      // Map questions to topics based on topicBreakdown using questionNumber ranges
      const questionsWithTopics = sortedQuestions.map((question) => {
        let topic = "Other";
        const questionNum = question.questionNumber || 0;
        let startQuestionNum = 1;

        if (topicBreakdown && topicBreakdown.length > 0) {
          for (const topicInfo of topicBreakdown) {
            const endQuestionNum =
              startQuestionNum + topicInfo.questionCount - 1;

            if (
              questionNum >= startQuestionNum &&
              questionNum <= endQuestionNum
            ) {
              topic = topicInfo.topic;
              break;
            }

            startQuestionNum = endQuestionNum + 1;
          }
        }

        return { ...question, topic };
      });

      // Build questions array with answers and topics for AI grading
      const aiGradingQuestions = questionsWithTopics
        .filter((question) => {
          return (
            question._id &&
            question.questionText &&
            question.questionType &&
            question.marks
          );
        })
        .map((question) => {
          const answer = answers.find(
            (a) => a.questionId.toString() === question._id.toString(),
          );

          let studentAnswer = answer?.studentAnswer;
          if (studentAnswer === null || studentAnswer === undefined) {
            studentAnswer = "";
          }

          return {
            questionId: question._id.toString(),
            questionText: question.questionText,
            correctAnswer:
              question.questionType === "Short Answers" ||
              question.questionType === "Long Answers"
                ? undefined
                : question.correctAnswer,
            explanation: question.explanation,
            studentAnswer: studentAnswer,
            questionType: question.questionType,
            maxMarks: question.marks,
            difficulty: question.difficulty,
            topic: question.topic,
          };
        });

      // Build AI grading request data
      aiGradingData = {
        feAttemptId: attempt._id.toString(),
        ai_examId: exam.aiExamId,
        feStudentId: attempt.studentId.toString(),
        questions: aiGradingQuestions,
        topicBreakdown: topicBreakdown,
      };
    }

    return {
      success: true,
      message: "Student answers retrieved successfully",
      data: {
        attemptId: attempt._id.toString(),
        studentId: studentId,
        studentName: studentName,
        examId: examId,
        examTitle: exam.examTitle,
        totalMarks: attempt.totalMarks,
        submittedAt: attempt.submittedAt,
        timeTaken: attempt.timeTakenInSeconds,
        teacherFeedback: attempt.teacherFeedback,
        grade: attempt.grade,
        result: attempt.result,
        percentage: attempt.percentage,
        questionsGraded:
          await examAnswerRepository.countGradedAnswersForAttempt(
            attempt._id.toString(),
            studentId,
          ),
        questionsPending: Math.max(
          0,
          (await examQuestionRepository.countExamQuestions(examId)) -
            (await examAnswerRepository.countGradedAnswersForAttempt(
              attempt._id.toString(),
              studentId,
            )),
        ),
        questions: questionsWithAnswers,
        aiGradingData: aiGradingData,
        // Attempt-level AI data
        overallFeedback: attempt.aiFeedback,
        gapAnalysis: attempt.gapAnalysis,
        weakTopics: attempt.weakTopics,
      },
    };
  } catch (error) {
    console.error("Get student answers error:", error);
    throw error;
  }
};

// Submit grading for a student
export const submitGrading = async (
  data: SubmitGradingRequest,
  teacherId: string,
  tenantId: string,
): Promise<SubmitGradingResponse> => {
  try {
    // feedback is aiFeedback and overallFeedback is teacherFeedback
    const {
      examId,
      studentId,
      attemptId,
      answers,
      aiFeedback: feedback,
      aiPrompt,
      recommendedResources,
      teacherFeedback: overallFeedback,
      gapAnalysis,
      weakTopics,
      aiResponse,
    } = data;

    // Get exam
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Check ownership
    if (exam.teacherId.toString() !== teacherId) {
      throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
    }

    // Get attempt
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Update each provided answer with marks and comments (supports partial/incremental grading)
    // AI grading data is merged directly into each answer object
    for (const answer of answers) {
      // Load question to detect type
      const question = await examQuestionRepository.findExamQuestionById(
        answer.questionId,
      );
      if (!question) {
        continue;
      }

      // Determine grading source based on what data is present
      const hasTeacherData =
        typeof answer.marksObtained === "number" ||
        answer.teacherComment ||
        answer.feedback;
      const hasAIData =
        answer.aiGradingNotes !== undefined ||
        answer.aiConfidence !== undefined ||
        answer.aiFeedback !== undefined ||
        answer.aiMarksObtained !== undefined ||
        answer.isCorrect !== undefined;

      let gradedBy: "manual" | "ai" | "hybrid" = "manual";
      if (hasTeacherData && hasAIData) {
        gradedBy = "hybrid";
      } else if (hasAIData && !hasTeacherData) {
        gradedBy = "ai";
      }

      // Prepare update data with both teacher and AI fields
      const updateData: any = {};

      // For MCQs, Fill in the Blanks, and True/False - auto-evaluate using student's saved answer
      if (
        question.questionType === "MCQs" ||
        question.questionType === "Fill in the Blanks" ||
        question.questionType === "True/False"
      ) {
        const saved = await examAnswerRepository.findAnswerByAttemptAndQuestion(
          attemptId,
          answer.questionId,
        );
        const studentAns = saved?.studentAnswer;
        const correct = saved?.correctAnswer;

        // Auto-evaluate based on question type
        let isCorrect = false;

        if (Array.isArray(correct)) {
          // Multiple correct answers (MCQs with multiple correct options)
          if (Array.isArray(studentAns)) {
            isCorrect =
              correct.length === (studentAns as any).length &&
              correct.every((v: any) => (studentAns as any).includes(v));
          }
        } else {
          // Single correct answer (MCQs, Fill in the Blanks, True/False)
          if (typeof correct === "string" && typeof studentAns === "string") {
            // Normalize comparison for text answers
            isCorrect =
              correct.trim().toLowerCase() === studentAns.trim().toLowerCase();
          } else {
            // Exact match for numbers or other types
            isCorrect = studentAns === correct;
          }
        }

        // Teacher's marks take precedence, but if not provided, use AI marks or auto-calculated
        if (typeof answer.marksObtained === "number") {
          updateData.marksObtained = answer.marksObtained;
          // If isCorrect is explicitly provided in payload, use it; otherwise use auto-calculated
          updateData.isCorrect =
            answer.isCorrect !== undefined ? answer.isCorrect : isCorrect;
        } else if (answer.aiMarksObtained !== undefined) {
          updateData.marksObtained = answer.aiMarksObtained;
          // Use AI's isCorrect if provided, otherwise use auto-calculated
          updateData.isCorrect =
            answer.isCorrect !== undefined ? answer.isCorrect : isCorrect;
        } else {
          updateData.marksObtained = isCorrect ? question.marks : 0;
          updateData.isCorrect = isCorrect;
        }

        // Ensure isCorrect is set - prioritize payload value if provided
        if (answer.isCorrect !== undefined) {
          updateData.isCorrect = answer.isCorrect;
        } else if (updateData.isCorrect === undefined) {
          updateData.isCorrect = isCorrect;
        }

        updateData.teacherComment = answer.teacherComment;
        updateData.feedback = answer.feedback; // Teacher feedback
        updateData.isGraded = true;
      } else {
        // Subjective types (Short Answers, Long Answers): manual grading only
        const hasMarks = typeof answer.marksObtained === "number";

        // Set isCorrect based on marks: full marks = true, partial = false, zero = false
        // But prioritize isCorrect from payload if explicitly provided
        if (hasMarks) {
          updateData.marksObtained = answer.marksObtained;
          // If isCorrect is explicitly provided in payload, use it; otherwise auto-calculate
          if (answer.isCorrect !== undefined) {
            updateData.isCorrect = answer.isCorrect;
          } else {
            const isCorrect = answer.marksObtained === question.marks;
            updateData.isCorrect = isCorrect;
          }
        } else if (answer.aiMarksObtained !== undefined) {
          // Use AI marks if teacher didn't provide marks
          updateData.marksObtained = answer.aiMarksObtained;
          updateData.isCorrect =
            answer.isCorrect !== undefined ? answer.isCorrect : false;
        } else {
          // Set isCorrect if provided by AI
          if (answer.isCorrect !== undefined) {
            updateData.isCorrect = answer.isCorrect;
          }
        }

        updateData.teacherComment = answer.teacherComment;
        updateData.feedback = answer.feedback; // Teacher feedback
        updateData.isGraded = true;
      }

      // Add AI grading data from answer object (merged format)
      if (answer.aiGradingNotes !== undefined)
        updateData.aiGradingNotes = answer.aiGradingNotes;
      if (answer.aiConfidence !== undefined)
        updateData.aiConfidence = answer.aiConfidence;
      if (answer.aiFeedback !== undefined)
        updateData.aiFeedback = answer.aiFeedback;
      if (answer.aiMarksObtained !== undefined)
        updateData.aiMarksObtained = answer.aiMarksObtained;

      // Set aiGradedAt if AI data is present
      if (hasAIData) {
        updateData.aiGradedAt = new Date();
      }

      // Set gradedBy field
      updateData.gradedBy = gradedBy;

      // Check if answer exists, if not create it (for questions student didn't attempt)
      const existingAnswer =
        await examAnswerRepository.findAnswerByAttemptAndQuestion(
          attemptId,
          answer.questionId,
        );

      if (existingAnswer) {
        // Update existing answer
        await examAnswerRepository.updateExamAnswer(
          attemptId,
          answer.questionId,
          updateData,
        );
      } else {
        // Create new answer record for question student didn't attempt
        // Question is already loaded at the beginning of the loop
        await examAnswerRepository.upsertExamAnswer(
          attemptId,
          answer.questionId,
          {
            attemptId: new mongoose.Types.ObjectId(attemptId),
            examId: new mongoose.Types.ObjectId(examId),
            questionId: new mongoose.Types.ObjectId(answer.questionId),
            studentId: new mongoose.Types.ObjectId(studentId),
            questionNumber: question.questionNumber,
            questionType: question.questionType,
            studentAnswer: null, // Student didn't attempt
            correctAnswer: question.correctAnswer,
            maxMarks: question.marks,
            timeTakenInSeconds: 0,
            tenantId: attempt.tenantId,
            ...updateData, // Include all grading data
          },
        );
      }

      // Update question aggregates
      await gradingRepository.updateQuestionAverageCorrectPercentage(
        examId,
        answer.questionId,
      );
    }

    // Recalculate totals across ALL graded answers for this attempt
    const totalMarksObtained =
      await examAnswerRepository.calculateTotalMarksForAttempt(attemptId);
    const percentage = (totalMarksObtained / exam.totalMarks) * 100;

    // Get grading system for tenant
    const gradingSystem =
      await gradingSystemRepository.findActiveGradingSystem(tenantId);

    // Calculate grade
    let grade = "F";
    if (gradingSystem && gradingSystem.gradeRanges) {
      for (const range of gradingSystem.gradeRanges) {
        if (
          percentage >= range.minPercentage &&
          percentage <= range.maxPercentage
        ) {
          grade = range.grade;
          break;
        }
      }
    }

    // Determine result based on grade: if grade is 'F' then 'Fail', otherwise 'Pass'
    const result = grade === "F" ? "Fail" : "Pass";

    // Determine if all answers graded
    const totalQuestions =
      await examQuestionRepository.countExamQuestions(examId);
    const gradedCount = await examAnswerRepository.countGradedAnswersForAttempt(
      attemptId,
      studentId,
    );
    const isFullyGraded = gradedCount >= totalQuestions && totalQuestions > 0;

    // Update attempt with marks and AI grading data
    const attemptUpdateData: any = {
      obtainedMarks: totalMarksObtained,
      percentage: Math.round(percentage * 100) / 100,
      result: result,
      grade: grade,
      attemptStatus: isFullyGraded ? "Graded" : "In Progress",
    };

    // Add AI grading analysis fields if provided
    if (overallFeedback !== undefined) {
      attemptUpdateData.teacherFeedback = overallFeedback;
    }
    if (feedback !== undefined) {
      attemptUpdateData.overallAssessment = feedback; // Per-exam AI feedback
    }
    if (gapAnalysis !== undefined) {
      attemptUpdateData.gapAnalysis = gapAnalysis;
    }
    if (weakTopics !== undefined && weakTopics.length > 0) {
      attemptUpdateData.weakTopics = weakTopics;
    }
    if (aiResponse !== undefined) {
      attemptUpdateData.aiResponse = aiResponse;
    }

    await examAttemptRepository.updateAttemptMarks(
      attemptId,
      attemptUpdateData,
    );

    // Update exam student with grade
    await gradingRepository.updateExamStudentGradingStatus(
      examId,
      studentId,
      isFullyGraded ? "Completed" : "In Progress",
      grade,
      Math.round(percentage * 100) / 100,
    );

    // Add feedback if provided
    if (feedback) {
      await gradingRepository.addFeedbackToExamStudent(examId, studentId, {
        comment: feedback,
        createdBy: new mongoose.Types.ObjectId(teacherId),
      });
    }

    // Add AI prompt if provided
    if (aiPrompt) {
      await gradingRepository.addAIPromptToExamStudent(examId, studentId, {
        prompt: aiPrompt,
        createdBy: new mongoose.Types.ObjectId(teacherId),
      });
    }

    // Add recommended resources if provided
    if (recommendedResources && recommendedResources.length > 0) {
      await gradingRepository.addRecommendedResourcesToExamStudent(
        examId,
        studentId,
        recommendedResources.map((r) => ({
          ...r,
          createdBy: new mongoose.Types.ObjectId(teacherId),
        })),
      );
    }

    // Check if all students are graded
    const allGraded = await gradingRepository.checkAllStudentsGraded(examId);
    if (allGraded) {
      await gradingRepository.updateExamGradingStatus(examId, "Completed");
    } else {
      // Set to In Progress if not all graded
      await gradingRepository.updateExamGradingStatus(examId, "In Progress");
    }

    // Call AI service to update analytics after grading (async, don't block the response)
    // console.log(`[submitGrading] Analytics update check:`, {
    //   studentId,
    //   examId,
    //   tenantId,
    //   isFullyGraded,
    //   totalQuestions,
    //   gradedCount,
    //   willCallUpdateAnalytics: isFullyGraded,
    // });

    // if (isFullyGraded) {
    //   console.log(
    //     `[submitGrading] ✅ Calling updateAnalyticsForReleasedExam for student ${studentId}`,
    //   );
    //   try {
    //     const { updateAnalyticsForReleasedExam } =
    //       await import("./exam.service");
    //     console.log(
    //       `[submitGrading] 📡 About to POST to update-analytics for examId: ${examId}, studentId: ${studentId}`,
    //     );
    //     await updateAnalyticsForReleasedExam(examId, tenantId, { studentId });
    //     console.log(
    //       `[submitGrading] ✅ Successfully updated analytics for student ${studentId}`,
    //     );
    //   } catch (error: any) {
    //     // Log error but don't fail the grading submission
    //     console.error(
    //       `[submitGrading] ❌ Error updating analytics for student ${studentId}:`,
    //       {
    //         message: error.message,
    //         response: error.response?.data,
    //         status: error.response?.status,
    //         stack: error.stack,
    //       },
    //     );
    //   }
    // } else {
    //   console.log(
    //     `[submitGrading] ⏭️ Skipping analytics update - student exam not fully graded yet (${gradedCount}/${totalQuestions} graded)`,
    //   );
    // }

    // We only update analytics on teacher-initiated exam release/publish.
    // Previous behavior triggered analytics here when `isFullyGraded` was true.
    // That call has been removed to ensure analytics run only on explicit exam release.

    // Update topic performance aggregation (async, don't wait for it)
    if (exam.classId && exam.subjectId && tenantId) {
      console.log("[submitGrading] Preparing to update topic performance:", {
        examId,
        examIdType: typeof examId,
        classId: exam.classId,
        classIdType: typeof exam.classId,
        classIdIsObjectId: exam.classId instanceof mongoose.Types.ObjectId,
        subjectId: exam.subjectId,
        subjectIdType: typeof exam.subjectId,
        subjectIdIsObjectId: exam.subjectId instanceof mongoose.Types.ObjectId,
        tenantId,
        tenantIdType: typeof tenantId,
      });

      // Helper to safely convert to string
      const safeToString = (value: any, fieldName: string): string => {
        console.log(`[submitGrading] Converting ${fieldName}:`, {
          value,
          type: typeof value,
          isObjectId: value instanceof mongoose.Types.ObjectId,
          stringValue: String(value),
          has_id: value && typeof value === "object" && "_id" in value,
          has_id_value:
            value && typeof value === "object" ? value._id : undefined,
        });

        if (typeof value === "string") {
          console.log(
            `[submitGrading] ${fieldName} is already a string:`,
            value,
          );
          return value;
        }
        if (value instanceof mongoose.Types.ObjectId) {
          const str = value.toString();
          console.log(
            `[submitGrading] ${fieldName} ObjectId converted to:`,
            str,
          );
          return str;
        }
        // If it's an object, try to get the string representation
        if (value && typeof value === "object") {
          // Try _id first (common in Mongoose)
          if (value._id) {
            console.log(
              `[submitGrading] ${fieldName} has _id property:`,
              value._id,
            );
            return safeToString(value._id, `${fieldName}._id`);
          }
          // Try id property
          if (value.id) {
            console.log(
              `[submitGrading] ${fieldName} has id property:`,
              value.id,
            );
            return safeToString(value.id, `${fieldName}.id`);
          }
          // Try toString if available
          if (typeof value.toString === "function") {
            const str = value.toString();
            console.log(
              `[submitGrading] ${fieldName} toString() returned:`,
              str,
            );
            if (str !== "[object Object]" && /^[0-9a-fA-F]{24}$/.test(str)) {
              return str;
            }
          }
        }
        // Last resort
        const str = String(value);
        console.log(
          `[submitGrading] ${fieldName} final conversion (may be [object Object]):`,
          str,
        );
        return str;
      };

      const classIdStr = safeToString(exam.classId, "classId");
      const subjectIdStr = safeToString(exam.subjectId, "subjectId");
      const tenantIdStr = safeToString(tenantId, "tenantId");
      const examIdStr = safeToString(examId, "examId");

      console.log(
        "[submitGrading] Converted IDs before passing to updateTopicPerformanceForExam:",
        {
          classIdStr,
          subjectIdStr,
          tenantIdStr,
          examIdStr,
        },
      );

      // Update topic performance asynchronously (don't block the response)
      updateTopicPerformanceForExam(
        examIdStr,
        classIdStr,
        subjectIdStr,
        tenantIdStr,
      ).catch((error) => {
        console.error("[submitGrading] Error updating topic performance:", {
          error: error.message,
          stack: error.stack,
          examId: examIdStr,
          classId: classIdStr,
          subjectId: subjectIdStr,
          tenantId: tenantIdStr,
        });
        // Don't throw - this is a background operation that shouldn't fail the grading submission
      });
    } else {
      console.warn(
        "Skipping topic performance update - missing classId, subjectId, or tenantId",
        {
          hasClassId: !!exam.classId,
          hasSubjectId: !!exam.subjectId,
          hasTenantId: !!tenantId,
        },
      );
    }

    return {
      success: true,
      message: "Grading submitted successfully",
      data: {
        attemptId,
        studentId,
        totalMarksObtained,
        totalMarks: exam.totalMarks,
        percentage: Math.round(percentage * 100) / 100,
        grade,
        result: result as "Pass" | "Fail",
        gradingCompletedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Submit grading error:", error);
    throw error;
  }
};

// AI Grading Helper Methods

/**
 * Update answer with AI grading results
 */
export const updateAnswerWithAIGrading = async (
  attemptId: string,
  questionId: string,
  gradingData: {
    marksObtained: number;
    isCorrect: boolean;
    feedback?: string;
  },
): Promise<void> => {
  try {
    await examAnswerRepository.updateExamAnswer(attemptId, questionId, {
      marksObtained: gradingData.marksObtained,
      isCorrect: gradingData.isCorrect,
      feedback: gradingData.feedback,
    });
  } catch (error) {
    console.error("Error updating answer with AI grading:", error);
    throw error;
  }
};

/**
 * Update attempt after AI grading
 */
export const updateAttemptAfterAIGrading = async (
  attemptId: string,
  gradingResult: {
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
    overallFeedback?: string;
    overallAssessment?: string;
    gapAnalysis?: string;
    weakTopics?: Array<{
      topic: string;
      performance: number;
      suggestions: string;
    }>;
  },
): Promise<void> => {
  try {
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("Attempt not found");
    }

    const exam = await examRepository.findExamById(attempt.examId.toString());
    if (!exam) {
      throw new Error("Exam not found");
    }

    // Calculate grade
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
      attempt.tenantId.toString(),
    );

    let grade = "F";
    if (gradingSystem && gradingSystem.gradeRanges) {
      for (const range of gradingSystem.gradeRanges) {
        if (
          gradingResult.percentage >= range.minPercentage &&
          gradingResult.percentage <= range.maxPercentage
        ) {
          grade = range.grade;
          break;
        }
      }
    }

    // Determine result
    const result = gradingResult.percentage >= 50 ? "Pass" : "Fail";

    // Check if all questions are graded (count answers with isCorrect set or marksObtained > 0)
    const totalQuestions = await examQuestionRepository.countExamQuestions(
      exam._id.toString(),
    );
    // Count answers that have been graded (isCorrect is not null or marksObtained > 0)
    const answers =
      await examAnswerRepository.findAnswersByAttemptId(attemptId);
    const gradedCount = answers.filter(
      (a) => a.isCorrect !== null || a.marksObtained > 0,
    ).length;
    const isFullyGraded = gradedCount >= totalQuestions && totalQuestions > 0;

    // Update attempt
    await examAttemptRepository.updateAttemptMarks(attemptId, {
      obtainedMarks: gradingResult.totalMarksObtained,
      percentage: gradingResult.percentage,
      result: result,
      grade: grade,
      attemptStatus: isFullyGraded ? "Graded" : "Submitted",
      overallFeedback: gradingResult.overallFeedback,
      overallAssessment: gradingResult.overallAssessment,
      gapAnalysis: gradingResult.gapAnalysis,
      weakTopics: gradingResult.weakTopics,
    });

    // Update exam student
    await gradingRepository.updateExamStudentGradingStatus(
      exam._id.toString(),
      attempt.studentId.toString(),
      isFullyGraded ? "Completed" : "In Progress",
      grade,
      gradingResult.percentage,
    );
  } catch (error) {
    console.error("Error updating attempt after AI grading:", error);
    throw error;
  }
};

/**
 * Get all submitted attempts for an exam
 */
export const getSubmittedAttemptsForExam = async (
  examId: string,
  tenantId?: string,
): Promise<any[]> => {
  try {
    // Get exam to get tenantId if not provided
    if (!tenantId) {
      const exam = await examRepository.findExamById(examId);
      if (!exam) {
        throw new Error("Exam not found");
      }
      tenantId = exam.tenantId.toString();
    }

    return await examAttemptRepository.getAttemptsNeedingGrading(
      examId,
      tenantId,
    );
  } catch (error) {
    console.error("Error getting submitted attempts:", error);
    throw error;
  }
};

// Get grading statistics by class
export const getGradingStatisticsByClass = async (
  classId: string,
  subjectId: string,
  tenantId: string,
  gradingType?: string,
  examType?: string,
): Promise<{
  success: boolean;
  message: string;
  data: {
    totalExams: number;
    inProgressCount: number;
    waitingForGradingCount: number;
    completedCount: number;
  };
}> => {
  try {
    if (!classId) {
      throw new Error("Class ID is required");
    }

    if (!subjectId) {
      throw new Error("Subject ID is required");
    }

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    const statistics = await gradingRepository.getGradingStatisticsByClass(
      classId,
      subjectId,
      tenantId,
      gradingType,
      examType,
    );

    return {
      success: true,
      message: "Grading statistics retrieved successfully",
      data: statistics,
    };
  } catch (error: any) {
    console.error("Get grading statistics by class error:", error);
    throw new Error(`Failed to get grading statistics: ${error.message}`);
  }
};

// Get grading statistics for teacher across all assigned classes and subjects
export const getGradingStatisticsForTeacher = async (
  teacherId: string,
  tenantId: string,
  gradingType?: string,
  examType?: string,
  batchId?: string,
  examModeId?: string,
): Promise<{
  success: boolean;
  message: string;
  data: {
    totalExams: number;
    inProgressCount: number;
    waitingForGradingCount: number;
    completedCount: number;
  };
}> => {
  try {
    if (!teacherId) {
      throw new Error("Teacher ID is required");
    }

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    const statistics = await gradingRepository.getGradingStatisticsForTeacher(
      teacherId,
      tenantId,
      gradingType,
      examType,
      batchId,
      examModeId,
    );

    return {
      success: true,
      message: "Grading statistics retrieved successfully",
      data: statistics,
    };
  } catch (error: any) {
    console.error("Get grading statistics for teacher error:", error);
    throw new Error(`Failed to get grading statistics: ${error.message}`);
  }
};

/**
 * Update topic performance aggregation for an exam
 * Calculates topic-wise performance across all graded attempts
 */
const updateTopicPerformanceForExam = async (
  examId: string,
  classId: string,
  subjectId: string,
  tenantId: string,
): Promise<void> => {
  try {
    // Get exam to access topicBreakdown
    const exam = await examRepository.findExamById(examId);
    if (!exam || !exam.topicBreakdown || exam.topicBreakdown.length === 0) {
      console.log(
        `No topic breakdown found for exam ${examId}, skipping topic performance update`,
      );
      return;
    }

    // Get all questions for the exam
    const questions =
      await examQuestionRepository.findQuestionsByExamId(examId);
    if (questions.length === 0) {
      console.log(
        `No questions found for exam ${examId}, skipping topic performance update`,
      );
      return;
    }

    // Map questions to topics based on topicBreakdown
    // topicBreakdown uses questionNumber ranges
    const sortedQuestions = [...questions].sort((a, b) => {
      const numA = a.questionNumber || 0;
      const numB = b.questionNumber || 0;
      return numA - numB;
    });

    const questionTopicMap = new Map<string, string>(); // questionId -> topicName
    let startQuestionNum = 1;

    for (const topicInfo of exam.topicBreakdown) {
      const endQuestionNum = startQuestionNum + topicInfo.questionCount - 1;
      for (
        let i = startQuestionNum;
        i <= endQuestionNum && i <= sortedQuestions.length;
        i++
      ) {
        const question = sortedQuestions[i - 1];
        if (question) {
          questionTopicMap.set(question._id.toString(), topicInfo.topic);
        }
      }
      startQuestionNum = endQuestionNum + 1;
    }

    // Get all attempts for this exam - include both "Graded" and "In Progress" attempts
    // since partial grading should also be tracked
    const allAttempts =
      await examAttemptRepository.findAttemptsByExamId(examId);
    const gradedAttempts = allAttempts.filter(
      (a) =>
        (a.attemptStatus === "Graded" || a.attemptStatus === "In Progress") &&
        !a.isDeleted,
    );

    if (gradedAttempts.length === 0) {
      console.log(
        `No graded or in-progress attempts found for exam ${examId}, skipping topic performance update`,
      );
      return;
    }

    console.log(
      `[updateTopicPerformanceForExam] Processing ${gradedAttempts.length} attempts (Graded + In Progress) for exam ${examId}`,
    );

    // For each topic, calculate performance
    for (const topicInfo of exam.topicBreakdown) {
      const topicName = topicInfo.topic;
      const topicWeightage = topicInfo.percentage;
      const topicTotalMarks = topicInfo.totalMarks;

      // Get questions for this topic
      const topicQuestionIds: string[] = [];
      for (const [questionId, mappedTopic] of questionTopicMap.entries()) {
        if (mappedTopic === topicName) {
          topicQuestionIds.push(questionId);
        }
      }

      if (topicQuestionIds.length === 0) {
        console.log(
          `No questions found for topic ${topicName} in exam ${examId}`,
        );
        continue;
      }

      // Calculate performance for this topic across all graded attempts
      let totalMarksObtained = 0;
      let totalMarksPossible = 0;
      const studentsWithAttempts = new Set<string>();

      for (const attempt of gradedAttempts) {
        // Get all answers for this attempt
        const answers = await examAnswerRepository.findAnswersByAttemptId(
          attempt._id.toString(),
        );

        // Filter answers for this topic
        const topicAnswers = answers.filter((a) =>
          topicQuestionIds.includes(a.questionId.toString()),
        );

        if (topicAnswers.length > 0) {
          studentsWithAttempts.add(attempt.studentId.toString());

          // Calculate marks for this student in this topic
          let studentMarksObtained = 0;
          let studentMarksPossible = 0;

          for (const answer of topicAnswers) {
            const question = questions.find(
              (q) => q._id.toString() === answer.questionId.toString(),
            );
            if (question) {
              studentMarksPossible += question.marks;
              studentMarksObtained += answer.marksObtained || 0;
            }
          }

          totalMarksObtained += studentMarksObtained;
          totalMarksPossible += studentMarksPossible;
        }
      }

      // Calculate average performance
      const totalStudents = studentsWithAttempts.size;
      const averagePerformance =
        totalMarksPossible > 0
          ? (totalMarksObtained / totalMarksPossible) * 100
          : 0;

      // Ensure examId is a string (not an object) - examId parameter is string, but double-check
      const examIdStr =
        typeof examId === "string"
          ? examId
          : (examId as any) instanceof mongoose.Types.ObjectId
            ? (examId as any).toString()
            : examId && typeof examId === "object" && (examId as any)._id
              ? typeof (examId as any)._id === "string"
                ? (examId as any)._id
                : (examId as any)._id.toString()
              : String(examId);

      console.log(
        "[updateTopicPerformanceForExam] Calculating topic performance for topic:",
        {
          topicName,
          totalMarksObtained,
          totalMarksPossible,
          totalStudents,
          averagePerformance: Math.round(averagePerformance * 100) / 100,
          examId: examIdStr,
        },
      );

      // Upsert class topic performance - ensure all IDs are strings
      // The repository will handle case-insensitive topic matching and update/create accordingly
      const classTopicPerf =
        await classTopicPerformanceRepository.upsertTopicPerformance({
          classId: typeof classId === "string" ? classId : String(classId),
          subjectId:
            typeof subjectId === "string" ? subjectId : String(subjectId),
          examId: examIdStr,
          tenantId: typeof tenantId === "string" ? tenantId : String(tenantId),
          topicName,
          weightageInExam: topicWeightage,
          totalMarks: topicTotalMarks,
          totalStudents,
          averagePerformance: Math.round(averagePerformance * 100) / 100,
          totalMarksObtained,
          totalMarksPossible,
        });

      console.log(
        `[updateTopicPerformanceForExam] Successfully saved/updated class topic performance for "${classTopicPerf.topicName}"`,
      );

      // Calculate and store student-level topic performance
      for (const attempt of gradedAttempts) {
        const studentId = attempt.studentId.toString();

        // Get all answers for this student's attempt
        const answers = await examAnswerRepository.findAnswersByAttemptId(
          attempt._id.toString(),
        );

        // Filter answers for this topic
        const topicAnswers = answers.filter((a) =>
          topicQuestionIds.includes(a.questionId.toString()),
        );

        if (topicAnswers.length > 0) {
          // Calculate marks for this student in this topic
          let studentMarksObtained = 0;
          let studentMarksPossible = 0;

          for (const answer of topicAnswers) {
            const question = questions.find(
              (q) => q._id.toString() === answer.questionId.toString(),
            );
            if (question) {
              studentMarksPossible += question.marks;
              studentMarksObtained += answer.marksObtained || 0;
            }
          }

          // Calculate student's performance percentage for this topic
          const studentPerformance =
            studentMarksPossible > 0
              ? (studentMarksObtained / studentMarksPossible) * 100
              : 0;

          // Store student topic performance
          // The repository will handle case-insensitive topic matching and update/create accordingly
          const studentTopicPerf =
            await studentTopicPerformanceRepository.upsertStudentTopicPerformance(
              {
                studentId: studentId,
                classId:
                  typeof classId === "string" ? classId : String(classId),
                subjectId:
                  typeof subjectId === "string" ? subjectId : String(subjectId),
                examId: examIdStr,
                tenantId:
                  typeof tenantId === "string" ? tenantId : String(tenantId),
                topicName,
                weightageInExam: topicWeightage,
                totalMarks: topicTotalMarks,
                marksObtained: studentMarksObtained,
                marksPossible: studentMarksPossible,
                performance: Math.round(studentPerformance * 100) / 100,
              },
            );

          console.log(
            `[updateTopicPerformanceForExam] Successfully saved/updated student topic performance for student ${studentId}, topic "${studentTopicPerf.topicName}"`,
          );
        }
      }
    }

    console.log(`Topic performance updated for exam ${examId}`);
  } catch (error: any) {
    console.error(
      `Error updating topic performance for exam ${examId}:`,
      error,
    );
    throw error;
  }
};

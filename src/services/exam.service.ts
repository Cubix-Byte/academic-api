import * as examRepository from "../repositories/exam.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examStudentRepository from "../repositories/examStudent.repository";
import * as examStudentAssignmentRepository from "../repositories/studentExams.repository";
import * as examContentRepository from "../repositories/examContent.repository";
import * as examAIPromptHistoryRepository from "../repositories/examAiPromptHistory.repository";
import * as examSettingsRepository from "../repositories/examSettings.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examAnswerRepository from "../repositories/examAnswer.repository";
import * as gradingRepository from "../repositories/grading.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import * as gradingSystemService from "./gradingSystem.service";
import * as activityLogService from "./activityLog.service";
import * as notificationService from "./notification.service";
import * as parentChildService from "./parentChild.service";
import axios from "axios";
import { SubjectRepository } from "../repositories/subject.repository";
import {
  buildActivityDescription,
  fetchUserNames,
} from "@/utils/activityLog.helper";
import { retryOnWriteConflict } from "@/utils/retry.util";
import { IExam } from "@/models";
import { IExamQuestion } from "@/models";
import {
  CreateExamRequest,
  UpdateExamRequest,
  GetAllExamsRequest,
  GetAllExamsResponse,
  ExamStatistics,
  ExamWithQuestionsResponse,
  AssignStudentsRequest,
  AssignStudentsResponse,
  ExamCardData,
  CreateExamWithNestedDataRequest,
  CreateExamWithNestedDataResponse,
  SchoolPerformanceResponse,
} from "@/types/exam.types";
import {
  CreateExamQuestionRequest,
  UpdateExamQuestionRequest,
  GetAllExamQuestionsRequest,
  GetAllExamQuestionsResponse,
  BulkCreateQuestionsRequest,
  BulkCreateQuestionsResponse,
  ReorderQuestionsRequest,
} from "@/types/examQuestion.types";
import { TransactionHelper } from "../utils/shared-lib-imports";
import mongoose from "mongoose";

/**
 * Exam Service - Business logic for exam management
 */

// Create new exam with nested data (questions, students, contents, etc.)
export const createExamWithNestedData = async (
  data: CreateExamWithNestedDataRequest,
  tenantId: string,
  teacherId: string,
): Promise<CreateExamWithNestedDataResponse> => {
  const result = (await TransactionHelper.executeWithTransaction(
    async (session: mongoose.ClientSession) => {
      try {
        // Validate dates
        const startDate = new Date(data.startOn);
        const endDate = new Date(data.endOn);

        if (endDate <= startDate) {
          throw new Error("END_DATE_BEFORE_START_DATE");
        }

        // Extract basic exam data
        const {
          exam_questions,
          exam_students,
          exam_contents,
          exam_ai_prompt_history,
          exam_settings,
          shouldPublish,
          ...basicExamData
        } = data;

        // Create basic exam
        const examData = {
          ...basicExamData,
          tenantId: tenantId,
          teacherId: teacherId,
          examStatus: "Draft" as const,
        };

        console.log(
          "ðŸ“ Creating exam with nested data:",
          JSON.stringify(examData, null, 2),
        );

        const exam = await examRepository.createExam(examData, session);
        console.log("âœ… Exam created successfully:", exam._id);

        // Log activity
        try {
          const teacherName = await fetchUserNames([teacherId]).then(
            (names) => names[teacherId] || "Teacher",
          );
          const activityType =
            exam.examType === "Practice"
              ? "PracticeExamCreated"
              : "ExamCreated";
          const activityDescription = buildActivityDescription(
            teacherName,
            activityType,
            exam.examTitle,
          );

          await activityLogService.createTeacherActivityLog(
            {
              teacherId,
              activityType,
              activityDescription,
              relatedEntityId: exam._id.toString(),
              relatedEntityType:
                exam.examType === "Practice" ? "PracticeExam" : "Exam",
              classId: exam.classId.toString(),
              subjectId: exam.subjectId.toString(),
              tenantId: tenantId,
            },
            session,
          );
        } catch (logError) {
          console.error("Error creating activity log:", logError);
          // Don't throw - logging failure shouldn't break exam creation
        }

        // Send exam creation notification to teacher
        try {
          console.log(
            `ðŸ“§ [createExamWithNestedData] Starting exam creation notification...`,
          );
          const notification: notificationService.INotificationRequest = {
            receiverId: teacherId,
            receiverRole: "TEACHER",
            title: `Exam Created: ${exam.examTitle}`,
            content: `Assessment responsibility assigned: "${exam.examTitle}" has been created and is ready for assignment.`,
            senderId: teacherId,
            senderRole: "SYSTEM",
            tenantId,
            meta: {
              entityId: exam._id.toString(),
              entityType: "Exam",
              notificationType: "exam_created",
              examTitle: exam.examTitle,
              examType: exam.examType,
              totalMarks: exam.totalMarks,
            },
          };
          console.log(
            `ðŸŽ¯ [createExamWithNestedData] Notification payload:`,
            JSON.stringify(notification, null, 2),
          );
          await notificationService.sendNotifications([notification]);
          console.log(
            `âœ… [createExamWithNestedData] Exam creation notification sent successfully`,
          );
        } catch (notificationError) {
          console.error(
            "Error sending exam created notification:",
            notificationError,
          );
          // Don't throw - notification failure shouldn't break exam creation
        }

        const response: CreateExamWithNestedDataResponse = {
          exam: exam,
        };

        // Process questions if provided
        if (exam_questions && exam_questions.length > 0) {
          console.log("ðŸ“ Processing exam questions:", exam_questions.length);
          console.log("ðŸ” First question fields:", {
            explanation: exam_questions[0]?.explanation,
            imageUrl: exam_questions[0]?.imageUrl,
            videoUrl: exam_questions[0]?.videoUrl,
          });
          const questionsToCreate = exam_questions.map((q) => {
            const questionData: any = {
              examId: exam._id.toString(),
              questionNumber: q.questionNumber,
              questionType: q.questionType,
              questionGenerateType: q.questionGenerateType,
              questionText: q.questionText,
              marks: q.marks,
              options: q.options || [],
              correctAnswer: q.correctAnswer || "",
              difficulty: q.difficulty,
              subjectId: exam.subjectId.toString(),
              classId: exam.classId.toString(),
              teacherId: teacherId,
              tenantId: tenantId,
              // Always explicitly set these fields so they exist in the database
              explanation: q.explanation !== undefined ? q.explanation : null,
              imageUrl: q.imageUrl !== undefined ? q.imageUrl : null,
              videoUrl: q.videoUrl !== undefined ? q.videoUrl : null,
              questionContent:
                q.questionContent !== undefined ? q.questionContent : [],
              aiQuestionId: q.aiQuestionId !== undefined ? q.aiQuestionId : null,
            };
            return questionData;
          });

          const createdQuestions =
            await examQuestionRepository.bulkCreateQuestions(
              questionsToCreate,
              session,
            );

          response.questions = {
            createdCount: createdQuestions.length,
            questions: createdQuestions,
          };

          console.log(
            "âœ… Questions created successfully:",
            createdQuestions.length,
          );
        }

        // Process students if provided
        try {
          if (exam_students && exam_students.length > 0) {
            console.log("ðŸ“ Processing exam students:", exam_students.length);

            const studentAssignments = exam_students
              .filter((s) => s.studentId && s.studentId.trim() !== "") // Filter out empty student IDs
              .map((student) => ({
                examId: exam._id.toString(),
                studentId: student.studentId,
                classId: exam.classId.toString(),
                subjectId: exam.subjectId.toString(),
                batchId: exam.batchId.toString(),
                tenantId: tenantId,
              }));

            if (studentAssignments.length > 0) {
              const result =
                await examStudentRepository.bulkAssignStudentsToExam(
                  studentAssignments,
                  session,
                );

              response.students = {
                assignedCount: result.assignedCount,
                alreadyAssignedCount: result.alreadyAssignedCount,
                totalStudents: studentAssignments.length,
              };

              console.log(
                "âœ… Students assigned successfully:",
                result.assignedCount,
              );
            }
          }
        } catch (error) {
          console.error("Error processing students:", error);
          throw error;
        }

        // Process contents if provided
        if (exam_contents && exam_contents.length > 0) {
          console.log("ðŸ“ Processing exam contents:", exam_contents.length);

          const contentsToCreate = exam_contents.map((content) => ({
            examId: exam._id.toString(),
            fileName: content.fileName,
            filePath: content.filePath,
            fileType: content.fileType,
            fileSize: content.fileSize,
            uploadedBy: teacherId,
            tenantId: tenantId,
          }));

          const createdContents =
            await examContentRepository.bulkCreateExamContent(
              contentsToCreate,
              session,
            );

          response.contents = {
            processedCount: createdContents.length,
          };

          console.log(
            "âœ… Contents created successfully:",
            createdContents.length,
          );
        }

        // Process AI prompt history if provided
        if (exam_ai_prompt_history && exam_ai_prompt_history.length > 0) {
          console.log(
            "ðŸ“ Processing AI prompt history:",
            exam_ai_prompt_history.length,
          );

          const aiPromptHistoryToCreate = exam_ai_prompt_history.map(
            (history) => ({
              examId: exam._id.toString(),
              prompt: history.prompt,
              response: history.response,
              aiModel: history.aiModel,
              tokensUsed: history.tokensUsed,
              teacherId: teacherId,
              tenantId: tenantId,
            }),
          );

          const createdAIHistory =
            await examAIPromptHistoryRepository.bulkCreateAIPromptHistory(
              aiPromptHistoryToCreate,
              session,
            );

          response.aiPromptHistory = {
            processedCount: createdAIHistory.length,
          };

          console.log(
            "âœ… AI prompt history created successfully:",
            createdAIHistory.length,
          );
        }

        // Process exam settings if provided
        if (exam_settings && exam_settings.length > 0) {
          console.log("ðŸ“ Processing exam settings:", exam_settings.length);

          // Map key-value settings to schema fields
          const settingsData: any = {
            examId: exam._id.toString(),
            tenantId: tenantId,
          };

          // Parse user's key-value settings
          exam_settings.forEach((setting) => {
            const key = setting.settingKey;
            let value: any = setting.settingValue;

            // Convert string values to appropriate types
            if (setting.settingType === "boolean") {
              value = value === "true" || value === "1" || value === "yes";
            } else if (setting.settingType === "number") {
              value = parseFloat(value);
            }

            // Map to schema fields
            switch (key) {
              case "isAdaptiveDifficultyEnabled":
              case "allowReview":
                settingsData.isAdaptiveDifficultyEnabled = value;
                break;
              case "aiGenerationPrompt":
              case "instructions":
                settingsData.aiGenerationPrompt = value;
                break;
              case "contentExternalLink":
                settingsData.contentExternalLink = value;
                break;
              case "percipioContentLibraryIntegration":
                settingsData.percipioContentLibraryIntegration = value;
                break;
              case "moeDelimaRepositoryIntegration":
                settingsData.moeDelimaRepositoryIntegration = value;
                break;
              case "allowedQuestionTypes":
                if (typeof value === "string") {
                  settingsData.allowedQuestionTypes = value
                    .split(",")
                    .map((t) => t.trim());
                } else if (Array.isArray(value)) {
                  settingsData.allowedQuestionTypes = value;
                }
                break;
            }
          });

          const createdSettings =
            await examSettingsRepository.upsertExamSettings(
              settingsData,
              session,
            );

          response.settings = {
            processedCount: exam_settings.length,
          };

          console.log("âœ… Exam settings created successfully");
        }

        return response;
      } catch (error) {
        console.error("Create exam with nested data error:", error);
        throw error;
      }
    },
  )) as CreateExamWithNestedDataResponse;

  // Handle Auto-Publish
  if (data.shouldPublish) {
    try {
      console.log("📢 Auto-publishing exam after creation...");
      const publishedExam = await publishExam(
        result.exam._id.toString(),
        teacherId,
      );
      result.exam = publishedExam;
    } catch (error) {
      console.error("Auto-publish failed:", error);
      throw error;
    }
  }

  return result;
};

// Create new exam (basic version)
export const createExam = async (
  data: CreateExamRequest,
  tenantId: string,
  teacherId: string,
): Promise<IExam> => {
  try {
    // Validate dates
    const startDate = new Date(data.startOn);
    const endDate = new Date(data.endOn);

    if (endDate <= startDate) {
      throw new Error("END_DATE_BEFORE_START_DATE");
    }

    // Add tenantId and teacherId to data
    const examData = {
      ...data,
      tenantId: tenantId,
      teacherId: teacherId,
      examStatus: "Draft" as const,
    };

    console.log(
      "ðŸ“ Creating exam with data:",
      JSON.stringify(examData, null, 2),
    );

    const exam = await examRepository.createExam(examData);
    console.log("âœ… Exam created successfully:", exam._id);

    // Log activity
    try {
      const teacherName = await fetchUserNames([teacherId]).then(
        (names) => names[teacherId] || "Teacher",
      );
      const activityType =
        exam.examType === "Practice" ? "PracticeExamCreated" : "ExamCreated";
      const activityDescription = buildActivityDescription(
        teacherName,
        activityType,
        exam.examTitle,
      );

      await activityLogService.createTeacherActivityLog({
        teacherId,
        activityType,
        activityDescription,
        relatedEntityId: exam._id.toString(),
        relatedEntityType:
          exam.examType === "Practice" ? "PracticeExam" : "Exam",
        classId: exam.classId.toString(),
        subjectId: exam.subjectId.toString(),
        tenantId: tenantId,
      });
    } catch (logError) {
      console.error("Error creating activity log:", logError);
      // Don't throw - logging failure shouldn't break exam creation
    }

    // Handle Auto-Publish
    if (data.shouldPublish) {
      try {
        console.log("📢 Auto-publishing exam after creation...");
        return await publishExam(exam._id.toString(), teacherId);
      } catch (error) {
        console.error("Auto-publish failed:", error);
        throw error;
      }
    }

    // Send exam creation notification to teacher
    try {
      console.log(`ðŸ“§ [createExam] Starting exam creation notification...`);
      const notification: notificationService.INotificationRequest = {
        receiverId: teacherId,
        receiverRole: "TEACHER",
        title: `Exam Created: ${exam.examTitle}`,
        content: `Assessment responsibility assigned: "${exam.examTitle}" has been created and is ready for assignment.`,
        senderId: teacherId,
        senderRole: "SYSTEM",
        tenantId,
        meta: {
          entityId: exam._id.toString(),
          entityType: "Exam",
          notificationType: "exam_created",
          examTitle: exam.examTitle,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
        },
      };
      console.log(
        `ðŸŽ¯ [createExam] Notification payload:`,
        JSON.stringify(notification, null, 2),
      );
      await notificationService.sendNotifications([notification]);
      console.log(
        `âœ… [createExam] Exam creation notification sent successfully`,
      );
    } catch (notificationError) {
      console.error(
        "Error sending exam created notification:",
        notificationError,
      );
      // Don't throw - notification failure shouldn't break exam creation
    }

    return exam;
  } catch (error) {
    console.error("Create exam error:", error);
    throw error;
  }
};

// Get exam by ID
export const getExamById = async (id: string): Promise<IExam> => {
  return retryOnWriteConflict(async () => {
    const exam = await examRepository.findExamById(id);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get questions count by type
    const questions = await examQuestionRepository.findQuestionsByExamId(id);

    // Debug: Check if explanation, imageUrl, videoUrl are in the first question
    if (questions.length > 0) {
      console.log("ðŸ” First question fields check:", {
        hasExplanation: "explanation" in questions[0],
        hasImageUrl: "imageUrl" in questions[0],
        hasVideoUrl: "videoUrl" in questions[0],
        explanation: (questions[0] as any).explanation,
        imageUrl: (questions[0] as any).imageUrl,
        videoUrl: (questions[0] as any).videoUrl,
      });
    }

    const questionTypeCounts = {
      MCQs: questions.filter((q) => q.questionType === "MCQs").length,
      "Fill in the Blanks": questions.filter(
        (q) => q.questionType === "Fill in the Blanks",
      ).length,
      "True/False": questions.filter((q) => q.questionType === "True/False")
        .length,
      "Short Answers": questions.filter(
        (q) => q.questionType === "Short Answers",
      ).length,
      "Long Answers": questions.filter((q) => q.questionType === "Long Answers")
        .length,
    };

    // Get all nested data in parallel
    const [students, contents, aiHistory, settings] = await Promise.all([
      examStudentAssignmentRepository.findStudentsByExamId(id),
      examContentRepository.findContentByExamId(id),
      examAIPromptHistoryRepository.findAIPromptHistoryByExamId(id),
      examSettingsRepository.findSettingsByExamId(id),
    ]);

    // Add question types metadata to exam and clean up
    // Since we're using .lean(), exam is already a plain object
    const examObj =
      exam && typeof exam.toObject === "function" ? exam.toObject() : exam;
    const {
      __v,
      teacherId,
      tenantId,
      isDeleted,
      allowedAttempts,
      ...cleanExam
    } = examObj as any;

    // Add metadata
    (cleanExam as any).questionTypes = questionTypeCounts;
    (cleanExam as any).totalQuestions = questions.length;

    // Convert questions to plain objects and remove unnecessary fields
    const plainQuestions = questions.map((q) => {
      const question = q && typeof q.toObject === "function" ? q.toObject() : q;
      // Remove unnecessary fields
      const {
        __v,
        isActive,
        createdAt,
        updatedAt,
        successRate,
        teacherId,
        tenantId,
        subjectId,
        classId,
        examId,
        questionContent,
        ...cleanQuestion
      } = question as any;

      // Explicitly ensure explanation, imageUrl, and videoUrl are always included
      // Extract them before destructuring to preserve them
      const explanation = (question as any).explanation;
      const imageUrl = (question as any).imageUrl;
      const videoUrl = (question as any).videoUrl;

      // Add them back explicitly
      cleanQuestion.explanation =
        explanation !== undefined ? explanation : null;
      cleanQuestion.imageUrl = imageUrl !== undefined ? imageUrl : null;
      cleanQuestion.videoUrl = videoUrl !== undefined ? videoUrl : null;

      // Remove empty arrays from options
      if (cleanQuestion.options && Array.isArray(cleanQuestion.options)) {
        cleanQuestion.options = cleanQuestion.options.map((opt: any) => {
          const { optionContent, ...cleanOpt } = opt;
          return cleanOpt;
        });
      }

      return cleanQuestion;
    });

    // Add nested data and clean up
    // Clean exam_contents
    const cleanContents = (contents || []).map((c: any) => {
      const content = c.toObject ? c.toObject() : c;
      const { __v, examId, tenantId, uploadedBy, ...cleanContent } = content;
      return cleanContent;
    });

    // Clean exam_students
    const cleanStudents = (students || []).map((s: any) => {
      const student = s.toObject ? s.toObject() : s;
      const {
        __v,
        examId,
        classId,
        subjectId,
        batchId,
        tenantId,
        isActive,
        createdAt,
        updatedAt,
        ...cleanStudent
      } = student;
      return cleanStudent;
    });

    // Clean exam_ai_prompt_history
    const cleanAIHistory = (aiHistory || []).map((h: any) => {
      const history = h.toObject ? h.toObject() : h;
      const { __v, examId, teacherId, tenantId, updatedAt, ...cleanHistory } =
        history;
      return cleanHistory;
    });

    // Clean exam_settings
    const cleanSettings = settings
      ? (() => {
          const setting = settings.toObject ? settings.toObject() : settings;
          const { __v, examId, tenantId, ...cleanSetting } = setting as any;
          return cleanSetting;
        })()
      : {};

    // Add nested data to cleaned exam object
    (cleanExam as any).exam_questions = plainQuestions || [];
    (cleanExam as any).exam_students = cleanStudents || [];
    (cleanExam as any).exam_contents = cleanContents || [];
    (cleanExam as any).exam_ai_prompt_history = cleanAIHistory || [];
    (cleanExam as any).exam_settings = cleanSettings || {};

    return cleanExam as IExam;
  });
};

// Get exam with questions
export const getExamWithQuestions = async (
  id: string,
): Promise<ExamWithQuestionsResponse> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  const questions = await examQuestionRepository.findQuestionsByExamId(id);

  return {
    ...exam,
    questions,
    questionCount: questions.length,
  } as ExamWithQuestionsResponse;
};

// Helper function to execute transaction with retry logic
const executeWithTransactionAndRetry = async <T>(
  operation: (session: mongoose.ClientSession) => Promise<T>,
  maxRetries: number = 3,
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await TransactionHelper.executeWithTransaction(operation);
    } catch (error: any) {
      lastError = error;

      // Check if this is a retryable error
      const isRetryable =
        error.name === "TransientTransactionError" ||
        error.name === "NoSuchTransaction" ||
        error.name === "WriteConflict" ||
        error.name === "WriteConcernError" ||
        error.message?.includes("WriteConflict") ||
        error.message?.includes("write conflict") ||
        error.codeName === "WriteConflict";

      if (isRetryable && attempt < maxRetries) {
        console.log(
          `Transaction attempt ${attempt} failed, retrying... (${error.message})`,
        );
        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100),
        );
        continue;
      }

      // If not retryable or max retries reached, throw the error
      throw error;
    }
  }

  throw lastError || new Error("Transaction failed after all retries");
};

// Update exam with nested data
export const updateExamWithNestedData = async (
  id: string,
  data: UpdateExamRequest,
  teacherId: string,
): Promise<CreateExamWithNestedDataResponse> => {
  const result = (await executeWithTransactionAndRetry(
    async (session: mongoose.ClientSession) => {
      try {
        const exam = await examRepository.findExamById(id, session);
        if (!exam) {
          throw new Error("EXAM_NOT_FOUND");
        }

        // Check ownership
        if (exam.teacherId.toString() !== teacherId) {
          throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
        }

        // Only allow updates if exam is in Draft or Unpublished status
        if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
          throw new Error("EXAM_CANNOT_BE_UPDATED");
        }

        // Validate dates if both are provided
        if (data.startOn && data.endOn) {
          const startDate = new Date(data.startOn);
          const endDate = new Date(data.endOn);

          if (endDate <= startDate) {
            throw new Error("END_DATE_BEFORE_START_DATE");
          }
        }

        // Extract nested data
        const {
          exam_questions,
          exam_students,
          exam_contents,
          exam_ai_prompt_history,
          exam_settings,
          shouldPublish,
          ...basicExamData
        } = data;

        // Update basic exam data
        const updatedExam = await examRepository.updateExamById(
          id,
          basicExamData,
          session,
        );
        if (!updatedExam) {
          throw new Error("EXAM_NOT_FOUND");
        }

        // Log activity
        try {
          const tenantId = exam.tenantId.toString();
          const teacherName = await fetchUserNames([teacherId]).then(
            (names) => names[teacherId] || "Teacher",
          );
          const activityType =
            updatedExam.examType === "Practice"
              ? "PracticeExamEdited"
              : "ExamEdited";
          const activityDescription = buildActivityDescription(
            teacherName,
            activityType,
            updatedExam.examTitle,
          );

          await activityLogService.createTeacherActivityLog(
            {
              teacherId,
              activityType,
              activityDescription,
              relatedEntityId: updatedExam._id.toString(),
              relatedEntityType:
                updatedExam.examType === "Practice" ? "PracticeExam" : "Exam",
              classId: updatedExam.classId.toString(),
              subjectId: updatedExam.subjectId.toString(),
              tenantId,
            },
            session,
          );
        } catch (logError) {
          console.error("Error creating activity log:", logError);
          // Don't throw - logging failure shouldn't break exam update
        }

        const response: CreateExamWithNestedDataResponse = {
          exam: updatedExam,
        };

        // Process questions if provided
        if (exam_questions && exam_questions.length > 0) {
          console.log("ðŸ“ Updating exam questions:", exam_questions.length);

          const keepNumbers = exam_questions.map((q: any) => q.questionNumber);

          // Upsert each question by (examId, questionNumber)
          const upsertedQuestions: any[] = [];
          for (const q of exam_questions as any[]) {
            const mapped: any = {
              questionType: q.questionType,
              questionGenerateType: q.questionGenerateType,
              questionText: q.questionText,
              marks: q.marks,
              options: q.options || [],
              correctAnswer: q.correctAnswer || "",
              difficulty: q.difficulty,
              subjectId: updatedExam.subjectId.toString(),
              classId: updatedExam.classId.toString(),
              teacherId: teacherId,
              tenantId: updatedExam.tenantId.toString(),
              // Always explicitly set these fields so they exist in the database
              explanation: q.explanation !== undefined ? q.explanation : null,
              imageUrl: q.imageUrl !== undefined ? q.imageUrl : null,
              videoUrl: q.videoUrl !== undefined ? q.videoUrl : null,
              aiQuestionId:
                q.aiQuestionId !== undefined ? q.aiQuestionId : null,
            };

            const upserted =
              await examQuestionRepository.upsertByExamAndQuestionNumber(
                id,
                q.questionNumber,
                mapped,
                session,
              );
            upsertedQuestions.push(upserted);
          }

          // Deactivate any questions not present in payload question numbers
          await examQuestionRepository.deactivateNotInQuestionNumbers(
            id,
            keepNumbers,
            session,
          );

          response.questions = {
            createdCount: upsertedQuestions.length,
            questions: upsertedQuestions,
          };

          console.log(
            "âœ… Questions upserted successfully:",
            upsertedQuestions.length,
          );
        }

        // Process students if provided
        try {
          if (exam_students && exam_students.length > 0) {
            console.log("ðŸ“ Updating exam students:", exam_students.length);

            // Remove existing student assignments
            await examStudentRepository.removeAllStudentsFromExam(id, session);

            // Add new student assignments
            const studentAssignments = exam_students
              .filter((s) => s.studentId && s.studentId.trim() !== "")
              .map((student) => ({
                examId: id,
                studentId: student.studentId,
                classId: updatedExam.classId.toString(),
                subjectId: updatedExam.subjectId.toString(),
                batchId: updatedExam.batchId.toString(),
                tenantId: updatedExam.tenantId.toString(),
              }));

            if (studentAssignments.length > 0) {
              const result =
                await examStudentRepository.bulkAssignStudentsToExam(
                  studentAssignments,
                  session,
                );

              response.students = {
                assignedCount: result.assignedCount,
                alreadyAssignedCount: result.alreadyAssignedCount,
                totalStudents: studentAssignments.length,
              };

              console.log(
                "âœ… Students updated successfully:",
                result.assignedCount,
              );
            }
          }
        } catch (error) {
          console.error("Error updating students:", error);
          throw error;
        }

        // Process contents if provided
        if (exam_contents && exam_contents.length > 0) {
          console.log("ðŸ“ Updating exam contents:", exam_contents.length);

          // Delete existing contents
          await examContentRepository.deleteContentByExamId(id, session);

          // Create new contents
          const contentsToCreate = exam_contents.map((content) => ({
            examId: id,
            fileName: content.fileName,
            filePath: content.filePath,
            fileType: content.fileType,
            fileSize: content.fileSize,
            uploadedBy: teacherId,
            tenantId: updatedExam.tenantId.toString(),
          }));

          const createdContents =
            await examContentRepository.bulkCreateExamContent(
              contentsToCreate,
              session,
            );

          response.contents = {
            processedCount: createdContents.length,
          };

          console.log(
            "âœ… Contents updated successfully:",
            createdContents.length,
          );
        }

        // Process AI prompt history if provided
        if (exam_ai_prompt_history && exam_ai_prompt_history.length > 0) {
          console.log(
            "ðŸ“ Updating AI prompt history:",
            exam_ai_prompt_history.length,
          );

          // Delete existing AI prompt history
          await examAIPromptHistoryRepository.deleteAIPromptHistoryByExamId(
            id,
            session,
          );

          // Create new AI prompt history
          const aiPromptHistoryToCreate = exam_ai_prompt_history.map(
            (history) => ({
              examId: id,
              prompt: history.prompt,
              response: history.response,
              aiModel: history.aiModel,
              tokensUsed: history.tokensUsed,
              teacherId: teacherId,
              tenantId: updatedExam.tenantId.toString(),
            }),
          );

          const createdAIHistory =
            await examAIPromptHistoryRepository.bulkCreateAIPromptHistory(
              aiPromptHistoryToCreate,
              session,
            );

          response.aiPromptHistory = {
            processedCount: createdAIHistory.length,
          };

          console.log(
            "âœ… AI prompt history updated successfully:",
            createdAIHistory.length,
          );
        }

        // Process exam settings if provided
        if (exam_settings && exam_settings.length > 0) {
          console.log("ðŸ“ Updating exam settings:", exam_settings.length);

          // Map key-value settings to schema fields
          const settingsData: any = {
            examId: id,
            tenantId: updatedExam.tenantId.toString(),
          };

          // Parse user's key-value settings
          exam_settings.forEach((setting) => {
            const key = setting.settingKey;
            let value: any = setting.settingValue;

            // Convert string values to appropriate types
            if (setting.settingType === "boolean") {
              value = value === "true" || value === "1" || value === "yes";
            } else if (setting.settingType === "number") {
              value = parseFloat(value);
            }

            // Map to schema fields
            switch (key) {
              case "isAdaptiveDifficultyEnabled":
              case "allowReview":
                settingsData.isAdaptiveDifficultyEnabled = value;
                break;
              case "aiGenerationPrompt":
              case "instructions":
                settingsData.aiGenerationPrompt = value;
                break;
              case "contentExternalLink":
                settingsData.contentExternalLink = value;
                break;
              case "percipioContentLibraryIntegration":
                settingsData.percipioContentLibraryIntegration = value;
                break;
              case "moeDelimaRepositoryIntegration":
                settingsData.moeDelimaRepositoryIntegration = value;
                break;
              case "allowedQuestionTypes":
                if (typeof value === "string") {
                  settingsData.allowedQuestionTypes = value
                    .split(",")
                    .map((t) => t.trim());
                } else if (Array.isArray(value)) {
                  settingsData.allowedQuestionTypes = value;
                }
                break;
            }
          });

          const updatedSettings =
            await examSettingsRepository.upsertExamSettings(
              settingsData,
              session,
            );

          response.settings = {
            processedCount: exam_settings.length,
          };

          console.log("âœ… Exam settings updated successfully");
        }

        return response;
      } catch (error) {
        console.error("Update exam with nested data error:", error);
        throw error;
      }
    },
  )) as CreateExamWithNestedDataResponse;

  // Handle Auto-Publish
  if (data.shouldPublish) {
    try {
      console.log("📢 Auto-publishing exam after update...");
      // If the exam is already published, this might throw if we don't check status.
      // But publishExam checks if ALREADY_PUBLISHED and throws?
      // Step 24: "if (errorMessage === "EXAM_ALREADY_PUBLISHED") ..." in controller.
      // Service implementation of publishExam does NOT check if already published?
      // Let's check Step 24 publishExam implementation again.
      // It does NOT check if status is already Published at the explicit check level,
      // but it might fail or re-publish.
      // Wait, Step 24 shows the controller.
      // Step 24 service implementation (lines 1372+) does NOT check examStatus explicitly to throw ALREADY_PUBLISHED.
      // It just updates status to Published.
      // So it is safe to call idempotent-ish?
      // Actually, if we are updating an exam, it might be Draft or Unpublished.
      // If it is already Published, updateExamWithNestedData throws "EXAM_CANNOT_BE_UPDATED" (line 670).
      // So we are safe; it must be Draft/Unpublished to reach here.

      const publishedExam = await publishExam(id, teacherId);
      result.exam = publishedExam;
    } catch (error) {
      console.error("Auto-publish failed:", error);
      throw error;
    }
  }

  return result;
};

// Update exam (basic version)
export const updateExam = async (
  id: string,
  data: UpdateExamRequest,
  teacherId: string,
): Promise<IExam> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Only allow updates if exam is in Draft or Unpublished status
  if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
    throw new Error("EXAM_CANNOT_BE_UPDATED");
  }

  // Validate dates if both are provided
  if (data.startOn && data.endOn) {
    const startDate = new Date(data.startOn);
    const endDate = new Date(data.endOn);

    if (endDate <= startDate) {
      throw new Error("END_DATE_BEFORE_START_DATE");
    }
  }

  // Update exam record
  const updatedExam = await examRepository.updateExamById(id, data);
  if (!updatedExam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Log activity
  try {
    const tenantId = exam.tenantId.toString();
    const teacherName = await fetchUserNames([teacherId]).then(
      (names) => names[teacherId] || "Teacher",
    );
    const activityType =
      exam.examType === "Practice" ? "PracticeExamEdited" : "ExamEdited";
    const activityDescription = buildActivityDescription(
      teacherName,
      activityType,
      updatedExam.examTitle,
    );

    await activityLogService.createTeacherActivityLog({
      teacherId,
      activityType,
      activityDescription,
      relatedEntityId: updatedExam._id.toString(),
      relatedEntityType:
        updatedExam.examType === "Practice" ? "PracticeExam" : "Exam",
      classId: updatedExam.classId.toString(),
      subjectId: updatedExam.subjectId.toString(),
      tenantId,
    });
  } catch (logError) {
    console.error("Error creating activity log:", logError);
    // Don't throw - logging failure shouldn't break exam update
  }

  // Handle Auto-Publish
  if (data.shouldPublish) {
    try {
      console.log("📢 Auto-publishing exam after update...");
      return await publishExam(id, teacherId);
    } catch (error) {
      console.error("Auto-publish failed:", error);
      throw error;
    }
  }

  return updatedExam;
};

// Delete exam
export const deleteExam = async (
  id: string,
  teacherId: string,
): Promise<IExam | null> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Only allow deletion if exam is in Draft status
  if (exam.examStatus !== "Draft") {
    throw new Error("EXAM_CANNOT_BE_DELETED");
  }

  // Cascade delete all related data
  await examAnswerRepository.deleteAnswersByExamId(id);
  await examAttemptRepository.softDeleteAttemptsByExamId(id);
  await examStudentRepository.removeAllStudentsFromExam(id);
  await examQuestionRepository.deleteQuestionsByExamId(id);

  // Soft delete exam record
  const deletedExam = await examRepository.softDeleteExamById(id);
  return deletedExam;
};

// Get all exams
export const getAllExams = async (
  params: GetAllExamsRequest & { tenantId: string; teacherId?: string },
): Promise<GetAllExamsResponse> => {
  const exams = await examRepository.findExams(params);
  const total = await examRepository.countExams(params);

  // Enrich with question and student counts
  const enrichedExams = await Promise.all(
    exams.map(async (exam) => {
      const questionCount = await examQuestionRepository.countExamQuestions(
        exam._id.toString(),
      );
      const studentCount = await examStudentRepository.countStudentsForExam(
        exam._id.toString(),
      );

      // Get question type counts
      const questions = await examQuestionRepository.findQuestionsByExamId(
        exam._id.toString(),
      );
      const questionTypeCounts = {
        MCQs: questions.filter((q) => q.questionType === "MCQs").length,
        "Fill in the Blanks": questions.filter(
          (q) => q.questionType === "Fill in the Blanks",
        ).length,
        "True/False": questions.filter((q) => q.questionType === "True/False")
          .length,
        "Short Answers": questions.filter(
          (q) => q.questionType === "Short Answers",
        ).length,
        "Long Answers": questions.filter(
          (q) => q.questionType === "Long Answers",
        ).length,
      };

      // Get grading stats to determine release readiness
      const gradingStats = await gradingRepository.countStudentsByStatus(
        exam._id.toString(),
      );
      const gradedCount = await gradingRepository.countGradedStudents(
        exam._id.toString(),
      );
      const hasAttempts = gradingStats.studentsCompleted > 0;
      const allGraded =
        hasAttempts && gradedCount === gradingStats.studentsCompleted;
      const examEnded = new Date(exam.endOn) < new Date();
      // Can release: exam ended + at least 1 attempt + ALL attempts graded + status is Published
      const canRelease =
        examEnded &&
        hasAttempts &&
        allGraded &&
        exam.examStatus === "Published";

      if (gradingStats.studentsCompleted === gradedCount) {
        exam.gradingTypeStatus = "Completed";
      }

      return {
        ...exam,
        questionCount,
        studentCount,
        questionTypes: questionTypeCounts,
        totalQuestions: questions.length,
        gradingTypeStatus: exam.gradingTypeStatus,
        gradingInfo: {
          studentsAttempted: gradingStats.studentsCompleted,
          studentsGraded: gradedCount,
          hasAttempts,
          allGraded,
          examEnded,
          canRelease,
        },
      };
    }),
  );

  return {
    exams: enrichedExams as any,
    pagination: {
      total,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 10,
      totalPages: Math.ceil(total / (params.pageSize || 10)),
    },
  };
};

// Get all exams using generic dynamic filter pattern (filter + sort)
export const getAllExamsDynamic = async (params: {
  pageNo: number;
  pageSize: number;
  tenantId: string;
  teacherId?: string;
  query?: Record<string, any>;
  sort?: Record<string, any>;
}): Promise<GetAllExamsResponse> => {
  const result = await examRepository.findExamsDynamic(params);
  const totalPages = Math.ceil(result.total / params.pageSize);

  // Enrich with question and student counts (keep response consistent with getAllExams)
  const enrichedExams = await Promise.all(
    result.exams.map(async (exam: any) => {
      const questionCount = await examQuestionRepository.countExamQuestions(
        exam._id.toString(),
      );
      const studentCount = await examStudentRepository.countStudentsForExam(
        exam._id.toString(),
      );

      const questions = await examQuestionRepository.findQuestionsByExamId(
        exam._id.toString(),
      );
      const questionTypeCounts = {
        MCQs: questions.filter((q) => q.questionType === "MCQs").length,
        "Fill in the Blanks": questions.filter(
          (q) => q.questionType === "Fill in the Blanks",
        ).length,
        "True/False": questions.filter((q) => q.questionType === "True/False")
          .length,
        "Short Answers": questions.filter(
          (q) => q.questionType === "Short Answers",
        ).length,
        "Long Answers": questions.filter(
          (q) => q.questionType === "Long Answers",
        ).length,
      };

      const gradingStats = await gradingRepository.countStudentsByStatus(
        exam._id.toString(),
      );
      const gradedCount = await gradingRepository.countGradedStudents(
        exam._id.toString(),
      );
      const hasAttempts = gradingStats.studentsCompleted > 0;
      const allGraded =
        hasAttempts && gradedCount === gradingStats.studentsCompleted;
      const examEnded = new Date(exam.endOn) < new Date();
      const canRelease =
        examEnded &&
        hasAttempts &&
        allGraded &&
        exam.examStatus === "Published";

      return {
        ...exam,
        questionCount,
        studentCount,
        questionTypes: questionTypeCounts,
        totalQuestions: questions.length,
        gradingTypeStatus: exam.gradingTypeStatus,
        gradingInfo: {
          studentsAttempted: gradingStats.studentsCompleted,
          studentsGraded: gradedCount,
          hasAttempts,
          allGraded,
          examEnded,
          canRelease,
        },
      };
    }),
  );

  return {
    exams: enrichedExams as any,
    pagination: {
      total: result.total,
      pageNo: params.pageNo,
      pageSize: params.pageSize,
      totalPages,
    },
  };
};

// Get exam logs (basic listing with filters)
export const getExamLogs = async (params: {
  pageNo: number;
  pageSize: number;
  tenantId: string;
  query?: Record<string, any>;
  sort?: Record<string, any>;
}): Promise<{
  exams: any[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}> => {
  try {
    const result = await examRepository.findExamLogs(params);

    const totalPages = Math.ceil(result.total / params.pageSize);

    // Transform exams to include className, subjectName, batchName
    const transformedExams = result.exams.map((exam: any) => {
      const examObj = { ...exam };

      // Extract className from populated classId
      if (exam.classId) {
        if (typeof exam.classId === "object" && exam.classId.name) {
          examObj.className = exam.classId.name;
          examObj.classId =
            exam.classId._id?.toString() || exam.classId.toString();
        } else {
          examObj.className = null;
          examObj.classId = exam.classId.toString();
        }
      } else {
        examObj.className = null;
      }

      // Extract subjectName from populated subjectId
      if (exam.subjectId) {
        if (typeof exam.subjectId === "object" && exam.subjectId.name) {
          examObj.subjectName = exam.subjectId.name;
          examObj.subjectId =
            exam.subjectId._id?.toString() || exam.subjectId.toString();
        } else {
          examObj.subjectName = null;
          examObj.subjectId = exam.subjectId.toString();
        }
      } else {
        examObj.subjectName = null;
      }

      // Extract batchName from populated batchId
      if (exam.batchId) {
        if (typeof exam.batchId === "object" && exam.batchId.batchName) {
          examObj.batchName = exam.batchId.batchName;
          examObj.batchId =
            exam.batchId._id?.toString() || exam.batchId.toString();
        } else {
          examObj.batchName = null;
          examObj.batchId = exam.batchId.toString();
        }
      } else {
        examObj.batchName = null;
      }

      // Ensure teacherId is string
      if (exam.teacherId) {
        examObj.teacherId = exam.teacherId.toString();
      }

      return examObj;
    });

    return {
      exams: transformedExams,
      pagination: {
        total: result.total,
        pageNo: params.pageNo,
        pageSize: params.pageSize,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error getting exam logs:", error);
    throw error;
  }
};

// Get exam statistics
export const getExamStatistics = async (
  tenantId: string,
  teacherId?: string,
  batchId?: string,
  examModeId?: string,
): Promise<ExamStatistics> => {
  try {
    return await examRepository.getExamStatistics(tenantId, teacherId, batchId, examModeId);
  } catch (error) {
    console.error("Error getting exam statistics:", error);
    throw error;
  }
};

// Publish exam
export const publishExam = async (
  id: string,
  teacherId: string,
): Promise<IExam> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Validate exam has questions
  const questionCount = await examQuestionRepository.countExamQuestions(id);
  if (questionCount === 0) {
    throw new Error("EXAM_HAS_NO_QUESTIONS");
  }

  // Validate total marks match
  const totalMarksFromQuestions =
    await examQuestionRepository.getTotalMarksForExam(id);
  console.log("🔍 Marks validation:", {
    examTotalMarks: exam.totalMarks,
    examTotalMarksType: typeof exam.totalMarks,
    questionsTotalMarks: totalMarksFromQuestions,
    questionsTotalMarksType: typeof totalMarksFromQuestions,
    match: totalMarksFromQuestions === exam.totalMarks,
  });

  if (totalMarksFromQuestions !== exam.totalMarks) {
    throw new Error("EXAM_MARKS_MISMATCH");
  }

  // Validate exam has students assigned
  const studentCount = await examStudentRepository.countStudentsForExam(id);
  if (studentCount === 0) {
    throw new Error("EXAM_HAS_NO_STUDENTS");
  }

  // Validate topic breakdown exists and has at least one topic
  if (!exam.topicBreakdown || exam.topicBreakdown.length === 0) {
    throw new Error("EXAM_MISSING_TOPIC_BREAKDOWN");
  }

  // Update status to Published
  const publishedExam = await examRepository.updateExamStatus(id, "Published");
  if (!publishedExam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Get teacher name once for both activity log and notifications
  const tenantId = exam.tenantId.toString();
  let teacherName = "Teacher";
  try {
    teacherName = await fetchUserNames([teacherId]).then(
      (names) => names[teacherId] || "Teacher",
    );
  } catch (nameError) {
    console.error("Error fetching teacher name:", nameError);
  }

  // Log activity (ExamScheduled when published)
  try {
    const activityDescription = buildActivityDescription(
      teacherName,
      "ExamScheduled",
      publishedExam.examTitle,
    );

    await activityLogService.createTeacherActivityLog({
      teacherId,
      activityType: "ExamScheduled",
      activityDescription,
      relatedEntityId: publishedExam._id.toString(),
      relatedEntityType:
        publishedExam.examType === "Practice" ? "PracticeExam" : "Exam",
      classId: publishedExam.classId.toString(),
      subjectId: publishedExam.subjectId.toString(),
      tenantId,
    });
  } catch (logError) {
    console.error("Error creating activity log:", logError);
    // Don't throw - logging failure shouldn't break exam publish
  }

  // Send notifications to all assigned students
  try {
    // Get all student IDs assigned to this exam
    const studentIds = await examStudentRepository.getStudentIdsForExam(id);

    if (studentIds.length > 0) {
      console.log(
        `📧 Sending exam assignment notifications to ${studentIds.length} students`,
      );

      // Format the date for display
      const startDate = new Date(publishedExam.startOn).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      // Debug: Log the IDs being used
      console.log("📤 [EXAM PUBLISH] Notification IDs:", {
        teacherId,
        teacherIdLength: teacherId?.length,
        tenantId,
        tenantIdLength: tenantId?.length,
        studentIds: studentIds.slice(0, 3), // First 3 for debugging
        studentIdsLength: studentIds.map((id) => id?.length),
      });

      // Create notification requests for each student
      const notifications: notificationService.INotificationRequest[] =
        studentIds.map((studentId) => ({
          receiverId: studentId,
          receiverRole: "STUDENT",
          title: `New Exam Assigned: ${publishedExam.examTitle}`,
          content: `You've been assigned a new ${publishedExam.examType.toLowerCase()} exam by ${teacherName}. It starts on ${startDate}, lasts ${
            publishedExam.durationInMinutes
          } minutes, and is worth ${
            publishedExam.totalMarks
          } marks. Good luck!`,
          senderId: teacherId,
          senderRole: "TEACHER",
          tenantId,
          meta: {
            entityId: publishedExam._id.toString(),
            entityType: "Exam",
            examTitle: publishedExam.examTitle,
            examType: publishedExam.examType,
            startOn: publishedExam.startOn,
            endOn: publishedExam.endOn,
            durationInMinutes: publishedExam.durationInMinutes,
            totalMarks: publishedExam.totalMarks,
          },
        }));

      // Send notifications in batches of 100 (API limit)
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        await notificationService.sendNotifications(batch);
      }

      // Send notifications to parents of assigned students (OUTSIDE the batching loop)
      try {
        console.log(
          `📧 [publishExam] Starting parent notifications for ${studentIds.length} students...`,
        );
        const parentIds = new Set<string>();

        // Fetch parents for each student
        for (const studentId of studentIds) {
          try {
            const parentsResult =
              await parentChildService.getParentsByChildId(studentId);

            console.log(
              `🔍 [publishExam] Fetched parents for student ${studentId}:`,
              {
                success: parentsResult.success,
                dataLength: parentsResult.data ? parentsResult.data.length : 0,
                data: parentsResult.data,
              },
            );

            if (
              parentsResult.success &&
              parentsResult.data &&
              Array.isArray(parentsResult.data)
            ) {
              const parents = parentsResult.data;
              console.log(
                `📌 [publishExam] Found ${parents.length} parent relationship(s) for student ${studentId}`,
              );

              parents.forEach((parentRel: any) => {
                let parentId = null;

                // Handle both populated object and string references
                if (parentRel.parentId) {
                  if (typeof parentRel.parentId === "string") {
                    parentId = parentRel.parentId;
                  } else if (parentRel.parentId._id) {
                    // Populated object with _id field
                    parentId = parentRel.parentId._id.toString();
                  } else if (
                    typeof parentRel.parentId === "object" &&
                    parentRel.parentId.toString
                  ) {
                    // ObjectId instance
                    parentId = parentRel.parentId.toString();
                  }
                }

                console.log(
                  `  → Parent ID: ${parentId}, Valid: ${parentId && mongoose.Types.ObjectId.isValid(parentId)}, parentRel.parentId type: ${typeof parentRel.parentId}`,
                );

                if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
                  parentIds.add(parentId);
                }
              });
            } else {
              console.log(
                `ℹ️  [publishExam] No parents found for student ${studentId}`,
              );
            }
          } catch (parentError: any) {
            console.warn(
              `⚠️ Could not fetch parents for student ${studentId}:`,
              parentError.message,
            );
          }
        }

        // Send notifications to all unique parents
        console.log(
          `🎯 [publishExam] Total unique parents found: ${parentIds.size}`,
        );

        if (parentIds.size > 0) {
          const parentNotifications: notificationService.INotificationRequest[] =
            Array.from(parentIds).map((parentId) => ({
              receiverId: parentId,
              receiverRole: "PARENT",
              title: `Child's Exam Assigned: ${publishedExam.examTitle}`,
              content: `Your child has been assigned a new ${publishedExam.examType.toLowerCase()} exam by ${teacherName}. Exam: "${publishedExam.examTitle}" starts on ${startDate}, lasts ${publishedExam.durationInMinutes} minutes, and is worth ${publishedExam.totalMarks} marks.`,
              senderId: teacherId,
              senderRole: "TEACHER",
              tenantId,
              meta: {
                entityId: publishedExam._id.toString(),
                entityType: "Exam",
                examTitle: publishedExam.examTitle,
                examType: publishedExam.examType,
                startOn: publishedExam.startOn,
                endOn: publishedExam.endOn,
                durationInMinutes: publishedExam.durationInMinutes,
                totalMarks: publishedExam.totalMarks,
              },
            }));

          const parentBatchSize = 100;
          for (
            let i = 0;
            i < parentNotifications.length;
            i += parentBatchSize
          ) {
            const batch = parentNotifications.slice(i, i + parentBatchSize);
            await notificationService.sendNotifications(batch);
          }
          console.log(
            `✅ [publishExam] Parent notifications sent to ${parentIds.size} parent(s)`,
          );
        } else {
          console.log(
            `ℹ️  [publishExam] No parents to notify (either none assigned or no relationships found)`,
          );
        }
      } catch (parentNotificationError: any) {
        console.error("Parent notification error:", parentNotificationError);
      }
    }

    // Send notification to admin about exam publication
    try {
      console.log(`📧 [publishExam] Starting admin notification...`);
      const { findAdminByTenantId } =
        await import("../repositories/admin.repository");
      const admin = await findAdminByTenantId(tenantId);
      if (admin) {
        const adminNotif: notificationService.INotificationRequest = {
          receiverId: admin._id.toString(),
          receiverRole: "ADMIN",
          title: `Exam Published: ${publishedExam.examTitle}`,
          content: `${teacherName} published "${publishedExam.examTitle}". ${studentIds.length} student(s) assigned.`,
          senderId: teacherId,
          senderRole: "TEACHER",
          tenantId,
          meta: {
            entityId: publishedExam._id.toString(),
            entityType: "Exam",
            notificationType: "exam_published",
            examTitle: publishedExam.examTitle,
            studentCount: studentIds.length,
          },
        };
        await notificationService.sendNotifications([adminNotif]);
        console.log(`✅ [publishExam] Admin notification sent`);
      }
    } catch (adminErr) {
      console.error("Admin notification error:", adminErr);
    }
  } catch (notificationError) {
    console.error(
      "Error sending exam assignment notifications:",
      notificationError,
    );
  }

  return publishedExam;
};

// Release exam
export const releaseExam = async (
  id: string,
  teacherId: string,
): Promise<{
  exam: IExam;
  studentsAttempted: number;
  studentsGraded: number;
  totalStudents: number;
}> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Check if already released
  if (exam.examStatus === "Released") {
    throw new Error("EXAM_ALREADY_RELEASED");
  }

  // Validate exam is published before it can be released
  if (exam.examStatus !== "Published") {
    throw new Error("EXAM_MUST_BE_PUBLISHED_TO_RELEASE");
  }

  // Check if exam has ended
  const now = new Date();
  if (new Date(exam.endOn) > now) {
    throw new Error("EXAM_NOT_ENDED_YET");
  }

  // Check if all students' grading is completed
  // const allStudentsGraded = await gradingRepository.checkAllStudentsGraded(id);
  // if (!allStudentsGraded) {
  //   throw new Error("EXAM_GRADING_NOT_COMPLETED");
  // }

  // Get student attempt stats
  const studentStats = await gradingRepository.countStudentsByStatus(id);
  const studentsAttempted = studentStats.studentsCompleted;
  const totalStudents = studentStats.totalStudents;
  const studentsGraded = await gradingRepository.countGradedStudents(id);

  // At least one student must have attempted the exam
  // if (studentsAttempted === 0) {
  //   throw new Error("NO_STUDENTS_ATTEMPTED");
  // }

  // All attempted students must be graded before release
  if (studentsGraded < studentsAttempted) {
    throw new Error("GRADING_NOT_COMPLETED");
  }

  // Find students who were assigned but didn't attempt (status is "Pending")
  const allAssignedStudents =
    await examStudentRepository.getStudentsForExam(id);
  const studentsNotAttempted = allAssignedStudents.filter(
    (student) => student.status === "Pending",
  );

  // Get all questions for the exam to create zero-graded answers
  const examQuestions = await examQuestionRepository.findQuestionsByExamId(id);

  // Fetch active grading system and calculate grade for 0 marks
  const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
    exam.tenantId.toString(),
  );
  const zeroGrade = gradingSystemService.calculateGradeFromPercentage(
    0,
    gradingSystem,
  );

  // Create zero-graded attempts for students who didn't attempt
  for (const studentRecord of studentsNotAttempted) {
    const studentId = studentRecord.studentId.toString();

    try {
      // Check if student already has an attempt (to avoid duplicates)
      const existingAttempts =
        await examAttemptRepository.findAttemptsByStudentAndExam(studentId, id);

      if (existingAttempts.length > 0) {
        continue;
      }

      // Create attempt with zero marks and "Graded" status
      const attemptNumber = 1;
      const attempt = await examAttemptRepository.createExamAttempt({
        examId: exam._id,
        studentId: studentRecord.studentId,
        classId: exam.classId,
        subjectId: exam.subjectId,

        tenantId: exam.tenantId,
        attemptNumber: attemptNumber,
        startedAt: now,
        submittedAt: now,
        attemptStatus: "Graded",
        totalMarks: exam.totalMarks,
        obtainedMarks: 0,
        percentage: 0,
        result: "Fail",
        grade: zeroGrade,
        timeTakenInSeconds: 0,
      });

      // Create zero-graded answers for all questions
      const attemptIdForAnswers =
        typeof attempt._id === "string"
          ? attempt._id
          : (attempt._id as any).toString();
      for (const question of examQuestions) {
        const questionId =
          typeof question._id === "string"
            ? question._id
            : (question._id as any).toString();
        const examIdStr =
          typeof exam._id === "string" ? exam._id : exam._id.toString();
        await examAnswerRepository.createExamAnswer({
          attemptId: new mongoose.Types.ObjectId(attemptIdForAnswers),
          examId: new mongoose.Types.ObjectId(examIdStr),
          questionId: new mongoose.Types.ObjectId(questionId),
          studentId: studentRecord.studentId,
          questionNumber: question.questionNumber,
          questionType: question.questionType,
          studentAnswer: "", // Empty answer
          correctAnswer: question.correctAnswer,
          maxMarks: question.marks,
          marksObtained: 0, // Zero marks
          timeTakenInSeconds: 0,
          tenantId: exam.tenantId,
          gradedBy: "manual",
          isCorrect: false,
        });
      }

      // Update ExamStudent record to "Completed" with zero marks
      await gradingRepository.updateExamStudentGradingStatus(
        id,
        studentId,
        "Completed",
        zeroGrade,
        0,
      );

      // NOTE: We do NOT update ExamStudent status to "Completed" for missed/expired exams.
      // This ensures they remain in "Expired/Past" category instead of "Performed".
      // await examStudentRepository.updateExamStudentStatus(
      //   id,
      //   studentId,
      //   "Completed"
      // );

      console.log(` Graded attempt for student ${studentId} with zero marks`);
    } catch (error: any) {
      console.error(
        ` Error creating zero-graded attempt for student ${studentId}:`,
        error,
      );
      // Continue with other students even if one fails
    }
  }

  // Update status to Released and set releasedAt timestamp
  const releasedExam = await examRepository.updateExamStatusAndReleaseDate(
    id,
    "Released",
    now,
  );
  if (!releasedExam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Call AI service to update analytics
  try {
    await updateAnalyticsForReleasedExam(id, exam.tenantId.toString());
  } catch (error: any) {
    // Log error but don't fail the release operation
    console.error("Error updating analytics for released exam:", error);
  }

  // Trigger report regeneration for all students
  try {
    const { updateStudentReportsOnExamRelease } =
      await import("./reportGenerator.service");

    // Safely get classId string whether populated or not
    const classIdStr = (exam.classId as any)?._id
      ? (exam.classId as any)._id.toString()
      : exam.classId?.toString();

    if (classIdStr) {
      await updateStudentReportsOnExamRelease(classIdStr, id);
      console.log(
        `[Trigger] ReleaseExam: Successfully queued/completed report regeneration for Class ${classIdStr}`,
      );
    } else {
      console.warn(
        `[Trigger] ReleaseExam: Could not extract classId for exam ${id}, skipping report update`,
      );
    }
  } catch (error: any) {
    // Log error but don't fail the release operation
    console.error(
      ` [Trigger] ReleaseExam: Error updating student reports: ${error.message}`,
      error,
    );
  }

  // ===== SEND NOTIFICATIONS FOR EXAM RELEASE =====
  // Send notifications to all students assigned to the exam
  try {
    const tenantIdString = exam.tenantId?.toString
      ? exam.tenantId.toString()
      : String(exam.tenantId);
    const teacherIdString = exam.teacherId?.toString
      ? exam.teacherId.toString()
      : String(exam.teacherId);
    const examTitle = releasedExam.examTitle || "Exam";

    // Validate IDs are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(tenantIdString)) {
      console.warn("⚠️ Invalid tenantId, skipping exam release notifications");
    } else {
      // Get all students assigned to the exam
      const allAssignedStudents =
        await examStudentRepository.getStudentsForExam(id);

      if (allAssignedStudents.length > 0) {
        const notifications: notificationService.INotificationRequest[] = [];

        // Collect all unique student IDs
        const studentIds = new Set<string>();
        allAssignedStudents.forEach((examStudent) => {
          // studentId is an ObjectId, convert to string
          const studentId = examStudent.studentId
            ? typeof examStudent.studentId === "string"
              ? examStudent.studentId
              : examStudent.studentId.toString()
            : null;

          // Validate studentId is a valid ObjectId
          if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
            studentIds.add(studentId);
          } else {
            console.warn(`⚠️ Invalid studentId format, skipping: ${studentId}`);
          }
        });

        // Send notification to each student
        studentIds.forEach((studentId) => {
          notifications.push({
            receiverId: studentId,
            receiverRole: "STUDENT",
            title: "Exam Grading Published",
            content: `The grading for "${examTitle}" has been published. You can now view your results.`,
            senderId:
              teacherIdString &&
              mongoose.Types.ObjectId.isValid(teacherIdString)
                ? teacherIdString
                : undefined,
            senderRole: "TEACHER",
            tenantId: tenantIdString,
            meta: {
              entityId: id,
              entityType: "Exam",
              examId: id,
              examTitle: examTitle,
              examType: releasedExam.examType,
              totalMarks: releasedExam.totalMarks,
            },
          });
        });

        // Get subject name from exam
        let subjectName = "Unknown";
        if (exam.subjectId) {
          try {
            const subjectRepository = new SubjectRepository();
            let subjectIdStr = "";

            // Handle subjectId - it might be populated (object) or ObjectId
            if (typeof exam.subjectId === "object" && exam.subjectId !== null) {
              if ("_id" in exam.subjectId) {
                // Populated subject object
                subjectIdStr = (exam.subjectId as any)._id?.toString() || "";
                subjectName = (exam.subjectId as any).name || "Unknown";
              } else if ("toString" in exam.subjectId) {
                // ObjectId object
                subjectIdStr = (exam.subjectId as any).toString();
              }
            } else if (typeof exam.subjectId === "string") {
              // String ObjectId
              subjectIdStr = exam.subjectId;
            }

            // If we don't have subject name yet, try to fetch it
            if (
              (!subjectName || subjectName === "Unknown") &&
              subjectIdStr &&
              mongoose.Types.ObjectId.isValid(subjectIdStr)
            ) {
              const subject = await subjectRepository.findById(
                subjectIdStr,
                tenantIdString,
              );
              if (subject && (subject as any).name) {
                subjectName = (subject as any).name;
              }
            }
          } catch (subjectError: any) {
            console.warn(
              `⚠️ Could not fetch subject name: ${subjectError.message}`,
            );
          }
        }

        // Get parents for each student and send notifications to them
        // Send a separate notification for each parent-child pair
        const parentIds = new Set<string>();
        for (const studentId of studentIds) {
          try {
            const parentsResult =
              await parentChildService.getParentsByChildId(studentId);
            if (
              parentsResult.success &&
              parentsResult.data &&
              Array.isArray(parentsResult.data)
            ) {
              const parents = parentsResult.data;
              parents.forEach((parentRel: any) => {
                const parent = parentRel.parentId;
                if (parent && parent._id) {
                  const parentId = parent._id.toString();
                  // Validate parentId is a valid ObjectId
                  if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
                    parentIds.add(parentId);
                    notifications.push({
                      receiverId: parentId,
                      receiverRole: "PARENT",
                      title: "Your Child's Exam Results Published",
                      content: `The grading for "${examTitle}" has been published. Your child can now view their results.`,
                      senderId:
                        teacherIdString &&
                        mongoose.Types.ObjectId.isValid(teacherIdString)
                          ? teacherIdString
                          : undefined,
                      senderRole: "TEACHER",
                      tenantId: tenantIdString,
                      meta: {
                        entityId: id,
                        entityType: "Exam",
                        examId: id,
                        examTitle: examTitle,
                        examType: releasedExam.examType,
                        totalMarks: releasedExam.totalMarks,
                        studentId: studentId,
                        subjectName: subjectName,
                        notificationType: "exam_released",
                      },
                    });
                  } else {
                    console.warn(
                      `⚠️ Invalid parentId format, skipping: ${parentId}`,
                    );
                  }
                }
              });
            }
          } catch (parentError: any) {
            console.warn(
              `⚠️ Could not fetch parents for student ${studentId}:`,
              parentError.message,
            );
          }
        }

        // Send notification to teacher who released the exam
        if (
          teacherIdString &&
          mongoose.Types.ObjectId.isValid(teacherIdString)
        ) {
          notifications.push({
            receiverId: teacherIdString,
            receiverRole: "TEACHER",
            title: "Exam Released Successfully",
            content: `You have successfully released "${examTitle}". ${studentIds.size} student(s) and ${parentIds.size} parent(s) have been notified.`,
            senderId: undefined, // No sender for system notifications
            senderRole: "SYSTEM",
            tenantId: tenantIdString,
            meta: {
              entityId: id,
              entityType: "Exam",
              examId: id,
              examTitle: examTitle,
              examType: releasedExam.examType,
              totalMarks: releasedExam.totalMarks,
              studentCount: studentIds.size,
              parentCount: parentIds.size,
            },
          });
        }

        // Send all notifications in batches (API limit is 100)
        if (notifications.length > 0) {
          console.log(
            `📤 Sending ${notifications.length} notification(s) for exam release...`,
          );
          const batchSize = 100;
          for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            notificationService
              .sendNotifications(batch)
              .then((result) => {
                console.log(
                  `✅ Successfully sent notification batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notifications.length / batchSize)} for exam release`,
                );
              })
              .catch((notificationError: any) => {
                console.error(
                  `⚠️ Failed to send notification batch ${Math.floor(i / batchSize) + 1} for exam release:`,
                  notificationError.message,
                );
              });
          }
        } else {
          console.warn(
            "⚠️ No valid student IDs found for exam release notifications",
          );
        }
      } else {
        console.warn(
          `⚠️ No students assigned to exam ${id}, skipping notifications`,
        );
      }
    }
  } catch (notificationError: any) {
    // Log error but don't fail the exam release operation
    console.error(
      "⚠️ Error preparing exam release notifications:",
      notificationError.message,
    );
  }

  return {
    exam: releasedExam,
    studentsAttempted,
    studentsGraded,
    totalStudents,
  };
};

/**
 * Transform options array to the expected format
 * Converts string arrays to objects with optionId, optionText, isCorrect
 */
function transformOptions(
  options: any,
  correctAnswer: any,
  questionType: string,
): any[] | null {
  if (!options) {
    return null;
  }

  // If options is not an array, return null
  if (!Array.isArray(options)) {
    return null;
  }

  // If options is already in the correct format (array of objects with optionId), return as-is
  if (
    options.length > 0 &&
    typeof options[0] === "object" &&
    options[0].optionId
  ) {
    return options;
  }

  // If options is an array of strings, transform to objects
  if (options.length > 0 && typeof options[0] === "string") {
    const correctAnswerStr = String(correctAnswer || "").trim();
    const isNumericIndex = /^\d+$/.test(correctAnswerStr);
    const correctIndex = isNumericIndex ? parseInt(correctAnswerStr, 10) : -1;

    return options.map((optionText: string, index: number) => {
      const optionId = String.fromCharCode(65 + index); // A, B, C, D, etc.
      let isCorrect = false;

      if (isNumericIndex) {
        // Compare with option index
        isCorrect = correctIndex === index;
      } else {
        // Compare with option text
        isCorrect = optionText === correctAnswerStr;
      }

      return {
        optionId,
        optionText,
        isCorrect,
      };
    });
  }

  return null;
}

/**
 * Transform weakTopics array to the expected format
 * Converts string arrays to objects with topic, performance, suggestions
 */
function transformWeakTopics(weakTopics: any): Array<{
  topic: string;
  performance: number;
  suggestions: string;
}> {
  if (!weakTopics) {
    return [];
  }

  // If not an array, return empty array
  if (!Array.isArray(weakTopics)) {
    return [];
  }

  // If already in the correct format (array of objects with topic), return as-is
  if (
    weakTopics.length > 0 &&
    typeof weakTopics[0] === "object" &&
    weakTopics[0].topic
  ) {
    // Validate and ensure all required fields exist
    return weakTopics.map((wt: any) => ({
      topic: wt.topic || "",
      performance: typeof wt.performance === "number" ? wt.performance : 0,
      suggestions: wt.suggestions || "",
    }));
  }

  // If weakTopics is an array of strings, transform to objects
  if (weakTopics.length > 0 && typeof weakTopics[0] === "string") {
    return weakTopics.map((topic: string) => ({
      topic: topic || "",
      performance: 0,
      suggestions: "",
    }));
  }

  return [];
}

/**
 * Update analytics in AI service for released exam
 * Sends student data with subjects and AI responses
 */
export async function updateAnalyticsForReleasedExam(
  examId: string,
  tenantId: string,
  options?: {
    studentId?: string;
  }
): Promise<void> {
  const targetStudentId = options?.studentId;
  try {
    // Get all assigned students for the exam
    const assignedStudents =
      await examStudentRepository.getStudentsForExam(examId);

    if (assignedStudents.length === 0) {
      console.log("No students assigned to exam, skipping analytics update");
      return;
    }

    // Get exam details
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      console.error("Exam not found for analytics update");
      return;
    }

    const subjectRepository = new SubjectRepository();
    const analyticsPayload = [];

    // Process each student
    for (const examStudent of assignedStudents) {
      const studentId = examStudent.studentId.toString();

      // Allow targeting a single student when requested
      if (targetStudentId && studentId !== targetStudentId) {
        continue;
      }

      try {
        // Get all graded attempts for this student across all exams (in the same class/subject context)
        // We'll get attempts for the same class and tenant
        const allAttempts = await examAttemptRepository.getStudentExamAttempts(
          studentId,
          undefined, // startDate
          undefined, // examId (all exams)
          undefined, // endDate
        );

        // Filter to only graded attempts that have aiResponse
        const gradedAttemptsWithAI = allAttempts.filter(
          (attempt) => attempt.attemptStatus === "Graded" && attempt.aiResponse,
        );

        if (gradedAttemptsWithAI.length === 0) {
          console.log(
            `No graded attempts with AI data for student ${studentId}, skipping`,
          );
          continue;
        }

        // Group attempts by subject and calculate statistics
        const subjectMap = new Map<
          string,
          { attempts: any[]; subjectName: string }
        >();

        for (const attempt of gradedAttemptsWithAI) {
          const subjectId = attempt.subjectId?.toString() || "";
          if (!subjectId) continue;

          // Get subject name
          let subjectName = "Unknown Subject";
          try {
            const subject = await subjectRepository.findById(
              subjectId,
              tenantId,
            );
            if (subject && (subject as any).name) {
              subjectName = (subject as any).name;
            }
          } catch (err) {
            console.warn(`Could not fetch subject name for ${subjectId}`);
          }

          if (!subjectMap.has(subjectId)) {
            subjectMap.set(subjectId, { attempts: [], subjectName });
          }
          subjectMap.get(subjectId)!.attempts.push(attempt);
        }

        // Build subjects array with statistics
        const subjects = Array.from(subjectMap.entries()).map(
          ([subjectId, data]) => {
            const attempts = data.attempts;
            const totalPercentage = attempts.reduce(
              (sum, att) => sum + (att.percentage || 0),
              0,
            );
            const averageScores =
              attempts.length > 0 ? totalPercentage / attempts.length : 0;

            return {
              subject: data.subjectName,
              examsCompleted: attempts.length,
              averageScores: Math.round(averageScores * 100) / 100, // Round to 2 decimal places
            };
          },
        );

        // Build responses array from aiResponse data with enriched information
        const responses = await Promise.all(
          gradedAttemptsWithAI
            .filter((attempt) => attempt.aiResponse)
            .map(async (attempt) => {
              const aiResponseData = attempt.aiResponse;
              const attemptId = attempt._id.toString();
              const examId = attempt.examId.toString();

              // Format date to ISO string
              const createdAt =
                attempt.submittedAt || attempt.createdAt || new Date();
              const createdAtISO =
                createdAt instanceof Date
                  ? createdAt.toISOString()
                  : new Date(createdAt).toISOString();

              try {
                // Fetch exam answers and questions for this attempt
                const [answers, questions] = await Promise.all([
                  examAnswerRepository.findAnswersByAttemptId(attemptId),
                  examQuestionRepository.findQuestionsByExamId(examId),
                ]);

                // Build question map for quick lookup
                const questionMap = new Map(
                  questions.map((q) => [q._id.toString(), q]),
                );

                // Build answer map for quick lookup
                const answerMap = new Map(
                  answers.map((a) => [a.questionId.toString(), a]),
                );

                // Extract data from aiResponse (handle both wrapped and unwrapped formats)
                let aiData: any = {};
                if (aiResponseData && typeof aiResponseData === "object") {
                  if ("data" in aiResponseData) {
                    aiData = aiResponseData.data || aiResponseData;
                  } else {
                    aiData = aiResponseData;
                  }
                }

                // Transform results array with enriched data from database
                let enrichedResults: any[] = [];

                // If aiResponse has results, enrich them; otherwise build from answers
                if (aiData.results && Array.isArray(aiData.results)) {
                  enrichedResults = aiData.results.map((result: any) => {
                    const questionId = result.questionId?.toString() || "";
                    const question = questionMap.get(questionId);
                    const answer = answerMap.get(questionId);

                    // Build enriched result object
                    const enrichedResult: any = {
                      questionId: questionId,
                      aiQuestionId: question?.aiQuestionId ?? null,
                      marksObtained:
                        result.marksObtained ?? answer?.marksObtained ?? 0,
                      maxMarks:
                        result.maxMarks ??
                        answer?.maxMarks ??
                        question?.marks ??
                        0,
                      isCorrect: result.isCorrect ?? answer?.isCorrect ?? false,
                      feedback: result.feedback ?? answer?.feedback ?? "",
                      gradingNotes:
                        result.gradingNotes ?? answer?.aiGradingNotes ?? "",
                      confidence:
                        result.confidence ?? answer?.aiConfidence ?? null,
                      questionNumber:
                        result.questionNumber ??
                        answer?.questionNumber ??
                        question?.questionNumber ??
                        0,
                      questionText:
                        result.questionText ?? question?.questionText ?? "",
                      questionType:
                        result.questionType ??
                        answer?.questionType ??
                        question?.questionType ??
                        "",
                      studentAnswer:
                        result.studentAnswer ?? answer?.studentAnswer ?? "",
                      correctAnswer:
                        result.correctAnswer ??
                        answer?.correctAnswer ??
                        question?.correctAnswer ??
                        "",
                    };

                    // Add options for MCQ-type questions
                    if (
                      question &&
                      (question.questionType === "MCQs" ||
                        question.questionType === "True/False")
                    ) {
                      enrichedResult.options = transformOptions(
                        question.options,
                        enrichedResult.correctAnswer,
                        enrichedResult.questionType,
                      );
                    } else {
                      enrichedResult.options = null;
                    }

                    return enrichedResult;
                  });
                } else {
                  // Build results from answers if aiResponse doesn't have results
                  enrichedResults = answers.map((answer) => {
                    const questionId = answer.questionId.toString();
                    const question = questionMap.get(questionId);

                    const result: any = {
                      questionId: questionId,
                      aiQuestionId: question?.aiQuestionId ?? null,
                      marksObtained: answer.marksObtained ?? 0,
                      maxMarks: answer.maxMarks ?? question?.marks ?? 0,
                      isCorrect: answer.isCorrect ?? false,
                      feedback: answer.feedback ?? "",
                      gradingNotes: answer.aiGradingNotes ?? "",
                      confidence: answer.aiConfidence ?? null,
                      questionNumber:
                        answer.questionNumber ?? question?.questionNumber ?? 0,
                      questionText: question?.questionText ?? "",
                      questionType:
                        answer.questionType ?? question?.questionType ?? "",
                      studentAnswer: answer.studentAnswer ?? "",
                      correctAnswer:
                        answer.correctAnswer ?? question?.correctAnswer ?? "",
                    };

                    // Add options for MCQ-type questions
                    if (
                      question &&
                      (question.questionType === "MCQs" ||
                        question.questionType === "True/False")
                    ) {
                      result.options = transformOptions(
                        question.options,
                        result.correctAnswer,
                        result.questionType,
                      );
                    } else {
                      result.options = null;
                    }

                    return result;
                  });
                }

                // Get subject name for this attempt
                const subjectId = attempt.subjectId?.toString() || "";
                let attemptSubjectName = "Unknown Subject";
                try {
                  const subject = await subjectRepository.findById(
                    subjectId,
                    tenantId
                  );
                  if (subject && (subject as any).name) {
                    attemptSubjectName = (subject as any).name;
                  }
                } catch (err) {
                  console.warn(`Could not fetch subject name for ${subjectId}`);
                }

                // Build enriched data object with required fields per spec
                // Ensure topic arrays have at least 3 items (spec requirement)
                const normalizeTopicList = (
                  topics: any[] | undefined,
                  minItems: number = 3
                ): string[] => {
                  if (!topics || !Array.isArray(topics)) {
                    return Array(minItems).fill("No data available");
                  }

                  // Extract strings from mixed formats
                  const topicStrings = topics
                    .map((t) =>
                      typeof t === "string"
                        ? t
                        : typeof t === "object" && t.topic
                          ? t.topic
                          : null
                    )
                    .filter((t) => t && typeof t === "string") as string[];

                  // Remove duplicates
                  const unique = [...new Set(topicStrings)];

                  // Pad with defaults if needed
                  while (unique.length < minItems) {
                    unique.push(`Topic ${unique.length + 1}`);
                  }

                  return unique.slice(0, minItems);
                };

                // Normalize skillMastery to ensure proper format
                const normalizeSkillMastery = (
                  skills: any[] | undefined
                ): Array<{ skill: string; performance: number; suggestions: string }> => {
                  if (!skills || !Array.isArray(skills)) {
                    return [];
                  }

                  return skills
                    .map((skill) => {
                      if (typeof skill === "object" && skill.skill) {
                        return {
                          skill: skill.skill || "",
                          performance:
                            typeof skill.performance === "number"
                              ? skill.performance
                              : 0,
                          suggestions: skill.suggestions || "",
                        };
                      }
                      return null;
                    })
                    .filter((s) => s) as Array<{
                    skill: string;
                    performance: number;
                    suggestions: string;
                  }>;
                };

                const enrichedData = {
                  feAttemptId: attemptId, // camelCase per spec
                  totalMarksObtained: attempt.obtainedMarks ?? 0,
                  totalMarks: attempt.totalMarks ?? 0,
                  percentage: attempt.percentage ?? 0,
                  grade: attempt.grade ?? "",
                  questionsGraded: answers.length,
                  results: enrichedResults, // Can be empty array per spec
                  overallAssessment: // Use overallAssessment not overallFeedback
                    aiData.overallAssessment ??
                    aiData.overallFeedback ??
                    attempt.overallAssessment ??
                    attempt.overallFeedback ??
                    attempt.aiFeedback ??
                    "Assessment completed. Review detailed feedback for improvement areas.",
                  skillMastery: normalizeSkillMastery(
                    aiData.skillMastery ?? attempt.skillMastery ?? []
                  ),
                  weakTopics: normalizeTopicList(
                    aiData.weakTopics ?? attempt.weakTopics ?? [],
                    3
                  ),
                  averageTopics: normalizeTopicList(
                    aiData.averageTopics ?? attempt.averageTopics ?? [],
                    3
                  ),
                  strongestTopics: normalizeTopicList(
                    aiData.strongestTopics ?? attempt.strongestTopics ?? [],
                    3
                  ),
                };

                // Return response in expected format with subject field at top level
                return {
                  created_at: createdAtISO,
                  subject: attemptSubjectName,
                  data: enrichedData,
                };
              } catch (error: any) {
                console.error(
                  `Error enriching attempt ${attemptId} data:`,
                  error,
                );
                // Fallback to original structure if enrichment fails
                if (
                  aiResponseData &&
                  typeof aiResponseData === "object" &&
                  "code" in aiResponseData &&
                  "data" in aiResponseData
                ) {
                  return {
                    created_at: createdAtISO,
                    ...aiResponseData,
                  };
                } else {
                  return {
                    created_at: createdAtISO,
                    code: 200,
                    message: "Attempt graded successfully using AI",
                    data: aiResponseData,
                  };
                }
              }
            }),
        );

        // Only add student if they have responses
        // Note: Per spec, we only need feStudentId and responses array
        // We include responses (which have subject field) instead of top-level subjects
        if (responses.length > 0) {
          analyticsPayload.push({
            feStudentId: studentId, // camelCase per spec
            responses,
          });
        }
      } catch (error: any) {
        console.error(
          `Error processing student ${studentId} for analytics:`,
          error,
        );
        // Continue with other students
      }
    }

    // Only make API call if we have data to send
    if (analyticsPayload.length > 0) {
      const aiApiUrl = process.env.BASE_URL || "http://localhost:3005";
      const endpoint = `${aiApiUrl}/ai-llm/api/v1/grading/update-analytics`;
      
      console.log(`[updateAnalyticsForReleasedExam] 🚀 Preparing to POST to update-analytics:`, {
        endpoint,
        studentsCount: analyticsPayload.length,
        studentIds: analyticsPayload.map(p => p.feStudentId),
        examId,
        tenantId,
      });

      // Build classMetadata (optional) from exam context
      const studentIds = Array.from(
        new Set(analyticsPayload.map((p) => p.feStudentId))
      );

      let firstSubject = "Unknown";
      if (
        analyticsPayload.length > 0 &&
        analyticsPayload[0].responses.length > 0
      ) {
        firstSubject = analyticsPayload[0].responses[0].subject || "Unknown";
      }

      const classMetadata = exam.classId && exam.subjectId
        ? {
            classId:
              typeof exam.classId === "object" && exam.classId !== null && "_id" in exam.classId
                ? String((exam.classId as any)._id)
                : typeof exam.classId === "string"
                  ? exam.classId
                  : typeof exam.classId === "number"
                    ? String(exam.classId)
                    : "",
            subject: firstSubject,
            studentIds,
          }
        : undefined;

      // Wrap in 'students' key; include classMetadata when available
      const requestPayload = {
        students: analyticsPayload,
        ...(classMetadata && { classMetadata }),
      };

      console.log(
        `Sending analytics data for ${analyticsPayload.length} students to AI service`
      );

      // Log payload for debugging/share-out
      console.log(
        "[updateAnalyticsForReleasedExam] 📦 update-analytics payload:",
        JSON.stringify(requestPayload, null, 2)
      );

      console.log(`[updateAnalyticsForReleasedExam] 📡 Sending POST request to: ${endpoint}`);
      const response = await axios.post(endpoint, requestPayload, {
        timeout: 30000, // 30 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log(`[updateAnalyticsForReleasedExam] ✅ Successfully updated analytics in AI service:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });
    } else {
      console.log("No analytics data to send");
    }
  } catch (error: any) {
      if (error.response?.data) {
        console.error("AI service validation error:", JSON.stringify(error.response.data, null, 2));
      }
    console.error("Error in updateAnalyticsForReleasedExam:", error);
    throw error;
  }
}

// Unpublish exam
export const unpublishExam = async (
  id: string,
  teacherId: string,
): Promise<IExam> => {
  const exam = await examRepository.findExamById(id);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Only allow unpublishing from Published status
  if (exam.examStatus !== "Published") {
    throw new Error("EXAM_NOT_PUBLISHED");
  }

  // Check if exam has started
  const now = new Date();
  if (new Date(exam.startOn) <= now) {
    throw new Error("EXAM_ALREADY_STARTED");
  }

  // Check if any student has attempted/started the exam
  const attemptCount = await examAttemptRepository.countAttemptsByExamId(id);
  if (attemptCount > 0) {
    throw new Error("EXAM_HAS_STUDENT_ATTEMPTS");
  }

  // Update status to Unpublished
  const unpublishedExam = await examRepository.updateExamStatus(
    id,
    "Unpublished",
  );
  if (!unpublishedExam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  return unpublishedExam;
};

// Assign students to exam
export const assignStudentsToExam = async (
  examId: string,
  data: AssignStudentsRequest,
  teacherId: string,
  tenantId: string,
): Promise<AssignStudentsResponse> => {
  const exam = await examRepository.findExamById(examId);
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  // Check ownership
  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Prepare student assignments
  const studentAssignments = data.studentIds.map((studentId) => ({
    examId: examId,
    studentId: studentId,
    classId: exam.classId.toString(),
    subjectId: exam.subjectId.toString(),
    batchId: exam.batchId.toString(),
    tenantId: tenantId,
  }));

  // Bulk assign students
  const result =
    await examStudentRepository.bulkAssignStudentsToExam(studentAssignments);

  return {
    assignedCount: result.assignedCount,
    alreadyAssignedCount: result.alreadyAssignedCount,
    totalStudents: data.studentIds.length,
  };
};

// Get exam cards data (for dashboard)
export const getExamCardsData = async (
  tenantId: string,
  teacherId: string,
): Promise<ExamCardData[]> => {
  try {
    const exams = await examRepository.findExamsByTeacher(teacherId, tenantId);

    const examCards = await Promise.all(
      exams.map(async (exam) => {
        const questionCount = await examQuestionRepository.countExamQuestions(
          exam._id.toString(),
        );
        const studentCount = await examStudentRepository.countStudentsForExam(
          exam._id.toString(),
        );

        return {
          _id: exam._id.toString(),
          examTitle: exam.examTitle,
          examType: exam.examType,
          examStatus: exam.examStatus,
          totalMarks: exam.totalMarks,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          questionCount,
          studentCount,
        } as ExamCardData;
      }),
    );

    return examCards;
  } catch (error) {
    console.error("Error getting exam cards data:", error);
    throw error;
  }
};

// Search exams
export const searchExams = async (
  searchTerm: string,
  tenantId: string,
  teacherId: string,
  params: {
    pageNo?: number;
    pageSize?: number;
    examStatus?: string;
    examType?: string;
  },
): Promise<GetAllExamsResponse> => {
  const searchParams = {
    ...params,
    search: searchTerm,
    tenantId: tenantId,
    teacherId: teacherId,
  };

  return await getAllExams(searchParams);
};

// Get published exams DDL list for teacher
export const getPublishedExamsDDL = async (
  teacherId: string,
  tenantId: string,
  filters?: {
    id?: string;
    name?: string;
    classId?: string;
    subjectId?: string;
  },
): Promise<any[]> => {
  try {
    const exams = await examRepository.findPublishedExamsByTeacher(
      teacherId,
      tenantId,
      filters,
    );
    return exams;
  } catch (error) {
    console.error("Get published exams DDL error:", error);
    throw error;
  }
};

// ============================================================================
// EXAM QUESTION MANAGEMENT FUNCTIONS (Consolidated from examQuestion.service)
// ============================================================================

// Create new exam question
export const createExamQuestion = async (
  data: CreateExamQuestionRequest,
  teacherId: string,
  tenantId: string,
): Promise<IExamQuestion> => {
  try {
    // Verify exam exists and belongs to teacher
    const exam = await examRepository.findExamById(data.examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    if (exam.teacherId.toString() !== teacherId) {
      throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
    }

    // Only allow adding questions if exam is in Draft or Unpublished status
    if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
      throw new Error("EXAM_CANNOT_BE_MODIFIED");
    }

    // Check if question number already exists
    const exists = await examQuestionRepository.checkQuestionNumberExists(
      data.examId,
      data.questionNumber,
    );
    if (exists) {
      throw new Error("QUESTION_NUMBER_EXISTS");
    }

    // Add teacherId and tenantId
    const questionData = {
      ...data,
      teacherId: teacherId,
      tenantId: tenantId,
    };

    const question =
      await examQuestionRepository.createExamQuestion(questionData);

    return question;
  } catch (error) {
    console.error("Create exam question error:", error);
    throw error;
  }
};

// Get exam question by ID
export const getExamQuestionById = async (
  id: string,
): Promise<IExamQuestion> => {
  const question = await examQuestionRepository.findExamQuestionById(id);
  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }
  return question;
};

// Get all questions for an exam
export const getAllExamQuestions = async (
  params: GetAllExamQuestionsRequest,
): Promise<GetAllExamQuestionsResponse> => {
  try {
    const questions = await examQuestionRepository.findExamQuestions(params);
    const total = await examQuestionRepository.countExamQuestions(
      params.examId,
    );
    const byType = await examQuestionRepository.countQuestionsByType(
      params.examId,
    );
    const byDifficulty =
      await examQuestionRepository.countQuestionsByDifficulty(params.examId);

    return {
      questions,
      total,
      byType,
      byDifficulty,
    };
  } catch (error) {
    console.error("Get all exam questions error:", error);
    throw error;
  }
};

// Update exam question
export const updateExamQuestion = async (
  id: string,
  data: UpdateExamQuestionRequest,
  teacherId: string,
): Promise<IExamQuestion> => {
  const question = await examQuestionRepository.findExamQuestionById(id);
  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  // Verify exam exists and belongs to teacher
  const exam = await examRepository.findExamById(question.examId.toString());
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Only allow updates if exam is in Draft or Unpublished status
  if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
    throw new Error("EXAM_CANNOT_BE_MODIFIED");
  }

  // Check if question number already exists (if being updated)
  if (data.questionNumber && data.questionNumber !== question.questionNumber) {
    const exists = await examQuestionRepository.checkQuestionNumberExists(
      question.examId.toString(),
      data.questionNumber,
      id,
    );
    if (exists) {
      throw new Error("QUESTION_NUMBER_EXISTS");
    }
  }

  // Update question
  const updatedQuestion = await examQuestionRepository.updateExamQuestionById(
    id,
    data,
  );
  if (!updatedQuestion) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  return updatedQuestion;
};

// Delete exam question
export const deleteExamQuestion = async (
  id: string,
  teacherId: string,
): Promise<IExamQuestion | null> => {
  const question = await examQuestionRepository.findExamQuestionById(id);
  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  // Verify exam exists and belongs to teacher
  const exam = await examRepository.findExamById(question.examId.toString());
  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  if (exam.teacherId.toString() !== teacherId) {
    throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
  }

  // Only allow deletion if exam is in Draft or Unpublished status
  if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
    throw new Error("EXAM_CANNOT_BE_MODIFIED");
  }

  // Soft delete question
  const deletedQuestion =
    await examQuestionRepository.softDeleteExamQuestionById(id);
  return deletedQuestion;
};

// Bulk create questions with transaction support
export const bulkCreateQuestions = async (
  data: BulkCreateQuestionsRequest,
  teacherId: string,
  tenantId: string,
): Promise<BulkCreateQuestionsResponse> => {
  return await TransactionHelper.executeWithTransaction(
    async (session: mongoose.ClientSession) => {
      try {
        // Verify exam exists and belongs to teacher
        const exam = await examRepository.findExamById(data.examId);
        if (!exam) {
          throw new Error("EXAM_NOT_FOUND");
        }

        if (exam.teacherId.toString() !== teacherId) {
          throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
        }

        // Only allow adding questions if exam is in Draft or Unpublished status
        if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
          throw new Error("EXAM_CANNOT_BE_MODIFIED");
        }

        // Get next question number
        let nextQuestionNumber =
          await examQuestionRepository.getNextQuestionNumber(data.examId);

        // Prepare questions with auto-incremented question numbers
        const questionsToCreate = data.questions.map((q, index) => ({
          ...q,
          examId: data.examId,
          questionNumber: q.questionNumber || nextQuestionNumber + index,
          teacherId: teacherId,
          tenantId: tenantId,
        }));

        // Bulk create with session
        const createdQuestions =
          await examQuestionRepository.bulkCreateQuestions(
            questionsToCreate,
            session,
          );

        return {
          createdCount: createdQuestions.length,
          questions: createdQuestions,
        };
      } catch (error) {
        console.error("Bulk create questions error:", error);
        throw error;
      }
    },
  );
};

// Reorder questions
export const reorderQuestions = async (
  examId: string,
  data: ReorderQuestionsRequest,
  teacherId: string,
): Promise<void> => {
  try {
    // Verify exam exists and belongs to teacher
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    if (exam.teacherId.toString() !== teacherId) {
      throw new Error("EXAM_NOT_OWNED_BY_TEACHER");
    }

    // Only allow reordering if exam is in Draft or Unpublished status
    if (exam.examStatus !== "Draft" && exam.examStatus !== "Unpublished") {
      throw new Error("EXAM_CANNOT_BE_MODIFIED");
    }

    // Reorder questions
    await examQuestionRepository.reorderQuestions(data.questionOrders);
  } catch (error) {
    console.error("Reorder questions error:", error);
    throw error;
  }
};

// Update question success rate
export const updateQuestionSuccessRate = async (
  questionId: string,
  successRate: number,
): Promise<IExamQuestion | null> => {
  try {
    const question = await examQuestionRepository.updateQuestionSuccessRate(
      questionId,
      successRate,
    );
    if (!question) {
      throw new Error("QUESTION_NOT_FOUND");
    }
    return question;
  } catch (error) {
    console.error("Update question success rate error:", error);
    throw error;
  }
};

// Get next question number for exam
export const getNextQuestionNumber = async (
  examId: string,
): Promise<number> => {
  try {
    return await examQuestionRepository.getNextQuestionNumber(examId);
  } catch (error) {
    console.error("Get next question number error:", error);
    throw error;
  }
};

// Get quick exam list (limited to 30 records with filters)
export const getQuickExamList = async (params: {
  tenantId: string;
  query?: Record<string, any>;
  sort?: Record<string, any>;
}): Promise<IExam[]> => {
  try {
    const { tenantId, query = {}, sort = { createdAt: -1 } } = params;

    if (!tenantId) {
      throw new Error("TENANT_ID_REQUIRED");
    }

    const exams = await examRepository.findQuickExamList({
      tenantId,
      query,
      sort,
    });

    return exams;
  } catch (error) {
    console.error("Get quick exam list error:", error);
    throw error;
  }
};

// Get school performance for a specific month
export const getSchoolPerformance = async (
  tenantId: string,
  currentMonth: string,
): Promise<SchoolPerformanceResponse> => {
  try {
    if (!tenantId) {
      throw new Error("TENANT_ID_REQUIRED");
    }

    // Validate currentMonth format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(currentMonth)) {
      throw new Error("INVALID_MONTH_FORMAT");
    }

    // Parse currentMonth to get start and end dates
    const [year, month] = currentMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 1, 0, 0, 0, 0); // First day of next month

    // Calculate previous month dates
    const previousMonthStart = new Date(year, month - 2, 1, 0, 0, 0, 0);
    const previousMonthEnd = new Date(year, month - 1, 1, 0, 0, 0, 0);

    // Get current month data
    const currentMonthData = await examRepository.getSchoolPerformanceData({
      tenantId,
      monthStart,
      monthEnd,
    });

    // Get previous month data
    const previousMonthData = await examRepository.getSchoolPerformanceData({
      tenantId,
      monthStart: previousMonthStart,
      monthEnd: previousMonthEnd,
    });

    // Calculate overall average for current month (average of all subject averages)
    const currentOverallAverage =
      currentMonthData.length > 0
        ? currentMonthData.reduce(
            (sum, subject) => sum + subject.averagePercentage,
            0,
          ) / currentMonthData.length
        : 0;

    // Calculate overall average for previous month
    const previousOverallAverage =
      previousMonthData.length > 0
        ? previousMonthData.reduce(
            (sum, subject) => sum + subject.averagePercentage,
            0,
          ) / previousMonthData.length
        : 0;

    // Calculate month-over-month increase
    // Formula: ((current - previous) / previous) * 100
    let monthOverMonthIncrease = 0;
    if (previousOverallAverage > 0) {
      monthOverMonthIncrease =
        ((currentOverallAverage - previousOverallAverage) /
          previousOverallAverage) *
        100;
    } else if (currentOverallAverage > 0) {
      // If previous month had no data but current month has data, it's 100% increase
      monthOverMonthIncrease = 100;
    }
    // If both are 0, monthOverMonthIncrease remains 0

    // Round values to 2 decimal places
    const roundedCurrentAverage = Math.round(currentOverallAverage * 100) / 100;
    const roundedPreviousAverage =
      Math.round(previousOverallAverage * 100) / 100;
    const roundedIncrease = Math.round(monthOverMonthIncrease * 100) / 100;

    return {
      currentMonth,
      subjects: currentMonthData,
      overallAverage: roundedCurrentAverage,
      previousMonthAverage: roundedPreviousAverage,
      monthOverMonthIncrease: roundedIncrease,
    };
  } catch (error) {
    console.error("Get school performance error:", error);
    throw error;
  }
};

interface TimeWindow {
  start: Date;
  end: Date;
}

/**
 * Sends scheduled notifications for exams to students and teachers.
 * Called by Lambda on a schedule (e.g. every hour).
 */
export const sendExamNotifications = async (
  lookAhead: TimeWindow,
  lookBack: TimeWindow,
): Promise<{
  students: {
    upcomingExams: { processed: number; notified: number };
    expiringExams: { processed: number; notified: number };
  };
  teachers: {
    upcomingGrading: { processed: number; notified: number };
    readyForGrading: { processed: number; notified: number };
  };
  totals: {
    processedCount: number;
    notifiedCount: number;
    errorsCount: number;
  };
  errors: string[];
}> => {
  const errors: string[] = [];
  const results = {
    students: {
      upcomingExams: { processed: 0, notified: 0 },
      expiringExams: { processed: 0, notified: 0 },
    },
    teachers: {
      upcomingGrading: { processed: 0, notified: 0 },
      readyForGrading: { processed: 0, notified: 0 },
    },
  };

  try {
    // Notify students about exams starting soon

    const upcomingExams = await examRepository.findExamsStartingInWindow(
      lookAhead.start,
      lookAhead.end,
    );
    console.log(`   Found ${upcomingExams.length} exams starting soon`);

    for (const exam of upcomingExams) {
      try {
        results.students.upcomingExams.processed++;

        const studentIds = await examStudentRepository.getStudentIdsForExam(
          exam._id.toString(),
        );
        if (studentIds.length === 0) continue;

        const teacherId = exam.teacherId.toString();
        const tenantId = exam.tenantId.toString();
        const teacherName = await fetchUserNames([teacherId]).then(
          (names) => names[teacherId] || "Teacher",
        );

        const startDate = new Date(exam.startOn).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const notifications: notificationService.INotificationRequest[] =
          studentIds.map((studentId) => ({
            receiverId: studentId,
            receiverRole: "STUDENT",
            title: `Upcoming Exam: ${exam.examTitle}`,
            content: `Your ${exam.examType.toLowerCase()} exam "${
              exam.examTitle
            }" by ${teacherName} starts on ${startDate}. Duration: ${
              exam.durationInMinutes
            } minutes. Good luck!`,
            senderId: teacherId,
            senderRole: "TEACHER",
            tenantId,
            meta: {
              entityId: exam._id.toString(),
              entityType: "Exam",
              notificationType: "UpcomingExam",
              examTitle: exam.examTitle,
              startOn: exam.startOn,
            },
          }));

        await notificationService.sendNotifications(notifications);
        results.students.upcomingExams.notified += studentIds.length;
      } catch (err: any) {
        errors.push(`[UpcomingExam] ${exam._id}: ${err.message}`);
      }
    }

    // Warn students who haven't attempted exams that are about to end

    const expiringExams = await examRepository.findExamsEndingInWindow(
      lookAhead.start,
      lookAhead.end,
    );
    console.log(`   Found ${expiringExams.length} exams ending soon`);

    for (const exam of expiringExams) {
      try {
        results.students.expiringExams.processed++;

        // skip students who already started/completed
        const studentIds =
          await examStudentRepository.getStudentIdsNotAttempted(
            exam._id.toString(),
          );
        if (studentIds.length === 0) continue;

        const teacherId = exam.teacherId.toString();
        const tenantId = exam.tenantId.toString();

        const endDate = new Date(exam.endOn).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const notifications: notificationService.INotificationRequest[] =
          studentIds.map((studentId) => ({
            receiverId: studentId,
            receiverRole: "STUDENT",
            title: `âš ï¸ Exam Ending Soon: ${exam.examTitle}`,
            content: `Your ${exam.examType.toLowerCase()} exam "${
              exam.examTitle
            }" ends on ${endDate}. This is your last chance to complete it!`,
            senderId: teacherId,
            senderRole: "SYSTEM",
            tenantId,
            meta: {
              entityId: exam._id.toString(),
              entityType: "Exam",
              notificationType: "ExamExpiring",
              examTitle: exam.examTitle,
              endOn: exam.endOn,
            },
          }));

        await notificationService.sendNotifications(notifications);
        results.students.expiringExams.notified += studentIds.length;
      } catch (err: any) {
        errors.push(`[ExpiringExam] ${exam._id}: ${err.message}`);
      }
    }

    // Heads up for teachers - exams ending soon will need grading

    for (const exam of expiringExams) {
      try {
        results.teachers.upcomingGrading.processed++;

        const teacherId = exam.teacherId.toString();
        const tenantId = exam.tenantId.toString();
        const teacherName = await fetchUserNames([teacherId]).then(
          (names) => names[teacherId] || "Teacher",
        );

        const studentStats = await gradingRepository.countStudentsByStatus(
          exam._id.toString(),
        );
        const endDate = new Date(exam.endOn).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const notification: notificationService.INotificationRequest = {
          receiverId: teacherId,
          receiverRole: "TEACHER",
          title: `Grading Coming Up: ${exam.examTitle}`,
          content: `Hi ${teacherName}, your exam "${exam.examTitle}" ends on ${endDate}. ${studentStats.totalStudents} student(s) are assigned. Grading will be needed soon.`,
          senderId: teacherId,
          senderRole: "SYSTEM",
          tenantId,
          meta: {
            entityId: exam._id.toString(),
            entityType: "Exam",
            notificationType: "UpcomingGrading",
            examTitle: exam.examTitle,
            endOn: exam.endOn,
            totalStudents: studentStats.totalStudents,
          },
        };

        await notificationService.sendNotifications([notification]);
        results.teachers.upcomingGrading.notified++;
      } catch (err: any) {
        errors.push(`[UpcomingGrading] ${exam._id}: ${err.message}`);
      }
    }

    // Tell teachers their exams just ended and need grading

    const readyForGradingExams = await examRepository.findExamsNeedingGrading(
      lookBack.start,
      lookBack.end,
    );
    console.log(
      `   Found ${
        readyForGradingExams.length
      } exams ready for grading (ended between ${lookBack.start.toISOString()} and ${lookBack.end.toISOString()})`,
    );

    for (const exam of readyForGradingExams) {
      try {
        results.teachers.readyForGrading.processed++;

        const teacherId = exam.teacherId.toString();
        const tenantId = exam.tenantId.toString();
        const teacherName = await fetchUserNames([teacherId]).then(
          (names) => names[teacherId] || "Teacher",
        );

        const studentStats = await gradingRepository.countStudentsByStatus(
          exam._id.toString(),
        );
        const attemptedCount = studentStats.studentsCompleted;

        const endedAt = new Date(exam.endOn).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const notification: notificationService.INotificationRequest = {
          receiverId: teacherId,
          receiverRole: "TEACHER",
          title: `Grading Required: ${exam.examTitle}`,
          content: `Hi ${teacherName}, your ${exam.examType.toLowerCase()} exam "${
            exam.examTitle
          }" ended on ${endedAt}. ${attemptedCount} student(s) have submitted and are waiting for grading.`,
          senderId: teacherId,
          senderRole: "SYSTEM",
          tenantId,
          meta: {
            entityId: exam._id.toString(),
            entityType: "Exam",
            notificationType: "ReadyForGrading",
            examTitle: exam.examTitle,
            endedAt: exam.endOn,
            attemptedCount,
            totalStudents: studentStats.totalStudents,
          },
        };

        await notificationService.sendNotifications([notification]);
        results.teachers.readyForGrading.notified++;
      } catch (err: any) {
        errors.push(`[ReadyForGrading] ${exam._id}: ${err.message}`);
      }
    }

    const totals = {
      processedCount:
        results.students.upcomingExams.processed +
        results.students.expiringExams.processed +
        results.teachers.upcomingGrading.processed +
        results.teachers.readyForGrading.processed,
      notifiedCount:
        results.students.upcomingExams.notified +
        results.students.expiringExams.notified +
        results.teachers.upcomingGrading.notified +
        results.teachers.readyForGrading.notified,
      errorsCount: errors.length,
    };

    console.log(
      `   Students - Upcoming: ${results.students.upcomingExams.notified}, Expiring: ${results.students.expiringExams.notified}`,
    );
    console.log(
      `   Teachers - Upcoming Grading: ${results.teachers.upcomingGrading.notified}, Ready: ${results.teachers.readyForGrading.notified}`,
    );
    console.log(`   Errors: ${errors.length}`);

    return {
      students: results.students,
      teachers: results.teachers,
      totals,
      errors,
    };
  } catch (error: any) {
    console.error("Send exam notifications error:", error);
    throw error;
  }
};

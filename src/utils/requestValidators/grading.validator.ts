import { z } from "zod";

/**
 * Grading Validators - Zod validation schemas for teacher grading APIs
 */

// Auto-grade Schema
export const autoGradeSchema = z.object({
  attemptId: z
    .string()
    .min(1, "Attempt ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Attempt ID must be a valid MongoDB ObjectId"),
});

// Get Pending Submissions Schema
export const getPendingSubmissionsSchema = z.object({
  examId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId")
    .optional(),
  pageNo: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10)),
  sortBy: z.enum(["submittedAt", "studentName"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// Manual Grade Answer Schema
export const manualGradeAnswerSchema = z.object({
  answerId: z
    .string()
    .min(1, "Answer ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Answer ID must be a valid MongoDB ObjectId"),
  marksObtained: z.number().min(0, "Marks obtained cannot be negative"),
  isCorrect: z.boolean(),
  feedback: z.string().max(1000, "Feedback is too long").optional(),
  teacherComment: z.string().max(500, "Teacher comment is too long").optional(),
});

// Manual Grade Attempt Schema
export const manualGradeAttemptSchema = z.object({
  attemptId: z
    .string()
    .min(1, "Attempt ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Attempt ID must be a valid MongoDB ObjectId"),
  answers: z
    .array(
      z.object({
        answerId: z
          .string()
          .min(1, "Answer ID is required")
          .regex(
            /^[0-9a-fA-F]{24}$/,
            "Answer ID must be a valid MongoDB ObjectId"
          ),
        marksObtained: z.number().min(0, "Marks obtained cannot be negative"),
        isCorrect: z.boolean(),
        feedback: z.string().max(1000, "Feedback is too long").optional(),
        teacherComment: z
          .string()
          .max(500, "Teacher comment is too long")
          .optional(),
      })
    )
    .min(1, "At least one answer is required"),
});

// Update Marks Schema
export const updateMarksSchema = z.object({
  answerId: z
    .string()
    .min(1, "Answer ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Answer ID must be a valid MongoDB ObjectId"),
  marksObtained: z.number().min(0, "Marks obtained cannot be negative"),
  feedback: z.string().max(1000, "Feedback is too long").optional(),
  teacherComment: z.string().max(500, "Teacher comment is too long").optional(),
});

// Publish Results Schema
export const publishResultsSchema = z.object({
  attemptId: z
    .string()
    .min(1, "Attempt ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Attempt ID must be a valid MongoDB ObjectId"),
});

// Get Grading Statistics Schema
export const getGradingStatisticsSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
});

// Get Exam Leaderboard Schema
export const getExamLeaderboardSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10)),
});

// Bulk Grade Schema
export const bulkGradeSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
  attemptIds: z
    .array(
      z
        .string()
        .regex(
          /^[0-9a-fA-F]{24}$/,
          "Each attempt ID must be a valid MongoDB ObjectId"
        )
    )
    .min(1, "At least one attempt ID is required")
    .max(100, "Cannot grade more than 100 attempts at once"),
});

// Get Question Performance Schema
export const getQuestionPerformanceSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
});

// Attempt ID Param Schema
export const attemptIdParamSchema = z.object({
  attemptId: z
    .string()
    .min(1, "Attempt ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Attempt ID must be a valid MongoDB ObjectId"),
});

// Exam ID Param Schema
export const examIdParamSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
});

// Submit Grading Schema
export const submitGradingSchema = z.object({
  examId: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
  studentId: z
    .string()
    .min(1, "Student ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Student ID must be a valid MongoDB ObjectId"),
  attemptId: z
    .string()
    .min(1, "Attempt ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Attempt ID must be a valid MongoDB ObjectId"),
  answers: z
    .array(
      z.object({
        questionId: z
          .string()
          .min(1, "Question ID is required")
          .regex(
            /^[0-9a-fA-F]{24}$/,
            "Question ID must be a valid MongoDB ObjectId"
          ),
        // Teacher data
        marksObtained: z
          .number()
          .min(0, "Marks obtained cannot be negative")
          .optional(),
        teacherComment: z
          .string()
          .max(500, "Teacher comment is too long")
          .optional(),
        feedback: z.string().max(1000, "Feedback is too long").optional(),
        // AI Grading fields (merged into same object)
        aiGradingNotes: z
          .string()
          .max(1000, "AI grading notes is too long")
          .optional(),
        aiConfidence: z
          .number()
          .min(0, "AI confidence cannot be negative")
          .max(1, "AI confidence cannot exceed 1")
          .optional(),
        aiFeedback: z.string().max(1000, "AI feedback is too long").optional(),
        aiMarksObtained: z
          .number()
          .min(0, "AI marks obtained cannot be negative")
          .optional(),
        isCorrect: z.boolean().optional(), // Can come from AI or be set by teacher
      })
    )
    .min(1, "At least one answer is required"),
  feedback: z.string().max(1000, "Feedback is too long").optional(),
  aiPrompt: z.string().max(2000, "AI prompt is too long").optional(),
  recommendedResources: z
    .array(
      z.object({
        title: z
          .string()
          .min(1, "Resource title is required")
          .max(200, "Resource title is too long"),
        url: z
          .string()
          .url("Resource URL must be a valid URL")
          .max(500, "Resource URL is too long"),
        description: z
          .string()
          .max(500, "Resource description is too long")
          .optional(),
      })
    )
    .optional(),
  // AI Grading analysis fields
  overallFeedback: z.string().max(5000, "Overall feedback is too long").optional(),
  gapAnalysis: z.string().max(5000, "Gap analysis is too long").optional(),
  weakTopics: z
    .array(
      z.object({
        topic: z.string().min(1, "Topic name is required").max(200, "Topic name is too long"),
        performance: z
          .number()
          .min(0, "Performance cannot be negative")
          .max(100, "Performance cannot exceed 100"),
        suggestions: z.string().max(1000, "Suggestions are too long"),
      })
    )
    .optional(),
  // AI Response - stores the entire AI grading response (mixed type)
  aiResponse: z.any().optional(),
});

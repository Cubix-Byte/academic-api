import { z } from "zod";

/**
 * Exam Validation Schemas
 * Zod schemas for validating exam-related requests
 */

// Nested Data Schemas (Simplified)
const examQuestionSchema = z.object({
  questionNumber: z.number().int().min(1),
  questionType: z.string().min(1),
  questionGenerateType: z.string().min(1),
  questionText: z.string().min(1),
  marks: z.number().int().min(1),
  options: z
    .array(
      z.object({
        optionId: z.string(),
        optionText: z.string(),
        isCorrect: z.boolean(),
      })
    )
    .optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  imageUrl: z
    .union([z.string(), z.literal("")])
    .nullable()
    .optional(),
  videoUrl: z
    .union([z.string(), z.literal("")])
    .nullable()
    .optional(),
  questionContent: z.array(z.string()).optional(),
  difficulty: z.string().optional(),
  aiQuestionId: z.string().optional(),
});

const examStudentSchema = z.object({
  studentId: z.string().min(1),
});

const examContentSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().min(0),
});

const examAIPromptHistorySchema = z.object({
  prompt: z.string().min(1),
  response: z.string().min(1),
  aiModel: z.string().min(1),
  tokensUsed: z.number().int().min(0),
});

const examSettingSchema = z.object({
  settingKey: z.string().min(1),
  settingValue: z.string().min(1),
  settingType: z.string().min(1),
  description: z.string().optional(),
});

const topicBreakdownSchema = z.object({
  topic: z.string().min(1, "Topic name is required").trim(),
  percentage: z
    .number()
    .min(0, "Percentage must be at least 0")
    .max(100, "Percentage must be at most 100"),
  questionCount: z
    .number()
    .int("Question count must be an integer")
    .min(0, "Question count must be at least 0"),
  totalMarks: z.number().min(0, "Total marks must be at least 0"),
});

const selectedDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  fileSize: z.number().int().min(0),
  subject: z.string().optional(),
  grade: z.string().optional(),
});

const sourceConfigSchema = z.object({
  file_id: z.string().min(1),
  topics: z.array(z.string()).default([]),
});

// Create Exam Request Schema (Basic)
export const createExamSchema = z
  .object({
    examTitle: z
      .string()
      .min(1, "Exam title is required")
      .max(200, "Exam title must be less than 200 characters")
      .trim(),
    description: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Description must be less than 1000 characters")
      .trim(),
    classId: z
      .string()
      .min(1, "Class ID is required")
      .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId"),
    subjectId: z
      .string()
      .min(1, "Subject ID is required")
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Subject ID must be a valid MongoDB ObjectId"
      ),
    batchId: z
      .string()
      .min(1, "Batch ID is required")
      .regex(/^[0-9a-fA-F]{24}$/, "Batch ID must be a valid MongoDB ObjectId"),
    examType: z.enum(["Official", "Practice", "Exam Repository"], {
      errorMap: () => ({
        message: "Exam type must be Official, Practice, or Exam Repository",
      }),
    }),
    examModeId: z
      .string()
      .min(1, "Exam mode ID is required")
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Exam mode ID must be a valid MongoDB ObjectId"
      ),
    totalMarks: z
      .number()
      .int("Total marks must be an integer")
      .min(1, "Total marks must be at least 1")
      .max(1000, "Total marks must be at most 1000"),
    passingMarks: z
      .number()
      .int("Passing marks must be an integer")
      .min(0, "Passing marks must be at least 0")
      .max(1000, "Passing marks must be at most 1000"),
    maxAttempts: z
      .number()
      .int("Max attempts must be an integer")
      .min(1, "Max attempts must be at least 1")
      .max(10, "Max attempts must be at most 10"),
    durationInMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be at least 1 minute")
      .max(480, "Duration must be at most 480 minutes (8 hours)"),
    startOn: z.string().datetime("Start date must be a valid ISO datetime"),
    endOn: z.string().datetime("End date must be a valid ISO datetime"),
    topicBreakdown: z.array(topicBreakdownSchema).optional(),
    shouldPublish: z.boolean().optional(),
    selectedDocuments: z.array(selectedDocumentSchema).optional(),
    sourceConfig: z.array(sourceConfigSchema).optional(),
  })
  .refine(
    (data) => {
      return new Date(data.endOn) > new Date(data.startOn);
    },
    {
      message: "End date must be after start date",
      path: ["endOn"],
    }
  );

// Create Exam Request Schema (Enhanced with Nested Data)
export const createExamWithNestedDataSchema = z
  .object({
    examTitle: z
      .string()
      .min(1, "Exam title is required")
      .max(200, "Exam title must be less than 200 characters")
      .trim(),
    description: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Description must be less than 1000 characters")
      .trim(),
    classId: z
      .string()
      .min(1, "Class ID is required")
      .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId"),
    subjectId: z
      .string()
      .min(1, "Subject ID is required")
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Subject ID must be a valid MongoDB ObjectId"
      ),
    batchId: z
      .string()
      .min(1, "Batch ID is required")
      .regex(/^[0-9a-fA-F]{24}$/, "Batch ID must be a valid MongoDB ObjectId"),
    examType: z.enum(["Official", "Practice", "Exam Repository"], {
      errorMap: () => ({
        message: "Exam type must be Official, Practice, or Exam Repository",
      }),
    }),
    examModeId: z
      .string()
      .min(1, "Exam mode ID is required")
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Exam mode ID must be a valid MongoDB ObjectId"
      ),
    totalMarks: z
      .number()
      .int("Total marks must be an integer")
      .min(1, "Total marks must be at least 1")
      .max(1000, "Total marks must be at most 1000"),
    passingMarks: z
      .number()
      .int("Passing marks must be an integer")
      .min(0, "Passing marks must be at least 0")
      .max(1000, "Passing marks must be at most 1000"),
    maxAttempts: z
      .number()
      .int("Max attempts must be an integer")
      .min(1, "Max attempts must be at least 1")
      .max(10, "Max attempts must be at most 10"),
    durationInMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be at least 1 minute")
      .max(480, "Duration must be at most 480 minutes (8 hours)"),
    startOn: z.string().datetime("Start date must be a valid ISO datetime"),
    endOn: z.string().datetime("End date must be a valid ISO datetime"),
    topicBreakdown: z.array(topicBreakdownSchema).optional(),
    aiExamId: z.string().optional(),

    // Nested Data (Optional)
    exam_questions: z.array(examQuestionSchema).optional(),
    exam_students: z.array(examStudentSchema).optional(),
    exam_contents: z.array(examContentSchema).optional(),
    exam_ai_prompt_history: z.array(examAIPromptHistorySchema).optional(),
    exam_settings: z.array(examSettingSchema).optional(),
    shouldPublish: z.boolean().optional(),
    selectedDocuments: z.array(selectedDocumentSchema).optional(),
    sourceConfig: z.array(sourceConfigSchema).optional(),
  })
  .refine(
    (data) => {
      return new Date(data.endOn) > new Date(data.startOn);
    },
    {
      message: "End date must be after start date",
      path: ["endOn"],
    }
  );

// Update Exam Request Schema
export const updateExamSchema = z
  .object({
    examTitle: z
      .string()
      .min(1, "Exam title is required")
      .max(200, "Exam title must be less than 200 characters")
      .trim()
      .optional(),
    description: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Description must be less than 1000 characters")
      .trim()
      .optional(),
    classId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId")
      .optional(),
    subjectId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Subject ID must be a valid MongoDB ObjectId")
      .optional(),
    batchId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Batch ID must be a valid MongoDB ObjectId")
      .optional(),
    examType: z.enum(["Official", "Practice", "Exam Repository"]).optional(),
    examModeId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Exam mode ID must be a valid MongoDB ObjectId"
      )
      .optional(),
    totalMarks: z
      .number()
      .int("Total marks must be an integer")
      .min(1, "Total marks must be at least 1")
      .max(1000, "Total marks must be at most 1000")
      .optional(),
    passingMarks: z
      .number()
      .int("Passing marks must be an integer")
      .min(0, "Passing marks must be at least 0")
      .max(1000, "Passing marks must be at most 1000")
      .optional(),
    maxAttempts: z
      .number()
      .int("Max attempts must be an integer")
      .min(1, "Max attempts must be at least 1")
      .max(10, "Max attempts must be at most 10")
      .optional(),
    durationInMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be at least 1 minute")
      .max(480, "Duration must be at most 480 minutes")
      .optional(),
    startOn: z
      .string()
      .datetime("Start date must be a valid ISO datetime")
      .optional(),
    endOn: z
      .string()
      .datetime("End date must be a valid ISO datetime")
      .optional(),
    examStatus: z
      .enum([
        "Draft",
        "Unpublished",
        "Published",
        "In Progress",
        "Completed",
        "Cancelled",
      ])
      .optional(),
    topicBreakdown: z.array(topicBreakdownSchema).optional(),
    shouldPublish: z.boolean().optional(),
    selectedDocuments: z.array(selectedDocumentSchema).optional(),
    sourceConfig: z.array(sourceConfigSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.startOn && data.endOn) {
        return new Date(data.endOn) > new Date(data.startOn);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endOn"],
    }
  );

// Get All Exams Query Schema
export const getAllExamsSchema = z.object({
  pageNo: z
    .string()
    .regex(/^\d+$/, "Page number must be a positive integer")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Page number must be greater than 0")
    .optional(),
  pageSize: z
    .string()
    .regex(/^\d+$/, "Page size must be a positive integer")
    .transform((val) => parseInt(val, 10))
    .refine(
      (val) => val > 0 && val <= 100,
      "Page size must be between 1 and 100"
    )
    .optional(),
  search: z
    .string()
    .min(1, "Search term cannot be empty")
    .max(100, "Search term must be less than 100 characters")
    .optional(),
  examStatus: z
    .enum([
      "Draft",
      "Unpublished",
      "Published",
      "In Progress",
      "Completed",
      "Cancelled",
    ])
    .optional(),
  examType: z.enum(["Official", "Practice", "Exam Repository"]).optional(),
  classId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId")
    .optional(),
  subjectId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Subject ID must be a valid MongoDB ObjectId")
    .optional(),
  batchId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Batch ID must be a valid MongoDB ObjectId")
    .optional(),
});

// Exam ID Parameter Schema
export const examIdSchema = z.object({
  id: z
    .string()
    .min(1, "Exam ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Exam ID must be a valid MongoDB ObjectId"),
});

// Assign Students Schema
export const assignStudentsSchema = z.object({
  studentIds: z
    .array(
      z
        .string()
        .regex(
          /^[0-9a-fA-F]{24}$/,
          "Student ID must be a valid MongoDB ObjectId"
        )
    )
    .min(1, "At least one student ID is required")
    .max(1000, "Cannot assign more than 1000 students at once"),
});

// Update Exam Request Schema (Enhanced with Nested Data)
export const updateExamWithNestedDataSchema = z
  .object({
    examTitle: z
      .string()
      .min(1, "Exam title is required")
      .max(200, "Exam title must be less than 200 characters")
      .trim()
      .optional(),
    description: z
      .string()
      .min(1, "Description is required")
      .max(1000, "Description must be less than 1000 characters")
      .trim()
      .optional(),
    classId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId")
      .optional(),
    subjectId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Subject ID must be a valid MongoDB ObjectId")
      .optional(),
    batchId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Batch ID must be a valid MongoDB ObjectId")
      .optional(),
    examType: z.enum(["Official", "Practice", "Exam Repository"]).optional(),
    examModeId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Exam mode ID must be a valid MongoDB ObjectId"
      )
      .optional(),
    totalMarks: z
      .number()
      .int("Total marks must be an integer")
      .min(1, "Total marks must be at least 1")
      .max(1000, "Total marks must be at most 1000")
      .optional(),
    passingMarks: z
      .number()
      .int("Passing marks must be an integer")
      .min(0, "Passing marks must be at least 0")
      .max(1000, "Passing marks must be at most 1000")
      .optional(),
    maxAttempts: z
      .number()
      .int("Max attempts must be an integer")
      .min(1, "Max attempts must be at least 1")
      .max(10, "Max attempts must be at most 10")
      .optional(),
    durationInMinutes: z
      .number()
      .int("Duration must be an integer")
      .min(1, "Duration must be at least 1 minute")
      .max(480, "Duration must be at most 480 minutes")
      .optional(),
    startOn: z
      .string()
      .datetime("Start date must be a valid ISO datetime")
      .optional(),
    endOn: z
      .string()
      .datetime("End date must be a valid ISO datetime")
      .optional(),
    examStatus: z
      .enum([
        "Draft",
        "Unpublished",
        "Published",
        "In Progress",
        "Completed",
        "Cancelled",
      ])
      .optional(),
    topicBreakdown: z.array(topicBreakdownSchema).optional(),
    aiExamId: z.string().optional(),

    // Nested Data (Optional)
    exam_questions: z.array(examQuestionSchema).optional(),
    exam_students: z.array(examStudentSchema).optional(),
    exam_contents: z.array(examContentSchema).optional(),
    exam_ai_prompt_history: z.array(examAIPromptHistorySchema).optional(),
    exam_settings: z.array(examSettingSchema).optional(),
    shouldPublish: z.boolean().optional(),
    selectedDocuments: z.array(selectedDocumentSchema).optional(),
    sourceConfig: z.array(sourceConfigSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.startOn && data.endOn) {
        return new Date(data.endOn) > new Date(data.startOn);
      }
      return true;
    },
    {
      message: "End date must be after start date",
      path: ["endOn"],
    }
  );

// Export all schemas
export const examValidationSchemas = {
  createExam: createExamSchema,
  createExamWithNestedData: createExamWithNestedDataSchema,
  updateExam: updateExamSchema,
  updateExamWithNestedData: updateExamWithNestedDataSchema,
  getAllExams: getAllExamsSchema,
  examId: examIdSchema,
  assignStudents: assignStudentsSchema,
};

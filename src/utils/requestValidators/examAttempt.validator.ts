import { z } from 'zod';

/**
 * Exam Attempt Validators
 * Zod validation schemas for student exam taking APIs
 */

// Start Exam Schema
export const startExamSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId')
});

// Submit Answer Schema
export const submitAnswerSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId'),
  questionId: z.string()
    .min(1, 'Question ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Question ID must be a valid MongoDB ObjectId'),
  answer: z.union([z.string(), z.array(z.string())])
    .refine(val => {
      if (typeof val === 'string') return val.trim().length > 0;
      if (Array.isArray(val)) return val.length > 0;
      return false;
    }, 'Answer cannot be empty'),
  timeTaken: z.number()
    .int('Time taken must be an integer')
    .min(0, 'Time taken cannot be negative')
});

// Submit Exam Schema
export const submitExamSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId'),
  answers: z.array(z.object({
    questionId: z.string()
      .min(1, 'Question ID is required')
      .regex(/^[0-9a-fA-F]{24}$/, 'Question ID must be a valid MongoDB ObjectId'),
    answer: z.union([z.string(), z.array(z.string())])
      .refine(val => {
        if (typeof val === 'string') return val.trim().length > 0;
        if (Array.isArray(val)) return val.length > 0;
        return false;
      }, 'Answer cannot be empty'),
    timeTaken: z.number()
      .int('Time taken must be an integer')
      .min(0, 'Time taken cannot be negative')
  }))
  .min(1, 'At least one answer is required'),
  isAutoSubmit: z.boolean().optional()
});

// Get Attempt Status Schema
export const getAttemptStatusSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId')
});

// Get Student Exams Schema
export const getStudentExamsSchema = z.object({
  pageNo: z.string().optional().transform(val => val ? parseInt(val) : 1),
  pageSize: z.string().optional().transform(val => val ? parseInt(val) : 10),
  examStatus: z.enum(['Draft', 'Published', 'Unpublished', 'Ongoing', 'Completed', 'Cancelled']).optional(),
  examType: z.enum(['Official', 'Practice', 'Exam Repository']).optional(),
  classId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Class ID must be a valid MongoDB ObjectId')
    .optional(),
  subjectId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Subject ID must be a valid MongoDB ObjectId')
    .optional(),
  search: z.string().optional()
});

// Get Student Attempt History Schema
export const getStudentAttemptHistorySchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId')
});

// Pause Exam Schema
export const pauseExamSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId')
});

// Resume Exam Schema
export const resumeExamSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId')
});

// Get Exam Instructions Schema
export const getExamInstructionsSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId')
});

// Save Draft Answer Schema
export const saveDraftAnswerSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId'),
  questionId: z.string()
    .min(1, 'Question ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Question ID must be a valid MongoDB ObjectId'),
  answer: z.union([z.string(), z.array(z.string())])
});

// Get Draft Answers Schema
export const getDraftAnswersSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId')
});

// Exam ID Param Schema
export const examIdParamSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId')
});

// Attempt ID Param Schema
export const attemptIdParamSchema = z.object({
  attemptId: z.string()
    .min(1, 'Attempt ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Attempt ID must be a valid MongoDB ObjectId')
});


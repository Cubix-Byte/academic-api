import { z } from 'zod';

/**
 * Student Results Validators - Zod validation schemas
 */

// Get Exam Result Schema
export const getExamResultSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId')
});

// Get Results History Schema
export const getResultsHistorySchema = z.object({
  pageNo: z.string().optional().transform(val => val ? parseInt(val) : 1),
  pageSize: z.string().optional().transform(val => val ? parseInt(val) : 10),
  examType: z.enum(['Official', 'Practice', 'Exam Repository']).optional(),
  result: z.enum(['Pass', 'Fail']).optional(),
  sortBy: z.enum(['submittedAt', 'percentage']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

// Exam Comparison Schema
export const examComparisonSchema = z.object({
  examIds: z.array(z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Each exam ID must be a valid MongoDB ObjectId'))
    .min(2, 'At least 2 exam IDs are required for comparison')
    .max(5, 'Cannot compare more than 5 exams at once')
});

// Get Detailed Result Schema
export const getDetailedResultSchema = z.object({
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


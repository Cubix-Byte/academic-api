import { z } from 'zod';

/**
 * ExamMode Validation Schemas
 * Zod schemas for validating exam mode-related requests
 */

// Create ExamMode Request Schema
export const createExamModeSchema = z.object({
  name: z.string()
    .min(1, 'Exam mode name is required')
    .max(100, 'Exam mode name must be less than 100 characters')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .trim()
});

// Update ExamMode Request Schema
export const updateExamModeSchema = z.object({
  name: z.string()
    .min(1, 'Exam mode name is required')
    .max(100, 'Exam mode name must be less than 100 characters')
    .trim()
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  isActive: z.boolean().optional()
});

// Get All ExamModes Query Schema
export const getAllExamModesSchema = z.object({
  pageNo: z.string()
    .regex(/^\d+$/, 'Page number must be a positive integer')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'Page number must be greater than 0')
    .optional(),
  pageSize: z.string()
    .regex(/^\d+$/, 'Page size must be a positive integer')
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, 'Page size must be between 1 and 100')
    .optional(),
  search: z.string()
    .min(1, 'Search term cannot be empty')
    .max(100, 'Search term must be less than 100 characters')
    .optional(),
  isActive: z.string()
    .regex(/^(true|false)$/, 'isActive must be true or false')
    .transform((val) => val === 'true')
    .optional()
});

// ExamMode ID Parameter Schema
export const examModeIdSchema = z.object({
  id: z.string()
    .min(1, 'ExamMode ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'ExamMode ID must be a valid MongoDB ObjectId')
});

// Export all schemas
export const examModeValidationSchemas = {
  createExamMode: createExamModeSchema,
  updateExamMode: updateExamModeSchema,
  getAllExamModes: getAllExamModesSchema,
  examModeId: examModeIdSchema
};


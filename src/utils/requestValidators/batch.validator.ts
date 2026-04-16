import { z } from 'zod';

/**
 * Batch Validation Schemas
 * Zod schemas for validating batch-related requests
 */

// Create Batch Request Schema
export const createBatchSchema = z.object({
  // Support both 'name' and 'batchName' for flexibility
  name: z.string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  batchName: z.string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  // Support both 'description' and make it optional
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  // Support both 'startDate' and 'startFrom' for flexibility
  startDate: z.string()
    .datetime('Start date must be a valid ISO datetime')
    .optional(),
  startFrom: z.string()
    .datetime('Start date must be a valid ISO datetime')
    .optional(),
  // Support both 'endDate' and 'endTill' for flexibility
  endDate: z.string()
    .datetime('End date must be a valid ISO datetime')
    .optional(),
  endTill: z.string()
    .datetime('End date must be a valid ISO datetime')
    .optional(),
  // Make totalClasses optional with default value
  totalClasses: z.number()
    .int('Total classes must be an integer')
    .min(1, 'Total classes must be at least 1')
    .max(1000, 'Total classes must be less than 1000')
    .optional(),
  // Support isActive field
  isActive: z.boolean().optional(),
}).refine((data) => {
  // Ensure at least one name field is provided
  if (!data.name && !data.batchName) {
    return false;
  }
  return true;
}, {
  message: 'Either name or batchName is required',
  path: ['name']
}).refine((data) => {
  // If both dates are provided, end date should be after start date
  const startDate = data.startDate || data.startFrom;
  const endDate = data.endDate || data.endTill;
  if (startDate && endDate) {
    return new Date(endDate) > new Date(startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// Update Batch Request Schema
export const updateBatchSchema = z.object({
  batchName: z.string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters')
    .trim()
    .optional(),
  totalClasses: z.number()
    .int('Total classes must be an integer')
    .min(1, 'Total classes must be at least 1')
    .max(1000, 'Total classes must be less than 1000')
    .optional(),
  startFrom: z.string()
    .datetime('Start date must be a valid ISO datetime')
    .optional(),
  endTill: z.string()
    .datetime('End date must be a valid ISO datetime')
    .optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  // If both dates are provided, end date should be after start date
  if (data.startFrom && data.endTill) {
    return new Date(data.endTill) > new Date(data.startFrom);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endTill']
});

// Get All Batches Query Schema
export const getAllBatchesSchema = z.object({
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
    .optional(),
});

// Search Batches Query Schema
export const searchBatchesSchema = z.object({
  search: z.string()
    .min(1, 'Search term is required')
    .max(100, 'Search term must be less than 100 characters'),
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
  isActive: z.string()
    .regex(/^(true|false)$/, 'isActive must be true or false')
    .transform((val) => val === 'true')
    .optional(),
});

// Batch ID Parameter Schema
export const batchIdSchema = z.object({
  id: z.string()
    .min(1, 'Batch ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Batch ID must be a valid MongoDB ObjectId'),
});

// Export all schemas
export const batchValidationSchemas = {
  createBatch: createBatchSchema,
  updateBatch: updateBatchSchema,
  getAllBatches: getAllBatchesSchema,
  searchBatches: searchBatchesSchema,
  batchId: batchIdSchema,
};

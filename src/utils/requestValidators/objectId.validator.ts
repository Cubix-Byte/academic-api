import { z } from 'zod';

/**
 * MongoDB ObjectId validation utilities
 * Provides consistent ObjectId validation across all validators
 */

// MongoDB ObjectId validation helper
export const objectIdSchema = z.string().refine((val) => {
  return /^[0-9a-fA-F]{24}$/.test(val);
}, {
  message: "Invalid MongoDB ObjectId format"
});

// Optional ObjectId schema that allows empty strings and placeholder values
export const optionalObjectIdSchema = z.string().optional().refine((val) => {
  // Allow undefined, empty string, placeholder values, or valid ObjectId
  if (!val || val.trim() === '' || val.includes('{{') || val.includes('}}')) return true;
  return /^[0-9a-fA-F]{24}$/.test(val);
}, {
  message: "Invalid MongoDB ObjectId format"
});

// Array of optional ObjectIds
export const optionalObjectIdArraySchema = z.array(optionalObjectIdSchema).optional();

// Required ObjectId array
export const objectIdArraySchema = z.array(objectIdSchema).min(1, "At least one valid ObjectId is required");

// Required ObjectId array that allows empty arrays (for removing all assignments)
export const objectIdArraySchemaAllowEmpty = z.array(objectIdSchema);

// Optional ObjectId array (can be empty)
export const optionalObjectIdArraySchemaMin = z.array(optionalObjectIdSchema).optional();

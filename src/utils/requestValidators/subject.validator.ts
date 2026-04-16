import { z } from "zod";
import { objectIdSchema } from "./objectId.validator";

/**
 * Subject Request Validators
 *
 * Zod schemas for validating subject-related API requests
 */

// Create subject validation schema
export const createSubjectSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(1, "Subject code is required")
      .max(20, "Subject code must be less than 20 characters"),

    name: z
      .string()
      .min(1, "Subject name is required")
      .max(100, "Subject name must be less than 100 characters"),

    grade: z
      .number()
      .min(1, "Grade must be at least 1")
      .max(100, "Grade cannot exceed 100")
      .nullish(),

    // createdBy will be set from JWT token in controller
  }),
});

// Update subject validation schema
export const updateSubjectSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    code: z
      .string()
      .min(1, "Subject code is required")
      .max(20, "Subject code must be less than 20 characters")
      .optional(),

    name: z
      .string()
      .min(1, "Subject name is required")
      .max(100, "Subject name must be less than 100 characters")
      .optional(),

    grade: z
      .number()
      .min(1, "Grade must be at least 1")
      .max(100, "Grade cannot exceed 100")
      .nullish(),
  }),
});

// Get subject by ID validation schema
export const getSubjectSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Delete subject validation schema
export const deleteSubjectSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Get subject classes validation schema
export const getSubjectClassesSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

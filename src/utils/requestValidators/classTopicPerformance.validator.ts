import { z } from "zod";

/**
 * Class Topic Performance Validators - Zod validation schemas
 */

// Get Topic Statistics Schema
export const getTopicStatisticsSchema = z.object({
  classId: z
    .string()
    .min(1, "Class ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId"),
  subjectId: z
    .string()
    .min(1, "Subject ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Subject ID must be a valid MongoDB ObjectId"),
});


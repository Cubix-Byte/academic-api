import { z } from "zod";

/**
 * Student Topic Performance Validators - Zod validation schemas
 */

// Get Student Topic Statistics Schema
export const getStudentTopicStatisticsSchema = z.object({
  studentId: z
    .string()
    .min(1, "Student ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Student ID must be a valid MongoDB ObjectId"),
  classId: z
    .string()
    .min(1, "Class ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Class ID must be a valid MongoDB ObjectId"),
  subjectId: z
    .string()
    .min(1, "Subject ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Subject ID must be a valid MongoDB ObjectId"),
});



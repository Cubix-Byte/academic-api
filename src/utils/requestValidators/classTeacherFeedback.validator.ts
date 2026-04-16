import { z } from "zod";

/**
 * Validator for creating or updating class teacher feedback
 */
export const createOrUpdateFeedbackSchema = z.object({
  body: z.object({
    classId: z
      .string({
        required_error: "Class ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID format"),
    studentId: z
      .string({
        required_error: "Student ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid student ID format"),
    feedback: z
      .string({
        required_error: "Feedback is required",
      })
      .min(1, "Feedback cannot be empty")
      .max(5000, "Feedback cannot exceed 5000 characters")
      .trim(),
  }),
});

/**
 * Validator for getting feedback for a specific student
 */
export const getFeedbackSchema = z.object({
  params: z.object({
    classId: z
      .string({
        required_error: "Class ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID format"),
    studentId: z
      .string({
        required_error: "Student ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid student ID format"),
  }),
});

/**
 * Validator for getting all feedback for a student
 */
export const getStudentAllFeedbackSchema = z.object({
  params: z.object({
    studentId: z
      .string({
        required_error: "Student ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid student ID format"),
  }),
});

/**
 * Validator for getting feedback by teacher
 */
export const getTeacherFeedbackSchema = z.object({
  query: z.object({
    classId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID format")
      .optional(),
  }),
});

/**
 * Validator for deleting feedback
 */
export const deleteFeedbackSchema = z.object({
  params: z.object({
    classId: z
      .string({
        required_error: "Class ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID format"),
    studentId: z
      .string({
        required_error: "Student ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid student ID format"),
  }),
});

/**
 * Validator for bulk feedback retrieval
 */
export const getBulkFeedbackSchema = z.object({
  body: z.object({
    classId: z
      .string({
        required_error: "Class ID is required",
      })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID format"),
    studentIds: z
      .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid student ID format"))
      .min(1, "At least one student ID is required")
      .max(100, "Cannot fetch feedback for more than 100 students at once"),
  }),
});

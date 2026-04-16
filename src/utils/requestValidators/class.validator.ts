import { z } from "zod";
import {
  objectIdSchema,
  optionalObjectIdSchema,
  optionalObjectIdArraySchema,
} from "./objectId.validator";

// Basic class validator schemas
export const createClassSchema = z.object({
  body: z.object({
    batchId: z.string().min(1, "Batch ID is required"),
    subjectIds: z.array(z.string()).min(1, "At least one subject is required"),
    grade: z.number().min(1).max(100, "Grade must be positive number"),
    class_details: z
      .array(
        z.object({
          name: z.string().min(1, "Class name is required"),
          description: z.string().min(1, "Description is required"),
          capacity: z.number().min(1, "Capacity must be at least 1"),
        })
      )
      .min(1, "At least one class detail is required"),
    // Status is not in request - defaults to active in backend
    // createdBy will be set from JWT token in controller
  }),
});

export const updateClassSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    grade: z.number().min(1).max(100).optional(),
    section: z.string().optional(),
    capacity: z.number().min(1).optional(),
    classTeacherId: optionalObjectIdSchema,
    batchId: optionalObjectIdSchema, // Optional batch reference
    subjectIds: z.array(optionalObjectIdSchema).optional(),
    description: z.string().optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const classParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Additional schemas for different operations
export const getClassSchema = classParamsSchema;
export const deleteClassSchema = classParamsSchema;
export const getClassStudentsSchema = classParamsSchema;
export const getClassSubjectsSchema = classParamsSchema;
export const getClassSubjectDetailsSchema = classParamsSchema;

// Remove teacher from class-subject assignment or remove main class teacher
export const removeTeacherFromClassSubjectSchema = z.object({
  body: z
    .object({
      classId: objectIdSchema,
      teacherId: optionalObjectIdSchema,
      subjectId: optionalObjectIdSchema,
      mainClassTeacherId: optionalObjectIdSchema,
    })
    .refine(
      (data) => {
        // Either teacherId+subjectId (for subject assignment removal) OR mainClassTeacherId must be provided
        const hasSubjectAssignment = data.teacherId && data.subjectId;
        const hasMainClassTeacher = data.mainClassTeacherId;
        return hasSubjectAssignment || hasMainClassTeacher;
      },
      {
        message:
          "Either teacherId with subjectId (for subject assignment removal) OR mainClassTeacherId must be provided",
      }
    ),
});

// Assign class to teacher subject-wise
export const assignClassToTeacherSubjectWiseSchema = z.object({
  body: z
    .object({
      assignments: z
        .array(
          z.object({
            classId: objectIdSchema,
            teacherId: objectIdSchema,
            subjectId: objectIdSchema,
          })
        )
        .optional(),
      mainClassTeacherId: optionalObjectIdSchema,
      classId: optionalObjectIdSchema,
    })
    .refine(
      (data) => {
        // Either assignments array must have at least one item, OR mainClassTeacherId+classId must be provided
        const hasAssignments = data.assignments && data.assignments.length > 0;
        const hasMainClassTeacher = data.mainClassTeacherId && data.classId;
        return hasAssignments || hasMainClassTeacher;
      },
      {
        message:
          "Either assignments array with at least one item OR mainClassTeacherId with classId must be provided",
      }
    )
    .refine(
      (data) => {
        // If mainClassTeacherId is provided, classId must also be provided
        if (data.mainClassTeacherId && !data.classId) {
          return false;
        }
        return true;
      },
      {
        message: "classId is required when mainClassTeacherId is provided",
        path: ["classId"],
      }
    ),
});

// Promote students to new class
export const promoteStudentsSchema = z.object({
  body: z.object({
    students: z.array(
      z.object({
        studentId: objectIdSchema,
        assignedRollNumber: z.preprocess(
          (val) => (typeof val === "number" ? String(val) : val),
          z.string().min(1, "Assigned roll number is required")
        ),
        subjectIds: z.array(objectIdSchema).optional(),
        assignedSubjectIds: z.array(objectIdSchema).optional(),
      })
    ).min(1, "At least one student is required"),
    oldClassId: objectIdSchema,
    newClassId: objectIdSchema,
  }),
});

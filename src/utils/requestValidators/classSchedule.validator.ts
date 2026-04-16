import { z } from "zod";
import { objectIdSchema } from "./objectId.validator";

// Shared pieces
const dayOfWeekSchema = z
  .number()
  .int()
  .min(0, { message: "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)" })
  .max(6, { message: "dayOfWeek must be between 0 (Sunday) and 6 (Saturday)" });

const slotNumberSchema = z
  .number()
  .int()
  .min(1, { message: "slotNumber must be at least 1" });

const academicYearSchema = z
  .string()
  .min(1, { message: "academicYear is required" });

export const createClassScheduleSchema = z.object({
  body: z.object({
    classId: objectIdSchema,
    subjectId: objectIdSchema,
    teacherId: objectIdSchema,
    dayOfWeek: dayOfWeekSchema,
    slotNumber: slotNumberSchema,
    academicYear: academicYearSchema,
  }),
});

export const updateClassScheduleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      classId: objectIdSchema.optional(),
      subjectId: objectIdSchema.optional(),
      teacherId: objectIdSchema.optional(),
      dayOfWeek: dayOfWeekSchema.optional(),
      slotNumber: slotNumberSchema.optional(),
      academicYear: academicYearSchema.optional(),
    })
    .refine(
      (body) =>
        body.classId ||
        body.subjectId ||
        body.teacherId ||
        body.dayOfWeek !== undefined ||
        body.slotNumber !== undefined ||
        body.academicYear,
      {
        message: "At least one field must be provided to update",
      }
    ),
});

export const deleteClassScheduleSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getClassScheduleByIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const listClassSchedulesSchema = z.object({
  query: z.object({
    classId: objectIdSchema.optional(),
    teacherId: objectIdSchema.optional(),
    subjectId: objectIdSchema.optional(),
    academicYear: academicYearSchema.optional(),
    dayOfWeek: z
      .preprocess(
        (val) => (typeof val === "string" ? Number(val) : val),
        dayOfWeekSchema
      )
      .optional(),
  }),
});

export const getClassTimetableSchema = z.object({
  params: z.object({
    classId: objectIdSchema,
  }),
  query: z.object({
    academicYear: academicYearSchema,
  }),
});

export const getTeacherTimetableSchema = z.object({
  query: z.object({
    academicYear: academicYearSchema,
  }),
});

export const getStudentTimetableSchema = z.object({
  query: z.object({
    academicYear: academicYearSchema.optional(),
  }),
});

export const getClassTimetableSummarySchema = z.object({
  query: z.object({
    academicYear: academicYearSchema.optional(),
  }),
});



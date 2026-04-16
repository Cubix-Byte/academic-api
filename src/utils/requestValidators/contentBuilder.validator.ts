import { z } from "zod";
import { objectIdSchema } from "./objectId.validator";

export const createContentBuilderSchema = z.object({
  body: z.object({
    contentTitle: z.string().min(1, "Content title is required").max(200),
    description: z.string().max(1000).optional(),
    subjectId: objectIdSchema,
    classId: objectIdSchema,
    batchId: objectIdSchema,
    contentType: z.string().min(1, "Content type is required"),
  }),
});

export const updateContentBuilderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    contentTitle: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    subjectId: objectIdSchema.optional(),
    classId: objectIdSchema.optional(),
    batchId: objectIdSchema.optional(),
    contentType: z.string().min(1).optional(),
  }),
});

export const getContentBuilderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listContentBuildersSchema = z.object({
  query: z.object({
    classId: z.string().optional(),
    subjectId: z.string().optional(),
    batchId: z.string().optional(),
    contentType: z.string().optional(),
    search: z.string().optional(),
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "contentTitle"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

export const deleteContentBuilderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

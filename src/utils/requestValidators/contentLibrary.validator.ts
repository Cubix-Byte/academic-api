import { z } from "zod";
import { objectIdSchema, objectIdArraySchema, objectIdArraySchemaAllowEmpty } from "./objectId.validator";

export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Folder name is required").max(200),
  }),
});

export const listFoldersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
  }),
});

export const listFoldersWithContentsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    contentSearch: z.string().optional(),
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
  }),
});

export const renameFolderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ name: z.string().min(1).max(200) }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const addContentSchema = z.object({
  body: z.object({
    contentLibraryId: objectIdSchema,
    contentId: z.string().optional(),
    fileName: z.string().min(1).max(255),
    filePath: z.string().min(1),
    fileType: z.string().optional(),
    fileSizeInBytes: z.number().optional(),
    subject: z.string().nullable().optional(),
    subjectId: z.string().nullable().optional(),
    grade: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    targetLanguage: z.string().nullable().optional(),
    ingestType: z.string().optional(),
  }),
});

export const listContentsSchema = z.object({
  query: z.object({
    contentLibraryId: objectIdSchema,
    search: z.string().optional(),
  }),
});

export const renameContentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ fileName: z.string().min(1).max(255) }),
});

export const updateContentMetaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    fileType: z.string().optional(),
    fileSizeInBytes: z.number().optional(),
    filePath: z.string().optional(),
    subject: z.string().nullable().optional(),
    subjectId: z.string().nullable().optional(),
    grade: z.string().nullable().optional(),
  }),
});

export const assignContentToClassesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    classIds: objectIdArraySchemaAllowEmpty,
  }),
});

export const unassignContentFromClassesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    classIds: objectIdArraySchema,
  }),
});

export const getStudentAssignedContentSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
  }),
});

export const getStudentAssignedContentStatsSchema = z.object({
  query: z.object({
    classId: z.string().optional(),
    subjectId: z.string().optional(),
  }),
});

export const markAssignedContentReadSchema = z.object({
  params: z.object({
    contentId: z.string().min(1, "Content ID is required"),
  }),
});

export const bulkAddContentSchema = z.object({
  body: z.object({
    contentLibraryId: objectIdSchema,
    contents: z.array(z.object({
      contentId: z.string().optional(),
      fileName: z.string().min(1).max(255),
      filePath: z.string().min(1),
      fileType: z.string().optional(),
      fileSizeInBytes: z.number().optional(),
      subject: z.string().nullable().optional(),
      subjectId: z.string().nullable().optional(),
      grade: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      targetLanguage: z.string().nullable().optional(),
    })).min(1, "At least one content item is required"),
  }),
});
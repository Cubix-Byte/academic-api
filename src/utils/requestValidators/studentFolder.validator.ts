import { z } from "zod";
import { objectIdSchema } from "./objectId.validator";

export const createStudentFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Folder name is required").max(255).trim(),
  }),
});

export const studentFolderIdParamSchema = z.object({
  params: z.object({
    folderId: objectIdSchema,
  }),
});

export const updateStudentFolderSchema = z.object({
  params: z.object({
    folderId: objectIdSchema,
  }),
  body: z.object({
    name: z.string().min(1, "Folder name is required").max(255).trim(),
  }),
});

export const addContentToStudentFolderSchema = z.object({
  params: z.object({
    folderId: objectIdSchema,
  }),
  body: z.object({
    contentId: objectIdSchema,
  }),
});

export const removeContentFromStudentFolderSchema = z.object({
  params: z.object({
    folderId: objectIdSchema,
    contentId: objectIdSchema,
  }),
});

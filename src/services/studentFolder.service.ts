import mongoose from "mongoose";
import * as studentFolderRepository from "../repositories/studentFolder.repository";
import { ContentLibraryService } from "./contentLibrary.service";
import { ContentLibraryContent } from "../models";

export interface StudentFolderResponse {
  id: string;
  name: string;
  contentIds: string[];
  contentCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Same shape as assigned-content API items (full content document). */
export type FolderContentItem = Record<string, any>;

/**
 * Create a folder for the student.
 */
export const createFolder = async (
  studentId: string,
  tenantId: string,
  name: string
): Promise<StudentFolderResponse> => {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const folder = await studentFolderRepository.create({
    name: trimmed,
    studentId,
    tenantId,
  });
  return mapFolderToResponse(folder);
};

/**
 * List all folders for the student.
 */
export const listFolders = async (
  studentId: string,
  tenantId: string
): Promise<StudentFolderResponse[]> => {
  const folders = await studentFolderRepository.findByStudent(studentId, tenantId);
  return folders.map((f) => mapFolderToResponse(f));
};

/**
 * Update folder name.
 */
export const updateFolder = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  name: string
): Promise<StudentFolderResponse | null> => {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Folder name is required");
  const folder = await studentFolderRepository.updateName(
    folderId,
    studentId,
    tenantId,
    trimmed
  );
  return folder ? mapFolderToResponse(folder) : null;
};

/**
 * Soft-delete a folder.
 */
export const deleteFolder = async (
  folderId: string,
  studentId: string,
  tenantId: string
): Promise<boolean> => {
  const folder = await studentFolderRepository.softDelete(
    folderId,
    studentId,
    tenantId
  );
  return !!folder;
};

/**
 * Add a content item to a folder. Validates that the content is in the student's assigned content.
 */
export const addContentToFolder = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  contentId: string
): Promise<StudentFolderResponse | null> => {
  const contentLibraryService = new ContentLibraryService();
  const isAssigned = await contentLibraryService.isContentAssignedToStudent(
    studentId,
    tenantId,
    contentId
  );
  if (!isAssigned) {
    throw new Error("Content is not assigned to this student or does not exist");
  }
  const folder = await studentFolderRepository.addContentId(
    folderId,
    studentId,
    tenantId,
    contentId
  );
  return folder ? mapFolderToResponse(folder) : null;
};

/**
 * Remove a content item from a folder.
 */
export const removeContentFromFolder = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  contentId: string
): Promise<StudentFolderResponse | null> => {
  const folder = await studentFolderRepository.removeContentId(
    folderId,
    studentId,
    tenantId,
    contentId
  );
  return folder ? mapFolderToResponse(folder) : null;
};

/**
 * Get folder by ID (for student). Returns null if not found or not owned.
 */
export const getFolderById = async (
  folderId: string,
  studentId: string,
  tenantId: string
): Promise<StudentFolderResponse | null> => {
  const folder = await studentFolderRepository.findByIdAndStudent(
    folderId,
    studentId,
    tenantId
  );
  return folder ? mapFolderToResponse(folder) : null;
};

/**
 * Get full content details for items in a folder.
 * Only returns content that still exists and is assigned to the student's classes.
 */
export const getFolderContents = async (
  folderId: string,
  studentId: string,
  tenantId: string
): Promise<{ folder: StudentFolderResponse; items: FolderContentItem[] } | null> => {
  const folder = await studentFolderRepository.findByIdAndStudent(
    folderId,
    studentId,
    tenantId
  );
  if (!folder) return null;

  const contentIds = (folder.contentIds || []).map((id: any) =>
    id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
  );
  if (contentIds.length === 0) {
    return {
      folder: mapFolderToResponse(folder),
      items: [],
    };
  }

  const contents = await ContentLibraryContent.find({
    _id: { $in: contentIds },
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  })
    .lean()
    .sort({ createdAt: -1 });

  // Format items to match assigned-content API response (full document, id instead of _id)
  const items: FolderContentItem[] = contents.map((c: any) => {
    const plainContent = { ...c };
    if (plainContent._id != null && !plainContent.id) {
      plainContent.id = plainContent._id.toString();
    }
    delete plainContent._id;
    delete plainContent.__v;
    if (plainContent.isEmbedded === undefined) plainContent.isEmbedded = false;
    if (plainContent.isAssigned === undefined) plainContent.isAssigned = true;
    plainContent.isFolder = true; // Content is in at least one folder (this one)
    // Stringify ObjectIds for JSON response (match assigned-content)
    if (plainContent.tenantId?.toString) plainContent.tenantId = plainContent.tenantId.toString();
    if (plainContent.teacherId?.toString) plainContent.teacherId = plainContent.teacherId.toString();
    if (plainContent.contentLibraryId?.toString) plainContent.contentLibraryId = plainContent.contentLibraryId.toString();
    if (Array.isArray(plainContent.assignedClassIds)) {
      plainContent.assignedClassIds = plainContent.assignedClassIds.map((id: any) =>
        id?.toString ? id.toString() : id
      );
    }
    return plainContent;
  });

  return {
    folder: mapFolderToResponse(folder),
    items,
  };
};

function mapFolderToResponse(folder: any): StudentFolderResponse {
  const contentIds = (folder.contentIds || []).map((id: any) =>
    id instanceof mongoose.Types.ObjectId ? id.toString() : String(id)
  );
  return {
    id: folder._id.toString(),
    name: folder.name,
    contentIds,
    contentCount: contentIds.length,
    createdAt: folder.createdAt?.toISOString?.() ?? new Date().toISOString(),
    updatedAt: folder.updatedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

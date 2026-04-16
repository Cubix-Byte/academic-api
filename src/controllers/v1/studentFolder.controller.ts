import { Request, Response } from "express";
import * as studentFolderService from "../../services/studentFolder.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "../../utils/shared-lib-imports";

/**
 * Student Folder Controller
 * Handles CRUD and folder-content operations for student-created folders (my-courses).
 * All routes are student-scoped via req.user (studentId, tenantId).
 */

export const createFolder = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const { name } = req.body;
    const folder = await studentFolderService.createFolder(
      studentId,
      tenantId,
      name
    );
    return sendSuccessResponse(res, "Folder created successfully", folder);
  } catch (error: any) {
    console.error("Create student folder error:", error);
    const code =
      error?.message === "Folder name is required"
        ? HttpStatusCodes.BAD_REQUEST
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(res, error?.message ?? "Failed to create folder", code);
  }
};

export const listFolders = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const folders = await studentFolderService.listFolders(studentId, tenantId);
    return sendSuccessResponse(res, "Folders retrieved successfully", folders);
  } catch (error: any) {
    console.error("List student folders error:", error);
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to list folders",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getFolderById = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId } = req.params;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const folder = await studentFolderService.getFolderById(
      folderId,
      studentId,
      tenantId
    );
    if (!folder) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Folder retrieved successfully", folder);
  } catch (error: any) {
    console.error("Get student folder error:", error);
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to get folder",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const updateFolder = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId } = req.params;
    const { name } = req.body;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const folder = await studentFolderService.updateFolder(
      folderId,
      studentId,
      tenantId,
      name
    );
    if (!folder) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Folder updated successfully", folder);
  } catch (error: any) {
    console.error("Update student folder error:", error);
    const code =
      error?.message === "Folder name is required"
        ? HttpStatusCodes.BAD_REQUEST
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(res, error?.message ?? "Failed to update folder", code);
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId } = req.params;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const deleted = await studentFolderService.deleteFolder(
      folderId,
      studentId,
      tenantId
    );
    if (!deleted) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Folder deleted successfully", { deleted: true });
  } catch (error: any) {
    console.error("Delete student folder error:", error);
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to delete folder",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const getFolderContents = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId } = req.params;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const result = await studentFolderService.getFolderContents(
      folderId,
      studentId,
      tenantId
    );
    if (!result) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Folder contents retrieved successfully", result);
  } catch (error: any) {
    console.error("Get folder contents error:", error);
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to get folder contents",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export const addContentToFolder = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId } = req.params;
    const { contentId } = req.body;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const folder = await studentFolderService.addContentToFolder(
      folderId,
      studentId,
      tenantId,
      contentId
    );
    if (!folder) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Content added to folder successfully", folder);
  } catch (error: any) {
    console.error("Add content to folder error:", error);
    const code =
      error?.message?.includes("not assigned") || error?.message?.includes("does not exist")
        ? HttpStatusCodes.BAD_REQUEST
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to add content to folder",
      code
    );
  }
};

export const removeContentFromFolder = async (req: Request, res: Response) => {
  try {
    const studentId = (req.user as any)?.id ?? (req.user as any)?.userId;
    const tenantId = (req.user as any)?.tenantId;
    const { folderId, contentId } = req.params;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Student ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const folder = await studentFolderService.removeContentFromFolder(
      folderId,
      studentId,
      tenantId,
      contentId
    );
    if (!folder) {
      return sendErrorResponse(res, "Folder not found", HttpStatusCodes.NOT_FOUND);
    }
    return sendSuccessResponse(res, "Content removed from folder successfully", folder);
  } catch (error: any) {
    console.error("Remove content from folder error:", error);
    return sendErrorResponse(
      res,
      error?.message ?? "Failed to remove content from folder",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

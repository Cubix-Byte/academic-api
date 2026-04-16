import { Request, Response, NextFunction } from "express";
import * as examModeService from "../../services/examMode.service";
import {
  CreateExamModeRequest,
  UpdateExamModeRequest,
  GetAllExamModesRequest,
} from "@/types/examMode.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * ExamMode Controller - HTTP request handlers for exam mode management
 */

// Create new exam mode (superadmin only)
export const createExamMode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateExamModeRequest = req.body;
    const tenantId = req.user?.tenantId;
    const createdBy = req.user?.id;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!createdBy) {
      return sendErrorResponse(
        res,
        "User ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const examMode = await examModeService.createExamMode(
      data,
      tenantId,
      createdBy
    );
    res.status(201);
    return sendSuccessResponse(res, "Exam mode created successfully", examMode);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_MODE_NAME_EXISTS") {
      return sendErrorResponse(
        res,
        "Exam mode name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Get all exam modes
export const getAllExamModes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Extract teacherId if user is a TEACHER (for filtering exams)
    const teacherId =
      req.user?.roleName === "TEACHER" ? req.user?.id : undefined;

    // When STUDENT role and classId is passed (student portal results), pass studentId for pass/fail counts per mode
    const role = (req.user as any)?.roleName ?? (req.user as any)?.role;
    const isStudentWithClass =
      (role === "STUDENT" || role === "Student") && req.query.classId;
    const studentId = isStudentWithClass ? ((req.user as any)?.id ?? (req.user as any)?.userId) : undefined;

    const params: GetAllExamModesRequest = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      search: req.query.search as string,
      isActive: req.query.isActive ? req.query.isActive === "true" : undefined,
      tenantId: tenantId,
      teacherId: teacherId,
      batchId: req.query.batchId as string | undefined,
      classId: req.query.classId as string | undefined,
      studentId,
    };

    const result = await examModeService.getAllExamModes(params);
    return sendSuccessResponse(
      res,
      "Exam modes retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get exam mode by ID
export const getExamMode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam mode ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const examMode = await examModeService.getExamModeById(id);
    return sendSuccessResponse(
      res,
      "Exam mode retrieved successfully",
      examMode
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_MODE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam mode not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update exam mode (superadmin only)
export const updateExamMode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateExamModeRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam mode ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const examMode = await examModeService.updateExamMode(id, data, tenantId);
    return sendSuccessResponse(res, "Exam mode updated successfully", examMode);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_MODE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam mode not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_MODE_NAME_EXISTS") {
      return sendErrorResponse(
        res,
        "Exam mode name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Delete exam mode
export const deleteExamMode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam mode ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const examMode = await examModeService.deleteExamMode(id);
    return sendSuccessResponse(
      res,
      "Exam mode deleted successfully",
      examMode || {}
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_MODE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam mode not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get exam mode statistics
export const getExamModeStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const result = await examModeService.getExamModeStatistics(tenantId);
    return sendSuccessResponse(
      res,
      "Exam mode statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Search exam modes
export const searchExamModes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, query } = req.query;
    const searchTerm = search || query; // Accept both 'search' and 'query' parameters
    const tenantId = req.user?.tenantId;

    if (!searchTerm) {
      return sendErrorResponse(
        res,
        "Search term is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetAllExamModesRequest = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      isActive: req.query.isActive ? req.query.isActive === "true" : undefined,
      tenantId: tenantId,
    };

    const result = await examModeService.searchExamModes(
      searchTerm as string,
      params
    );
    return sendSuccessResponse(
      res,
      "Exam modes search completed successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get exam modes DDL (dropdown list)
export const getExamModesDDL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const result = await examModeService.getExamModesDDL(tenantId);
    return sendSuccessResponse(
      res,
      "Exam modes DDL retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get exam modes DDL error:", error);
    next(error);
  }
};

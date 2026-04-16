import { Request, Response, NextFunction } from "express";
import * as teacherCredentialsService from "../../services/teacherCredentials.service";
import {
  CreateCredentialRequest,
  UpdateCredentialRequest,
  GetTeacherCredentialsRequest,
} from "@/types/teacherCredentials.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Teacher Credentials Controller
 */

// Create credentials
export const createCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateCredentialRequest = req.body;
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!teacherId || !tenantId) {
      return sendErrorResponse(
        res,
        "Teacher ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    res.status(201);
    const result = await teacherCredentialsService.createCredentials(
      data,
      teacherId,
      tenantId
    );
    return sendSuccessResponse(res, "Credentials created successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update credential
export const updateCredential = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: UpdateCredentialRequest = req.body;
    const teacherId = req.user?.id;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await teacherCredentialsService.updateCredential(
      data,
      teacherId
    );
    return sendSuccessResponse(res, "Credential updated successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Delete credential
export const deleteCredential = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credentialId } = req.params;
    const teacherId = req.user?.id;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await teacherCredentialsService.deleteCredential(credentialId, teacherId);
    return sendSuccessResponse(res, "Credential deleted successfully", {
      credentialId,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get teacher credentials (original endpoint - backward compatible)
export const getTeacherCredentials = async (
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

    const params: GetTeacherCredentialsRequest & { tenantId: string } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      examId: req.query.examId as string,
      studentId: req.query.studentId as string,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      tenantId: tenantId,
    };

    const result = await teacherCredentialsService.getTeacherCredentials(
      params
    );
    return sendSuccessResponse(
      res,
      "Credentials retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get issued credentials (enhanced endpoint with filters and data enrichment)
export const getIssuedCredentials = async (
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

    // Build query and sort from request using generic filter pattern
    // This supports filter parameter with operators like: filter={"classId__eq":"value","teacherId__eq":"value"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters, sort } = queryResult;

    // Extract pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // Extract classId and teacherId from filter parameter (for post-query filtering)
    // These are handled separately because they require joins with Exam and ActivityLog
    let classId: string | undefined;
    let teacherId: string | undefined;
    let issuedBy: string | undefined;

    // Extract classId from filter (handle $eq operator)
    if (filters.classId) {
      if (typeof filters.classId === 'object' && filters.classId.$eq !== undefined) {
        classId = filters.classId.$eq;
      } else if (typeof filters.classId === 'string') {
        classId = filters.classId;
      }
      // Remove from filters as it will be handled separately
      delete filters.classId;
    }

    // Extract teacherId from filter (handle $eq operator)
    if (filters.teacherId) {
      if (typeof filters.teacherId === 'object' && filters.teacherId.$eq !== undefined) {
        teacherId = filters.teacherId.$eq;
      } else if (typeof filters.teacherId === 'string') {
        teacherId = filters.teacherId;
      }
      // Remove from filters as it will be handled separately
      delete filters.teacherId;
    }

    // Backward compatibility: also check query params
    if (!classId && req.query.classId) {
      classId = req.query.classId as string;
    }
    if (!teacherId && req.query.teacherId) {
      teacherId = req.query.teacherId as string;
    }
    if (req.query.issuedBy) {
      issuedBy = req.query.issuedBy as string;
    }

    const params = {
      tenantId,
      pageNo,
      pageSize,
      filters,
      sort:
        Object.keys(sort).length > 0
          ? sort
          : ({ issuedDate: -1 } as Record<string, 1 | -1>),
      classId, // For post-query filtering
      teacherId, // For post-query filtering (maps to issuedBy logic)
      issuedBy, // For post-query filtering (backward compatibility)
    };

    const result = await teacherCredentialsService.getIssuedCredentials(params);
    return sendSuccessResponse(
      res,
      "Issued credentials retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get teacher credentials by teacher ID (assigned + issued)
export const getTeacherCredentialsByTeacherId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teacherId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
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

    const result = await teacherCredentialsService.getTeacherCredentialsByTeacherId(
      teacherId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Teacher credentials retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};
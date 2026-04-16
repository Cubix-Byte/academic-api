import { Request, Response, NextFunction } from "express";
import * as examBuilderService from "../../services/examBuilder.service";
import {
  CreateExamBuilderRequest,
  UpdateExamBuilderRequest,
  GetAllExamBuildersRequest,
} from "@/types/examBuilder.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * ExamBuilder Controller - HTTP request handlers for exam builder management
 */

// Create new exam builder
export const createExamBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateExamBuilderRequest = req.body;
    const tenantId = req.user?.tenantId;
    const createdBy =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

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
        "Only teachers and admins can create exam builders",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const examBuilder = await examBuilderService.createExamBuilder(
      data,
      tenantId,
      createdBy
    );

    res.status(201);
    return sendSuccessResponse(
      res,
      "Exam builder created successfully",
      examBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Get exam builder by ID
export const getExamBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const examBuilder = await examBuilderService.getExamBuilder(id);

    if (!examBuilder) {
      return sendErrorResponse(
        res,
        "Exam builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Verify tenant access
    if (examBuilder.tenantId.toString() !== tenantId) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    return sendSuccessResponse(
      res,
      "Exam builder retrieved successfully",
      examBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Get all exam builders with filters and pagination
export const getAllExamBuilders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const createdBy =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : undefined;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetAllExamBuildersRequest = {
      tenantId,
      createdBy,
      status: (req.query.status as "Recent" | "Draft" | "All") || "All",
      classId: req.query.classId as string,
      subjectId: req.query.subjectId as string,
      batchId: req.query.batchId as string,
      contentType: req.query.contentType as
        | "Syllabus"
        | "Lesson Plan"
        | "Study Material"
        | "Worksheet",
      search: req.query.search as string,
      pageNo: req.query.pageNo
        ? parseInt(req.query.pageNo as string)
        : undefined,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : undefined,
      sortBy:
        (req.query.sortBy as "createdAt" | "updatedAt" | "contentTitle") ||
        "createdAt",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
    };

    const result = await examBuilderService.getAllExamBuilders(params);

    return sendSuccessResponse(
      res,
      "Exam builders retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Update exam builder
export const updateExamBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateExamBuilderRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Verify ownership or admin access
    const existingExamBuilder = await examBuilderService.getExamBuilder(id);
    if (!existingExamBuilder) {
      return sendErrorResponse(
        res,
        "Exam builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      existingExamBuilder.tenantId.toString() !== tenantId ||
      (existingExamBuilder.createdBy.toString() !== req.user?.id &&
        req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    const examBuilder = await examBuilderService.updateExamBuilder(id, data);

    if (!examBuilder) {
      return sendErrorResponse(
        res,
        "Exam builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Exam builder updated successfully",
      examBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Delete exam builder (soft delete)
export const deleteExamBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Verify ownership or admin access
    const existingExamBuilder = await examBuilderService.getExamBuilder(id);
    if (!existingExamBuilder) {
      return sendErrorResponse(
        res,
        "Exam builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      existingExamBuilder.tenantId.toString() !== tenantId ||
      (existingExamBuilder.createdBy.toString() !== req.user?.id &&
        req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    const examBuilder = await examBuilderService.deleteExamBuilder(id);

    if (!examBuilder) {
      return sendErrorResponse(
        res,
        "Exam builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Exam builder deleted successfully",
      examBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Get exam builder statistics
export const getExamBuilderStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const createdBy =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : undefined;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const statistics = await examBuilderService.getExamBuilderStatistics(
      tenantId,
      createdBy
    );

    return sendSuccessResponse(
      res,
      "Exam builder statistics retrieved successfully",
      statistics
    );
  } catch (error) {
    next(error);
  }
};

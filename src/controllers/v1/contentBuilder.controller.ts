import { Request, Response, NextFunction } from "express";
import * as contentBuilderService from "../../services/contentBuilder.service";
import {
  CreateContentBuilderRequest,
  UpdateContentBuilderRequest,
  GetAllContentBuildersRequest,
} from "@/types/contentBuilder.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * ContentBuilder Controller - HTTP request handlers for content builder management
 */

// Create new content builder
export const createContentBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateContentBuilderRequest = req.body;
    const tenantId = req.user?.tenantId;
    const teacherId = req.user?.id || (req.user as any)?.userId;
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
        "Only teachers and admins can create content builders",
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const contentBuilder = await contentBuilderService.createContentBuilder(
      data,
      tenantId,
      teacherId,
      createdBy
    );

    res.status(201);
    return sendSuccessResponse(
      res,
      "Content builder created successfully",
      contentBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Get content builder by ID
export const getContentBuilder = async (
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

    const contentBuilder = await contentBuilderService.getContentBuilder(id);

    if (!contentBuilder) {
      return sendErrorResponse(
        res,
        "Content builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Verify tenant access
    if (contentBuilder.tenantId.toString() !== tenantId) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    return sendSuccessResponse(
      res,
      "Content builder retrieved successfully",
      contentBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Get all content builders with filters and pagination
export const getAllContentBuilders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id || (req.user as any)?.userId
        : undefined;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetAllContentBuildersRequest = {
      tenantId,
      teacherId,
      classId: req.query.classId as string,
      subjectId: req.query.subjectId as string,
      batchId: req.query.batchId as string,
      contentType: req.query.contentType as string,
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

    const result = await contentBuilderService.getAllContentBuilders(params);

    return sendSuccessResponse(
      res,
      "Content builders retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Update content builder
export const updateContentBuilder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateContentBuilderRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Verify ownership or admin access
    const existingContentBuilder = await contentBuilderService.getContentBuilder(id);
    if (!existingContentBuilder) {
      return sendErrorResponse(
        res,
        "Content builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      existingContentBuilder.tenantId.toString() !== tenantId ||
      (existingContentBuilder.createdBy.toString() !== req.user?.id &&
        req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    const contentBuilder = await contentBuilderService.updateContentBuilder(id, data);

    if (!contentBuilder) {
      return sendErrorResponse(
        res,
        "Content builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Content builder updated successfully",
      contentBuilder
    );
  } catch (error) {
    next(error);
  }
};

// Delete content builder (soft delete)
export const deleteContentBuilder = async (
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
    const existingContentBuilder = await contentBuilderService.getContentBuilder(id);
    if (!existingContentBuilder) {
      return sendErrorResponse(
        res,
        "Content builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      existingContentBuilder.tenantId.toString() !== tenantId ||
      (existingContentBuilder.createdBy.toString() !== req.user?.id &&
        req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    }

    const contentBuilder = await contentBuilderService.deleteContentBuilder(id);

    if (!contentBuilder) {
      return sendErrorResponse(
        res,
        "Content builder not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Content builder deleted successfully",
      contentBuilder
    );
  } catch (error) {
    next(error);
  }
};

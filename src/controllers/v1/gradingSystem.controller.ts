import { Request, Response, NextFunction } from "express";
import * as gradingSystemService from "../../services/gradingSystem.service";
import {
  CreateGradingSystemRequest,
  UpdateGradingSystemRequest,
  SearchGradingSystemsRequest,
  CalculateGradeRequest,
} from "@/types/gradingSystem.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Grading System Controller - HTTP request handlers for grading system management
 */

// Create grading system
export const createGradingSystem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateGradingSystemRequest = req.body;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingSystemService.createGradingSystem(
      data,
      tenantId,
      tenantName || "Unknown Tenant"
    );
    return sendSuccessResponse(
      res,
      "Grading system created successfully",
      result
    );
  } catch (error) {
    console.error("Create grading system error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage === "GRADING_SYSTEM_ALREADY_EXISTS") {
      return sendErrorResponse(
        res,
        "Grading system with this name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Get all grading systems
export const getAllGradingSystems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await gradingSystemService.getAllGradingSystems(
      tenantId,
      page,
      limit
    );
    return sendSuccessResponse(
      res,
      "Grading systems retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get all grading systems error:", error);
    next(error);
  }
};

// Get grading system by ID
export const getGradingSystemById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Grading system ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingSystemService.getGradingSystemById(
      id,
      tenantId
    );
    if (!result) {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Grading system retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get grading system by ID error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage === "GRADING_SYSTEM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update grading system
export const updateGradingSystem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateGradingSystemRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Grading system ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingSystemService.updateGradingSystem(
      id,
      data,
      tenantId
    );
    if (!result) {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Grading system updated successfully",
      result
    );
  } catch (error) {
    console.error("Update grading system error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage === "GRADING_SYSTEM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "GRADING_SYSTEM_ALREADY_EXISTS") {
      return sendErrorResponse(
        res,
        "Grading system with this name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Delete grading system
export const deleteGradingSystem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Grading system ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingSystemService.deleteGradingSystem(id, tenantId);
    if (!result) {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(res, "Grading system deleted successfully", {
      id,
    });
  } catch (error) {
    console.error("Delete grading system error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage === "GRADING_SYSTEM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "GRADING_SYSTEM_IN_USE") {
      return sendErrorResponse(
        res,
        "Cannot delete grading system that is currently in use",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Search grading systems
export const searchGradingSystems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: SearchGradingSystemsRequest = req.query as any;
    const tenantId = req.user?.tenantId;

    const result = await gradingSystemService.searchGradingSystems(
      data,
      tenantId
    );
    return sendSuccessResponse(res, "Grading systems search completed", result);
  } catch (error) {
    console.error("Search grading systems error:", error);
    next(error);
  }
};

// Get grading system statistics
export const getGradingSystemStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    const result = await gradingSystemService.getGradingSystemStatistics(
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Grading system statistics retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get grading system statistics error:", error);
    next(error);
  }
};

// Get active grading system
export const getActiveGradingSystem = async (
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

    const result = await gradingSystemService.getActiveGradingSystem(tenantId);
    if (!result) {
      return sendErrorResponse(
        res,
        "No active grading system found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendSuccessResponse(
      res,
      "Active grading system retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get active grading system error:", error);
    next(error);
  }
};

// Calculate grade from percentage
export const calculateGrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CalculateGradeRequest = req.body;

    if (!data.percentage || !data.gradingSystemId) {
      return sendErrorResponse(
        res,
        "Percentage and grading system ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingSystemService.calculateGrade(
      data.percentage,
      data.gradingSystemId
    );
    return sendSuccessResponse(res, "Grade calculated successfully", result);
  } catch (error) {
    console.error("Calculate grade error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage === "GRADING_SYSTEM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Grading system not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

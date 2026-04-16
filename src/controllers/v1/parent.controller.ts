import { Request, Response, NextFunction } from "express";
import * as parentService from "../../services/parent.service";
import {
  CreateParentRequest,
  UpdateParentRequest,
} from "@/types/parent.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  buildQueryFromRequest,
  HttpStatusCodes,
} from "shared-lib";
import {
  GetAchievementsRequest,
  GetBadgesRequest,
} from "@/types/studentCredentials.types";
import * as bulkUploadService from "../../services/bulkUpload.service";
import { safeCleanup } from "../../utils/fileCleanup.util";

// Create parent
export const createParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateParentRequest = req.body;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;

    if (!tenantId || !tenantName) {
      return sendErrorResponse(
        res,
        "Tenant ID and tenant name are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const createdBy = req.user?.id; // Admin who created the parent
    const createdByRole = req.user?.roleName || req.user?.role || "ADMIN"; // Role of the user creating the parent
    const result = await parentService.createParent(data, tenantId, tenantName, createdBy, createdByRole);
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create parent error:", error);
    const errorMessage = error.message || "Failed to create parent";

    // Check for child role conflict errors first (before generic "already exists" check)
    if (
      errorMessage.includes("Cannot assign") ||
      errorMessage.includes("already has a") && errorMessage.includes("parent")
    ) {
      return sendErrorResponse(
        res,
        errorMessage,
        HttpStatusCodes.CONFLICT
      );
    }

    // Check for duplicate email/username errors
    if (
      errorMessage.includes("full capacity") ||
      errorMessage.includes("USERNAME_EXISTS") ||
      errorMessage.includes("EMAIL_EXISTS") ||
      (errorMessage.includes("already exists") && 
       (errorMessage.includes("email") || errorMessage.includes("username") || errorMessage.includes("user-api"))) ||
      errorMessage.includes("Conflict") ||
      error.response?.status === 409
    ) {
      return sendErrorResponse(
        res,
        errorMessage.includes("Please use a different email")
          ? errorMessage
          : `Email or username already exists. ${errorMessage}`,
        HttpStatusCodes.CONFLICT
      );
    }

    // Check for validation errors
    if (
      errorMessage.includes("required") ||
      errorMessage.includes("Invalid") ||
      errorMessage.includes("must be") ||
      errorMessage.includes("format")
    ) {
      return sendErrorResponse(res, errorMessage, HttpStatusCodes.BAD_REQUEST);
    }

    // Default to 500 for unexpected errors
    return sendErrorResponse(
      res,
      errorMessage,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get all parents with dynamic filters
export const getAllParents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    // Prepare pagination parameters
    const pageNo =
      parseInt(req.query.pageNo as string) ||
      parseInt(req.query.page as string) ||
      1;
    const pageSize =
      parseInt(req.query.pageSize as string) ||
      parseInt(req.query.limit as string) ||
      10;

    // Default sort: order by createdAt desc if no sort is provided
    if (!sort || Object.keys(sort).length === 0) {
      sort = { createdAt: -1 };
    }

    const result = await parentService.getAllParents(
      tenantId,
      pageNo,
      pageSize,
      query || {},
      sort
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get all parents error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get parent by ID
export const getParentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await parentService.getParentById(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get parent by ID error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update parent
export const updateParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateParentRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await parentService.updateParent(id, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update parent error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete parent
export const deleteParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await parentService.deleteParent(id, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete parent error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get parent statistics
export const getParentStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await parentService.getParentStatistics(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get parent statistics error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get parent counts (total, active, inactive)
export const getParentCounts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", HttpStatusCodes.BAD_REQUEST);
    }

    const result = await parentService.getParentCounts(tenantId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get parent counts error:", error);
    return sendErrorResponse(res, error.message, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Get child's achievements for a parent
 */
export const getChildAchievements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id;
    const { childId } = req.params;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    if (!childId) {
      return sendErrorResponse(res, "Child ID is required", 400);
    }

    const params: Omit<GetAchievementsRequest, "studentId"> = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      category: req.query.category as string,
      isUnlocked:
        req.query.isUnlocked === "true"
          ? true
          : req.query.isUnlocked === "false"
          ? false
          : undefined,
    };

    const result = await parentService.getChildAchievements(
      parentId,
      childId,
      params
    );
    res.status(200).json({
      success: true,
      message: "Child achievements retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child achievements error:", error);
    sendErrorResponse(res, error.message, error.status || 500);
  }
};

/**
 * Get child's badges for a parent
 */
export const getChildBadges = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id;
    const { childId } = req.params;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    if (!childId) {
      return sendErrorResponse(res, "Child ID is required", 400);
    }

    const params: Omit<GetBadgesRequest, "studentId"> = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      badgeType: req.query.badgeType as string,
      tier: req.query.tier as string,
      isEarned:
        req.query.isEarned === "true"
          ? true
          : req.query.isEarned === "false"
          ? false
          : undefined,
    };

    const result = await parentService.getChildBadges(
      parentId,
      childId,
      params
    );
    res.status(200).json({
      success: true,
      message: "Child badges retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child badges error:", error);
    sendErrorResponse(res, error.message, error.status || 500);
  }
};

// Get current parent profile (by auth user id)
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }
    const result = await parentService.getMyProfile(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my parent profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update current parent profile (by auth user id)
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const data: UpdateParentRequest = req.body;
    const result = await parentService.updateMyProfile(userId, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update my parent profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

/**
 * Get aggregated achievements from all children for parent dashboard
 */
export const getAllChildrenAchievements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    const params = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      category: req.query.category as string,
      isUnlocked:
        req.query.isUnlocked === "true"
          ? true
          : req.query.isUnlocked === "false"
          ? false
          : undefined,
    };

    const result = await parentService.getAllChildrenAchievements(
      parentId,
      params
    );
    res.status(200).json({
      success: true,
      message: "All children achievements retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get all children achievements error:", error);
    sendErrorResponse(res, error.message, error.status || 500);
  }
};

// Bulk upload parents from CSV
export const bulkUploadParents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const filePath = req.file?.path;
  const tenantId = req.user?.tenantId;
  const tenantName = req.user?.tenantName;

  if (!filePath) {
    return sendErrorResponse(
      res,
      "No CSV file uploaded",
      HttpStatusCodes.BAD_REQUEST
    );
  }

  if (!tenantId || !tenantName) {
    await safeCleanup(filePath);
    return sendErrorResponse(
      res,
      "Tenant ID and tenant name are required",
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    // Process bulk upload
    const result = await bulkUploadService.bulkUploadParents(
      filePath,
      tenantId,
      tenantName
    );

    // Cleanup temp file
    await safeCleanup(filePath);

    // If any rows failed validation (all-or-nothing approach), return error status
    if (result.failed > 0 || result.errorRows.length > 0) {
      const seatErrors = (result.errorRows || [])
        .flatMap((r: any) => r?.errors || [])
        .filter((e: any) => e?.field === "seats" && typeof e?.message === "string");

      const isSeatCapacityFailure =
        seatErrors.length > 0 &&
        seatErrors.length ===
          (result.errorRows || []).flatMap((r: any) => r?.errors || []).length;

      const seatMessage = seatErrors[0]?.message;

      return sendErrorResponse(
        res,
        isSeatCapacityFailure && seatMessage
          ? seatMessage
          : `Bulk upload failed. ${result.failed} row(s) have validation errors. No parents were created.`,
        HttpStatusCodes.BAD_REQUEST,
        {
          totalRows: result.totalRows,
          successful: result.successful,
          failed: result.failed,
          errorRows: result.errorRows.slice(0, 50), // Limit errorRows in response to first 50
        }
      );
    }

    // All rows passed validation and were created successfully
    return sendSuccessResponse(
      res,
      `Bulk upload completed successfully. ${result.successful} parents created.`,
      {
        totalRows: result.totalRows,
        successful: result.successful,
        failed: result.failed,
        errorRows: result.errorRows,
      }
    );
  } catch (error: any) {
    // Ensure cleanup even on error
    await safeCleanup(filePath);
    console.error("Bulk upload parents error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to process bulk upload",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Resend welcome email to parent
export const resendParentEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Parent ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await parentService.resendParentEmail(id);

    return sendSuccessResponse(
      res,
      result.message || "Welcome email sent successfully",
      result
    );
  } catch (error: any) {
    next(error);
  }
};

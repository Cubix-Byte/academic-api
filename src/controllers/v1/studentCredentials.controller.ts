import { Request, Response, NextFunction } from "express";
import * as studentCredentialsService from "../../services/studentCredentials.service";
import {
  GetCredentialsRequest,
  GetAchievementsRequest,
  GetBadgesRequest,
} from "@/types/studentCredentials.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  ROLE_NAMES,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Helper to transform API filters to Mongoose query operators
 * e.g., { "issuedDate__gte": "2023-01-01" } -> { "issuedDate": { "$gte": "2023-01-01" } }
 */
const transformFilters = (filters: Record<string, any>) => {
  const transformed: Record<string, any> = {};

  Object.keys(filters).forEach((key) => {
    // Check if this is credentialType with an $eq operator (already transformed by buildQueryFromRequest)
    if (key === "credentialType" &&
      typeof filters[key] === "object" &&
      filters[key].$eq &&
      typeof filters[key].$eq === "string") {
      // Replace exact match with case-insensitive regex
      transformed[key] = new RegExp(`^${filters[key].$eq}$`, "i");
      return;
    }

    if (key.includes("__")) {
      const parts = key.split("__");
      const field = parts[0];
      const operator = parts[1];
      // const index = parts[2]; // For or/and/not logic if needed later

      if (!transformed[field]) {
        transformed[field] = {};
      }

      // Helper to check if string is ISO date
      const isIsoDate = (str: any) => {
        if (typeof str !== "string") return false;
        // Simple regex for ISO date format YYYY-MM-DDTHH:mm:ss.sssZ
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);
      };

      // Map operator to Mongoose operator
      switch (operator) {
        case "eq":
          // Special handling for credentialType to be case-insensitive
          if (field === "credentialType" && typeof filters[key] === "string") {
            // Use regex directly for case-insensitive matching
            transformed[field] = new RegExp(`^${filters[key]}$`, "i");
          } else {
            transformed[field] = filters[key];
          }
          break;
        case "ne":
        case "gt":
        case "gte":
        case "lt":
        case "lte":
          let value = filters[key];
          if (isIsoDate(value)) {
            value = new Date(value);
          }
          transformed[field][`$${operator}`] = value;
          break;
        case "in":
          // Spec: "value1,value2,value3" -> ["value1", "value2", "value3"]
          if (typeof filters[key] === "string") {
            transformed[field]["$in"] = filters[key].split(",");
          } else {
            transformed[field]["$in"] = filters[key];
          }
          break;
        case "regex":
          transformed[field]["$regex"] = filters[key];
          transformed[field]["$options"] = "i"; // Default to case-insensitive
          break;
        default:
          // Handle other operators or ignore
          if (operator === "or" || operator === "and" || operator === "not") {
            // Complex logic for OR/AND/NOT would go here. 
            // For now, we focus on the requested operators.
          }
          break;
      }
    } else {
      // No operator, assume equality
      transformed[key] = filters[key];
    }
  });

  console.log('Original filters:', filters);
  console.log('Transformed filters:', JSON.stringify(transformed, null, 2));

  return transformed;
};

/**
 * Student Credentials Controller - HTTP request handlers
 */

// Get student credentials
export const getStudentCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Build query and sort from request using generic filter pattern
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters, sort } = queryResult;

    const params: GetCredentialsRequest & {
      studentId: string;
      filters?: Record<string, any>;
      sort?: Record<string, 1 | -1>;
    } = {
      pageNo:
        parseInt(req.query.pageNo as string) ||
        parseInt(req.query.page as string) ||
        1,
      pageSize:
        parseInt(req.query.pageSize as string) ||
        parseInt(req.query.limit as string) ||
        10,
      credentialType: (req.query.credentialType || req.query.type) as string,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
            ? false
            : undefined,
      sortBy: req.query.sortBy as "issuedDate",
      sortOrder: req.query.sortOrder as "asc" | "desc",
      studentId: studentId,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      createdBy: req.query.createdBy as string,
      filters: filters,
      sort: Object.keys(sort).length > 0 ? sort : undefined,
    };

    // Transform filters to support operators (e.g., field__gte -> { field: { $gte: value } })
    if (params.filters) {
      params.filters = transformFilters(params.filters);
    }

    const result = await studentCredentialsService.getStudentCredentials(
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

// Get credential by ID
export const getCredentialById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credentialId } = req.params;
    const studentId = req.user?.id;

    if (!credentialId) {
      return sendErrorResponse(
        res,
        "Credential ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.getCredentialById(
      credentialId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Credential retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "CREDENTIAL_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This credential does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    next(error);
  }
};

// Verify credential
export const verifyCredential = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return sendErrorResponse(
        res,
        "Verification code is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.verifyCredential(
      verificationCode
    );
    return sendSuccessResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};

// Get student achievements
export const getStudentAchievements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetAchievementsRequest & { studentId: string } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      category: req.query.category as string,
      isUnlocked:
        req.query.isUnlocked === "true"
          ? true
          : req.query.isUnlocked === "false"
            ? false
            : undefined,
      studentId: studentId,
    };

    const result = await studentCredentialsService.getStudentAchievements(
      params
    );
    return sendSuccessResponse(
      res,
      "Achievements retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get student badges
export const getStudentBadges = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetBadgesRequest & { studentId: string } = {
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
      studentId: studentId,
    };

    const result = await studentCredentialsService.getStudentBadges(params);
    return sendSuccessResponse(res, "Badges retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

// Get student credentials statistics
export const getStudentCredentialsStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userRole = req.user?.roleName;
    const userId = req.user?.id;
    const requestedStudentId = req.query.studentId as string | undefined;

    // Determine which studentId to use
    let studentId: string;

    if (requestedStudentId) {
      // Check if user has permission to access other students' data
      const canAccessOtherStudent =
        userRole === ROLE_NAMES.ADMIN ||
        userRole === ROLE_NAMES.PRIMARYADMIN ||
        userRole === ROLE_NAMES.SUPERADMIN ||
        userRole === ROLE_NAMES.TEACHER ||
        userRole === ROLE_NAMES.PARENT;

      if (!canAccessOtherStudent) {
        return sendErrorResponse(
          res,
          "You do not have permission to access other students' credentials",
          HttpStatusCodes.FORBIDDEN
        );
      }

      studentId = requestedStudentId;
    } else {
      // Use authenticated user's ID (for students viewing their own data)
      if (!userId) {
        return sendErrorResponse(
          res,
          "Student ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }
      studentId = userId;
    }

    // Build query and sort from request using generic filter pattern
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters } = queryResult;

    // Transform filters to support operators (e.g., field__gte -> { field: { $gte: value } })
    let transformedFilters = filters;
    if (transformedFilters) {
      transformedFilters = transformFilters(transformedFilters);
    }

    const result =
      await studentCredentialsService.getStudentCredentialsStatistics(
        studentId,
        transformedFilters
      );
    return sendSuccessResponse(
      res,
      "Statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get student credentials dashboard
export const getStudentCredentialsDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result =
      await studentCredentialsService.getStudentCredentialsDashboard(studentId);
    return sendSuccessResponse(
      res,
      "Dashboard data retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get recent credentials
export const getRecentCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userRole = req.user?.roleName;
    const userId = req.user?.id;
    const requestedStudentId = req.query.studentId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 5;

    // Determine which studentId to use
    let studentId: string;

    if (requestedStudentId) {
      // Check if user has permission to access other students' data
      const canAccessOtherStudent =
        userRole === ROLE_NAMES.ADMIN ||
        userRole === ROLE_NAMES.PRIMARYADMIN ||
        userRole === ROLE_NAMES.SUPERADMIN ||
        userRole === ROLE_NAMES.TEACHER ||
        userRole === ROLE_NAMES.PARENT;

      if (!canAccessOtherStudent) {
        return sendErrorResponse(
          res,
          "You do not have permission to access other students' credentials",
          HttpStatusCodes.FORBIDDEN
        );
      }

      studentId = requestedStudentId;
    } else {
      // Use authenticated user's ID (for students viewing their own data)
      if (!userId) {
        return sendErrorResponse(
          res,
          "Student ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }
      studentId = userId;
    }

    const result = await studentCredentialsService.getRecentCredentials(
      studentId,
      limit
    );
    return sendSuccessResponse(
      res,
      "Recent credentials retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get expiring credentials
export const getExpiringCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.getExpiringCredentials(
      studentId,
      days
    );
    return sendSuccessResponse(
      res,
      "Expiring credentials retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get credentials grouped by type
export const getCredentialsByType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.getCredentialsByType(
      studentId
    );
    return sendSuccessResponse(
      res,
      "Credentials by type retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get credentials grouped by exam
export const getCredentialsByExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.getCredentialsByExam(
      studentId
    );
    return sendSuccessResponse(
      res,
      "Credentials by exam retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get achievement details
export const getAchievementDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { achievementId } = req.params;
    const studentId = req.user?.id;

    if (!achievementId) {
      return sendErrorResponse(
        res,
        "Achievement ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.getAchievementDetail(
      achievementId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Achievement detail retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ACHIEVEMENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Achievement not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ACHIEVEMENT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This achievement does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    next(error);
  }
};
// Download credential
export const downloadCredential = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credentialId, format } = req.body;

    if (!credentialId) {
      return sendErrorResponse(
        res,
        "Credential ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentCredentialsService.downloadCredential(
      credentialId,
      format || "pdf"
    );

    return sendSuccessResponse(
      res,
      "Credential download link retrieved",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "CREDENTIAL_FILE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential file not available",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

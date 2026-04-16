import { Request, Response, NextFunction } from "express";
import * as credentialAnalyticsService from "../../services/credentialAnalytics.service";
import { GetCredentialAnalyticsRequest } from "@/types/credentialAnalytics.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Credential Analytics Controller
 */

// Get credential analytics
export const getCredentialAnalytics = async (
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
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters } = queryResult;

    // Debug logging
    console.log("🔍 [ANALYTICS] Filter parameter:", req.query.filter);
    console.log(
      "🔍 [ANALYTICS] Parsed filters:",
      JSON.stringify(filters, null, 2)
    );

    // Extract filter values from the generic filter system
    // Support both filter parameter and direct query params for backward compatibility
    // Handle $eq operator - extract value if it's an object with $eq
    const credentialTypeValue = filters.credentialType;
    const credentialType =
      credentialTypeValue &&
      typeof credentialTypeValue === "object" &&
      credentialTypeValue.$eq
        ? credentialTypeValue.$eq
        : credentialTypeValue || req.query.type || req.query.credentialType;

    const subjectIdValue = filters.subjectId;
    const subjectId =
      subjectIdValue && typeof subjectIdValue === "object" && subjectIdValue.$eq
        ? subjectIdValue.$eq
        : subjectIdValue || req.query.subjectId;

    // Extract date range from filters (issuedDate__gte, issuedDate__lte)
    let month: number | undefined;
    let year: number | undefined;

    if (filters.issuedDate) {
      // If date range is in filters, extract month/year from it
      if (filters.issuedDate.$gte) {
        const fromDate = new Date(filters.issuedDate.$gte);
        month = fromDate.getMonth() + 1;
        year = fromDate.getFullYear();
      }
    } else {
      // Fallback to month/year query params
      month = req.query.month ? parseInt(req.query.month as string) : undefined;
      year = req.query.year ? parseInt(req.query.year as string) : undefined;
    }

    const params: GetCredentialAnalyticsRequest & {
      tenantId: string;
      filters?: Record<string, any>;
    } = {
      subjectId: subjectId as string,
      issuedBy: req.query.issuedBy as any, // Post-query filter
      issuerName: req.query.issuerName as string, // Post-query filter
      type: credentialType as any,
      month,
      year,
      tenantId,
      filters, // Pass filters for service to use
    };

    const result = await credentialAnalyticsService.getCredentialAnalytics(
      params
    );
    return sendSuccessResponse(
      res,
      "Credential analytics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get credential statistics (for dashboard)
export const getCredentialStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await credentialAnalyticsService.getCredentialStatistics(
      tenantId,
      userId
    );
    return sendSuccessResponse(
      res,
      "Credential statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get credential template statistics (for credential templates)
export const getCredentialTemplateStats = async (
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

    const result = await credentialAnalyticsService.getCredentialTemplateStats(
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Credential template statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

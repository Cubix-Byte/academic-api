import { Request, Response, NextFunction } from "express";
import * as tenantAnalyticsService from "../../services/tenantAnalytics.service";
import {
    sendSuccessResponse,
    sendErrorResponse,
    HttpStatusCodes,
} from "shared-lib";

/**
 * Tenant Analytics Controller
 * HTTP request handlers for tenant-level analytics
 */

/**
 * Get tenant monthly trends and statistics
 * GET /api/v1/tenant-analytics/monthly-trends/:tenantId
 */
export const getTenantMonthlyTrends = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { tenantId } = req.params;

        if (!tenantId) {
            return sendErrorResponse(
                res,
                "Tenant ID is required",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        const result = await tenantAnalyticsService.getTenantMonthlyTrends(
            tenantId
        );

        return res.status(HttpStatusCodes.OK).json(result);
    } catch (error) {
        next(error);
    }
};

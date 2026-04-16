import { Router } from "express";
import { ROUTES } from "../../utils/constants/routes";
import * as tenantAnalyticsController from "../../controllers/v1/tenantAnalytics.controller";

const router = Router();

/**
 * Tenant Analytics Routes
 * API endpoints for tenant-level analytics
 */

// GET /api/v1/tenant-analytics/monthly-trends/:tenantId - Get tenant monthly trends and statistics
router.get(ROUTES.TENANT_ANALYTICS.SUBROUTES.MONTHLY_TRENDS, tenantAnalyticsController.getTenantMonthlyTrends);

export default router;

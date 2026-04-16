import { Router } from "express";
import * as parentDashboardController from "../../controllers/v1/parentDashboard.controller";

/**
 * Children Credits Routes
 * Routes for children credits statistics
 * Base path: /academy/api/v1/children-credits
 */
const router = Router();

// GET /api/v1/children-credits/stats - Get aggregated credit statistics for all children of a parent
router.get("/stats", parentDashboardController.getChildrenCreditsStats);

export default router;


import { Router } from "express";
import * as credentialTemplateController from "../../controllers/v1/credentialTemplate.controller";
import * as credentialAnalyticsController from "../../controllers/v1/credentialAnalytics.controller";

const router = Router();

/**
 * Credential Template Routes
 *
 * IMPORTANT: Specific routes (like /repository, /analytics) must be defined
 * BEFORE parameterized routes (like /:id) to avoid route conflicts
 */

// POST /api/v1/credentials - Create credential template
router.post("/", credentialTemplateController.createCredentialTemplate);

// GET /api/v1/credentials - Get all credential templates
router.get("/", credentialTemplateController.getCredentialTemplates);

// GET /api/v1/credentials/repository - Get credential repository
router.get("/repository", credentialTemplateController.getCredentialRepository);

// GET /api/v1/credentials/analytics - Get credential analytics (MUST be before /:id)
router.get("/analytics", credentialAnalyticsController.getCredentialAnalytics);

// GET /api/v1/credentials/statistics - Get credential statistics for dashboard (MUST be before /:id)
router.get(
  "/statistics",
  credentialAnalyticsController.getCredentialStatistics
);

// GET /api/v1/credentials/stats - Get credential template statistics (MUST be before /:id)
router.get("/stats", credentialAnalyticsController.getCredentialTemplateStats);

// GET /api/v1/credentials/:id - Get credential template by ID
router.get("/:id", credentialTemplateController.getCredentialTemplateById);

// PUT /api/v1/credentials/:id - Update credential template
router.put("/:id", credentialTemplateController.updateCredentialTemplate);

// DELETE /api/v1/credentials/:id - Delete credential template
router.delete("/:id", credentialTemplateController.deleteCredentialTemplate);

export default router;

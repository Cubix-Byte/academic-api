import { Router } from 'express';
import * as credentialAnalyticsController from '../../controllers/v1/credentialAnalytics.controller';

const router = Router();

/**
 * Credential Analytics Routes
 */

// GET /api/v1/credentials/analytics - Get credential analytics
router.get('/analytics', credentialAnalyticsController.getCredentialAnalytics);

export default router;


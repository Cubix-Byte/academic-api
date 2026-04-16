import { Router } from 'express';
import * as studentCredentialsController from '../../controllers/v1/studentCredentials.controller';

const router = Router();

/**
 * Student Credentials Routes - API endpoints for credentials and achievements
 */

// GET /api/v1/student-credentials - Get all credentials
router.get('/', studentCredentialsController.getStudentCredentials);

// POST /api/v1/student-credentials/verify - Verify credential
router.post('/verify', studentCredentialsController.verifyCredential);

// POST /api/v1/student-credentials/download - Download credential
router.post('/download', studentCredentialsController.downloadCredential);

// GET /api/v1/student-achievements - Get achievements
router.get(
	'/achievements',
	studentCredentialsController.getStudentAchievements,
);

// GET /api/v1/student-credentials/badges - Get badges
router.get('/badges', studentCredentialsController.getStudentBadges);

// GET /api/v1/student-credentials/statistics - Get student credentials statistics
router.get(
	'/statistics',
	studentCredentialsController.getStudentCredentialsStatistics,
);

// GET /api/v1/student-credentials/dashboard - Get student credentials dashboard
router.get(
	'/dashboard',
	studentCredentialsController.getStudentCredentialsDashboard,
);

// GET /api/v1/student-credentials/recent - Get recent credentials
router.get('/recent', studentCredentialsController.getRecentCredentials);

// GET /api/v1/student-credentials/expiring - Get expiring credentials
router.get('/expiring', studentCredentialsController.getExpiringCredentials);

// GET /api/v1/student-credentials/by-type - Get credentials grouped by type
router.get('/by-type', studentCredentialsController.getCredentialsByType);

// GET /api/v1/student-credentials/by-exam - Get credentials grouped by exam
router.get('/by-exam', studentCredentialsController.getCredentialsByExam);

// GET /api/v1/student-credentials/achievements/:achievementId - Get achievement detail
router.get(
	'/achievements/:achievementId',
	studentCredentialsController.getAchievementDetail,
);

// GET /api/v1/student-credentials/:credentialId - Get credential by ID (MUST BE LAST)
router.get('/:credentialId', studentCredentialsController.getCredentialById);

export default router;

import express from 'express';
import * as dashboardController from '../../controllers/v1/dashboard.controller';

const router = express.Router();

// GET /academy/api/v1/dashboard/statistics - Get dashboard statistics
router.get('/statistics', dashboardController.getDashboardStatistics);

export default router;


import { Router } from 'express';
import * as studentDashboardController from '../../controllers/v1/studentDashboard.controller';

const router = Router();

/**
 * Student Dashboard Routes - API endpoints for student dashboard
 */

// GET /api/v1/student-dashboard - Get dashboard overview
router.get('/', studentDashboardController.getDashboardOverview);

// GET /api/v1/student-dashboard/upcoming - Get upcoming exams
router.get('/upcoming', studentDashboardController.getUpcomingExams);

// GET /api/v1/student-dashboard/statistics - Get dashboard statistics
router.get('/statistics', studentDashboardController.getDashboardStatistics);

// GET /api/v1/student-dashboard/top-students - Get top students in the same class
router.get('/top-students', studentDashboardController.getTopStudents);

// GET /api/v1/student-dashboard/student-dashboard-stats - Get simplified dashboard stats
router.get('/student-dashboard-stats', studentDashboardController.getStudentDashboardStats);

export default router;


import { Router } from "express";
import * as teacherDashboardController from "../../controllers/v1/teacherDashboard.controller";

const router = Router();

/**
 * Teacher Dashboard Routes - API endpoints for teacher dashboard
 */

// GET /api/v1/teacher-dashboard/top-students - Get top students
router.get("/top-students", teacherDashboardController.getTopStudents);

// GET /api/v1/teacher-dashboard/class-analytics - Get class analytics
router.get("/class-analytics", teacherDashboardController.getClassAnalytics);

// GET /api/v1/teacher-dashboard/student-activity - Get student activity
router.get("/student-activity", teacherDashboardController.getStudentActivity);

// GET /api/v1/teacher-dashboard/students-activities - Get all students activities for a teacher (by teacherId)
router.get("/students-activities", teacherDashboardController.getTeacherStudentsActivities);

// GET /api/v1/teacher-dashboard/stats - Get teacher dashboard statistics
router.get("/stats", teacherDashboardController.getTeacherDashboardStats);

// ----------------------------------------------------------------------
// New Analytics Routes
// ----------------------------------------------------------------------

// GET /api/v1/teacher-dashboard/class-monthly-trends - Get class monthly performance trends
router.get("/class-monthly-trends", teacherDashboardController.getClassMonthlyTrends);

// GET /api/v1/teacher-dashboard/question-type-performance - Get question type performance
router.get("/question-type-performance", teacherDashboardController.getQuestionTypePerformance);

// GET /api/v1/teacher-dashboard/class-exam-time-analysis - Get class exam time analysis
router.get("/class-exam-time-analysis", teacherDashboardController.getClassExamTimeAnalysis);

// GET /api/v1/teacher-dashboard/class-score-distribution - Get class score distribution
router.get("/class-score-distribution", teacherDashboardController.getClassScoreDistribution);

export default router;


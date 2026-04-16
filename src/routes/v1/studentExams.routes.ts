import { Router } from "express";
import * as studentExamsController from "../../controllers/v1/studentExams.controller";
import studentExamsByCategoryRoutes from "./studentExamsByStatus.routes";

const router = Router();

/**
 * Student Exams Routes - API endpoints for student exam management
 * Base path: /academy/api/v1/student-exams
 */

// GET /api/v1/student-exams - Get all exams for student with pagination and filtering
router.get("/", studentExamsController.getStudentExams);

// GET /api/v1/student-exams/statistics - Get student exam statistics
router.get("/statistics", studentExamsController.getStudentExamStatistics);

// GET /api/v1/student-exams/dashboard - Get student exam dashboard
router.get("/dashboard", studentExamsController.getStudentExamDashboard);

// GET /api/v1/student-exams/current-class - Get exams for student's current class
router.get("/current-class", studentExamsController.getStudentExamsByCurrentClass);

// GET /api/v1/student-exams/upcoming - Get upcoming exams for student
router.get("/upcoming", studentExamsController.getUpcomingExams);

// GET /api/v1/student-exams/past - Get past exams for student
router.get("/past", studentExamsController.getPastExams);

// GET /api/v1/student-exams/current-class-stats - Get current class stats (completed exam counts)
router.get("/current-class-stats", studentExamsController.getCurrentClassStats);

// GET /api/v1/student-exams/subject-stats - Get subject-wise stats (average percentage and grade)
router.get("/subject-stats", studentExamsController.getSubjectStats);


// GET /api/v1/student-exams/recent-results - Get last 3 graded results
router.get("/recent-results", studentExamsController.getRecentResults);

// GET /api/v1/student-exams/started - Get started exams that haven't expired
router.get("/started", studentExamsController.getStartedExams);

// Register the by-category route BEFORE the :examId route
router.use(studentExamsByCategoryRoutes);

// GET /api/v1/student-exams/:examId - Get specific exam by ID for student (MUST BE LAST)
router.get("/:examId", studentExamsController.getStudentExamById);

export default router;

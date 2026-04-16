import { Router } from "express";
import * as teacherGradingController from "../../controllers/v1/teacherGrading.controller";

const router = Router();

/**
 * Teacher Grading Routes - API endpoints for teacher grading operations
 * Base path: /academy/api/v1/grading
 */

// GET /api/v1/grading - Get grading list
router.get("/", teacherGradingController.getGradingList);

// GET /api/v1/grading/stats - Get grading statistics for teacher across all classes and subjects
router.get("/stats", teacherGradingController.getGradingStatisticsForTeacher);

// GET /api/v1/grading/stats/:classId - Get grading statistics by class
router.get(
  "/stats/:classId",
  teacherGradingController.getGradingStatisticsByClass
);

// GET /api/v1/grading/topics/stats - Get topic statistics for class and subject
router.get("/topics/stats", teacherGradingController.getTopicStatistics);

// GET /api/v1/grading/students/:studentId/topics/stats - Get student topic statistics for class and subject
router.get(
  "/students/:studentId/topics/stats",
  teacherGradingController.getStudentTopicStatistics
);

// GET /api/v1/grading/:examId - Get exam grading details
router.get("/:examId", teacherGradingController.getExamGradingDetails);

// GET /api/v1/grading/:examId/student/:studentId - Get student answers for grading
router.get(
  "/:examId/student/:studentId",
  teacherGradingController.getStudentAnswers
);

// POST /api/v1/grading/submit - Submit grading for a student
router.post("/submit", teacherGradingController.submitGrading);

export default router;

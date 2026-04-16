import { Router } from "express";
import * as studentResultsController from "../../controllers/v1/studentResults.controller";

const router = Router();

/**
 * Student Results Routes - API endpoints for student results and analytics
 */

// GET /api/v1/student-results - Get results history (must be before /:examId)
router.get("/", studentResultsController.getResultsHistory);

// GET /api/v1/student-results/ranking/month-wise - Get month-wise ranking
router.get("/ranking/month-wise", studentResultsController.getMonthWiseRanking);

// GET /api/v1/student-analytics/performance - Get performance analytics
router.get(
  "/analytics/performance",
  studentResultsController.getPerformanceAnalytics
);

// GET /api/v1/student-analytics/subject-wise - Get subject-wise analytics
router.get(
  "/analytics/subject-wise",
  studentResultsController.getSubjectWiseAnalytics
);

// GET /api/v1/student-analytics/ranking - Get class ranking
router.get("/analytics/ranking", studentResultsController.getClassRanking);

// GET /api/v1/student-analytics/progress - Get progress tracking
router.get("/analytics/progress", studentResultsController.getProgressTracking);

// GET /api/v1/student-analytics/peer-comparison - Get peer comparison
router.get(
  "/analytics/peer-comparison",
  studentResultsController.getPeerComparison
);

// POST /api/v1/student-results/compare - Compare exams
router.post("/compare", studentResultsController.compareExams);

// GET /api/v1/student-results/detailed/exam/:examId - Get detailed result by exam ID (must be before /detailed/:attemptId)
router.get(
  "/detailed/exam/:examId",
  studentResultsController.getDetailedResultByExamId
);

// GET /api/v1/student-results/detailed/:attemptId - Get detailed result by attempt ID
router.get("/detailed/:attemptId", studentResultsController.getDetailedResult);

// GET /api/v1/student-results/:examId - Get exam result (catch-all, must be last)
router.get("/:examId", studentResultsController.getExamResult);

export default router;

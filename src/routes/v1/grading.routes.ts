import { Router } from "express";
import * as aiGradingController from "../../controllers/v1/aiGrading.controller";

const router = Router();

/**
 * Grading Routes - API endpoints for teacher grading operations
 */

// AI Grading Routes
// POST /api/v1/grading/auto-grade/:attemptId - Auto-grade a single attempt
router.post("/auto-grade/:attemptId", aiGradingController.autoGradeAttempt);

// POST /api/v1/grading/auto-grade-with-data - Auto-grade with data in request body
router.post(
  "/auto-grade-with-data",
  aiGradingController.autoGradeAttemptWithData
);

// POST /api/v1/grading/auto-grade-exam/:examId - Auto-grade all submitted attempts for an exam
router.post("/auto-grade-exam/:examId", aiGradingController.autoGradeExam);

// POST /api/v1/grading/auto-grade-attempt/:attemptId - Auto-grade single attempt with topic analysis (no DB updates)
router.post("/auto-grade-attempt/:attemptId", aiGradingController.autoGradeAttemptPreview);

export default router;

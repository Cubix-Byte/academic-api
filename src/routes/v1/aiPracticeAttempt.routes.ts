import { Router } from "express";
import * as aiPracticeController from "../../controllers/v1/aiPracticeAttempt.controller";

const router = Router();

/**
 * AI Practice Attempt Routes
 * Base: /api/v1/ai-practice
 */

// POST /api/v1/ai-practice/start — start a new AI practice attempt
router.post("/start", aiPracticeController.startAIPractice);

// GET /api/v1/ai-practice/student/list — list all AI practice attempts for current student
router.get("/student/list", aiPracticeController.listByStudent);

// GET /api/v1/ai-practice/student/:studentId/list — list attempts for a specific student (Parent/Teacher view)
router.get("/student/:studentId/list", aiPracticeController.listByStudentId);

// GET /api/v1/ai-practice/:attemptId — get a single attempt (for results view)
router.get("/:attemptId", aiPracticeController.getAttemptResult);

// POST /api/v1/ai-practice/:attemptId/submit-answer — save one answer
router.post("/:attemptId/submit-answer", aiPracticeController.submitAnswer);

// POST /api/v1/ai-practice/:attemptId/submit — submit the full attempt
router.post("/:attemptId/submit", aiPracticeController.submitAttempt);

export default router;

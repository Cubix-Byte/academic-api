import { Router } from "express";
import * as examBuilderController from "../../controllers/v1/examBuilder.controller";

const router = Router();

/**
 * ExamBuilder Routes - API endpoints for exam builder management
 */

// POST /api/v1/exam-builders - Create new exam builder
router.post("/", examBuilderController.createExamBuilder);

// GET /api/v1/exam-builders - Get all exam builders with pagination and filters
router.get("/", examBuilderController.getAllExamBuilders);

// GET /api/v1/exam-builders/statistics - Get exam builder statistics
router.get("/statistics", examBuilderController.getExamBuilderStatistics);

// GET /api/v1/exam-builders/:id - Get exam builder by ID
router.get("/:id", examBuilderController.getExamBuilder);

// PUT /api/v1/exam-builders/:id - Update exam builder
router.put("/:id", examBuilderController.updateExamBuilder);

// DELETE /api/v1/exam-builders/:id - Delete exam builder
router.delete("/:id", examBuilderController.deleteExamBuilder);

export default router;

import { Router } from "express";
import * as gradingSystemController from "../../controllers/v1/gradingSystem.controller";

const router = Router();

/**
 * Grading System Routes - API endpoints for managing grading systems
 */

// POST /api/v1/grading-systems - Create grading system
router.post("/", gradingSystemController.createGradingSystem);

// GET /api/v1/grading-systems - Get all grading systems
router.get("/", gradingSystemController.getAllGradingSystems);

// GET /api/v1/grading-systems/active - Get active grading system
router.get("/active", gradingSystemController.getActiveGradingSystem);

// GET /api/v1/grading-systems/search - Search grading systems
router.get("/search", gradingSystemController.searchGradingSystems);

// GET /api/v1/grading-systems/statistics - Get grading system statistics
router.get("/statistics", gradingSystemController.getGradingSystemStatistics);

// POST /api/v1/grading-systems/calculate-grade - Calculate grade from percentage
router.post("/calculate-grade", gradingSystemController.calculateGrade);

// GET /api/v1/grading-systems/:id - Get grading system by ID
router.get("/:id", gradingSystemController.getGradingSystemById);

// PUT /api/v1/grading-systems/:id - Update grading system
router.put("/:id", gradingSystemController.updateGradingSystem);

// DELETE /api/v1/grading-systems/:id - Delete grading system
router.delete("/:id", gradingSystemController.deleteGradingSystem);

export default router;

import { Router } from 'express';
import * as examModeController from '../../controllers/v1/examMode.controller';

const router = Router();

/**
 * ExamMode Routes - API endpoints for exam mode management
 */

// POST /api/v1/exam-modes - Create new exam mode
router.post('/', examModeController.createExamMode);

// GET /api/v1/exam-modes - Get all exam modes with pagination and filters
router.get('/', examModeController.getAllExamModes);

// GET /api/v1/exam-modes/search - Search exam modes (must be before /:id route)
router.get('/search', examModeController.searchExamModes);

// GET /api/v1/exam-modes/statistics - Get exam mode statistics (must be before /:id route)
router.get('/statistics', examModeController.getExamModeStatistics);

// GET /api/v1/exam-modes/ddl - Get exam modes DDL (dropdown list) (must be before /:id route)
router.get('/ddl', examModeController.getExamModesDDL);

// GET /api/v1/exam-modes/:id - Get exam mode by ID (must be last to avoid conflicts)
router.get('/:id', examModeController.getExamMode);

// PUT /api/v1/exam-modes/:id - Update exam mode
router.put('/:id', examModeController.updateExamMode);

// DELETE /api/v1/exam-modes/:id - Delete exam mode
router.delete('/:id', examModeController.deleteExamMode);

export default router;


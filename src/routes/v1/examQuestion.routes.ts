import { Router } from 'express';
import * as examQuestionController from '../../controllers/v1/examQuestion.controller';

const router = Router();

/**
 * ExamQuestion Routes - API endpoints for exam question management
 */

// POST /api/v1/exam-questions - Create new exam question
router.post('/', examQuestionController.createExamQuestion);

// GET /api/v1/exam-questions - Get all exam questions
router.get('/', examQuestionController.getAllExamQuestions);

// POST /api/v1/exam-questions/bulk - Bulk create questions
router.post('/bulk', examQuestionController.bulkCreateQuestions);

// PUT /api/v1/exam-questions/:examId/reorder - Reorder questions
router.put('/:examId/reorder', examQuestionController.reorderQuestions);

// GET /api/v1/exam-questions/:examId/next-number - Get next question number
router.get('/:examId/next-number', examQuestionController.getNextQuestionNumber);

// GET /api/v1/exam-questions/:id - Get exam question by ID
router.get('/:id', examQuestionController.getExamQuestion);

// PUT /api/v1/exam-questions/:id - Update exam question
router.put('/:id', examQuestionController.updateExamQuestion);

// DELETE /api/v1/exam-questions/:id - Delete exam question
router.delete('/:id', examQuestionController.deleteExamQuestion);

export default router;


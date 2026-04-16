import { Router } from 'express';
import * as examController from '../../controllers/v1/exam.controller';
import { smartExamValidation, smartExamUpdateValidation } from '@/middlewares/smart-validation.middleware';

const router = Router();

/**
 * Exam Routes - API endpoints for exam management
 */

// POST /api/v1/exams - Create new exam
router.post('/', smartExamValidation, examController.createExam);

// GET /api/v1/exams - Get all exams with pagination and filters
router.get('/', examController.getAllExams);

// GET /api/v1/exams/search - Search exams
router.get('/search', examController.searchExams);

// GET /api/v1/exams/statistics - Get exam statistics
router.get('/statistics', examController.getExamStatistics);

// GET /api/v1/exams/published/ddl - Get published exams DDL list for teachers
router.get('/published/ddl', examController.getPublishedExamsDDL);

// GET /api/v1/exams/logs - Get exam logs (paginated listing with filters)
router.get('/logs', examController.getExamLogs);

// GET /api/v1/exams/quick-list - Get quick exam list (limited to 30 records with filters)
router.get('/quick-list', examController.getQuickExamList);

// GET /api/v1/exams/school-performance - Get school performance metrics
router.get('/school-performance', examController.getSchoolPerformance);

// GET /api/v1/exams/:id/with-questions - Get exam with questions
router.get('/:id/with-questions', examController.getExamWithQuestions);

// POST /api/v1/exams/:id/publish - Publish exam
router.post('/:id/publish', examController.publishExam);

// POST /api/v1/exams/:id/unpublish - Unpublish exam
router.post('/:id/unpublish', examController.unpublishExam);

// POST /api/v1/exams/:id/release - Release exam
router.post('/:id/release', examController.releaseExam);

// POST /api/v1/exams/:id/assign-students - Assign students to exam
router.post('/:id/assign-students', examController.assignStudents);

// GET /api/v1/exams/:id - Get exam by ID
router.get('/:id', examController.getExam);

// PUT /api/v1/exams/:id - Update exam
router.put('/:id', smartExamUpdateValidation, examController.updateExam);

// DELETE /api/v1/exams/:id - Delete exam
router.delete('/:id', examController.deleteExam);

export default router;


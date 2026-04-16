import { Router } from 'express';
import * as studentExamTakingController from '../../controllers/v1/studentExamTaking.controller';

const router = Router();

/**
 * Student Exam Taking Routes - API endpoints for students to take exams
 */

// POST /api/v1/student-exams/start - Start exam
router.post('/start', studentExamTakingController.startExam);

// POST /api/v1/student-exams/submit-answer - Submit answer
router.post('/submit-answer', studentExamTakingController.submitAnswer);

// POST /api/v1/student-exams/submit - Submit exam
router.post('/submit', studentExamTakingController.submitExam);

// POST /api/v1/student-exams/save-draft - Save draft answer
router.post('/save-draft', studentExamTakingController.saveDraftAnswer);

// GET /api/v1/student-exams - Get all student exams
router.get('/', studentExamTakingController.getStudentExams);

// GET /api/v1/student-exams/:examId/instructions - Get exam instructions
router.get('/:examId/instructions', studentExamTakingController.getExamInstructions);

// GET /api/v1/student-exams/:examId/history - Get attempt history
router.get('/:examId/history', studentExamTakingController.getStudentAttemptHistory);

// GET /api/v1/student-exams/attempts/:attemptId/status - Get attempt status
router.get('/attempts/:attemptId/status', studentExamTakingController.getAttemptStatus);

// GET /api/v1/student-exams/attempts/:attemptId/drafts - Get draft answers
router.get('/attempts/:attemptId/drafts', studentExamTakingController.getDraftAnswers);

// POST /api/v1/student-exams/flag - Flag question
router.post('/flag', studentExamTakingController.flagQuestion);

// POST /api/v1/student-exams/unflag - Unflag question
router.post('/unflag', studentExamTakingController.unflagQuestion);

export default router;


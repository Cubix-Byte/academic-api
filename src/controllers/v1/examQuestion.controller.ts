import { Request, Response, NextFunction } from 'express';
import * as examService from '../../services/exam.service';
import {
    CreateExamQuestionRequest,
    UpdateExamQuestionRequest,
    BulkCreateQuestionsRequest,
    ReorderQuestionsRequest
} from '@/types/examQuestion.types';
import { sendSuccessResponse, sendErrorResponse, HttpStatusCodes } from 'shared-lib';

/**
 * ExamQuestion Controller - HTTP request handlers for exam question management
 */

// Create new exam question
export const createExamQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: CreateExamQuestionRequest = req.body;
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!teacherId) {
      return sendErrorResponse(res, 'Teacher ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    if (!tenantId) {
      return sendErrorResponse(res, 'Tenant ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const question = await examService.createExamQuestion(data, teacherId, tenantId);
    res.status(201);
    return sendSuccessResponse(res, 'Exam question created successfully', question);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'EXAM_NOT_FOUND') {
      return sendErrorResponse(res, 'Exam not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_OWNED_BY_TEACHER') {
      return sendErrorResponse(res, 'You do not have permission to add questions to this exam', HttpStatusCodes.FORBIDDEN);
    }
    if (errorMessage === 'EXAM_CANNOT_BE_MODIFIED') {
      return sendErrorResponse(res, 'Exam cannot be modified in its current status', HttpStatusCodes.BAD_REQUEST);
    }
    if (errorMessage === 'QUESTION_NUMBER_EXISTS') {
      return sendErrorResponse(res, 'Question number already exists', HttpStatusCodes.CONFLICT);
    }
    next(error);
  }
};

// Get all exam questions
export const getAllExamQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(res, 'Tenant ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const params = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      search: req.query.search as string,
      examId: req.query.examId as string,
      questionType: req.query.questionType as string,
      difficulty: req.query.difficulty as string,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      tenantId: tenantId
    };

    const result = await examService.getAllExamQuestions(params);
    return sendSuccessResponse(res, 'Exam questions retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

// Get exam question by ID
export const getExamQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return sendErrorResponse(res, 'Question ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const question = await examService.getExamQuestionById(id);
    return sendSuccessResponse(res, 'Exam question retrieved successfully', question);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'QUESTION_NOT_FOUND') {
      return sendErrorResponse(res, 'Question not found', HttpStatusCodes.NOT_FOUND);
    }
    next(error);
  }
};

// Update exam question
export const updateExamQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data: UpdateExamQuestionRequest = req.body;
    const teacherId = req.user?.id;

    if (!id) {
      return sendErrorResponse(res, 'Question ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    if (!teacherId) {
      return sendErrorResponse(res, 'Teacher ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const question = await examService.updateExamQuestion(id, data, teacherId);
    return sendSuccessResponse(res, 'Exam question updated successfully', question);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'QUESTION_NOT_FOUND') {
      return sendErrorResponse(res, 'Question not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_FOUND') {
      return sendErrorResponse(res, 'Exam not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_OWNED_BY_TEACHER') {
      return sendErrorResponse(res, 'You do not have permission to update this question', HttpStatusCodes.FORBIDDEN);
    }
    if (errorMessage === 'EXAM_CANNOT_BE_MODIFIED') {
      return sendErrorResponse(res, 'Exam cannot be modified in its current status', HttpStatusCodes.BAD_REQUEST);
    }
    if (errorMessage === 'QUESTION_NUMBER_EXISTS') {
      return sendErrorResponse(res, 'Question number already exists', HttpStatusCodes.CONFLICT);
    }
    next(error);
  }
};

// Delete exam question
export const deleteExamQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const teacherId = req.user?.id;
    
    if (!id) {
      return sendErrorResponse(res, 'Question ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    if (!teacherId) {
      return sendErrorResponse(res, 'Teacher ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const question = await examService.deleteExamQuestion(id, teacherId);
    return sendSuccessResponse(res, 'Exam question deleted successfully', question || {});
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'QUESTION_NOT_FOUND') {
      return sendErrorResponse(res, 'Question not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_FOUND') {
      return sendErrorResponse(res, 'Exam not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_OWNED_BY_TEACHER') {
      return sendErrorResponse(res, 'You do not have permission to delete this question', HttpStatusCodes.FORBIDDEN);
    }
    if (errorMessage === 'EXAM_CANNOT_BE_MODIFIED') {
      return sendErrorResponse(res, 'Exam cannot be modified in its current status', HttpStatusCodes.BAD_REQUEST);
    }
    next(error);
  }
};

// Bulk create questions
export const bulkCreateQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: BulkCreateQuestionsRequest = req.body;
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!teacherId) {
      return sendErrorResponse(res, 'Teacher ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    if (!tenantId) {
      return sendErrorResponse(res, 'Tenant ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const result = await examService.bulkCreateQuestions(data, teacherId, tenantId);
    res.status(201);
    return sendSuccessResponse(res, 'Questions created successfully', result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'EXAM_NOT_FOUND') {
      return sendErrorResponse(res, 'Exam not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_OWNED_BY_TEACHER') {
      return sendErrorResponse(res, 'You do not have permission to add questions to this exam', HttpStatusCodes.FORBIDDEN);
    }
    if (errorMessage === 'EXAM_CANNOT_BE_MODIFIED') {
      return sendErrorResponse(res, 'Exam cannot be modified in its current status', HttpStatusCodes.BAD_REQUEST);
    }
    next(error);
  }
};

// Reorder questions
export const reorderQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const data: ReorderQuestionsRequest = req.body;
    const teacherId = req.user?.id;

    if (!examId) {
      return sendErrorResponse(res, 'Exam ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    if (!teacherId) {
      return sendErrorResponse(res, 'Teacher ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    await examService.reorderQuestions(examId, data, teacherId);
    return sendSuccessResponse(res, 'Questions reordered successfully', {});
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === 'EXAM_NOT_FOUND') {
      return sendErrorResponse(res, 'Exam not found', HttpStatusCodes.NOT_FOUND);
    }
    if (errorMessage === 'EXAM_NOT_OWNED_BY_TEACHER') {
      return sendErrorResponse(res, 'You do not have permission to reorder questions', HttpStatusCodes.FORBIDDEN);
    }
    if (errorMessage === 'EXAM_CANNOT_BE_MODIFIED') {
      return sendErrorResponse(res, 'Exam cannot be modified in its current status', HttpStatusCodes.BAD_REQUEST);
    }
    next(error);
  }
};

// Get next question number
export const getNextQuestionNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;

    if (!examId) {
      return sendErrorResponse(res, 'Exam ID is required', HttpStatusCodes.BAD_REQUEST);
    }

    const nextNumber = await examService.getNextQuestionNumber(examId);
    return sendSuccessResponse(res, 'Next question number retrieved successfully', { nextQuestionNumber: nextNumber });
  } catch (error) {
    next(error);
  }
};


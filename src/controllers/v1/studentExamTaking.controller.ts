import { Request, Response, NextFunction } from "express";
import * as studentExamTakingService from "../../services/studentExamTaking.service";
import {
  StartExamRequest,
  SubmitAnswerRequest,
  SubmitExamRequest,
  GetStudentExamsRequest,
  SaveDraftAnswerRequest,
  FlagQuestionRequest,
} from "@/types/examAttempt.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Student Exam Taking Controller - HTTP request handlers
 */

// Start exam
export const startExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: StartExamRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.startExam(
      data,
      studentId,
      tenantId
    );
    const message = result.isResuming
      ? "Exam resumed successfully"
      : "Exam started successfully";
    res.status(201);
    return sendSuccessResponse(res, message, result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_PUBLISHED") {
      return sendErrorResponse(
        res,
        "Exam is not published yet",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "STUDENT_NOT_ASSIGNED") {
      return sendErrorResponse(
        res,
        "You are not assigned to this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_ALREADY_COMPLETED") {
      return sendErrorResponse(
        res,
        "You have already completed this exam",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_NOT_STARTED") {
      return sendErrorResponse(
        res,
        "Exam has not started yet",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_TIME_OVER") {
      return sendErrorResponse(
        res,
        "Exam time is over. You cannot start or continue this exam now.",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_ENDED") {
      return sendErrorResponse(
        res,
        "Exam has ended",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "MAX_ATTEMPTS_REACHED") {
      return sendErrorResponse(
        res,
        "You have reached the maximum number of attempts",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_HAS_NO_QUESTIONS") {
      return sendErrorResponse(
        res,
        "Exam has no questions",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Submit answer
export const submitAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: SubmitAnswerRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.submitAnswer(
      data,
      studentId,
      tenantId
    );
    return sendSuccessResponse(res, "Answer submitted successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "ATTEMPT_NOT_IN_PROGRESS") {
      return sendErrorResponse(
        res,
        "Attempt is not in progress",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "QUESTION_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Question not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "QUESTION_NOT_IN_EXAM") {
      return sendErrorResponse(
        res,
        "Question does not belong to this exam",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Submit exam
export const submitExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: SubmitExamRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.submitExam(
      data,
      studentId,
      tenantId
    );
    return sendSuccessResponse(res, result.message, result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "ATTEMPT_ALREADY_SUBMITTED") {
      return sendErrorResponse(
        res,
        "Attempt has already been submitted",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Get attempt status
export const getAttemptStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user?.id;

    if (!attemptId) {
      return sendErrorResponse(
        res,
        "Attempt ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.getAttemptStatus(
      attemptId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Attempt status retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get student exams
export const getStudentExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetStudentExamsRequest & {
      studentId: string;
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      examStatus: req.query.examStatus as string,
      examType: req.query.examType as string,
      classId: req.query.classId as string,
      subjectId: req.query.subjectId as string,
      search: req.query.search as string,
      studentId: studentId,
      tenantId: tenantId,
    };

    const result = await studentExamTakingService.getStudentExams(params);
    return sendSuccessResponse(
      res,
      "Student exams retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get student attempt history
export const getStudentAttemptHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId } = req.params;
    const studentId = req.user?.id;

    if (!examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.getStudentAttemptHistory(
      examId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Attempt history retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get exam instructions
export const getExamInstructions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId } = req.params;
    const studentId = req.user?.id;

    if (!examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.getExamInstructions(
      examId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Exam instructions retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "STUDENT_NOT_ASSIGNED") {
      return sendErrorResponse(
        res,
        "You are not assigned to this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    next(error);
  }
};

// Save draft answer
export const saveDraftAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: SaveDraftAnswerRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.saveDraftAnswer(
      data,
      studentId,
      tenantId
    );
    return sendSuccessResponse(res, "Draft answer saved successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "ATTEMPT_NOT_IN_PROGRESS") {
      return sendErrorResponse(
        res,
        "Attempt is not in progress",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Get draft answers
export const getDraftAnswers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user?.id;

    if (!attemptId) {
      return sendErrorResponse(
        res,
        "Attempt ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.getDraftAnswers(
      attemptId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Draft answers retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    next(error);
  }
};

// Flag question
export const flagQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: FlagQuestionRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.attemptId || !data.questionId) {
      return sendErrorResponse(
        res,
        "Attempt ID and Question ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.flagQuestion(
      data,
      studentId,
      tenantId
    );
    return sendSuccessResponse(res, "Question flagged successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "ATTEMPT_NOT_IN_PROGRESS") {
      return sendErrorResponse(
        res,
        "Attempt is not in progress",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "QUESTION_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Question not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Unflag question
export const unflagQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: FlagQuestionRequest = req.body;
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.attemptId || !data.questionId) {
      return sendErrorResponse(
        res,
        "Attempt ID and Question ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamTakingService.unflagQuestion(
      data,
      studentId,
      tenantId
    );
    return sendSuccessResponse(res, "Question unflagged successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "ATTEMPT_NOT_OWNED_BY_STUDENT") {
      return sendErrorResponse(
        res,
        "This attempt does not belong to you",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "ATTEMPT_NOT_IN_PROGRESS") {
      return sendErrorResponse(
        res,
        "Attempt is not in progress",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

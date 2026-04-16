import { Request, Response, NextFunction } from "express";
import * as aiPracticeService from "../../services/aiPracticeAttempt.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Controller — AI Practice Attempt endpoints
 */

// POST /api/v1/ai-practice/start
export const startAIPractice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const result = await aiPracticeService.startAIPractice(
      studentId,
      tenantId,
      req.body,
    );
    return sendSuccessResponse(res, "AI practice attempt started", result);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/ai-practice/:attemptId/submit-answer
export const submitAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const { attemptId } = req.params;
    const { questionId, answer, timeTaken } = req.body;

    await aiPracticeService.submitAnswer(
      attemptId,
      studentId,
      questionId,
      answer,
      timeTaken ?? 0,
    );
    return sendSuccessResponse(res, "Answer saved", { success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "ATTEMPT_NOT_FOUND")
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND,
      );
    if (msg === "FORBIDDEN")
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    if (msg === "ATTEMPT_NOT_IN_PROGRESS")
      return sendErrorResponse(
        res,
        "Attempt is not in progress",
        HttpStatusCodes.BAD_REQUEST,
      );
    next(error);
  }
};

// POST /api/v1/ai-practice/:attemptId/submit
export const submitAttempt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const { attemptId } = req.params;
    const { totalTimeTaken } = req.body;

    const result = await aiPracticeService.submitAttempt(
      attemptId,
      studentId,
      totalTimeTaken ?? 0,
    );
    return sendSuccessResponse(
      res,
      "Practice attempt submitted successfully",
      result,
    );
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "ATTEMPT_NOT_FOUND")
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND,
      );
    if (msg === "FORBIDDEN")
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    if (msg === "ATTEMPT_ALREADY_SUBMITTED")
      return sendErrorResponse(
        res,
        "Attempt already submitted",
        HttpStatusCodes.BAD_REQUEST,
      );
    next(error);
  }
};

// GET /api/v1/ai-practice/:attemptId
export const getAttemptResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const { attemptId } = req.params;
    const result = await aiPracticeService.getAttemptResult(
      attemptId,
      userId,
      userRole,
    );
    return sendSuccessResponse(res, "Attempt fetched", result);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "ATTEMPT_NOT_FOUND")
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND,
      );
    if (msg === "FORBIDDEN")
      return sendErrorResponse(res, "Access denied", HttpStatusCodes.FORBIDDEN);
    next(error);
  }
};

// GET /api/v1/ai-practice/student/list
export const listByStudent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const studentId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!studentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const results = await aiPracticeService.listByStudent(studentId, tenantId);
    return sendSuccessResponse(res, "AI practice attempts fetched", results);
  } catch (error) {
    next(error);
  }
};
// GET /api/v1/ai-practice/student/:studentId/list
export const listByStudentId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // In a real app, we should verify that req.user is a parent of this student
    // or has admin rights. For now, we check authentication & tenant.
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Unauthorized",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const { studentId } = req.params;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const results = await aiPracticeService.listByStudent(studentId, tenantId);
    return sendSuccessResponse(res, "AI practice attempts fetched", results);
  } catch (error) {
    next(error);
  }
};

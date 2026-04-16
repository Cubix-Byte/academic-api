import { Request, Response, NextFunction } from "express";
import * as studentResultsService from "../../services/studentResults.service";
import {
  GetResultsHistoryRequest,
  ExamComparisonRequest,
  GetMonthWiseRankingRequest,
} from "@/types/studentResults.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Student Results Controller - HTTP request handlers
 */

// Get exam result
export const getExamResult = async (
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

    const result = await studentResultsService.getExamResult(examId, studentId);
    return sendSuccessResponse(
      res,
      "Exam result retrieved successfully",
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
    if (errorMessage === "RESULT_NOT_AVAILABLE") {
      return sendErrorResponse(
        res,
        "Result is not yet available",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get results history
export const getResultsHistory = async (
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

    const params: GetResultsHistoryRequest & {
      studentId: string;
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      examType: req.query.examType as string,
      result: req.query.result as string,
      sortBy: req.query.sortBy as "submittedAt" | "percentage",
      sortOrder: req.query.sortOrder as "asc" | "desc",
      studentId: studentId,
      tenantId: tenantId,
    };

    const result = await studentResultsService.getResultsHistory(params);
    return sendSuccessResponse(
      res,
      "Results history retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get performance analytics
export const getPerformanceAnalytics = async (
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

    const result = await studentResultsService.getStudentPerformanceAnalytics(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Performance analytics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get subject-wise analytics
export const getSubjectWiseAnalytics = async (
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

    const result = await studentResultsService.getSubjectWiseAnalytics(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Subject-wise analytics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get class ranking
export const getClassRanking = async (
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

    const result = await studentResultsService.getClassRanking(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Class ranking retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get progress tracking
export const getProgressTracking = async (
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

    const result = await studentResultsService.getProgressTracking(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Progress tracking retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get peer comparison
export const getPeerComparison = async (
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

    const result = await studentResultsService.getPeerComparison(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Peer comparison retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Compare exams
export const compareExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: ExamComparisonRequest = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentResultsService.compareExams(data, studentId);
    return sendSuccessResponse(
      res,
      "Exam comparison completed successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get detailed result by attempt ID
export const getDetailedResult = async (
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

    const result = await studentResultsService.getDetailedResult(
      attemptId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Detailed result retrieved successfully",
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
    if (errorMessage === "RESULT_NOT_AVAILABLE") {
      return sendErrorResponse(
        res,
        "Result is not yet available",
        HttpStatusCodes.NOT_FOUND
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

// Get detailed result by exam ID
export const getDetailedResultByExamId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId } = req.params;
    const studentId = (req.query.studentId as string) || req.user?.id;

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

    const result = await studentResultsService.getDetailedResultByExamId(
      examId,
      studentId
    );
    return sendSuccessResponse(
      res,
      "Detailed result retrieved successfully",
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
    if (errorMessage === "RESULT_NOT_AVAILABLE") {
      return sendErrorResponse(
        res,
        "Result is not yet available",
        HttpStatusCodes.NOT_FOUND
      );
    }
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

// Get month-wise ranking
export const getMonthWiseRanking = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, subjectId, classId } = req.query;
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

    const params: GetMonthWiseRankingRequest & { tenantId: string } = {
      studentId: studentId as string,
      subjectId: subjectId as string | undefined,
      classId: classId as string | undefined,
      tenantId: tenantId,
    };

    const result = await studentResultsService.getMonthWiseRanking(params);
    return sendSuccessResponse(
      res,
      "Month-wise ranking retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "STUDENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Student not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "STUDENT_NOT_IN_TENANT") {
      return sendErrorResponse(
        res,
        "Student does not belong to this tenant",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "STUDENT_NOT_IN_CLASS") {
      return sendErrorResponse(
        res,
        "Student is not assigned to a class",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

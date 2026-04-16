import { Request, Response, NextFunction } from "express";
import * as studentExamsService from "../../services/studentExams.service";
import { GetStudentExamsRequest } from "@/types/studentExams.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Student Exams Controller - Handles HTTP requests for student exam management
 */

// Get student exams with pagination and filtering
export const getStudentExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const params: GetStudentExamsRequest = {
      pageNo: req.query.pageNo
        ? parseInt(req.query.pageNo as string)
        : undefined,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : undefined,
      examType: req.query.examType as any,
      examStatus: req.query.examStatus as any,
      timeFilter: req.query.timeFilter as any,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
    };

    const result = await studentExamsService.getStudentExams({
      ...params,
      studentId,
    });
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student exams controller error:", error);

    if (error.message === "STUDENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Student not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendErrorResponse(
      res,
      "Failed to retrieve student exams",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get exam by ID for a specific student
export const getStudentExamById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const { examId } = req.params;
    if (!examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentExamsService.getStudentExamById(
      examId,
      studentId
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student exam by ID controller error:", error);

    if (error.message === "EXAM_NOT_FOUND_OR_NOT_ASSIGNED") {
      return sendErrorResponse(
        res,
        "Exam not found or not assigned to student",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendErrorResponse(
      res,
      "Failed to retrieve student exam",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student exam statistics
export const getStudentExamStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const studentId = (req.query.studentId as string) || authenticatedUserId;

    const examType = req.query.examType as
      | "Official"
      | "Practice"
      | "Exam Repository"
      | undefined;

    const result = await studentExamsService.getStudentExamStatistics(
      studentId,
      examType
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student exam statistics controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve student exam statistics",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student exam dashboard
export const getStudentExamDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const result = await studentExamsService.getStudentExamDashboard(studentId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student exam dashboard controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve student exam dashboard",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get exams for student's current class
export const getStudentExamsByCurrentClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      return sendErrorResponse(
        res,
        "User ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Support explicit studentId from query, or fallback to authenticated user
    const studentId = (req.query.studentId as string) || authenticatedUserId;
    // assignmentId = credential template id; when present, exclude exams where student already has this credential
    const credentialId = req.query.assignmentId as string | undefined;

    const params: GetStudentExamsRequest = {
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
      examType: req.query.examType as any,
      examStatus: req.query.examStatus as any,
      timeFilter: req.query.timeFilter as any,
      sortBy: (req.query.sortBy as any) || "startOn",
      sortOrder: (req.query.sortOrder as any) || "desc",
      subjectId: req.query.subjectId as string | undefined,
      credentialId: credentialId || undefined,
    };

    const result = await studentExamsService.getStudentExamsByCurrentClass({
      ...params,
      studentId,
    });
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get exams by current class controller error:", error);

    if (error.message === "STUDENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Student not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendErrorResponse(
      res,
      "Failed to retrieve exams for current class",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get upcoming exams for student - Available Exam Queue
export const getUpcomingExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const params: GetStudentExamsRequest = {
      timeFilter: "upcoming",
      examStatus: "Published",
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
      sortBy: "startOn",
      sortOrder: "asc",
      subjectId: req.query.subjectId as string | undefined,
    };

    const result = await studentExamsService.getStudentExams({
      ...params,
      studentId,
    });
    return sendSuccessResponse(
      res,
      "Upcoming exams retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get upcoming exams controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve upcoming exams",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get past exams for student - Performed Exam
export const getPastExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const params: GetStudentExamsRequest = {
      timeFilter: "past",
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
      sortBy: "startOn",
      sortOrder: "desc",
    };

    const result = await studentExamsService.getStudentExams({
      ...params,
      studentId,
    });
    return sendSuccessResponse(
      res,
      "Past exams retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get past exams controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve past exams",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get current class stats - completed exam counts by examType
export const getCurrentClassStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const result = await studentExamsService.getCurrentClassStats(studentId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get current class stats controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve current class stats",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get subject-wise stats - average percentage and grade per subject
export const getSubjectStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Get examType from query (optional filter)
    const examType = req.query.examType as
      | "Official"
      | "Practice"
      | "Exam Repository"
      | "all"
      | undefined;

    // Build query and sort from request using generic filter pattern
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters } = queryResult;

    // Extract studentId from filters or use authenticated user's ID
    let studentId: string | null = null;

    if (filters?.studentId?.$eq) {
      studentId = filters.studentId.$eq.toString();
    } else if (filters?.studentId && typeof filters.studentId === 'string') {
      studentId = filters.studentId;
    } else {
      // Fallback to authenticated user's ID
      studentId = req.user?.id || null;
    }

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Remove studentId from filters since we're using it separately
    const { studentId: _, ...filtersWithoutStudentId } = filters || {};

    const result = await studentExamsService.getSubjectStats(
      studentId,
      tenantId,
      examType || "all",
      filtersWithoutStudentId
    );

    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get subject stats controller error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      studentId: req.user?.id,
      tenantId: req.user?.tenantId,
      examType: req.query.examType,
      errorMessage: error.message,
      errorName: error.name,
    });
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve subject stats",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get recent results - last 3 graded results
export const getRecentResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const result = await studentExamsService.getRecentResults(studentId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get recent results controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve recent results",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get started exams for student (exams with status "Started" that haven't expired)
export const getStartedExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID not found in token",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const examType = req.query.examType as
      | "Official"
      | "Practice"
      | "Exam Repository"
      | undefined;

    const result = await studentExamsService.getStartedExams(studentId, examType);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get started exams controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve started exams",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
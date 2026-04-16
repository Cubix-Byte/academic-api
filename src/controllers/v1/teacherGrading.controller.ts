import { Request, Response, NextFunction } from "express";
import * as gradingService from "../../services/grading.service";
import * as classTopicPerformanceService from "../../services/classTopicPerformance.service";
import * as studentTopicPerformanceService from "../../services/studentTopicPerformance.service";
import {
  GetGradingListRequest,
  GetStudentAnswersRequest,
  SubmitGradingRequest,
} from "@/types/grading.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Teacher Grading Controller - Handles HTTP requests for teacher grading operations
 */

// Get grading list for teacher
export const getGradingList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
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

    const params: GetGradingListRequest & {
      teacherId: string;
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      gradingTypeStatus: (req.query.gradingTypeStatus as any) || "all",
      sortBy: (req.query.sortBy as any) || "endOn",
      sortOrder: (req.query.sortOrder as any) || "desc",
      search: req.query.search as string,
      classId: req.query.classId as string,
      class: req.query.class as string,
      subjectId: req.query.subjectId as string,
      batchId: req.query.batchId as string,
      examModeId: req.query.examModeId as string,
      clientTime: req.query.clientTime as string,
      teacherId,
      tenantId,
    };

    const result = await gradingService.getGradingList(params);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error) {
    console.error("Get grading list controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve grading list",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get exam grading details
export const getExamGradingDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId } = req.params;
    const teacherId = req.user?.id;

    if (!examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingService.getExamGradingDetails(
      examId,
      teacherId
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get exam grading details controller error:", error);

    if (error.message === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (error.message === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to grade this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }

    return sendErrorResponse(
      res,
      "Failed to retrieve exam grading details",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student answers for grading
export const getStudentAnswers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { examId, studentId } = req.params;

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

    const params: GetStudentAnswersRequest = {
      examId,
      studentId,
    };

    const result = await gradingService.getStudentAnswers(params);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student answers controller error:", error);

    if (error.message === "NO_ATTEMPT_FOUND") {
      return sendErrorResponse(
        res,
        "No attempt found for this student",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendErrorResponse(
      res,
      "Failed to retrieve student answers",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Submit grading for a student
export const submitGrading = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: SubmitGradingRequest = req.body;
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
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

    if (!data.examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.attemptId) {
      return sendErrorResponse(
        res,
        "Attempt ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.answers || data.answers.length === 0) {
      return sendErrorResponse(
        res,
        "Answers are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await gradingService.submitGrading(
      data,
      teacherId,
      tenantId
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Submit grading controller error:", error);

    if (error.message === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (error.message === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to grade this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (error.message === "ATTEMPT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND
      );
    }

    return sendErrorResponse(
      res,
      "Failed to submit grading",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get grading statistics for teacher across all assigned classes and subjects
export const getGradingStatisticsForTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teacherId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const gradingType = req.query.gradingType as string;
    const examType = req.query.examType as string;
    const batchId = req.query.batchId as string | undefined;
    const examModeId = req.query.examModeId as string | undefined;

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
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

    const result = await gradingService.getGradingStatisticsForTeacher(
      teacherId,
      tenantId,
      gradingType,
      examType,
      batchId,
      examModeId
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error(
      "Get grading statistics for teacher controller error:",
      error
    );
    return sendErrorResponse(
      res,
      "Failed to retrieve grading statistics",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get grading statistics by class
export const getGradingStatisticsByClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId } = req.params;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;
    const gradingType = req.query.gradingType as string;
    const examType = req.query.examType as string;

    if (!classId) {
      return sendErrorResponse(
        res,
        "Class ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!subjectId) {
      return sendErrorResponse(
        res,
        "Subject ID is required",
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

    const result = await gradingService.getGradingStatisticsByClass(
      classId,
      subjectId,
      tenantId,
      gradingType,
      examType
    );
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get grading statistics by class controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve grading statistics",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get topic statistics for class and subject
export const getTopicStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;

    if (!classId) {
      return sendErrorResponse(
        res,
        "Class ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!subjectId) {
      return sendErrorResponse(
        res,
        "Subject ID is required",
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

    const result = await classTopicPerformanceService.getTopicStatistics({
      classId,
      subjectId,
      tenantId,
    });
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get topic statistics controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve topic statistics",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student topic statistics for class and subject
export const getStudentTopicStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.params.studentId;
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const examType = req.query.examType as string; // ← Add this line
    const tenantId = req.user?.tenantId;

    if (!studentId) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!classId) {
      return sendErrorResponse(
        res,
        "Class ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!subjectId) {
      return sendErrorResponse(
        res,
        "Subject ID is required",
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

    const result =
      await studentTopicPerformanceService.getStudentTopicStatistics({
        studentId,
        classId,
        subjectId,
        tenantId,
        examType, // ← Add this line
      });
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get student topic statistics controller error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve student topic statistics",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

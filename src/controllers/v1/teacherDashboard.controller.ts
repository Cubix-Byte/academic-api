import { Request, Response, NextFunction } from "express";
import * as teacherDashboardService from "../../services/teacherDashboard.service";
import {
  GetTopStudentsRequest,
  GetClassAnalyticsRequest,
  GetStudentActivityRequest,
  GetTeacherStudentsActivitiesRequest,
} from "@/types/teacherDashboard.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Teacher Dashboard Controller - HTTP request handlers
 */

// Get top students
export const getTopStudents = async (
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

    const params: GetTopStudentsRequest = {
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      classId: req.query.classId as string,
      subjectId: req.query.subjectId as string,
      rankType: (req.query.rankType as any) || "Class Rank",
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
    };

    const result = await teacherDashboardService.getTopStudents(
      teacherId,
      tenantId,
      params
    );
    return sendSuccessResponse(
      res,
      "Top students retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get class analytics
export const getClassAnalytics = async (
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

    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetClassAnalyticsRequest = {
      classId,
      subjectId,
      viewAs: (req.query.viewAs as any) || "Radar chart",
    };

    const result = await teacherDashboardService.getClassAnalytics(
      teacherId,
      tenantId,
      params
    );
    return sendSuccessResponse(
      res,
      "Class analytics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get student activity
export const getStudentActivity = async (
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

    const params: GetStudentActivityRequest = {
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      classId: req.query.classId as string,
      subjectId: req.query.subjectId as string,
      activityType: req.query.activityType as string,
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
    };

    const result = await teacherDashboardService.getStudentActivity(
      teacherId,
      tenantId,
      params
    );
    return sendSuccessResponse(
      res,
      "Student activity retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get all students activities for a teacher (new endpoint - only teacherId)
export const getTeacherStudentsActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teacherId = req.query.teacherId as string || req.params.teacherId;
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

    const params: GetTeacherStudentsActivitiesRequest = {
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      activityType: req.query.activityType as string,
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
    };

    const result = await teacherDashboardService.getTeacherStudentsActivities(
      teacherId,
      tenantId,
      params
    );
    return sendSuccessResponse(
      res,
      "Teacher students activities retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get teacher dashboard statistics
export const getTeacherDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teacherId = req.query.teacherId as string;
    const tenantId = req.user?.tenantId;
    const classId = req.query.classId as string | undefined;
    const subjectId = req.query.subjectId as string | undefined;
    const batchId = req.query.batchId as string | undefined;

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

    const result = await teacherDashboardService.getTeacherDashboardStats(
      teacherId,
      tenantId,
      classId,
      subjectId,
      batchId
    );
    return sendSuccessResponse(
      res,
      "Teacher dashboard stats retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------------------------
// New Analytics Controllers
// ----------------------------------------------------------------------

// Get class monthly trends
export const getClassMonthlyTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required",
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

    const result = await teacherDashboardService.getClassMonthlyTrends(
      classId,
      subjectId,
      tenantId
    );
    return res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
};

// Get question type performance
export const getQuestionTypePerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required",
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

    const result = await teacherDashboardService.getQuestionTypePerformance(
      classId,
      subjectId,
      tenantId
    );
    return res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
};

// Get class exam time analysis
export const getClassExamTimeAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required",
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

    const result = await teacherDashboardService.getClassExamTimeAnalysis(
      classId,
      subjectId,
      tenantId
    );
    return res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
};

// Get class score distribution
export const getClassScoreDistribution = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const classId = req.query.classId as string;
    const subjectId = req.query.subjectId as string;
    const tenantId = req.user?.tenantId;

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required",
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

    const result = await teacherDashboardService.getClassScoreDistribution(
      classId,
      subjectId,
      tenantId
    );
    return res.status(HttpStatusCodes.OK).json(result);
  } catch (error) {
    next(error);
  }
};



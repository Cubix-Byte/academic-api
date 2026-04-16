import { Request, Response, NextFunction } from "express";
import * as activityLogService from "../../services/activityLog.service";
import {
  GetActivityLogsRequest,
  GetTeacherActivityLogsRequest,
  GetStudentActivityLogsRequest,
  GetClassActivityLogsRequest,
  GetSubjectActivityLogsRequest,
  GetUserActivityLogsRequest,
  GetTeacherActivitiesRequest,
  GetExamActivitiesRequest,
  GetStudentActivitiesRequest,
} from "../../types/activityLog.types";
import {
  sendErrorResponse,
  sendSuccessResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Activity Log Controller - HTTP request handlers for activity log management
 */

// Get activity logs (role-based)
export const getActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const userRole = req.user?.roleName || "";

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetActivityLogsRequest = {
      tenantId: tenantId.toString(),
      userType: req.query.userType as "teacher" | "student" | undefined,
      userId: req.query.userId as string | undefined,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      activityType: req.query.activityType as any,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await activityLogService.getActivityLogs(
      params,
      userRole,
      userId
    );
    return sendSuccessResponse(
      res,
      "Activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get teacher activity logs
export const getTeacherActivityLogs = async (
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

    const params: GetTeacherActivityLogsRequest = {
      tenantId: tenantId.toString(),
      teacherId: req.query.teacherId as string | undefined,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      activityType: req.query.activityType as any,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
    };

    const result = await activityLogService.getTeacherActivityLogs(params);
    return sendSuccessResponse(
      res,
      "Teacher activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get teacher activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve teacher activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get teacher activity logs by teacher ID (path param)
export const getTeacherActivityLogsById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const teacherId = req.params.teacherId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
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

    const params: GetTeacherActivityLogsRequest = {
      tenantId: tenantId.toString(),
      teacherId,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      activityType: req.query.activityType as any,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
    };

    const result = await activityLogService.getTeacherActivityLogs(params);
    return sendSuccessResponse(
      res,
      "Teacher activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get teacher activity logs by ID error:", error);
    return sendErrorResponse(
      res,
      error.message ||
      "Failed to retrieve teacher activity logs for the specified teacher",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student activity logs
export const getStudentActivityLogs = async (
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

    const params: GetStudentActivityLogsRequest = {
      tenantId: tenantId.toString(),
      studentId: req.query.studentId as string | undefined,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      activityType: req.query.activityType as any,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
    };

    const userRole = req.user?.roleName || "";
    const userId = req.user?.id;

    const result = await activityLogService.getStudentActivityLogs(params, userRole, userId);
    return sendSuccessResponse(
      res,
      "Student activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get student activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve student activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student activity logs by student ID (path param)
export const getStudentActivityLogsById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const studentId = req.params.studentId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
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

    const params: GetStudentActivityLogsRequest = {
      tenantId: tenantId.toString(),
      studentId,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
      activityType: req.query.activityType as any,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
    };

    const userRole = req.user?.roleName || "";
    const userId = req.user?.id;

    const result = await activityLogService.getStudentActivityLogs(params, userRole, userId);
    return sendSuccessResponse(
      res,
      "Student activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get student activity logs by ID error:", error);
    return sendErrorResponse(
      res,
      error.message ||
      "Failed to retrieve student activity logs for the specified student",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get class-wise activity logs
export const getClassActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.roleName || "";
    const classId = req.params.classId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
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

    const params: GetClassActivityLogsRequest = {
      tenantId: tenantId.toString(),
      classId,
      userType: req.query.userType as "teacher" | "student" | undefined,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await activityLogService.getClassActivityLogs(
      params,
      userRole
    );
    return sendSuccessResponse(
      res,
      "Class activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get class activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve class activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get subject-wise activity logs
export const getSubjectActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.roleName || "";
    const subjectId = req.params.subjectId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
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

    const params: GetSubjectActivityLogsRequest = {
      tenantId: tenantId.toString(),
      subjectId,
      userType: req.query.userType as "teacher" | "student" | undefined,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await activityLogService.getSubjectActivityLogs(
      params,
      userRole
    );
    return sendSuccessResponse(
      res,
      "Subject activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get subject activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve subject activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get user-specific activity logs
export const getUserActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.params.userId;
    const userType = req.query.userType as "teacher" | "student";

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!userId) {
      return sendErrorResponse(
        res,
        "User ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!userType || !["teacher", "student"].includes(userType)) {
      return sendErrorResponse(
        res,
        'User type must be either "teacher" or "student"',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetUserActivityLogsRequest = {
      tenantId: tenantId.toString(),
      userId,
      userType,
      month: req.query.month as string | undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await activityLogService.getUserActivityLogs(params);
    return sendSuccessResponse(
      res,
      "User activity logs retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get user activity logs error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve user activity logs",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get teacher activities (using generic filter pattern with pagination)
export const getTeacherActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        'Tenant ID is required',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Build query and sort from request using generic filter pattern
    // Supports: filter={"teacherId__eq":"value","createdAt__gte":"date","createdAt__lte":"date"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query: filters, sort } = queryResult;

    // Prepare pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || parseInt(req.query.limit as string) || 10;

    const params: GetTeacherActivitiesRequest = {
      tenantId: tenantId.toString(),
      pageNo,
      pageSize,
      filters: filters || {},
      sort: sort || { createdAt: -1 } // Default sort by createdAt desc
    };

    const result = await activityLogService.getTeacherActivities(params);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error('Get teacher activities error:', error);
    return sendErrorResponse(
      res,
      error.message || 'Failed to retrieve teacher activities',
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get exam activities (teacher created + student attempted, using generic filter pattern with pagination)
export const getExamActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        'Tenant ID is required',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Build query and sort from request using generic filter pattern
    // Supports: filter={"createdAt__gte":"date","createdAt__lte":"date","activityType__eq":"ExamCreated"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query: filters, sort } = queryResult;

    // Prepare pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || parseInt(req.query.limit as string) || 10;

    const params: GetExamActivitiesRequest = {
      tenantId: tenantId.toString(),
      pageNo,
      pageSize,
      filters: filters || {},
      sort: sort || { createdAt: -1 } // Default sort by createdAt desc
    };

    const result = await activityLogService.getExamActivities(params);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error('Get exam activities error:', error);
    return sendErrorResponse(
      res,
      error.message || 'Failed to retrieve exam activities',
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student activities (studentId required, using generic filter pattern with pagination)
export const getStudentActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        'Tenant ID is required',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const studentId = req.query.studentId as string;
    if (!studentId) {
      return sendErrorResponse(
        res,
        'Student ID is required',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Build query and sort from request using generic filter pattern
    // Supports: filter={"createdAt__gte":"date","createdAt__lte":"date","activityType__eq":"ExamCompleted"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query: filters, sort } = queryResult;

    // Prepare pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || parseInt(req.query.limit as string) || 10;

    const params: GetStudentActivitiesRequest = {
      tenantId: tenantId.toString(),
      studentId,
      pageNo,
      pageSize,
      filters: filters || {},
      sort: sort || { createdAt: -1 } // Default sort by createdAt desc
    };

    const userRole = req.user?.roleName || "";
    const userId = req.user?.id;

    const result = await activityLogService.getStudentActivities(params, userRole, userId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error('Get student activities error:', error);
    return sendErrorResponse(
      res,
      error.message || 'Failed to retrieve student activities',
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};


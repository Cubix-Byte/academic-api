import { Request, Response, NextFunction } from "express";
import * as studentDashboardService from "../../services/studentDashboard.service";
import { GetUpcomingExamsRequest } from "@/types/studentDashboard.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Student Dashboard Controller - HTTP request handlers
 */

// Get dashboard overview
export const getDashboardOverview = async (
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

    const result = await studentDashboardService.getDashboardOverview(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Dashboard overview retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get upcoming exams
export const getUpcomingExams = async (
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

    const params: GetUpcomingExamsRequest & {
      studentId: string;
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      subjectId: req.query.subjectId as string,
      examType: req.query.examType as string,
      studentId: studentId,
      tenantId: tenantId,
    };

    const result = await studentDashboardService.getUpcomingExams(params);
    return sendSuccessResponse(
      res,
      "Upcoming exams retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get dashboard statistics
export const getDashboardStatistics = async (
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

    const result = await studentDashboardService.getDashboardStatistics(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Dashboard statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get top students in the same class
export const getTopStudents = async (
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

    const subjectId = req.query.subjectId as string | undefined;

    const result = await studentDashboardService.getTopStudents(
      studentId,
      tenantId,
      subjectId
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

// Get dashboard stats (total exams, completed, upcoming, credentials)
export const getStudentDashboardStats = async (
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

    const result = await studentDashboardService.getStudentDashboardStats(
      studentId,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Student dashboard stats retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};


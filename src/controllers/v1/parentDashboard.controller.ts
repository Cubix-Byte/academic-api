/**
 * Parent Dashboard Controller
 * Handles parent dashboard exam results, academic reports, and related endpoints
 */

import { Request, Response, NextFunction } from "express";
import * as parentDashboardService from "../../services/parentDashboard.service";
import { GetChildExamResultsRequest } from "@/types";
import { sendErrorResponse, sendSuccessResponse, buildQueryFromRequest } from "shared-lib";
import mongoose from "mongoose";

/**
 * Get exam results for a specific child
 * GET /parent-dashboard/children/:childId/exam-results
 */
export const getChildExamResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const params: GetChildExamResultsRequest & {
      tenantId: string;
      parentId: string;
    } = {
      childId,
      tenantId,
      parentId,
      examType: req.query.examType as any,
      subject: req.query.subject as string,
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      result: req.query.result as "Pass" | "Fail" | undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
      sortBy: req.query.sortBy as "date" | "percentage" | "subject" | undefined,
      sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
    };

    const result = await parentDashboardService.getChildExamResults(params);

    res.status(200).json({
      success: true,
      message: "Exam results retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child exam results error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve exam results",
      500
    );
  }
};

/**
 * Get academic reports for a specific child
 * GET /parent-dashboard/children/:childId/academic-reports
 */
export const getChildAcademicReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    // Parse filters from JSON query parameter
    let filters: any = {};
    if (req.query.filters) {
      try {
        filters =
          typeof req.query.filters === "string"
            ? JSON.parse(req.query.filters)
            : req.query.filters;
      } catch (e) {
        console.error("Error parsing filters:", e);
      }
    }

    // Extract filter values (support both direct query params and filters object)
    const search = (req.query.search as string) || filters.search || "";
    const teacher = (req.query.teacher as string) || filters.teacher || "";
    const subject = (req.query.subject as string) || filters.subject || "";
    const fromDate = (req.query.fromDate as string) || filters.fromDate || "";
    const toDate = (req.query.toDate as string) || filters.toDate || "";

    const params = {
      childId,
      tenantId,
      parentId,
      search: search.trim() || undefined,
      teacher: teacher && teacher !== "All" ? teacher : undefined,
      subject: subject && subject !== "All" ? subject : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      pageNo: req.query.pageNo ? parseInt(req.query.pageNo as string) : 1,
      pageSize: req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10,
    };

    const result = await parentDashboardService.getChildAcademicReports(params);

    res.status(200).json({
      success: true,
      message: "Academic reports retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child academic reports error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve academic reports",
      500
    );
  }
};

/**
 * Get all children for a parent
 * GET /parent-dashboard/children
 */
export const getParentChildren = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const status = (req.query.status as "active" | "all") || "active";

    const result = await parentDashboardService.getParentChildren(
      parentId,
      tenantId,
      status
    );

    res.status(200).json({
      success: true,
      message: "Children retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get parent children error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve children", 500);
  }
};

/**
 * Get parent dashboard overview
 * GET /parent-dashboard/overview
 */
export const getParentDashboardOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getParentDashboardOverview(
      parentId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Dashboard overview retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get parent dashboard overview error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve dashboard overview",
      500
    );
  }
};

/**
 * Get subject stats for a child (or all children if studentId not provided)
 * GET /parents/dashboard/subject-stats?studentId=xxx&examType=all
 */
export const getSubjectStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;
    const studentId = req.query.studentId as string | undefined;
    const examType = req.query.examType as
      | "Official"
      | "Practice"
      | "Exam Repository"
      | "all"
      | undefined;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getSubjectStats(
      parentId,
      tenantId,
      studentId,
      examType || "all"
    );

    res.status(200).json({
      success: true,
      message: result.message || "Subject stats retrieved successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error("Get subject stats error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve subject stats",
      500
    );
  }
};

/**
 * Get recent graded results for a specific child
 * GET /parents/dashboard/children/:childId/recent-results
 */
export const getChildRecentResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getChildRecentResults(
      parentId,
      childId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: result.message || "Recent results retrieved successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error("Get child recent results error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve recent results",
      500
    );
  }
};

/**
 * Get reports count by year for a specific child
 * GET /parents/dashboard/children/:childId/reports-by-year?year=2024
 */
export const getReportsByYear = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getReportsByYear(
      parentId,
      childId,
      tenantId,
      year
    );

    res.status(200).json({
      success: true,
      message: result.message || "Reports by year retrieved successfully",
      data: result.data,
    });
  } catch (error: any) {
    console.error("Get reports by year error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve reports by year",
      500
    );
  }
};

/**
 * Get teachers for a specific child
 * GET /parents/children/:childId/teachers
 */
export const getChildTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getChildTeachers(
      parentId,
      childId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Teachers retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child teachers error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve teachers", 500);
  }
};

/**
 * Get subjects for a specific child
 * GET /parents/children/:childId/subjects
 */
export const getChildSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    const result = await parentDashboardService.getChildSubjects(
      parentId,
      childId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Subjects retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child subjects error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve subjects", 500);
  }
};

/**
 * Get leaderboard data for a specific child
 * GET /parents/children/:childId/leaderboard?type=class
 */
export const getChildLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;
    const rankType = (req.query.type as "class" | "grade" | "school") || "class";

    if (!parentId || !tenantId) {
      return sendErrorResponse(
        res,
        "Parent ID and Tenant ID are required",
        400
      );
    }

    // Validate rank type
    if (!["class", "grade", "school"].includes(rankType)) {
      return sendErrorResponse(
        res,
        "Invalid ranking type. Must be 'class', 'grade', or 'school'",
        400
      );
    }

    const result = await parentDashboardService.getChildLeaderboard(
      parentId,
      childId,
      tenantId,
      rankType
    );

    res.status(200).json({
      success: true,
      message: "Leaderboard data retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child leaderboard error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve leaderboard data",
      500
    );
  }
};

/**
 * Get combined activities of all parent's children
 * GET /parents/children/activities
 */
export const getChildrenActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    const result = await parentDashboardService.getChildrenActivities({
      parentId,
      activityType: req.query.activityType as string | undefined,
      tab: req.query.tab as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Activities retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get children activities error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve activities",
      500
    );
  }
};

/**
 * Get activities for a specific child
 * GET /parents/children/:childId/activities
 */
export const getChildActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const { childId } = req.params;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    const result = await parentDashboardService.getChildrenActivities({
      parentId,
      childId,
      activityType: req.query.activityType as string | undefined,
      tab: req.query.tab as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      startDate: req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined,
      endDate: req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Child activities retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Get child activities error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve child activities",
      500
    );
  }
};

/**
 * Get aggregated credit statistics for all children of a parent
 * GET /children-credits/stats
 */
export const getChildrenCreditsStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const stats = await parentDashboardService.getChildrenCreditsStats(
      parentId,
      tenantId
    );

    sendSuccessResponse(res, "Children credits statistics retrieved successfully", stats);
  } catch (error: any) {
    console.error("Get children credits stats error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve children credits statistics",
      500
    );
  }
};

/**
 * Get all credit transactions for all children of a parent
 * GET /children/transactions
 * 
 * Query params:
 * - pageNo (optional): Page number (default: 1)
 * - pageSize (optional): Items per page (default: 50)
 * - filter (optional): JSON string for dynamic filtering
 *   Example: {"studentId": "69577a4adbfd19e13dbe0a59"}
 *   Or: {"studentId__eq": "69577a4adbfd19e13dbe0a59"}
 */
export const getChildrenTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!parentId) {
      return sendErrorResponse(res, "Parent ID is required", 400);
    }

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    const { query: filters } = queryResult;

    // Prepare pagination parameters
    const pageNo =
      parseInt(req.query.pageNo as string) ||
      parseInt(req.query.page as string) ||
      1;
    const pageSize =
      parseInt(req.query.pageSize as string) ||
      parseInt(req.query.limit as string) ||
      50;

    // Extract studentId from filters (support both direct and $eq operator)
    let studentId: string | undefined;
    if (filters.studentId) {
      if (typeof filters.studentId === "string") {
        studentId = filters.studentId;
      } else if (
        typeof filters.studentId === "object" &&
        filters.studentId.$eq
      ) {
        studentId = filters.studentId.$eq;
      }
    }

    // Log filters for debugging
    console.log("🔍 [TRANSACTIONS] Filter parameter:", req.query.filter);
    console.log("🔍 [TRANSACTIONS] Parsed filters:", JSON.stringify(filters, null, 2));
    console.log("🔍 [TRANSACTIONS] Extracted studentId:", studentId);
    console.log("🔍 [TRANSACTIONS] Pagination - pageNo:", pageNo, "pageSize:", pageSize);

    // Validate studentId if provided
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return sendErrorResponse(res, "Invalid studentId format", 400);
    }

    const result = await parentDashboardService.getChildrenTransactions(
      parentId,
      tenantId,
      pageNo,
      pageSize,
      studentId
    );

    console.log("✅ [TRANSACTIONS] Response - total:", result.total, "items:", result.items.length);

    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get children transactions error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to retrieve children transactions",
      500
    );
  }
};
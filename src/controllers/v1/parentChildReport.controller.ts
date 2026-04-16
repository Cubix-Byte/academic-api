import { Request, Response, NextFunction } from "express";
import * as parentChildReportService from "../../services/parentChildReport.service";

/**
 * Get child report for parent
 * GET /parents/children/:childId/report
 */
export const getChildReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { childId } = req.params;
    const { semester, startDate, endDate } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent ID not found",
      });
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Tenant ID not found",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    const result = await parentChildReportService.getChildReport({
      parentId: parentId.toString(),
      childId,
      tenantId: tenantId.toString(),
      semester: semester?.toString(),
      startDate: startDate?.toString(),
      endDate: endDate?.toString(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in getChildReport controller:", error);

    if (error.message?.includes("relationship not found")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view this child's report",
      });
    }

    if (error.message?.includes("Student not found")) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get child report",
    });
  }
};

/**
 * Get child performance details (trends + summary)
 * GET /parents/children/:childId/performance-details?year=2025&semester=fall_2024
 */
export const getChildPerformanceDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { childId } = req.params;
    const { year, classId, semester, startDate, endDate } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent ID not found",
      });
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Tenant ID not found",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    const result = await parentChildReportService.getChildPerformanceDetails({
      parentId: parentId.toString(),
      childId,
      tenantId: tenantId.toString(),
      classId: classId?.toString() || "",
      year: year ? parseInt(year as string, 10) : undefined,
      semester: semester?.toString(),
      startDate: startDate?.toString(),
      endDate: endDate?.toString(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in getChildPerformanceDetails controller:", error);

    if (error.message?.includes("relationship not found")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view this child's data",
      });
    }

    if (error.message?.includes("Student not found")) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get child performance details",
    });
  }
};

/**
 * Get available semesters for a child
 * GET /parents/children/:childId/semesters
 */
export const getChildSemesters = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = (req as any).user?.id || (req as any).user?._id;
    const { childId } = req.params;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent ID not found",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    const result = await parentChildReportService.getChildSemesters({
      parentId: parentId.toString(),
      childId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in getChildSemesters controller:", error);

    if (error.message?.includes("relationship not found")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view this child's data",
      });
    }

    if (error.message?.includes("Student not found")) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get child semesters",
    });
  }
};

/**
 * Get detailed subject performance for a child
 * GET /parents/children/:childId/subjects/:subjectId/details
 * classId is auto-fetched from student data
 */
export const getChildSubjectDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { childId, subjectId } = req.params;
    const { months } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent ID not found",
      });
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Tenant ID not found",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Subject ID is required",
      });
    }

    const result = await parentChildReportService.getChildSubjectDetails({
      parentId: parentId.toString(),
      childId,
      subjectId,
      tenantId: tenantId.toString(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in getChildSubjectDetails controller:", error);

    if (error.message?.includes("relationship not found")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view this child's data",
      });
    }

    if (error.message?.includes("Student not found")) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (error.message?.includes("Subject not found")) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get child subject details",
    });
  }
};

/**
 * Get monthly performance score for a subject
 * GET /parents/children/:childId/subjects/:subjectId/performance-score?months=6
 */
export const getPerformanceScore = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { childId, subjectId } = req.params;
    const { months } = req.query;

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Parent ID not found",
      });
    }

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Tenant ID not found",
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: "Subject ID is required",
      });
    }

    const result = await parentChildReportService.getChildSubjectPerformanceScore({
      parentId: parentId.toString(),
      childId,
      subjectId,
      tenantId: tenantId.toString(),
      months: months ? parseInt(months as string, 10) : 6,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error in getPerformanceScore controller:", error);

    if (error.message?.includes("relationship not found")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You are not authorized to view this child's data",
      });
    }

    if (error.message?.includes("Student not found")) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get child subject performance score",
    });
  }
};

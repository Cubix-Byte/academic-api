import { Request, Response, NextFunction } from 'express';
import { GetProgressReportRequest, GetComprehensiveReportRequest } from '@/types/report.types';
import * as reportService from '../../services/report.service';
import { sendErrorResponse } from 'shared-lib';

export const getStudentProgressReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    if (!studentId) {
      return sendErrorResponse(res, 'Student ID is required', 400);
    }

    // Validate month if provided
    if (month && (month < 1 || month > 12)) {
      return sendErrorResponse(res, 'Month must be between 1 and 12', 400);
    }

    // Validate year if provided
    if (year && (year < 2000 || year > 2100)) {
      return sendErrorResponse(res, 'Year must be between 2000 and 2100', 400);
    }

    const request: GetProgressReportRequest = {
      studentId,
      month,
      year
    };

    const report = await reportService.getStudentProgressReport(request);
    
    res.status(200).json({
      success: true,
      message: 'Progress report retrieved successfully',
      data: report
    });
  } catch (error) {
    console.error('Get progress report error:', error);
    sendErrorResponse(res, 'Failed to generate progress report', 500);
  }
};

// Additional report endpoints can be added here
export const getStudentActivityReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!studentId) {
      return sendErrorResponse(res, 'Student ID is required', 400);
    }

    // In a real implementation, you would fetch and format activity data
    // For now, we'll return a placeholder response
    res.status(200).json({
      success: true,
      message: 'Activity report endpoint',
      data: {
        studentId,
        startDate,
        endDate,
        activities: []
      }
    });
  } catch (error) {
    console.error('Get activity report error:', error);
    sendErrorResponse(res, 'Failed to generate activity report', 500);
  }
};

export const getSubjectPerformanceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, subjectId } = req.params;
    
    if (!studentId || !subjectId) {
      return sendErrorResponse(res, 'Student ID and Subject ID are required', 400);
    }

    // In a real implementation, you would fetch subject performance data
    // For now, we'll return a placeholder response
    res.status(200).json({
      success: true,
      message: 'Subject performance report endpoint',
      data: {
        studentId,
        subjectId,
        performance: {}
      }
    });
  } catch (error) {
    console.error('Get subject performance report error:', error);
    sendErrorResponse(res, 'Failed to generate subject performance report', 500);
  }
};

export const getComprehensiveStudentReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const { subjectId, classId, examId, requestingUserId } = req.query;
    // Tenant ID is extracted by global auth middleware from JWT token or user-api
    const tenantId = (req as any).user?.tenantId; 

    if (!studentId) {
      return sendErrorResponse(res, 'Student ID is required', 400);
    }
    
    // Safety check: Ensure tenantId is present
    if (!tenantId) {
        return sendErrorResponse(
          res, 
          'Tenant ID is missing. Please ensure you are properly authenticated with a valid tenant.', 
          401
        );
    }

    const request: GetComprehensiveReportRequest = {
        studentId,
        tenantId,
        classId: classId as string,
        subjectId: subjectId as string,
        examId: examId as string,
        requestingUserId: requestingUserId as string
    };

    const report = await reportService.getComprehensiveStudentReport(request);
    
    res.status(200).json({
      success: true,
      message: 'Comprehensive report generated successfully',
      data: report
    });

  } catch (error) {
    console.error('Get comprehensive report error:', error);
    sendErrorResponse(res, (error as Error).message || 'Failed to generate comprehensive report', 500);
  }
};

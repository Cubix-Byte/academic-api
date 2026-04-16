import { Request, Response, NextFunction } from "express";
import * as studentExamsService from "../../services/studentExams.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

export const getStudentExamsByCategory = async (
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

    // Allow filtering by studentId (for admin/teacher/parent views), default to authenticated user
    const studentId = (req.query.studentId as string) || authenticatedUserId;

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return;

    const { query, sort } = queryResult;

    // Remove pagination params from query filters
    delete query.pageNo;
    delete query.pageSize;
    delete query.page;
    delete query.limit;

    const pageNo = Number(req.query.pageNo) || Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || Number(req.query.limit) || 10;

    const result = await studentExamsService.getStudentExamsByCategory(
      studentId,
      {
        pageNo,
        pageSize,
        filters: query,
        sort,
      }
    );

    return sendSuccessResponse(
      res,
      "Student exams by category retrieved successfully",
      result
    );
  } catch (error: any) {
    console.error("Get student exams by category controller error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve student exams by category",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};


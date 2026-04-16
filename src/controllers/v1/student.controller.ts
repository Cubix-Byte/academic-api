import { Request, Response, NextFunction } from "express";
import * as studentService from "../../services/student.service";
import { ContentLibraryService } from "@/services/contentLibrary.service";
import * as studentExamsService from "../../services/studentExams.service";
import {
  CreateStudentRequest,
  UpdateStudentRequest,
} from "@/types/student.types";
import {
  sendErrorResponse,
  sendSuccessResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";
import { defaultPageLimit } from "shared-lib";
import mongoose from "mongoose";
import * as bulkUploadService from "../../services/bulkUpload.service";
import { safeCleanup } from "../../utils/fileCleanup.util";

// Get current student's profile (by auth user id)
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }

    const result = await studentService.getMyProfile(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my student profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get my class details with subjects
export const getMyClassDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await studentService.getMyClassDetails(userId, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my class details error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update current student's profile
export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const data: UpdateStudentRequest = req.body;
    const result = await studentService.updateStudent(userId, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update my student profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Create student
export const createStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateStudentRequest = req.body;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const createdBy = req.user?.id; // Admin who created the student
    const createdByRole = req.user?.roleName || req.user?.role || "ADMIN"; // Role of the user creating the student
    const result = await studentService.createStudent(
      data,
      tenantId,
      tenantName,
      createdBy,
      createdByRole
    );
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create student controller error:", error);

    // Check if it's a duplicate key/conflict error
    const isConflictError =
      error.isDuplicateKey ||
      error.message?.includes("already exists") ||
      error.message?.includes("full capacity") ||
      error.message?.toLowerCase().includes("duplicate") ||
      error.code === 11000;

    const statusCode = isConflictError ? HttpStatusCodes.CONFLICT : 500;
    sendErrorResponse(res, error.message, statusCode);
  }
};

// Get all students
export const getAllStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const pageNo = Number(req.query.pageNo) || defaultPageLimit;
    const pageSize = Number(req.query.pageSize) || defaultPageLimit;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Check if we need to filter for unassigned students only
    const unassignedOnly = req.query.unassigned === 'true' || req.query.unassigned === '1';

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    // If unassigned filter is requested, add conditions to get only unassigned students
    // Unassigned students: no classId AND no rollNumber
    if (unassignedOnly) {
      // Build conditions for unassigned students
      // Students with no classId (null, undefined, doesn't exist, or empty string)
      const noClassIdCondition = {
        $or: [
          { classId: { $exists: false } },
          { classId: null },
          { classId: "" }
        ]
      };

      // Students with no rollNumber (null, undefined, empty string, or doesn't exist)
      const noRollNumberCondition = {
        $or: [
          { rollNumber: { $exists: false } },
          { rollNumber: null },
          { rollNumber: "" }
        ]
      };

      // Combine existing query with unassigned conditions
      // Both conditions must be met (no classId AND no rollNumber)
      if (Object.keys(query).length > 0) {
        // If there are existing query conditions, combine them with $and
        query = {
          $and: [
            query,
            noClassIdCondition,
            noRollNumberCondition
          ]
        };
      } else {
        // If no existing conditions, just use the unassigned conditions
        query = {
          $and: [
            noClassIdCondition,
            noRollNumberCondition
          ]
        };
      }

      console.log("🔍 [STUDENTS] Filtering for unassigned students only (no classId AND no rollNumber)");
    }

    // If caller provided `subjectId` in the filter payload, map it to
    // the `subject` field used by the content documents so repository
    // queries will correctly filter assigned content.
    if (query && Object.prototype.hasOwnProperty.call(query, 'subjectId')) {
      const subjFilter = (query as any).subjectId;

      // Handle common shapes from buildQueryFromRequest: plain value,
      // object operators like {$eq, $in}, or regex objects. Preserve
      // operator objects where appropriate, otherwise stringify values.
      if (subjFilter && typeof subjFilter === 'object' && !Array.isArray(subjFilter)) {
        // If operator object contains $eq or $in, convert contained values to strings
        if ('$eq' in subjFilter) {
          (query as any).subject = String(subjFilter.$eq);
        } else if ('$in' in subjFilter && Array.isArray(subjFilter.$in)) {
          (query as any).subject = { $in: subjFilter.$in.map((v: any) => String(v)) };
        } else {
          // Keep other operator objects (e.g. regex) as-is but copy to `subject`
          (query as any).subject = subjFilter;
        }
      } else {
        // Primitive value or array - convert primitives to string, keep arrays
        if (Array.isArray(subjFilter)) {
          (query as any).subject = subjFilter.map((v: any) => String(v));
        } else {
          (query as any).subject = subjFilter != null ? String(subjFilter) : subjFilter;
        }
      }

      // Remove original subjectId to avoid confusion downstream
      delete (query as any).subjectId;
    }

    // Debug: Log the parsed query to understand the structure
    console.log("🔍 [STUDENTS] Filter parameter:", req.query.filter);
    console.log("🔍 [STUDENTS] Unassigned filter:", unassignedOnly);
    console.log("🔍 [STUDENTS] Parsed query:", JSON.stringify(query, null, 2));
    console.log("🔍 [STUDENTS] Parsed sort:", JSON.stringify(sort, null, 2));

    const result = await studentService.getAllStudents(
      tenantId,
      pageNo,
      pageSize,
      query,
      sort
    );
    return sendSuccessResponse(res, "Students retrieved successfully", result);
  } catch (error: any) {
    console.error("Get all students controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get active students DDL (dropdown list)
export const getActiveStudentsDDL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await studentService.getActiveStudentsDDL(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get active students DDL error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get student by ID
export const getStudentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format to prevent route conflicts (e.g., "performance", "stats")
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(
        res,
        `Invalid student ID format: ${id}. Must be a valid 24-character hex string.`,
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.getStudentById(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get student by ID controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update student
export const updateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateStudentRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(
        res,
        `Invalid student ID format: ${id}. Must be a valid 24-character hex string.`,
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.updateStudent(id, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update student controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete student
export const deleteStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendErrorResponse(
        res,
        `Invalid student ID format: ${id}. Must be a valid 24-character hex string.`,
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.deleteStudent(id, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete student controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get students by class
export const getStudentsByClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Extract subjectId/subjectIds from query parameters
    let subjectIds: string[] | undefined;
    const { subjectId, subjectIds: subjectIdsParam } = req.query;

    if (subjectIdsParam) {
      // Support comma-separated subjectIds: ?subjectIds=id1,id2,id3
      const ids = typeof subjectIdsParam === 'string'
        ? subjectIdsParam.split(',').map(id => id.trim()).filter(id => id)
        : Array.isArray(subjectIdsParam)
          ? subjectIdsParam.map(id => String(id).trim()).filter(id => id)
          : [];

      // Validate ObjectIds
      subjectIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));

      if (ids.length > 0 && subjectIds.length === 0) {
        return sendErrorResponse(
          res,
          "Invalid subjectId format. All subjectIds must be valid MongoDB ObjectIds.",
          HttpStatusCodes.BAD_REQUEST
        );
      }
    } else if (subjectId) {
      // Support single subjectId: ?subjectId=xxx
      const id = String(subjectId).trim();
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendErrorResponse(
          res,
          "Invalid subjectId format. Must be a valid MongoDB ObjectId.",
          HttpStatusCodes.BAD_REQUEST
        );
      }
      subjectIds = [id];
    }

    // Build query and sort from query parameters
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    const result = await studentService.getStudentsByClass(
      classId,
      tenantId,
      query,
      sort,
      subjectIds // Pass subjectIds filter to service
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get students by class controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get students by subject
export const getStudentsBySubject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { subjectId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await studentService.getStudentsBySubject(
      subjectId,
      tenantId
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get students by subject controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get my performance breakdown
export const getMyPerformanceBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { classId, subjectId, startDate, endDate } = req.query;

    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }
    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required query parameters",
        400
      );
    }

    // Parse optional date filters
    const dateFilters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    };

    const result = await studentService.getStudentPerformanceBreakdown(
      userId,
      classId as string,
      subjectId as string,
      tenantId,
      dateFilters
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my performance breakdown error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get student's graded exams
export const getMyGradedExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { studentId } = req.query;

    // Use studentId from query if provided, otherwise use authenticated user's id
    const targetStudentId = studentId ? (studentId as string) : userId;

    if (!targetStudentId) {
      return sendErrorResponse(res, "Student ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return;

    let { query, sort } = queryResult;

    // Default sort: newest exams first (by releaseDate descending)
    if (!sort || Object.keys(sort).length === 0) {
      sort = { releaseDate: -1 };
    }

    // Remove pagination params from query filters
    delete query.pageNo;
    delete query.pageSize;
    delete query.page;
    delete query.limit;

    const pageNo = Number(req.query.pageNo) || Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || Number(req.query.limit) || 10;

    console.log("🔍 [GRADED EXAMS] Query object:", JSON.stringify(query, null, 2));
    console.log("🔍 [GRADED EXAMS] Sort object:", JSON.stringify(sort, null, 2));

    const result = await studentService.getStudentGradedExams(
      targetStudentId,
      tenantId,
      {
        pageNo,
        pageSize,
        filters: query,
        sort,
      }
    );

    return sendSuccessResponse(res, "Graded exams retrieved successfully", result);
  } catch (error: any) {
    console.error("Get my graded exams error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve graded exams",
      500
    );
  }
};

// Get student's graded exams statistics
export const getMyGradedExamsStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { studentId, classId, examModeId, examType } = req.query;

    // Use studentId from query if provided, otherwise use authenticated user's id
    const targetStudentId = studentId ? (studentId as string) : userId;

    if (!targetStudentId) {
      return sendErrorResponse(res, "Student ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }
    if (!classId) {
      return sendErrorResponse(res, "Class ID is required", 400);
    }

    const result = await studentService.getStudentGradedExamsStatistics(
      targetStudentId,
      tenantId,
      classId as string,
      (examModeId as string) || undefined,
      (examType as string) || undefined
    );

    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get my graded exams statistics error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to retrieve graded exams statistics",
      500
    );
  }
};

// Get my assigned content
export const getMyAssignedContent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id || (req.user as any)?.userId;
    const tenantId = req.user?.tenantId as string;

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

    // Extract pagination parameters - Using defaultPageLimit from shared-lib
    const pageNo = Number(req.query.pageNo) || defaultPageLimit;
    const pageSize = Number(req.query.pageSize) || defaultPageLimit;

    // Build a dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    // Handle content-specific filters using operator syntax
    if (req.query.filter) {
      try {
        const filterObj = typeof req.query.filter === 'string'
          ? JSON.parse(req.query.filter)
          : req.query.filter;

        // Initialize query if it's null/undefined
        query = query || {};

        // Extract subject from processed query
        if (query.subject?.$eq) {
          query.subject = query.subject.$eq;
        }

        // Extract subjectId from processed query (filter by subject ID; preferred over subject name)
        if (query.subjectId?.$eq) {
          query.subjectId = query.subjectId.$eq;
        }

        // Extract grade from processed query
        if (query.grade?.$eq) {
          query.grade = query.grade.$eq;
        }

        // Extract fileType from processed query
        if (query.fileType?.$eq) {
          query.fileType = query.fileType.$eq;
        }

        // Extract classId from processed query (will be handled in service layer)
        // Keep it in query for service to process
        if (query.classId?.$eq) {
          query.classId = query.classId.$eq;
        }

        // Handle fileName with regex (special case for text search)
        if (filterObj.fileName) {
          query.fileName = { $regex: filterObj.fileName, $options: 'i' };
        } else if (query.fileName && typeof query.fileName === 'string') {
          query.fileName = { $regex: query.fileName, $options: 'i' };
        }
      } catch (e) {
        console.error("Failed to parse filter for content-specific fields:", e);
      }
    }

    const contentLibraryService = new ContentLibraryService();
    const result = await contentLibraryService.getStudentAssignedContent(
      studentId,
      tenantId,
      {
        pageNo,
        pageSize,
        query,
        sort,
      }
    );
    return sendSuccessResponse(res, "Assigned content fetched", result);
  } catch (error: any) {
    const code =
      error instanceof Error && error.message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to fetch assigned content",
      code
    );
  }
};

// Get my assigned content statistics (total, by subject, by file type)
export const getMyAssignedContentStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id || (req.user as any)?.userId;
    const tenantId = req.user?.tenantId as string;

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

    let query: Record<string, any> = {};
    if (req.query.classId) query.classId = req.query.classId as string;
    if (req.query.subjectId) query.subjectId = req.query.subjectId as string;
    if (req.query.filter) {
      try {
        const filterObj = typeof req.query.filter === "string"
          ? JSON.parse(req.query.filter)
          : req.query.filter;
        // Support both plain keys and __eq operator keys (e.g. classId__eq, subjectId__eq)
        if (filterObj.classId != null) query.classId = filterObj.classId;
        else if (filterObj.classId__eq != null) query.classId = filterObj.classId__eq;
        if (filterObj.subjectId != null) query.subjectId = filterObj.subjectId;
        else if (filterObj.subjectId__eq != null) query.subjectId = filterObj.subjectId__eq;
      } catch (_) {
        // ignore parse errors
      }
    }

    const contentLibraryService = new ContentLibraryService();
    const result = await contentLibraryService.getStudentAssignedContentStats(
      studentId,
      tenantId,
      { query: Object.keys(query).length ? query : undefined }
    );
    return sendSuccessResponse(res, "Assigned content stats fetched", result);
  } catch (error: any) {
    const code =
      error instanceof Error && error.message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to fetch assigned content stats",
      code
    );
  }
};

// Mark assigned content as read (for unread counts)
export const markAssignedContentRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id || (req.user as any)?.userId;
    const tenantId = req.user?.tenantId as string;
    const contentId = (req.params as { contentId?: string })?.contentId;

    if (!studentId) {
      return sendErrorResponse(res, "Student ID is required", HttpStatusCodes.BAD_REQUEST);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", HttpStatusCodes.BAD_REQUEST);
    }
    if (!contentId) {
      return sendErrorResponse(res, "Content ID is required", HttpStatusCodes.BAD_REQUEST);
    }

    const contentLibraryService = new ContentLibraryService();
    const result = await contentLibraryService.markAssignedContentAsRead(
      studentId,
      contentId,
      tenantId
    );

    if (!result.marked) {
      return sendErrorResponse(res, result.message, HttpStatusCodes.FORBIDDEN);
    }
    return sendSuccessResponse(res, result.message, { marked: true });
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error instanceof Error ? error.message : "Failed to mark content as read",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get my subject performance (percentages for all subjects based on graded exams)
export const getMySubjectPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = req.user?.id || (req.user as any)?.userId;
    const tenantId = req.user?.tenantId as string;

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

    // Get examType from query (optional filter)
    const examType = req.query.examType as
      | "Official"
      | "Practice"
      | "Exam Repository"
      | "all"
      | undefined;

    // Call the existing service method
    const result = await studentExamsService.getSubjectStats(
      studentId,
      tenantId,
      examType || "all"
    );

    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get my subject performance error:", error);
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to fetch subject performance",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get my academic progress trend (month-wise)
export const getMyAcademicProgressTrend = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId as string;

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

    // Call the service method
    const result = await studentExamsService.getAcademicProgressTrend(
      studentId,
      tenantId,
      examType || "all",
      filtersWithoutStudentId
    );

    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get my academic progress trend error:", error);
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to fetch academic progress trend",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get top students ranked by average exam percentage
export const getTopStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId, subjectId } = req.query;
    const tenantId = req.user?.tenantId;

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

    const result = await studentService.getTopStudents(
      classId as string,
      tenantId,
      subjectId as string | undefined
    );

    return sendSuccessResponse(
      res,
      result.message || "Top students retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get top students controller error:", error);
    sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get cumulative insights for a student (admin-only)
export const getAdminStudentCumulativeInsights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenantId;
    const { classId, subjectId } = req.query;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return sendErrorResponse(
        res,
        "Valid studentId param is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!classId || !subjectId) {
      return sendErrorResponse(
        res,
        "classId and subjectId are required query parameters",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.getAdminStudentCumulativeInsights({
      studentId,
      classId: classId as string,
      subjectId: subjectId as string,
      tenantId,
    });

    return sendSuccessResponse(
      res,
      result.message || "Student cumulative insights retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get admin student cumulative insights error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to get student cumulative insights",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get student profile details with statistics
export const getStudentProfileDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!id) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.getStudentProfileDetails(id, tenantId);

    return sendSuccessResponse(
      res,
      result.message || "Student profile details retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get student profile details controller error:", error);
    const errorMessage = (error as Error).message;
    if (errorMessage.includes("not found")) {
      return sendErrorResponse(res, errorMessage, HttpStatusCodes.NOT_FOUND);
    }
    sendErrorResponse(res, errorMessage, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

// Get active students stats (simplified)
export const getActiveStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const classId = req.query.classId as string | undefined;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await studentService.getActiveStats(tenantId, classId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get active stats error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Bulk upload students from CSV
export const bulkUploadStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const filePath = req.file?.path;
  const tenantId = req.user?.tenantId;
  const tenantName = req.user?.tenantName;

  if (!filePath) {
    return sendErrorResponse(
      res,
      "No CSV file uploaded",
      HttpStatusCodes.BAD_REQUEST
    );
  }

  if (!tenantId || !tenantName) {
    await safeCleanup(filePath);
    return sendErrorResponse(
      res,
      "Tenant ID and tenant name are required",
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    // Process bulk upload
    const result = await bulkUploadService.bulkUploadStudents(
      filePath,
      tenantId,
      tenantName
    );

    // Cleanup temp file
    await safeCleanup(filePath);

    // If any rows failed validation (all-or-nothing approach), return error status
    if (result.failed > 0 || result.errorRows.length > 0) {
      const seatErrors = (result.errorRows || [])
        .flatMap((r: any) => r?.errors || [])
        .filter((e: any) => e?.field === "seats" && typeof e?.message === "string");

      const isSeatCapacityFailure =
        seatErrors.length > 0 &&
        seatErrors.length ===
        (result.errorRows || []).flatMap((r: any) => r?.errors || []).length;

      const seatMessage = seatErrors[0]?.message;

      return sendErrorResponse(
        res,
        isSeatCapacityFailure && seatMessage
          ? seatMessage
          : `Bulk upload failed. ${result.failed} row(s) have validation errors. No students were created.`,
        HttpStatusCodes.BAD_REQUEST,
        {
          totalRows: result.totalRows,
          successful: result.successful,
          failed: result.failed,
          errorRows: result.errorRows.slice(0, 50), // Limit errorRows in response to first 50
        }
      );
    }

    // All rows passed validation and were created successfully
    return sendSuccessResponse(
      res,
      `Bulk upload completed successfully. ${result.successful} students created.`,
      {
        totalRows: result.totalRows,
        successful: result.successful,
        failed: result.failed,
        errorRows: result.errorRows,
      }
    );
  } catch (error: any) {
    // Ensure cleanup even on error
    await safeCleanup(filePath);
    console.error("Bulk upload students error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to process bulk upload",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Resend welcome email to student
export const resendStudentEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Student ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await studentService.resendStudentEmail(id);

    return sendSuccessResponse(
      res,
      result.message || "Welcome email sent successfully",
      result
    );
  } catch (error: any) {
    next(error);
  }
};

// Get all classes for a student (active and promoted) - Private (student, parent, admin, or teacher)
export const getStudentClasses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role || req.user?.roleName;
    const tenantId = req.user?.tenantId;

    if (!id) {
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

    if (!userId) {
      return sendErrorResponse(
        res,
        "User ID is required",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    // Access control: Student, Parent, PrimaryAdmin, Admin, and Teacher can access
    const isStudent = userRole === "STUDENT" || userRole === "Student";
    const isParent = userRole === "PARENT" || userRole === "Parent";
    const isAdmin = userRole === "ADMIN" || userRole === "Admin" || userRole === "PRIMARYADMIN" || userRole === "PrimaryAdmin";
    const isTeacher = userRole === "TEACHER" || userRole === "Teacher";

    if (isStudent) {
      // Student can only access their own classes
      if (userId !== id) {
        return sendErrorResponse(
          res,
          "You can only access your own classes",
          HttpStatusCodes.FORBIDDEN
        );
      }
    } else if (isParent) {
      // Parent can only access their children's classes
      // Import parentChild repository to verify relationship
      const parentChildRepository = await import(
        "../../repositories/parentChild.repository"
      );
      const relationship =
        await parentChildRepository.findParentChildRelationship(userId, id);

      if (!relationship) {
        return sendErrorResponse(
          res,
          "You can only access classes for your children",
          HttpStatusCodes.FORBIDDEN
        );
      }
    } else if (isAdmin || isTeacher) {
      // Admin and Teacher can access any student's classes (no additional check needed)
      // They have access to all students in their tenant
    } else {
      // Other roles are not allowed
      return sendErrorResponse(
        res,
        "Access denied. Only students, parents, admins, and teachers can access student classes",
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Get student classes
    const result = await studentService.getStudentClasses(id, tenantId);

    return sendSuccessResponse(
      res,
      "Student classes retrieved successfully",
      result
    );
  } catch (error: any) {
    console.error("Get student classes error:", error);
    const statusCode =
      error.message?.includes("not found") ||
        error.message?.includes("does not belong")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(res, error.message || "Failed to get student classes", statusCode);
  }
};

// Bulk assign students to class with subjects
export const bulkAssignStudentsToClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const { classId, assignments } = req.body;

    if (!classId) {
      return sendErrorResponse(res, "classId is required", 400);
    }

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return sendErrorResponse(
        res,
        "assignments array is required and must not be empty",
        400
      );
    }

    // Validate assignments structure
    for (const assignment of assignments) {
      if (!assignment.studentId) {
        return sendErrorResponse(
          res,
          "Each assignment must have a studentId",
          400
        );
      }
      if (!assignment.rollNumber) {
        return sendErrorResponse(
          res,
          "Each assignment must have a rollNumber",
          400
        );
      }
      if (!assignment.subjectIds || !Array.isArray(assignment.subjectIds)) {
        return sendErrorResponse(
          res,
          "Each assignment must have a subjectIds array",
          400
        );
      }
    }

    const result = await studentService.bulkAssignStudentsToClass(
      classId,
      assignments,
      tenantId,
      tenantName
    );

    res.status(201).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error: any) {
    console.error("Bulk assign students to class error:", error);
    const statusCode =
      error.message?.includes("not found") ||
        error.message?.includes("capacity exceeded") ||
        error.message?.includes("already exists")
        ? HttpStatusCodes.BAD_REQUEST
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
    return sendErrorResponse(
      res,
      error.message || "Failed to assign students to class",
      statusCode
    );
  }
};

// Update robot avatar
export const updateRobotAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { robotSrc } = req.body;

    if (!userId) {
      return sendErrorResponse(res, "User ID is required", 401);
    }
    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }
    if (!robotSrc) {
      return sendErrorResponse(res, "robotSrc is required", 400);
    }

    const result = await studentService.updateRobotAvatar(userId, robotSrc, tenantId);
    if (!result) {
      return sendErrorResponse(res, "Failed to update student avatar", 500);
    }
    return sendSuccessResponse(res, "Robot avatar updated successfully", result as any);
  } catch (error: any) {
    console.error("Update robot avatar controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

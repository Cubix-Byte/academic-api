import { Request, Response, NextFunction } from "express";
import * as examService from "../../services/exam.service";
import {
  CreateExamRequest,
  UpdateExamRequest,
  GetAllExamsRequest,
  AssignStudentsRequest,
  CreateExamWithNestedDataRequest,
} from "@/types/exam.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Exam Controller - HTTP request handlers for exam management
 */

// Create new exam (handles both basic and enhanced with nested data)
export const createExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;
    const tenantId = req.user?.tenantId;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Check if this is enhanced creation with nested data
    const hasNestedData =
      data.exam_questions ||
      data.exam_students ||
      data.exam_contents ||
      data.exam_ai_prompt_history ||
      data.exam_settings;
    if (hasNestedData) {
      // Use enhanced creation with nested data
      console.log("🚀 Using enhanced creation with nested data");
      const enhancedData: CreateExamWithNestedDataRequest = data;
      const result = await examService.createExamWithNestedData(
        enhancedData,
        tenantId,
        teacherId
      );
      res.status(201);
      return sendSuccessResponse(
        res,
        "Exam created successfully with nested data",
        result
      );
    } else {
      // Use basic creation
      console.log("📝 Using basic creation");
      const basicData: CreateExamRequest = data;
      const exam = await examService.createExam(basicData, tenantId, teacherId);
      res.status(201);
      return sendSuccessResponse(res, "Exam created successfully", exam);
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "END_DATE_BEFORE_START_DATE") {
      return sendErrorResponse(
        res,
        "End date must be after start date",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Get all exams
export const getAllExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }


    // Generic dynamic filter pattern (like tenants/logs/quick-list)
    // Supports: filter={"examType__eq":"Official","classId__eq":"...","subjectId__eq":"...","startOn__gte":"...","startOn__lte":"...","sort":"createdAt:desc"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query, sort } = queryResult;

    const pageNo =
      parseInt(req.query.pageNo as string) ||
      parseInt(req.query.page as string) ||
      1;
    const pageSize =
      parseInt(req.query.pageSize as string) ||
      parseInt(req.query.limit as string) ||
      10;

    const params = {
      pageNo,
      pageSize,
      query: query || {},
      sort: sort && Object.keys(sort).length > 0 ? sort : { createdAt: -1 },
      tenantId: tenantId.toString(),
      ...(req.user?.roleName === "TEACHER" && teacherId
        ? { teacherId: teacherId.toString() }
        : {}),
    };

    console.log('params', params);

    const result = await examService.getAllExamsDynamic(params);
    return sendSuccessResponse(res, "Exams retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

// Get exam logs (paginated listing with filters)
export const getExamLogs = async (
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

    // Build query and sort from query parameters using generic filter pattern
    // This supports filter parameter with operators like: filter={"classId__eq":"value","teacherId__eq":"value"}
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query, sort } = queryResult;

    // Prepare pagination parameters
    const pageNo =
      parseInt(req.query.pageNo as string) ||
      parseInt(req.query.page as string) ||
      1;
    const pageSize =
      parseInt(req.query.pageSize as string) ||
      parseInt(req.query.limit as string) ||
      10;

    const params = {
      pageNo,
      pageSize,
      query: query || {},
      sort: sort && Object.keys(sort).length > 0 ? sort : { createdAt: -1 }, // Only use sort if it has keys, otherwise default to createdAt desc
      tenantId,
    };

    // Handle search parameter if provided (backward compatibility)
    if (req.query.search) {
      params.query = {
        ...params.query,
        $or: [
          { examTitle: { $regex: req.query.search, $options: "i" } },
          { description: { $regex: req.query.search, $options: "i" } },
        ],
      };
    }

    const result = await examService.getExamLogs(params);
    return sendSuccessResponse(res, "Exam logs retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

// Get quick exam list (limited to 30 records with filters)
export const getQuickExamList = async (
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

    // Build dynamic query and sort from filter parameter
    // This uses the generic filter pattern: filter={"field__or__0":"value"} for regex search
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    // Default sort: order by createdAt desc if no sort is provided
    if (!sort || Object.keys(sort).length === 0) {
      sort = { createdAt: -1 };
    }

    // Pass query parameters to service
    const result = await examService.getQuickExamList({
      tenantId,
      query,
      sort,
    });

    return sendSuccessResponse(
      res,
      "Quick exam list retrieved successfully",
      result
    );
  } catch (error) {
    console.error("Get quick exam list error:", error);
    return sendErrorResponse(
      res,
      "Failed to retrieve quick exam list",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get exam by ID
export const getExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Validate ObjectId format (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return sendErrorResponse(
        res,
        "Invalid exam ID format",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const exam = await examService.getExamById(id);
    return sendSuccessResponse(res, "Exam retrieved successfully", exam);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get exam with questions
export const getExamWithQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const exam = await examService.getExamWithQuestions(id);
    return sendSuccessResponse(
      res,
      "Exam with questions retrieved successfully",
      exam
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update exam
export const updateExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateExamRequest = req.body;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Check if this is enhanced update with nested data
    const hasNestedData =
      data.exam_questions ||
      data.exam_students ||
      data.exam_contents ||
      data.exam_ai_prompt_history ||
      data.exam_settings;

    if (hasNestedData) {
      // Use enhanced update with nested data
      console.log("🚀 Using enhanced update with nested data");
      const result = await examService.updateExamWithNestedData(
        id,
        data,
        teacherId
      );
      return sendSuccessResponse(
        res,
        "Exam updated successfully with nested data",
        result
      );
    } else {
      // Use basic update
      console.log("📝 Using basic update");
      const exam = await examService.updateExam(id, data, teacherId);
      return sendSuccessResponse(res, "Exam updated successfully", exam);
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to update this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_CANNOT_BE_UPDATED") {
      return sendErrorResponse(
        res,
        "Exam cannot be updated in its current status",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "END_DATE_BEFORE_START_DATE") {
      return sendErrorResponse(
        res,
        "End date must be after start date",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Delete exam
export const deleteExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const exam = await examService.deleteExam(id, teacherId);
    return sendSuccessResponse(res, "Exam deleted successfully", exam || {});
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to delete this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_CANNOT_BE_DELETED") {
      return sendErrorResponse(
        res,
        "Only draft exams can be deleted",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Publish exam
export const publishExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const exam = await examService.publishExam(id, teacherId);
    return sendSuccessResponse(res, "Exam published successfully", exam);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to publish this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_ALREADY_PUBLISHED") {
      return sendErrorResponse(
        res,
        "Exam is already published",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_HAS_NO_QUESTIONS") {
      return sendErrorResponse(
        res,
        "Exam must have at least one question",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_MARKS_MISMATCH") {
      return sendErrorResponse(
        res,
        "Total marks from questions do not match exam total marks",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_HAS_NO_STUDENTS") {
      return sendErrorResponse(
        res,
        "Exam must have at least one student assigned",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_MISSING_TOPIC_BREAKDOWN") {
      return sendErrorResponse(
        res,
        "Topic breakdown must contain at least one topic",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Unpublish exam
export const unpublishExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const exam = await examService.unpublishExam(id, teacherId);
    return sendSuccessResponse(res, "Exam unpublished successfully", exam);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to unpublish this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_NOT_PUBLISHED") {
      return sendErrorResponse(
        res,
        "Exam is not published",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_ALREADY_STARTED") {
      return sendErrorResponse(
        res,
        "Cannot unpublish exam that has already started",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_HAS_STUDENT_ATTEMPTS") {
      return sendErrorResponse(
        res,
        "Cannot unpublish exam. Some students have already started or attempted this exam",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Release exam
export const releaseExam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const result = await examService.releaseExam(id, teacherId);
    return sendSuccessResponse(res, "Exam released successfully", {
      exam: result.exam,
      studentsAttempted: result.studentsAttempted,
      studentsGraded: result.studentsGraded,
      totalStudents: result.totalStudents,
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to release this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (errorMessage === "EXAM_MUST_BE_PUBLISHED_TO_RELEASE") {
      return sendErrorResponse(
        res,
        "Exam must be published before it can be released",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_ALREADY_RELEASED") {
      return sendErrorResponse(
        res,
        "Exam is already released",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "EXAM_NOT_ENDED_YET") {
      return sendErrorResponse(
        res,
        "Cannot release exam. Exam must have ended before it can be released",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "NO_STUDENTS_ATTEMPTED") {
      return sendErrorResponse(
        res,
        "Cannot release exam. At least one student must have attempted the exam",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "GRADING_NOT_COMPLETED") {
      return sendErrorResponse(
        res,
        "Cannot release exam. All student attempts must be graded before releasing",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Assign students to exam
export const assignStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: AssignStudentsRequest = req.body;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await examService.assignStudentsToExam(
      id,
      data,
      teacherId,
      tenantId
    );
    return sendSuccessResponse(res, "Students assigned successfully", result);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "EXAM_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "EXAM_NOT_OWNED_BY_TEACHER") {
      return sendErrorResponse(
        res,
        "You do not have permission to assign students to this exam",
        HttpStatusCodes.FORBIDDEN
      );
    }
    next(error);
  }
};

// Get exam statistics
export const getExamStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    
    // Support dynamic filter pattern: filter={"batchId__eq":"...","examModeId__eq":"..."}
    // Also support backward compatibility with direct query params
    let batchId: string | undefined;
    let examModeId: string | undefined;

    // Try to get from dynamic filter first
    if (req.query.filter) {
      try {
        const filterObj = typeof req.query.filter === 'string' 
          ? JSON.parse(req.query.filter) 
          : req.query.filter;
        
        // Extract batchId from filter (support both batchId__eq and batchId)
        if (filterObj.batchId__eq) {
          batchId = filterObj.batchId__eq;
        } else if (filterObj.batchId) {
          batchId = filterObj.batchId;
        }
        
        // Extract examModeId from filter (support both examModeId__eq and examModeId)
        if (filterObj.examModeId__eq) {
          examModeId = filterObj.examModeId__eq;
        } else if (filterObj.examModeId) {
          examModeId = filterObj.examModeId;
        }
      } catch (parseError) {
        // If filter parsing fails, fall back to query params
        console.warn("Failed to parse filter parameter, falling back to query params:", parseError);
      }
    }

    // Fall back to direct query params if not found in filter (backward compatibility)
    if (!batchId) {
      batchId = req.query.batchId as string | undefined;
    }
    if (!examModeId) {
      examModeId = req.query.examModeId as string | undefined;
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // TypeScript narrowing: after the check, tenantId is guaranteed to be string
    const validTenantId: string = tenantId;

    // Only TEACHER and ADMIN roles can access exam statistics
    if (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN") {
      return sendErrorResponse(
        res,
        "Only teachers and admins can access exam statistics",
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Only pass teacherId if the current user is a TEACHER
    // For ADMIN, pass undefined to show all statistics
    // Only pass teacherId as a string; use empty string for ADMIN to satisfy service signature
    const teacherId: string =
      req.user?.roleName === "TEACHER" && req.user?.id ? req.user.id : "";

    const result = await examService.getExamStatistics(
      validTenantId,
      teacherId,
      batchId,
      examModeId
    );
    return sendSuccessResponse(
      res,
      "Exam statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Search exams
export const searchExams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search } = req.query;
    const tenantId = req.user?.tenantId;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!search) {
      return sendErrorResponse(
        res,
        "Search term is required",
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

    // Only TEACHER and ADMIN roles can create/manage exams
    if (
      !teacherId ||
      (req.user?.roleName !== "TEACHER" && req.user?.roleName !== "ADMIN" && req.user?.roleName !== "PRIMARYADMIN")
    ) {
      return sendErrorResponse(
        res,
        "Only teachers and admins can manage exams",
        HttpStatusCodes.FORBIDDEN
      );
    }

    const params = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      examStatus: req.query.examStatus as string,
      examType: req.query.examType as string,
    };

    const result = await examService.searchExams(
      search as string,
      tenantId,
      teacherId,
      params
    );
    return sendSuccessResponse(
      res,
      "Exams search completed successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get published exams DDL list for teacher
export const getPublishedExamsDDL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    // Role-based ID mapping: userId becomes teacherId for TEACHER role
    const teacherId =
      req.user?.roleName === "TEACHER" || req.user?.roleName === "ADMIN" || req.user?.roleName === "PRIMARYADMIN"
        ? req.user?.id
        : null;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Only TEACHER role can access this endpoint
    if (!teacherId || req.user?.roleName !== "TEACHER") {
      return sendErrorResponse(
        res,
        "Only teachers can access this endpoint",
        HttpStatusCodes.FORBIDDEN
      );
    }

    // Extract filters from query parameters
    const filters = {
      id: req.query.id as string | undefined,
      name: req.query.name as string | undefined,
      classId: req.query.classId as string | undefined,
      subjectId: req.query.subjectId as string | undefined,
    };

    // Remove undefined filters
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined)
    );

    const result = await examService.getPublishedExamsDDL(
      teacherId,
      tenantId,
      Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined
    );

    return sendSuccessResponse(
      res,
      "Published exams DDL list retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get school performance
export const getSchoolPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const currentMonth = req.query.currentMonth as string;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required. Please login to access this endpoint.",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!currentMonth) {
      return sendErrorResponse(
        res,
        "currentMonth parameter is required (format: YYYY-MM)",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Validate currentMonth format
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(currentMonth)) {
      return sendErrorResponse(
        res,
        "Invalid currentMonth format. Expected format: YYYY-MM (e.g., 2024-11)",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await examService.getSchoolPerformance(
      tenantId,
      currentMonth
    );

    return sendSuccessResponse(
      res,
      "School performance retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "TENANT_ID_REQUIRED") {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (errorMessage === "INVALID_MONTH_FORMAT") {
      return sendErrorResponse(
        res,
        "Invalid currentMonth format. Expected format: YYYY-MM (e.g., 2024-11)",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

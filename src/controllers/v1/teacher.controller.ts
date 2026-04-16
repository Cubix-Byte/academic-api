import { Request, Response, NextFunction } from "express";
import * as teacherService from "../../services/teacher.service";
import {
  CreateTeacherRequest,
  UpdateTeacherRequest,
  AssignClassesRequest,
  AssignSubjectsRequest,
} from "@/types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  buildQueryFromRequest,
  HttpStatusCodes,
} from "shared-lib";
import * as bulkUploadService from "../../services/bulkUpload.service";
import { safeCleanup } from "../../utils/fileCleanup.util";

// Get current teacher profile (by auth user id)
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
    const result = await teacherService.getTeacherById(userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my teacher profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update current teacher profile
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

    const data: UpdateTeacherRequest = req.body;
    const result = await teacherService.updateTeacher(userId, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update my teacher profile error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get my class detail
export const getMyClassDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { classId, subjectId } = req.query;

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

    const result = await teacherService.getMyClassDetail(
      userId,
      classId as string,
      subjectId as string,
      tenantId
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get my class detail error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Create teacher
export const createTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateTeacherRequest = req.body;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    console.log("req.user", req.user);

    if (!tenantId || !tenantName) {
      return sendErrorResponse(
        res,
        "Tenant ID and tenant name are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const createdBy = req.user?.id; // Admin who created the teacher
    const createdByRole = req.user?.roleName || req.user?.role || "ADMIN"; // Role of the user creating the teacher
    const result = await teacherService.createTeacher(
      data,
      tenantId,
      tenantName,
      createdBy,
      createdByRole
    );
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create teacher error:", error);
    const errorMessage = error.message || "Failed to create teacher";

    // Check for duplicate email/username errors
    if (
      errorMessage.includes("already exists") ||
      errorMessage.includes("full capacity") ||
      errorMessage.includes("USERNAME_EXISTS") ||
      errorMessage.includes("EMAIL_EXISTS") ||
      errorMessage.includes("Conflict") ||
      errorMessage.includes("employee ID") ||
      error.response?.status === 409
    ) {
      return sendErrorResponse(
        res,
        errorMessage.includes("Please use a different email")
          ? errorMessage
          : errorMessage,
        HttpStatusCodes.CONFLICT
      );
    }

    // Check for validation errors
    if (
      errorMessage.includes("required") ||
      errorMessage.includes("Invalid") ||
      errorMessage.includes("must be") ||
      errorMessage.includes("format")
    ) {
      return sendErrorResponse(res, errorMessage, HttpStatusCodes.BAD_REQUEST);
    }

    // Default to 500 for unexpected errors
    return sendErrorResponse(
      res,
      errorMessage,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get all teachers
export const getAllTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    // Build dynamic query and sort from filter parameter
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled by buildQueryFromRequest

    let { query, sort } = queryResult;

    // Prepare pagination parameters (default pageSize = 100)
    const pageNo =
      parseInt(req.query.pageNo as string) ||
      parseInt(req.query.page as string) ||
      1;
    const pageSize =
      parseInt(req.query.pageSize as string) ||
      parseInt(req.query.limit as string) ||
      100;

    // Extract classId and subjectId from filter (can be in filter object or query params for backward compatibility)
    // buildQueryFromRequest may convert __eq to { $eq: 'value' } format, so we need to extract the actual value
    let classId: string | undefined = undefined;
    if (query.classId) {
      if (typeof query.classId === "string") {
        classId = query.classId;
      } else if (
        query.classId &&
        typeof query.classId === "object" &&
        "$eq" in query.classId
      ) {
        classId = String(query.classId.$eq);
      }
    }
    if (!classId) {
      classId = req.query.classId as string | undefined;
    }
    // Handle "all" value - ignore filter
    if (classId === "all") {
      classId = undefined;
    }

    let subjectId: string | undefined = undefined;
    if (query.subjectId) {
      if (typeof query.subjectId === "string") {
        subjectId = query.subjectId;
      } else if (
        query.subjectId &&
        typeof query.subjectId === "object" &&
        "$eq" in query.subjectId
      ) {
        subjectId = String(query.subjectId.$eq);
      }
    }
    if (!subjectId) {
      subjectId = req.query.subjectId as string | undefined;
    }
    // Handle "all" value - ignore filter
    if (subjectId === "all") {
      subjectId = undefined;
    }

    // Validation: If subjectId is provided, classId must also be provided
    if (subjectId && !classId) {
      return sendErrorResponse(
        res,
        "classId is required when subjectId is provided",
        400
      );
    }

    // Remove classId and subjectId from query to avoid conflicts (they're handled separately)
    const { classId: _, subjectId: __, ...restQuery } = query;
    query = restQuery;

    // Add classId and subjectId to filters if they exist (as strings, not objects)
    const filters = {
      ...query,
      ...(classId && { classId }),
      ...(subjectId && { subjectId }),
    };

    // Default sort: order by createdAt desc if no sort is provided
    if (!sort || Object.keys(sort).length === 0) {
      sort = { createdAt: -1 };
    }

    const result = await teacherService.getAllTeachers(
      tenantId,
      pageNo,
      pageSize,
      filters,
      sort
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get all teachers error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teacher by ID
export const getTeacherById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await teacherService.getTeacherById(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teacher by ID error:", error);
    const statusCode = (error as any).statusCode || 500;
    sendErrorResponse(res, error.message, statusCode);
  }
};

// Get teacher profile details with statistics
export const getTeacherProfileDetails = async (
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

    const result = await teacherService.getTeacherProfileDetails(id, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teacher profile details error:", error);
    const statusCode = (error as any).statusCode || 500;
    sendErrorResponse(res, error.message, statusCode);
  }
};

// Update teacher
export const updateTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateTeacherRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await teacherService.updateTeacher(id, data, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update teacher error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete teacher
export const deleteTeacher = async (
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

    const result = await teacherService.deleteTeacher(id, tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete teacher error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teachers by class
export const getTeachersByClass = async (
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

    // Build query and sort from query parameters
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query, sort } = queryResult;

    const result = await teacherService.getTeachersByClass(
      classId,
      tenantId,
      query || {},
      sort || { createdAt: -1 }
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teachers by class error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teachers by subject
export const getTeachersBySubject = async (
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

    // Build query and sort from query parameters
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query, sort } = queryResult;

    const result = await teacherService.getTeachersBySubject(
      subjectId,
      tenantId,
      query || {},
      sort || { createdAt: -1 }
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teachers by subject error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teachers DDL (dropdown list)
export const getTeachersDDL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await teacherService.getTeachersDDL(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teachers DDL error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Assign classes to teacher
export const assignClasses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: AssignClassesRequest = req.body;
    const tenantId = req.user?.tenantId;
    const assignedBy = req.user?.id;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    if (!assignedBy) {
      return sendErrorResponse(res, "User ID is required", 400);
    }

    if (
      !data.assignments ||
      !Array.isArray(data.assignments) ||
      data.assignments.length === 0
    ) {
      return sendErrorResponse(res, "Assignments array is required", 400);
    }

    // Validate each assignment has both classId and subjectId
    for (const assignment of data.assignments) {
      if (!assignment.classId || !assignment.subjectId) {
        return sendErrorResponse(
          res,
          "Each assignment must have both classId and subjectId",
          400
        );
      }
    }

    const result = await teacherService.assignClasses(
      id,
      data.assignments,
      tenantId,
      assignedBy
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Assign classes error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Assign subjects to teacher
export const assignSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: AssignSubjectsRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    if (
      !data.subjectIds ||
      !Array.isArray(data.subjectIds) ||
      data.subjectIds.length === 0
    ) {
      return sendErrorResponse(res, "Subject IDs array is required", 400);
    }

    const result = await teacherService.assignSubjects(
      id,
      data.subjectIds,
      tenantId
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Assign subjects error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teacher statistics
export const getTeacherStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await teacherService.getTeacherStatistics(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get teacher statistics error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get active teachers and subjects stats (simplified)
export const getActiveStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(res, "Tenant ID is required", 400);
    }

    const result = await teacherService.getActiveStats(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get active stats error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get teacher counts (total, active, inactive)
export const getActiveCounts = async (
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

    const result = await teacherService.getActiveCounts(tenantId);
    return sendSuccessResponse(res, result.message, result.data);
  } catch (error: any) {
    console.error("Get teacher counts error:", error);
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get teacher classes with subjects (Admin only)
export const getTeacherClassesWithSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: teacherId } = req.params;
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

    const classes = await teacherService.getTeacherClassesWithSubjects(
      teacherId,
      tenantId
    );

    return sendSuccessResponse(
      res,
      "Teacher classes with subjects retrieved successfully",
      classes
    );
  } catch (error: any) {
    console.error("Get teacher classes with subjects error:", error);
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Get my classes with students (for authenticated teacher)
export const getMyClassesWithStudents = async (
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
        "User ID is required",
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await teacherService.getMyClassesWithStudents(
      teacherId,
      tenantId
    );

    return sendSuccessResponse(
      res,
      "Teacher classes with students retrieved successfully",
      result.data
    );
  } catch (error: any) {
    console.error("Get my classes with students error:", error);
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Bulk upload teachers from CSV
export const bulkUploadTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const filePath = (req as any).file?.path;
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
    const result = await bulkUploadService.bulkUploadTeachers(
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
        seatErrors.length === (result.errorRows || []).flatMap((r: any) => r?.errors || []).length;

      const seatMessage = seatErrors[0]?.message;

      return sendErrorResponse(
        res,
        isSeatCapacityFailure && seatMessage
          ? seatMessage
          : `Bulk upload failed. ${result.failed} row(s) have validation errors. No teachers were created.`,
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
      `Bulk upload completed successfully. ${result.successful} teachers created.`,
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
    console.error("Bulk upload teachers error:", error);
    return sendErrorResponse(
      res,
      error.message || "Failed to process bulk upload",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

// Resend welcome email to teacher
export const resendTeacherEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await teacherService.resendTeacherEmail(id);

    return sendSuccessResponse(
      res,
      result.message || "Welcome email sent successfully",
      result
    );
  } catch (error: any) {
    next(error);
  }
};

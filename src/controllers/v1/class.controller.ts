import { Request, Response } from "express";
import { ClassService } from "@/services/class.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Class Controller
 *
 * Handles HTTP requests for Class operations
 * Processes requests and delegates business logic to service layer
 */
export class ClassController {
  private classService: ClassService;

  constructor() {
    this.classService = new ClassService();
  }

  /**
   * Create a new class
   */
  createClass = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("✅ [createClass] Request reached controller:", {
        hasUser: !!req.user,
        userId: req.user?.userId || req.user?.id,
        tenantId: req.user?.tenantId,
        bodyKeys: Object.keys(req.body),
        timestamp: new Date().toISOString(),
      });

      const classData = req.body;
      // Get tenant ID from user context (when authenticated) or from request body (when not authenticated)
      const tenantId = req.user?.tenantId || req.body.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Get admin ID and role who created the class
      const createdBy = req.user?.id; // Admin who created the class
      const createdByRole = req.user?.roleName || req.user?.role || "ADMIN"; // Role of the user creating the class
      const createdByEmail = req.user?.email || req.user?.username || "system"; // For backward compatibility

      const result = await this.classService.createClass(
        classData,
        tenantId,
        createdByEmail,
        createdBy,
        createdByRole
      );

      // Determine success message based on single or bulk
      const isBulk = Array.isArray(result);
      const message = isBulk
        ? `${result.length} class(es) created successfully`
        : "Class created successfully";

      sendSuccessResponse(res, message, result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create class";
      const isConflictError =
        errorMessage.includes("already exist") ||
        errorMessage.includes("Duplicate class") ||
        errorMessage.toLowerCase().includes("duplicate");
      const statusCode = isConflictError
        ? HttpStatusCodes.CONFLICT
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, errorMessage, statusCode);
    }
  };

  /**
   * Get all classes
   */
  getAllClasses = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get tenant ID from user context (when authenticated) or from query params (when not authenticated)
      const tenantId = req.user?.tenantId || (req.query.tenantId as string);

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Build query and sort from query parameters
      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return; // Error response already handled

      const { query, sort } = queryResult;

      // Prepare pagination parameters
      const pageNo = parseInt(req.query.pageNo as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const params = {
        pageNo,
        pageSize,
        query: query || {},
        sort: sort || { createdAt: -1 },
        tenantId,
      };

      // Handle search parameter if provided
      if (req.query.search) {
        params.query = {
          ...params.query,
          $or: [
            { className: { $regex: req.query.search, $options: "i" } },
            { name: { $regex: req.query.search, $options: "i" } },
          ],
        };
      }

      const result = await this.classService.getAllClasses(params);
      sendSuccessResponse(res, "Classes retrieved successfully", result);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve classes",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get class by ID
   */
  getClassById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      // Get tenant ID from user context (when authenticated) or from query params (when not authenticated)
      const tenantId = req.user?.tenantId || (req.query.tenantId as string);

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const classData = await this.classService.getClassById(id, tenantId);
      sendSuccessResponse(res, "Class retrieved successfully", classData);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message === "Class not found"
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve class",
        statusCode
      );
    }
  };

  /**
   * Update class
   */
  updateClass = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const classData = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const updatedClass = await this.classService.updateClass(
        id,
        classData,
        tenantId
      );
      sendSuccessResponse(res, "Class updated successfully", updatedClass);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message === "Class not found"
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to update class",
        statusCode
      );
    }
  };

  /**
   * Delete class
   */
  deleteClass = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      await this.classService.deleteClass(id, tenantId);
      sendSuccessResponse(res, "Class deleted successfully");
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message === "Class not found"
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to delete class",
        statusCode
      );
    }
  };

  /**
   * Get class students
   */
  getClassStudents = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const students = await this.classService.getClassStudents(id, tenantId);
      sendSuccessResponse(
        res,
        "Class students retrieved successfully",
        students
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve class students",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get class subjects
   */
  getClassSubjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const subjects = await this.classService.getClassSubjects(id, tenantId);
      sendSuccessResponse(
        res,
        "Class subjects retrieved successfully",
        subjects
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve class subjects",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get class subject details with teacher assignments
   */
  getClassSubjectDetails = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const subjectDetails = await this.classService.getClassSubjectDetails(
        id,
        tenantId
      );
      sendSuccessResponse(
        res,
        "Class subject details retrieved successfully",
        subjectDetails
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve class subject details",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get class statistics
   */
  getClassStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const stats = await this.classService.getClassStats(tenantId);
      sendSuccessResponse(
        res,
        "Class statistics retrieved successfully",
        stats
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve class statistics",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get classes by grade
   */
  getClassesByGrade = async (req: Request, res: Response): Promise<void> => {
    try {
      const { grade } = req.params;
      const tenantId = req.user?.tenantId || (req.query.tenantId as string);

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!grade) {
        sendErrorResponse(
          res,
          "Grade parameter is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return;

      const { query, sort } = queryResult;

      const classes = await this.classService.getClassesByGrade(
        grade,
        tenantId,
        query || {},
        sort || { createdAt: -1 }
      );

      sendSuccessResponse(
        res,
        "Classes retrieved successfully by grade",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve classes by grade",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get classes by academic year
   */
  getClassesByAcademicYear = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { year } = req.params;
      const tenantId = req.user?.tenantId || (req.query.tenantId as string);

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!year) {
        sendErrorResponse(
          res,
          "Academic year parameter is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return;

      const { query, sort } = queryResult;

      const classes = await this.classService.getClassesByAcademicYear(
        year,
        tenantId,
        query || {},
        sort || { createdAt: -1 }
      );

      sendSuccessResponse(
        res,
        "Classes retrieved successfully by academic year",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve classes by academic year",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get classes DDL (dropdown list) - simplified data for dropdowns
   */
  getClassesDDL = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const classes = await this.classService.getClassesDDL(tenantId);
      sendSuccessResponse(res, "Classes DDL retrieved successfully", classes);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve classes DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get batches DDL (dropdown list) - for class filters
   */
  getBatchesDDL = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Import batch service dynamically to avoid circular dependency
      const batchService = await import("../../services/batch.service");
      const result = await batchService.getBatchesDDL(tenantId);
      sendSuccessResponse(res, "Batches DDL retrieved successfully", result);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve batches DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get teacher assigned classes DDL list
   */
  getMyClassesDDL = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      const teacherId = req.user?.id;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!teacherId) {
        sendErrorResponse(
          res,
          "Teacher ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Only TEACHER role can access this endpoint
      if (req.user?.roleName !== "TEACHER") {
        sendErrorResponse(
          res,
          "Only teachers can access this endpoint",
          HttpStatusCodes.FORBIDDEN
        );
        return;
      }

      // Extract batchId from filter parameter if provided
      let batchId: string | undefined;
      if (req.query.filter) {
        try {
          const filterObj = typeof req.query.filter === 'string'
            ? JSON.parse(req.query.filter)
            : req.query.filter;
          
          // Extract batchId from filter (handle batchId__eq format)
          if (filterObj.batchId__eq) {
            batchId = filterObj.batchId__eq;
          } else if (filterObj.batchId) {
            // Also support direct batchId if provided
            batchId = typeof filterObj.batchId === 'object' && filterObj.batchId.$eq
              ? filterObj.batchId.$eq
              : filterObj.batchId;
          }
        } catch (error) {
          console.error("Error parsing filter parameter:", error);
          // Continue without batchId filter if parsing fails
        }
      }

      const classes = await this.classService.getMyClassesDDL(
        teacherId,
        tenantId,
        batchId
      );
      sendSuccessResponse(
        res,
        "Teacher assigned classes DDL retrieved successfully",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve teacher classes DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Create teacher assignments to class subjects and/or assign main class teacher
   */
  createTeacherAssignments = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { assignments, mainClassTeacherId, classId } = req.body;
      const tenantId = req.user?.tenantId;
      const tenantName = req.user?.tenantName || "";
      const assignedBy = req.user?.id || req.user?.email || "system";

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      let mainClassTeacherResult = null;
      let assignmentsResult = null;

      // 🔹 Case 1: Assign main class teacher (if provided)
      if (mainClassTeacherId) {
        if (!classId) {
          sendErrorResponse(
            res,
            "classId is required for main class teacher assignment",
            HttpStatusCodes.BAD_REQUEST
          );
          return;
        }

        mainClassTeacherResult = await this.classService.assignMainClassTeacher(
          classId,
          mainClassTeacherId,
          tenantId,
          tenantName,
          assignedBy
        );
      }

      // 🔹 Case 2: Process subject-wise assignments (if provided)
      if (assignments && Array.isArray(assignments) && assignments.length > 0) {
        // Validate each assignment
        for (const assignment of assignments) {
          if (
            !assignment.classId ||
            !assignment.teacherId ||
            !assignment.subjectId
          ) {
            sendErrorResponse(
              res,
              "Each assignment must have classId, teacherId, and subjectId",
              HttpStatusCodes.BAD_REQUEST
            );
            return;
          }
        }

        assignmentsResult =
          await this.classService.assignClassToTeacherSubjectWise(
            assignments,
            tenantId,
            tenantName,
            assignedBy
          );
      }

      // Prepare response based on what was processed
      if (mainClassTeacherResult && assignmentsResult) {
        // Both operations completed
        sendSuccessResponse(
          res,
          "Main class teacher and subject assignments created successfully",
          {
            mainClassTeacher: mainClassTeacherResult.data,
            assignments: assignmentsResult.data,
          }
        );
      } else if (mainClassTeacherResult) {
        // Only main class teacher assignment
        sendSuccessResponse(
          res,
          mainClassTeacherResult.message,
          mainClassTeacherResult.data
        );
      } else if (assignmentsResult) {
        // Only subject-wise assignments
        sendSuccessResponse(
          res,
          assignmentsResult.message,
          assignmentsResult.data
        );
      } else {
        // This should not happen due to validator, but handle it anyway
        sendErrorResponse(
          res,
          "Either assignments array or mainClassTeacherId with classId must be provided",
          HttpStatusCodes.BAD_REQUEST
        );
      }
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to create teacher assignments",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Remove teacher from class-subject assignment or remove main class teacher
   */
  removeTeacherAssignment = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { classId, teacherId, subjectId, mainClassTeacherId } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!classId) {
        sendErrorResponse(
          res,
          "Class ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // 🔹 Case 1: Remove main class teacher
      if (mainClassTeacherId) {
        const result = await this.classService.removeMainClassTeacher(
          classId,
          mainClassTeacherId,
          tenantId
        );
        sendSuccessResponse(res, result.message, result.data);
        return;
      }

      // 🔹 Case 2: Remove teacher from class-subject assignment
      if (!teacherId || !subjectId) {
        sendErrorResponse(
          res,
          "Either teacherId with subjectId (for subject assignment removal) OR mainClassTeacherId must be provided",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.classService.removeTeacherFromClassSubject(
        classId,
        teacherId,
        subjectId,
        tenantId
      );

      sendSuccessResponse(res, result.message, result);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to remove teacher assignment",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Remove main class teacher from class
   */

  /**
   * Get teacher assigned classes with subjects grouped by class
   */
  getMyClassesWithSubjects = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      const teacherId = req.user?.id;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!teacherId) {
        sendErrorResponse(
          res,
          "Teacher ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Only TEACHER role can access this endpoint
      if (req.user?.roleName !== "TEACHER") {
        sendErrorResponse(
          res,
          "Only teachers can access this endpoint",
          HttpStatusCodes.FORBIDDEN
        );
        return;
      }

      const classes = await this.classService.getMyClassesWithSubjects(
        teacherId,
        tenantId
      );
      sendSuccessResponse(
        res,
        "Teacher assigned classes with subjects retrieved successfully",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve teacher classes with subjects",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get student enrolled classes with subjects grouped by class
   */
  getMyStudentClassesWithSubjects = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      const studentId = req.user?.id;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!studentId) {
        sendErrorResponse(
          res,
          "Student ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Only STUDENT role can access this endpoint
      if (req.user?.roleName !== "STUDENT") {
        sendErrorResponse(
          res,
          "Only students can access this endpoint",
          HttpStatusCodes.FORBIDDEN
        );
        return;
      }

      // Build query and sort from request using generic filter pattern
      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) {
        return; // Error response already sent by buildQueryFromRequest
      }

      const { query: filters } = queryResult;

      const classes = await this.classService.getMyStudentClassesWithSubjects(
        studentId,
        tenantId,
        filters
      );
      sendSuccessResponse(
        res,
        "Student enrolled classes with subjects retrieved successfully",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve student classes with subjects",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get all classes DDL with subjects
   * Returns array of classes with format: { id, name: "className | grade", subjects: [{ id, name }] }
   */
  getAllClassesDDL = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const classes = await this.classService.getAllClassesDDL(tenantId);
      sendSuccessResponse(
        res,
        "All classes DDL with subjects retrieved successfully",
        classes
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve all classes DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Promote selected students to a new class
   */
  promoteStudents = async (req: Request, res: Response): Promise<void> => {
    try {
      const { students, oldClassId, newClassId } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(res, "Tenant ID is required", HttpStatusCodes.BAD_REQUEST);
        return;
      }

      if (!oldClassId || !newClassId) {
        sendErrorResponse(res, "oldClassId and newClassId are required", HttpStatusCodes.BAD_REQUEST);
        return;
      }

      if (!students || !Array.isArray(students) || students.length === 0) {
        sendErrorResponse(res, "students array is required", HttpStatusCodes.BAD_REQUEST);
        return;
      }

      const result = await this.classService.promoteStudents({
        students,
        oldClassId,
        newClassId,
        tenantId: tenantId.toString(),
      });

      sendSuccessResponse(res, result.message, result);
    } catch (error: any) {
      sendErrorResponse(
        res,
        error.message || "Failed to promote students",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}

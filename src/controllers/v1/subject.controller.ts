import { Request, Response } from "express";
import { SubjectService } from "@/services/subject.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Subject Controller
 *
 * Handles HTTP requests for Subject operations
 * Processes requests and delegates business logic to service layer
 */
export class SubjectController {
  private subjectService: SubjectService;

  constructor() {
    this.subjectService = new SubjectService();
  }

  /**
   * Create a new subject
   */
  createSubject = async (req: Request, res: Response): Promise<void> => {
    try {
      const subjectData = req.body;
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

      // Set createdBy from JWT token if available, otherwise use a default
      const createdBy = req.user?.email || req.user?.username || "system";

      const newSubject = await this.subjectService.createSubject(
        { ...subjectData, createdBy },
        tenantId
      );
      sendSuccessResponse(res, "Subject created successfully", newSubject);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create subject";

      // Check for duplicate errors
      if (
        errorMessage.includes("SUBJECT_CODE_EXISTS") ||
        errorMessage.includes("SUBJECT_NAME_EXISTS")
      ) {
        // Extract the actual message (remove error code prefix)
        const cleanMessage = errorMessage.includes("SUBJECT_CODE_EXISTS")
          ? errorMessage.replace("SUBJECT_CODE_EXISTS: ", "")
          : errorMessage.replace("SUBJECT_NAME_EXISTS: ", "");

        sendErrorResponse(res, cleanMessage, HttpStatusCodes.CONFLICT);
      } else {
        sendErrorResponse(
          res,
          errorMessage,
          HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
      }
    }
  };

  /**
   * Get all subjects with dynamic filters
   */
  getAllSubjects = async (req: Request, res: Response): Promise<void> => {
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

      // Build dynamic query and sort from filter parameter
      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return; // Error response already handled by buildQueryFromRequest

      let { query, sort } = queryResult;

      // Prepare pagination parameters
      const pageNo = parseInt(req.query.pageNo as string) || parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || parseInt(req.query.limit as string) || 10;

      // Default sort: order by createdAt desc if no sort is provided
      if (!sort || Object.keys(sort).length === 0) {
        sort = { createdAt: -1 };
      }

      const params = {
        pageNo,
        pageSize,
        query: query || {},
        sort: sort || { createdAt: -1 },
        tenantId,
      };

      const result = await this.subjectService.getAllSubjects(params);
      sendSuccessResponse(res, "Subjects retrieved successfully", result);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve subjects",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subject by ID
   */
  getSubjectById = async (req: Request, res: Response): Promise<void> => {
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

      const subject = await this.subjectService.getSubjectById(id, tenantId);
      sendSuccessResponse(res, "Subject retrieved successfully", subject);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message === "Subject not found"
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve subject",
        statusCode
      );
    }
  };

  /**
   * Update subject
   */
  updateSubject = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const subjectData = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const updatedSubject = await this.subjectService.updateSubject(
        id,
        subjectData,
        tenantId
      );
      sendSuccessResponse(res, "Subject updated successfully", updatedSubject);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update subject";

      // Check for specific error types
      if (errorMessage === "Subject not found") {
        sendErrorResponse(res, errorMessage, HttpStatusCodes.NOT_FOUND);
      } else if (
        errorMessage.includes("SUBJECT_CODE_EXISTS") ||
        errorMessage.includes("SUBJECT_NAME_EXISTS")
      ) {
        // Extract the actual message (remove error code prefix)
        const cleanMessage = errorMessage.includes("SUBJECT_CODE_EXISTS")
          ? errorMessage.replace("SUBJECT_CODE_EXISTS: ", "")
          : errorMessage.replace("SUBJECT_NAME_EXISTS: ", "");

        sendErrorResponse(res, cleanMessage, HttpStatusCodes.CONFLICT);
      } else {
        sendErrorResponse(
          res,
          errorMessage,
          HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
      }
    }
  };

  /**
   * Delete subject
   */
  deleteSubject = async (req: Request, res: Response): Promise<void> => {
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

      await this.subjectService.deleteSubject(id, tenantId);
      sendSuccessResponse(res, "Subject deleted successfully");
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message === "Subject not found"
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to delete subject",
        statusCode
      );
    }
  };

  /**
   * Get subject statistics
   */
  getSubjectStats = async (req: Request, res: Response): Promise<void> => {
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

      const stats = await this.subjectService.getSubjectStats(tenantId);
      sendSuccessResponse(
        res,
        "Subject statistics retrieved successfully",
        stats
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subject statistics",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subjects by type
   */
  getSubjectsByType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.params;
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

      const subjects = await this.subjectService.getSubjectsByType(
        type,
        tenantId,
        query || {},
        sort || { createdAt: -1 }
      );

      sendSuccessResponse(res, "Subjects retrieved successfully", subjects);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subjects by type",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subjects by grade level
   */
  getSubjectsByGradeLevel = async (
    req: Request,
    res: Response
  ): Promise<void> => {
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
          "Grade level parameter is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return;

      const { query, sort } = queryResult;

      const subjects = await this.subjectService.getSubjectsByGradeLevel(
        grade,
        tenantId,
        query || {},
        sort || { createdAt: -1 }
      );

      sendSuccessResponse(
        res,
        "Subjects retrieved successfully by grade level",
        subjects
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subjects by grade level",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Search subjects
   */
  searchSubjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q } = req.query;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!q || typeof q !== "string") {
        sendErrorResponse(
          res,
          "Search query is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const subjects = await this.subjectService.searchSubjects(q, tenantId);
      sendSuccessResponse(
        res,
        "Search results retrieved successfully",
        subjects
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error ? error.message : "Failed to search subjects",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subjects DDL (dropdown list) - simplified data for dropdowns
   */
  getSubjectsDDL = async (req: Request, res: Response): Promise<void> => {
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

      const subjects = await this.subjectService.getSubjectsDDL(tenantId);
      sendSuccessResponse(res, "Subjects DDL retrieved successfully", subjects);
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subjects DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subject grades DDL (dropdown list) - unique grades for dropdowns
   */
  getSubjectGradesDDL = async (req: Request, res: Response): Promise<void> => {
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

      const grades = await this.subjectService.getSubjectGradesDDL(tenantId);
      sendSuccessResponse(
        res,
        "Subject grades DDL retrieved successfully",
        grades
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subject grades DDL",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subject counts (total and active)
   */
  getSubjectCounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required. Please login to access this endpoint.",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const counts = await this.subjectService.getSubjectCounts(tenantId);
      sendSuccessResponse(
        res,
        "Subject counts retrieved successfully",
        counts
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (errorMessage === "TENANT_ID_REQUIRED") {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subject counts",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * Get subject classes
   * TODO: Implement this method in SubjectService and SubjectRepository
   * The repository method is currently commented out and needs to be implemented
   */
  getSubjectClasses = async (req: Request, res: Response): Promise<void> => {
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

      // TODO: Implement getSubjectClasses in SubjectService
      // This is a placeholder implementation
      sendErrorResponse(
        res,
        "getSubjectClasses is not yet implemented. Please implement SubjectService.getSubjectClasses and SubjectRepository.getSubjectClasses",
        HttpStatusCodes.NOT_IMPLEMENTED
      );
    } catch (error) {
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to retrieve subject classes",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}

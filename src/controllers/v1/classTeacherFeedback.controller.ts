import { Request, Response } from "express";
import { ClassTeacherFeedbackService } from "@/services/classTeacherFeedback.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * ClassTeacherFeedback Controller
 * Handles HTTP requests for class teacher feedback operations
 */
export class ClassTeacherFeedbackController {
  private feedbackService: ClassTeacherFeedbackService;

  constructor() {
    this.feedbackService = new ClassTeacherFeedbackService();
  }

  /**
   * Create or update class teacher feedback
   * POST /api/v1/class-teacher-feedback
   */
  createOrUpdateFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, studentId, feedback } = req.body;
      const tenantId = req.user?.tenantId;
      const teacherId = req.user?.id || req.user?.userId;

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
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const result = await this.feedbackService.createOrUpdateFeedback(
        classId,
        studentId,
        teacherId,
        feedback,
        tenantId
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(res, result.message, result.data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save feedback";
      
      // Check for permission errors
      const isPermissionError = errorMessage.includes("Only the assigned class teacher");
      const statusCode = isPermissionError
        ? HttpStatusCodes.FORBIDDEN
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, errorMessage, statusCode);
    }
  };

  /**
   * Get feedback for a specific student in a class
   * GET /api/v1/class-teacher-feedback/:classId/:studentId
   */
  getFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, studentId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.feedbackService.getFeedbackForStudent(
        classId,
        studentId,
        tenantId
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(
        res,
        "Feedback retrieved successfully",
        result.data
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to retrieve feedback";
      sendErrorResponse(res, errorMessage, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  /**
   * Get all feedback for a student across all classes
   * GET /api/v1/class-teacher-feedback/student/:studentId
   */
  getStudentAllFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { studentId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.feedbackService.getAllFeedbackForStudent(
        studentId,
        tenantId
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(
        res,
        "Student feedbacks retrieved successfully",
        result.data
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to retrieve student feedbacks";
      sendErrorResponse(res, errorMessage, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  /**
   * Get all feedback given by the logged-in teacher
   * GET /api/v1/class-teacher-feedback/my-feedback?classId=xxx
   */
  getTeacherFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId } = req.query;
      const tenantId = req.user?.tenantId;
      const teacherId = req.user?.id || req.user?.userId;

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
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const result = await this.feedbackService.getFeedbackByTeacher(
        teacherId,
        tenantId,
        classId as string | undefined
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(
        res,
        "Teacher feedbacks retrieved successfully",
        result.data
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to retrieve teacher feedbacks";
      sendErrorResponse(res, errorMessage, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };

  /**
   * Delete feedback
   * DELETE /api/v1/class-teacher-feedback/:classId/:studentId
   */
  deleteFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, studentId } = req.params;
      const tenantId = req.user?.tenantId;
      const teacherId = req.user?.id || req.user?.userId;

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
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const result = await this.feedbackService.deleteFeedback(
        classId,
        studentId,
        teacherId,
        tenantId
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(
        res,
        result.message,
        { success: true }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete feedback";
      
      // Check for permission errors
      const isPermissionError = errorMessage.includes("Only the assigned class teacher");
      const statusCode = isPermissionError
        ? HttpStatusCodes.FORBIDDEN
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, errorMessage, statusCode);
    }
  };

  /**
   * Get bulk feedback for multiple students in a class
   * POST /api/v1/class-teacher-feedback/bulk
   */
  getBulkFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classId, studentIds } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.feedbackService.getBulkFeedbackForClass(
        classId,
        studentIds,
        tenantId
      );

      res.status(HttpStatusCodes.OK);
      sendSuccessResponse(
        res,
        "Bulk feedbacks retrieved successfully",
        result.data
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to retrieve bulk feedbacks";
      sendErrorResponse(res, errorMessage, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  };
}

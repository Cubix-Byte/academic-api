import { Request, Response } from "express";
import { ClassScheduleService } from "@/services/classSchedule.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";
import { findTeacherByUserId } from "@/repositories/teacher.repository";

export class ClassScheduleController {
  /**
   * Create a new class schedule slot
   */
  static async create(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!userId) {
        sendErrorResponse(
          res,
          "User ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const schedule = await ClassScheduleService.createSchedule(
        tenantId,
        req.body,
        userId
      );

      sendSuccessResponse(
        res,
        "Class schedule created successfully",
        schedule
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to create schedule";
      const isConflict =
        message.toLowerCase().includes("conflict") ||
        message.toLowerCase().includes("already");
      const statusCode = isConflict
        ? HttpStatusCodes.CONFLICT
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Update an existing class schedule slot
   */
  static async update(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      const { id } = req.params;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!userId) {
        sendErrorResponse(
          res,
          "User ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const schedule = await ClassScheduleService.updateSchedule(
        tenantId,
        id,
        req.body,
        userId
      );

      sendSuccessResponse(
        res,
        "Class schedule updated successfully",
        schedule
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to update schedule";
      const statusCode = message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : message.toLowerCase().includes("conflict") ||
          message.toLowerCase().includes("already")
        ? HttpStatusCodes.CONFLICT
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Delete a class schedule slot
   */
  static async delete(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      await ClassScheduleService.deleteSchedule(tenantId, id);

      sendSuccessResponse(res, "Class schedule deleted successfully");
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to delete schedule";
      const statusCode = message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Get schedule by ID
   */
  static async getById(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const schedule = await ClassScheduleService.getScheduleById(
        tenantId,
        id
      );

      sendSuccessResponse(
        res,
        "Class schedule retrieved successfully",
        schedule
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to get schedule";
      const statusCode = message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * List schedules with optional filters
   */
  static async list(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const { classId, teacherId, subjectId, academicYear, dayOfWeek } =
        req.query as any;

      const schedules = await ClassScheduleService.listSchedules({
        tenantId,
        classId,
        teacherId,
        subjectId,
        academicYear,
        dayOfWeek:
          typeof dayOfWeek === "string" ? Number(dayOfWeek) : dayOfWeek,
      });

      sendSuccessResponse(
        res,
        "Class schedules retrieved successfully",
        schedules
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to list schedules";
      sendErrorResponse(
        res,
        message,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get full timetable for a specific class (for an academic year)
   */
  static async getClassTimetable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { classId } = req.params;
      const { academicYear } = req.query as any;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!academicYear) {
        sendErrorResponse(
          res,
          "academicYear is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await ClassScheduleService.getClassTimetable({
        tenantId,
        classId,
        academicYear,
      });

      sendSuccessResponse(
        res,
        "Class timetable retrieved successfully",
        result
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to get class timetable";
      sendErrorResponse(
        res,
        message,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get full timetable for the logged-in teacher (for an academic year)
   */
  static async getTeacherTimetable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      const { academicYear } = req.query as any;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!userId) {
        sendErrorResponse(
          res,
          "User ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!academicYear) {
        sendErrorResponse(
          res,
          "academicYear is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      console.log("userId", userId);
      // Find teacher by user ID
      const teacher = await findTeacherByUserId(userId);
      if (!teacher) {
        sendErrorResponse(
          res,
          "Teacher not found for this user",
          HttpStatusCodes.NOT_FOUND
        );
        return;
      }

      const teacherId = (teacher as any)._id?.toString() || (teacher as any).id;

      const result = await ClassScheduleService.getTeacherTimetable({
        tenantId,
        teacherId,
        academicYear,
      });

      sendSuccessResponse(
        res,
        "Teacher timetable retrieved successfully",
        result
      );
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to get teacher timetable";
      sendErrorResponse(
        res,
        message,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get full timetable for the logged-in student:
   * - Uses JWT user id as studentId
   * - Determines current class and assigned subjects from class_students
   * - Returns timetable filtered to only the student's enrolled subjects
   */
  static async getStudentTimetable(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      const { academicYear } = req.query as any;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!userId) {
        sendErrorResponse(
          res,
          "User ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const result = await ClassScheduleService.getStudentTimetable({
        tenantId,
        studentId: userId,
        academicYear,
      });

      sendSuccessResponse(
        res,
        "Student timetable retrieved successfully",
        result
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get student timetable";
      sendErrorResponse(
        res,
        message,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get summary of class timetables created for the tenant (per class).
   * Restricted to PRIMARYADMIN.
   */
  static async getClassTimetableSummary(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const role =
        (req.user as any)?.roleName || (req.user as any)?.role;
      const { academicYear } = req.query as any;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      const summary = await ClassScheduleService.getClassTimetableSummary({
        tenantId,
        academicYear,
      });

      sendSuccessResponse(
        res,
        "Class timetable summary retrieved successfully",
        summary
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get class timetable summary";
      sendErrorResponse(
        res,
        message,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

export default ClassScheduleController;



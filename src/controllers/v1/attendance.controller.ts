import { Request, Response } from "express";
import {
  HttpStatusCodes,
  sendErrorResponse,
  sendSuccessResponse,
} from "shared-lib";
import AttendanceService from "@/services/attendance.service";

export class AttendanceController {
  /**
   * Start a new class session for the logged-in teacher.
   * Body: { classId, subjectId, scheduleId?, sessionCreatedAt?, academicYear? }
   * sessionCreatedAt is optional - if not provided, it will be automatically set to current time
   */
  static async startSession(req: Request, res: Response) {
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

      const { classId, subjectId, scheduleId, sessionCreatedAt, academicYear } =
        req.body || {};

      if (!classId || !subjectId) {
        sendErrorResponse(
          res,
          "classId and subjectId are required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const session = await AttendanceService.startSession({
        tenantId,
        classId,
        subjectId,
        teacherId: userId,
        scheduleId,
        sessionCreatedAt: sessionCreatedAt ? new Date(sessionCreatedAt) : undefined,
        academicYear,
        createdBy: userId,
      });

      sendSuccessResponse(res, "Class session started successfully", session);
    } catch (error: any) {
      // If a duplicate session is detected, treat it as a successful response
      if (
        error &&
        (error as any).code === "DUPLICATE_SESSION" &&
        (error as any).sessionId
      ) {
        return sendSuccessResponse(
          res,
          "Attendance session already exists for this class, subject, date and time slot",
          {
            session: (error as any).session,
            isDuplicate: true,
          }
        );
      }

      const message =
        error instanceof Error ? error.message : "Failed to start session";
      // Determine appropriate status code based on error message
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("not found") ||
        message.includes("does not belong") ||
        message.includes("Invalid") ||
        message.includes("already exists") ||
        message.toLowerCase().includes("duplicate")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Mark or update attendance for a session.
   *
   * Supports both:
   * - Single record (backward compatible):
   *   Body: { sessionId, userId, role, status, remarks? }
   *
   * - Bulk records (preferred new format):
   *   Body: {
   *     sessionId: string;
   *     attendances: Array<{ userId: string; role: ATTENDANCE_ROLE; status: ATTENDANCE_STATUS; remarks?: string; }>;
   *   }
   *
   * For bulk:
   * - Only students who are enrolled in the session's class AND have the session's subject
   *   assigned will be marked.
   * - Other users are skipped and returned in the response under "skipped".
   */
  static async markAttendance(req: Request, res: Response) {
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

      const body = req.body || {};
      const { sessionId } = body;

      if (!sessionId) {
        sendErrorResponse(
          res,
          "sessionId is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      // Bulk format: { sessionId, attendances: [ { userId, role, status, remarks? }, ... ] }
      if (Array.isArray(body.attendances)) {
        const attendances = body.attendances;

        if (!attendances || attendances.length === 0) {
          sendErrorResponse(
            res,
            "attendances array must not be empty",
            HttpStatusCodes.BAD_REQUEST
          );
          return;
        }

        const result = await AttendanceService.markAttendanceBulk({
          tenantId,
          sessionId,
          markedBy: userId,
          records: attendances,
        });

        sendSuccessResponse(
          res,
          "Attendance marked successfully",
          result
        );
        return;
      }

      // Backward-compatible single-record format
      const { userId: targetUserId, role, status, remarks } = body;

      if (!targetUserId || !role || !status) {
        sendErrorResponse(
          res,
          "sessionId, userId, role and status are required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const attendance = await AttendanceService.markAttendance({
        tenantId,
        sessionId,
        userId: targetUserId,
        role,
        status,
        markedBy: userId,
        remarks,
      });

      sendSuccessResponse(res, "Attendance marked successfully", attendance);
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Failed to mark attendance";
      // Determine appropriate status code based on error message
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("not found") ||
        message.includes("not enrolled") ||
        message.includes("does not have access") ||
        message.includes("not assigned")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Get attendance for a specific session.
   * Params: { sessionId }
   */
  static async getSessionAttendance(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { sessionId } = req.params;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!sessionId) {
        sendErrorResponse(
          res,
          "sessionId is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await AttendanceService.getSessionAttendance({
        tenantId,
        sessionId,
      });

      sendSuccessResponse(
        res,
        "Session attendance retrieved successfully",
        result
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get session attendance";
      const statusCode = message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Get logged-in student's attendance summary with detailed records grouped by subject.
   * Returns attendance records with date and time information, not just counts.
   * Query: { fromDate?, toDate?, classId?, subjectId? }
   * Response: Array of subjects with detailed attendanceRecords array containing dates, times, and status
   */
  static async getMyAttendanceSummary(req: Request, res: Response) {
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

      const { fromDate, toDate, classId, subjectId } = req.query as any;

      const summary = await AttendanceService.getStudentAttendanceSummary({
        tenantId,
        studentId: userId,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        classId,
        subjectId,
      });

      sendSuccessResponse(
        res,
        "Student attendance summary retrieved successfully",
        summary
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get attendance summary";
      // Determine appropriate status code based on error message
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("not found") ||
        message.includes("not enrolled") ||
        message.includes("does not have access")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Get a teacher's attendance summary across their active classes/subjects.
   * Params: { teacherId }
   * Query: { fromDate?, toDate?, classId?, subjectId? }
   */
  static async getTeacherAttendanceSummary(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { teacherId } = req.params;
      const { fromDate, toDate, classId, subjectId } = req.query as any;

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!teacherId) {
        sendErrorResponse(
          res,
          "teacherId is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const summary = await AttendanceService.getTeacherAttendanceSummary({
        tenantId,
        teacherId,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        classId: classId as string | undefined,
        subjectId: subjectId as string | undefined,
      });

      sendSuccessResponse(
        res,
        "Teacher attendance summary retrieved successfully",
        summary
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get teacher attendance summary";
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("Invalid") ||
        message.includes("not found") ||
        message.includes("does not belong")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Get logged-in student's attendance statistics for their current active class.
   * - Uses JWT user id as studentId
   * - Only accessible to STUDENT role (checked here in addition to route access)
   */
  static async getMyCurrentClassAttendanceStats(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const userId = (req.user as any)?.id || (req.user as any)?.userId;
      const role =
        (req.user as any)?.roleName || (req.user as any)?.role;

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

      if (!role || role.toString().toUpperCase() !== "STUDENT") {
        sendErrorResponse(
          res,
          "Forbidden: Only students can access their current class attendance stats",
          HttpStatusCodes.FORBIDDEN
        );
        return;
      }

      const stats =
        await AttendanceService.getStudentCurrentClassAttendanceStats({
          tenantId,
          studentId: userId,
        });

      sendSuccessResponse(
        res,
        "Current class attendance stats retrieved successfully",
        stats
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to get current class attendance stats";
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("Invalid") ||
        message.includes("Active class enrollment not found")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }

  /**
   * Update a class session's status (end class).
   * - Only allows updating from 'in-progress' to 'completed'.
   * - Only status is updated; all other fields remain unchanged.
   * Body: { status: "completed" }
   */
  static async updateSessionStatus(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId;
      const { sessionId } = req.params;
      const { status } = req.body || {};

      if (!tenantId) {
        sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.UNAUTHORIZED
        );
        return;
      }

      if (!sessionId) {
        sendErrorResponse(
          res,
          "sessionId is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!status) {
        sendErrorResponse(
          res,
          "status is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const updated = await AttendanceService.updateSessionStatus({
        tenantId,
        sessionId,
        status,
      } as any);

      sendSuccessResponse(
        res,
        "Class session status updated successfully",
        updated
      );
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update session status";
      let statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      if (
        message.includes("Invalid sessionId") ||
        message.includes("not found") ||
        message.includes("only be updated from") ||
        message.includes("Only transition to")
      ) {
        statusCode = HttpStatusCodes.BAD_REQUEST;
      }
      sendErrorResponse(res, message, statusCode);
    }
  }
}

export default AttendanceController;

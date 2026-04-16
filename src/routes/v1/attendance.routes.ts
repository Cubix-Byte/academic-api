import { Router } from "express";
import { ROUTES } from "@/utils/constants/routes";
import AttendanceController from "@/controllers/v1/attendance.controller";

const router = Router();

// Teacher starts a class session
router.post(
  ROUTES.ATTENDANCE.SUBROUTES.START_SESSION,
  AttendanceController.startSession
);

// Update class session status (end class)
router.put(
  ROUTES.ATTENDANCE.SUBROUTES.UPDATE_SESSION_STATUS,
  AttendanceController.updateSessionStatus
);

// Mark attendance (teacher or student)
router.post(
  ROUTES.ATTENDANCE.SUBROUTES.MARK_ATTENDANCE,
  AttendanceController.markAttendance
);

// Get attendance for a specific session
router.get(
  ROUTES.ATTENDANCE.SUBROUTES.SESSION_ATTENDANCE,
  AttendanceController.getSessionAttendance
);

// Get logged-in student's attendance summary
router.get(
  ROUTES.ATTENDANCE.SUBROUTES.MY_SUMMARY,
  AttendanceController.getMyAttendanceSummary
);

// Get logged-in student's current class attendance stats
router.get(
  ROUTES.ATTENDANCE.SUBROUTES.MY_CURRENT_CLASS_STATS,
  AttendanceController.getMyCurrentClassAttendanceStats
);

// Get teacher's attendance summary across active assigned classes (admin-only)
router.get(
  ROUTES.ATTENDANCE.SUBROUTES.TEACHER_SUMMARY,
  AttendanceController.getTeacherAttendanceSummary
);

export default router;



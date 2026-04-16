import { Router } from 'express';
import * as activityLogController from '../../controllers/v1/activityLog.controller';
import { ROUTES } from '@/utils/constants/routes';

/**
 * Activity Log Routes
 * Handles all activity log endpoints
 */
const router = Router();

// Get activity logs (role-based)
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.ROOT,
  activityLogController.getActivityLogs
);

// Get teacher activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.TEACHER,
  activityLogController.getTeacherActivityLogs
);

// Get specific teacher activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.TEACHER_BY_ID,
  activityLogController.getTeacherActivityLogsById
);

// Get student activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.STUDENT,
  activityLogController.getStudentActivityLogs
);

// Get specific student activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.STUDENT_BY_ID,
  activityLogController.getStudentActivityLogsById
);

// Get class-wise activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.CLASS,
  activityLogController.getClassActivityLogs
);

// Get subject-wise activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.SUBJECT,
  activityLogController.getSubjectActivityLogs
);

// Get user-specific activity logs
router.get(
  ROUTES.ACTIVITY_LOGS.SUBROUTES.USER,
  activityLogController.getUserActivityLogs
);

// Get teacher activities (simplified - last 30 records)
router.get(
  '/teacher-activities',
  activityLogController.getTeacherActivities
);

// Get exam activities (teacher created + student attempted, last 30 records)
router.get(
  '/exam-activities',
  activityLogController.getExamActivities
);

// Get student activities (last 30 records)
router.get(
  '/student-activities',
  activityLogController.getStudentActivities
);

export default router;


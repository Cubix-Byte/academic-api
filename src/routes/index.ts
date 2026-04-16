import { Router } from "express";
import classRoutes from "./class.routes";
import subjectRoutes from "./subject.routes";
import teacherRoutes from "./teacher.routes";
import studentRoutes from "./v1/student.routes";
import batchRoutes from "./v1/batch.routes";
import examModeRoutes from "./v1/examMode.routes";
import gradingSystemRoutes from "./v1/gradingSystem.routes";
import examRoutes from "./v1/exam.routes";
import examQuestionRoutes from "./v1/examQuestion.routes";
import studentExamTakingRoutes from "./v1/studentExamTaking.routes";
import gradingRoutes from "./v1/grading.routes";
import studentResultsRoutes from "./v1/studentResults.routes";
import studentDashboardRoutes from "./v1/studentDashboard.routes";
import studentCredentialsRoutes from "./v1/studentCredentials.routes";
import teacherCredentialsRoutes from "./v1/teacherCredentials.routes";
import studentExamsRoutes from "./v1/studentExams.routes";
import studentExamsByStatusRoutes from "./v1/studentExamsByStatus.routes";
import teacherGradingRoutes from "./v1/teacherGrading.routes";
import teacherDashboardRoutes from "./v1/teacherDashboard.routes";
import parentRoutes from "./parent.routes";
import parentChildRoutes from "./parentChild.routes";
import childrenCreditsRoutes from "./v1/childrenCredits.routes";
import contentLibraryFolderRoutes from "./v1/contentLibraryFolders.routes";
import contentLibraryContentRoutes from "./v1/contentLibraryContents.routes";
import activityLogRoutes from "./v1/activityLog.routes";
import examBuilderRoutes from "./v1/examBuilder.routes";
import contentBuilderRoutes from "./v1/contentBuilder.routes";
import dashboardRoutes from "./v1/dashboard.routes";
import internalRoutes from "./internal.routes";
import credentialTemplateRoutes from "./v1/credentialTemplate.routes";
import credentialAssignmentRoutes from "./v1/credentialAssignment.routes";
import notificationRoutes from "./v1/notification.routes";
import tenantRoutes from "./v1/tenant.routes";
import partnerRoutes from "./v1/partner.routes";
import imageRoutes from "./v1/image.routes";
import adminRoutes from "./v1/admin.routes";
import resendEmailRoutes from "./v1/resendEmail.routes";
import tenantAnalyticsRoutes from "./v1/tenantAnalytics.routes";
import classTeacherFeedbackRoutes from "./classTeacherFeedback.routes";
import chatRoutes from "./v1/chat.routes";
import schoolTimeConfigRoutes from "./v1/schoolTimeConfig.routes";
import classScheduleRoutes from "./v1/classSchedule.routes";
import attendanceRoutes from "./v1/attendance.routes";
import { ROUTES } from "../utils/constants/routes";

import reportRoutes from "./report.routes";
import aiPracticeAttemptRoutes from "./v1/aiPracticeAttempt.routes";
import announcementRoutes from "./v1/announcement.routes";
import communityRoutes from "./v1/community.routes";

/**
 * Main Routes Index
 *
 * Combines all route modules and applies base paths
 * Global authentication middleware handles access control
 */
const router = Router();

// Health check route (public)
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "academy-api",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Class routes
router.use(ROUTES.CLASSES.BASE, classRoutes);

// Subject routes
router.use(ROUTES.SUBJECTS.BASE, subjectRoutes);

// Teacher routes
router.use(ROUTES.TEACHERS.BASE, teacherRoutes);

// Report routes
router.use(ROUTES.REPORTS.BASE, reportRoutes);

// Student routes
router.use(ROUTES.STUDENTS.BASE, studentRoutes);

// Batch routes
router.use(ROUTES.BATCHES.BASE, batchRoutes);

// Exam Mode routes
router.use(ROUTES.EXAM_MODES.BASE, examModeRoutes);

// Grading System routes
router.use(ROUTES.GRADING_SYSTEMS.BASE, gradingSystemRoutes);

// Exam routes
router.use(ROUTES.EXAMS.BASE, examRoutes);

// Exam Question routes
router.use(ROUTES.EXAM_QUESTIONS.BASE, examQuestionRoutes);

// Student Exams routes (for viewing assigned exams) - MUST BE BEFORE studentExamTakingRoutes
router.use(ROUTES.STUDENT_EXAMS.BASE, studentExamsRoutes);
router.use(ROUTES.STUDENT_EXAMS.BASE, studentExamsByStatusRoutes);

// Student Exam Taking routes
router.use(ROUTES.STUDENT_EXAMS.BASE, studentExamTakingRoutes);

// Grading routes (AI grading endpoints)
router.use(ROUTES.GRADING.BASE, gradingRoutes);

// Student Results routes
router.use(ROUTES.STUDENT_RESULTS.BASE, studentResultsRoutes);

// Student Dashboard routes
router.use(ROUTES.STUDENT_DASHBOARD.BASE, studentDashboardRoutes);

// Student Credentials routes
router.use(ROUTES.STUDENT_CREDENTIALS.BASE, studentCredentialsRoutes);

// Teacher Credentials routes
router.use(ROUTES.TEACHER_CREDENTIALS.BASE, teacherCredentialsRoutes);

// Credential Templates routes (analytics route is now included in credentialTemplateRoutes to avoid route conflicts)
router.use(ROUTES.CREDENTIALS.BASE, credentialTemplateRoutes);
router.use(ROUTES.CREDENTIALS.BASE, credentialAssignmentRoutes);
// Note: credentialAnalyticsRoutes is now handled within credentialTemplateRoutes to ensure proper route ordering

// Teacher Grading routes
router.use(ROUTES.TEACHER_GRADING.BASE, teacherGradingRoutes);

// Teacher Dashboard routes
router.use(ROUTES.TEACHER_DASHBOARD.BASE, teacherDashboardRoutes);

// Content Library routes
router.use(ROUTES.CONTENT_LIBRARY.BASE, contentLibraryFolderRoutes);
router.use(ROUTES.CONTENT_LIBRARY_CONTENT.BASE, contentLibraryContentRoutes);

// Activity Log routes
router.use(ROUTES.ACTIVITY_LOGS.BASE, activityLogRoutes);

// Exam Builder routes
router.use(ROUTES.EXAM_BUILDERS.BASE, examBuilderRoutes);

// Content Builder routes
router.use(ROUTES.CONTENT_BUILDERS.BASE, contentBuilderRoutes);

// Dashboard routes
router.use(ROUTES.DASHBOARD.BASE, dashboardRoutes);

// Notification routes
router.use(ROUTES.NOTIFICATIONS.BASE, notificationRoutes);

// Parent routes
router.use(ROUTES.PARENTS.BASE, parentRoutes);

// Parent-Child relationship routes
router.use(ROUTES.PARENT_CHILD.BASE, parentChildRoutes);

// Children Credits routes
router.use("/children-credits", childrenCreditsRoutes);

// Partner routes
router.use(ROUTES.PARTNERS.BASE, partnerRoutes);

// Image routes
router.use(ROUTES.IMAGES.BASE, imageRoutes);

// Internal API routes (for microservice communication)
router.use(ROUTES.INTERNAL_ROUTES.BASE, internalRoutes);

// Tenant routes
router.use(ROUTES.TENANTS.BASE, tenantRoutes);

// Admin routes
router.use(ROUTES.ADMINS.BASE, adminRoutes);

// Resend Email routes (unified endpoint)
router.use(ROUTES.RESEND_EMAIL.BASE, resendEmailRoutes);

// Tenant Analytics routes
router.use(ROUTES.TENANT_ANALYTICS.BASE, tenantAnalyticsRoutes);

// Class Teacher Feedback routes
router.use("/class-teacher-feedback", classTeacherFeedbackRoutes);

// AI Practice Attempt routes
router.use("/ai-practice", aiPracticeAttemptRoutes);

// Chat routes
router.use(ROUTES.CHAT.BASE, chatRoutes);

// Announcement routes
router.use(ROUTES.ANNOUNCEMENTS.BASE, announcementRoutes);

// School Time Config routes
router.use(ROUTES.SCHOOL_TIME_CONFIGS.BASE, schoolTimeConfigRoutes);

// Class Schedule / Timetable routes
router.use(ROUTES.CLASS_SCHEDULES.BASE, classScheduleRoutes);

// Attendance & Class Session routes
router.use(ROUTES.ATTENDANCE.BASE, attendanceRoutes);

// Community channels
router.use("/communities", communityRoutes);

export default router;

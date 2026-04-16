import { Router } from "express";
import * as studentController from "../../controllers/v1/student.controller";
import * as studentWalletController from "../../controllers/v1/studentWallet.controller";
import * as studentFolderController from "../../controllers/v1/studentFolder.controller";
import { csvUpload } from "../../middlewares/upload.middleware";
import { validate } from '@/middlewares/validation.middleware';
import { getStudentAssignedContentSchema, getStudentAssignedContentStatsSchema, markAssignedContentReadSchema } from '@/utils/requestValidators/contentLibrary.validator';
import {
  createStudentFolderSchema,
  studentFolderIdParamSchema,
  updateStudentFolderSchema,
  addContentToStudentFolderSchema,
  removeContentFromStudentFolderSchema,
} from '@/utils/requestValidators/studentFolder.validator';

const router = Router();

// Get current student's profile
router.get("/profile", studentController.getMyProfile);

// Get my class details with subjects
router.get("/class-details", studentController.getMyClassDetails);

// Get my performance breakdown
router.get("/performance-breakdown", studentController.getMyPerformanceBreakdown);

// Get my graded exams statistics (must come before /graded-exams)
router.get("/graded-exams/statistics", studentController.getMyGradedExamsStatistics);

// Get my graded exams
router.get("/graded-exams", studentController.getMyGradedExams);

// Get my assigned content statistics (must come before /assigned-content)
router.get("/assigned-content/stats", validate(getStudentAssignedContentStatsSchema), studentController.getMyAssignedContentStats);

// Get my assigned content
router.get("/assigned-content", validate(getStudentAssignedContentSchema), studentController.getMyAssignedContent);

// Mark assigned content as read (must be after /assigned-content and /assigned-content/stats)
router.post("/assigned-content/:contentId/read", validate(markAssignedContentReadSchema), studentController.markAssignedContentRead);

// Student folders (my-courses organization) - MUST be before /:id routes
router.post("/folders", validate(createStudentFolderSchema), studentFolderController.createFolder);
router.get("/folders", studentFolderController.listFolders);
router.get("/folders/:folderId", validate(studentFolderIdParamSchema), studentFolderController.getFolderById);
router.patch("/folders/:folderId", validate(updateStudentFolderSchema), studentFolderController.updateFolder);
router.delete("/folders/:folderId", validate(studentFolderIdParamSchema), studentFolderController.deleteFolder);
router.get("/folders/:folderId/contents", validate(studentFolderIdParamSchema), studentFolderController.getFolderContents);
router.post("/folders/:folderId/contents", validate(addContentToStudentFolderSchema), studentFolderController.addContentToFolder);
router.delete("/folders/:folderId/contents/:contentId", validate(removeContentFromStudentFolderSchema), studentFolderController.removeContentFromFolder);

// Get my subject performance (percentages for all subjects based on graded exams)
router.get("/subject-performance", studentController.getMySubjectPerformance);

// Get my academic progress trend (month-wise)
router.get("/academic-progress-trend", studentController.getMyAcademicProgressTrend);

// Update current student's profile
router.put("/profile", studentController.updateMyProfile);

// Update robot avatar
router.post("/update-robot-avatar", studentController.updateRobotAvatar);

// Create a new student
router.post("/", studentController.createStudent);

// Bulk upload students from CSV
router.post(
  "/bulk-upload",
  csvUpload.single("file"),
  studentController.bulkUploadStudents
);

// Bulk assign students to class with subjects
router.post(
  "/bulk-assign-to-class",
  studentController.bulkAssignStudentsToClass
);

// Get all students
router.get("/", studentController.getAllStudents);

// Get active students DDL (dropdown list) - MUST come before /:id routes
router.get("/ddl", studentController.getActiveStudentsDDL);

// Get top students ranked by average exam percentage
router.get("/top-students", studentController.getTopStudents);


// Get active stats (students) - MUST come before /:id routes
router.get("/stats", studentController.getActiveStats);

// Get cumulative insights for a student (admin)
router.get(
  "/admin/:studentId/cumulative-insights",
  studentController.getAdminStudentCumulativeInsights
);

// Get student profile details with statistics - MUST come before /:id route
router.get("/:id/profile-details", studentController.getStudentProfileDetails);

// Get student wallet balance - MUST come before /:id route
router.get("/:studentId/wallet", studentWalletController.getStudentWallet);

// Get student credit usage history - MUST come before /:id route
router.get("/:studentId/credit-usage-history", studentWalletController.getCreditUsageHistory);

// Get all classes for a student (active and promoted) - MUST come before /:id route
router.get("/:id/classes", studentController.getStudentClasses);

// Get student by ID
router.get("/:id", studentController.getStudentById);

// Update student by ID
router.put("/:id", studentController.updateStudent);

// Delete student by ID (soft delete)
router.delete("/:id", studentController.deleteStudent);

// Get students by class
router.get("/class/:classId", studentController.getStudentsByClass);

// Get students by subject
router.get("/subject/:subjectId", studentController.getStudentsBySubject);

export default router;

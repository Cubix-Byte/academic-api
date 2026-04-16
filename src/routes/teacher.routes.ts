import { Router } from "express";
import * as teacherController from "../controllers/v1/teacher.controller";
import { ROUTES } from "../utils/constants/routes";
import { csvUpload } from "../middlewares/upload.middleware";

const router = Router();

/**
 * Teacher Routes
 * All routes require authentication and tenant context
 */

// Get current teacher's profile
router.get("/profile", teacherController.getMyProfile);

// Update current teacher's profile
router.put("/profile", teacherController.updateMyProfile);

// Get my class detail
router.get("/my-class-detail", teacherController.getMyClassDetail);

// Get my classes with students
router.get(
  ROUTES.TEACHERS.SUBROUTES.MY_CLASSES_STUDENTS,
  teacherController.getMyClassesWithStudents
);

// Create teacher
router.post("/", teacherController.createTeacher);

// Bulk upload teachers from CSV
router.post(
  "/bulk-upload",
  csvUpload.single("file"),
  teacherController.bulkUploadTeachers
);

// Get all teachers
router.get("/", teacherController.getAllTeachers);

// Get teacher statistics
router.get("/statistics", teacherController.getTeacherStatistics);

// Get active stats (teachers and subjects) - MUST come before /:id routes
router.get("/stats", teacherController.getActiveStats);

// Get active counts (active teachers and active subjects) - MUST come before /:id routes
router.get("/counts", teacherController.getActiveCounts);

// Get teachers by class
router.get("/class/:classId", teacherController.getTeachersByClass);

// Get teachers by subject
router.get("/subject/:subjectId", teacherController.getTeachersBySubject); //

// Get teachers DDL (dropdown list) - MUST come before /:id routes
router.get("/ddl", teacherController.getTeachersDDL);

// Get teacher profile details with statistics - MUST come before /:id route
router.get("/:id/profile-details", teacherController.getTeacherProfileDetails);

// Get teacher classes with subjects (Admin only) - MUST come before /:id route
router.get(
  ROUTES.TEACHERS.SUBROUTES.CLASSES,
  teacherController.getTeacherClassesWithSubjects
);

// Get teacher by ID
router.get("/:id", teacherController.getTeacherById);

// Update teacher
router.put("/:id", teacherController.updateTeacher);

// Delete teacher
router.delete("/:id", teacherController.deleteTeacher);

// Assign classes to teacher
router.post("/:id/assign-classes", teacherController.assignClasses);

// Assign subjects to teacher
router.post("/:id/assign-subjects", teacherController.assignSubjects);

export default router;

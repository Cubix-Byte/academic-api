import { Router } from "express";
import { SubjectController } from "../controllers/v1/subject.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createSubjectSchema,
  updateSubjectSchema,
  getSubjectSchema,
  deleteSubjectSchema,
  getSubjectClassesSchema,
} from "../utils/requestValidators/subject.validator";
import { ROUTES } from "../utils/constants/routes";

/**
 * Subject Routes
 *
 * Defines all subject-related API endpoints
 * Uses global authentication middleware for access control
 */
const router = Router();
const subjectController = new SubjectController();

// Create subject
router.post(
  ROUTES.SUBJECTS.SUBROUTES.ROOT,
  validate(createSubjectSchema),
  subjectController.createSubject
);

// Get all subjects
router.get(ROUTES.SUBJECTS.SUBROUTES.ROOT, subjectController.getAllSubjects);

// IMPORTANT: All specific routes MUST come before /:id route to avoid route matching conflicts

// Get subject statistics - MUST come before /:id routes
router.get(ROUTES.SUBJECTS.SUBROUTES.STATS, subjectController.getSubjectStats);

// Get subject counts - MUST come before /:id routes
router.get(ROUTES.SUBJECTS.SUBROUTES.COUNTS, subjectController.getSubjectCounts);

// Get subjects by type - MUST come before /:id routes
router.get(
  ROUTES.SUBJECTS.SUBROUTES.BY_TYPE,
  subjectController.getSubjectsByType
);

// Get subjects by grade level - MUST come before /:id routes
router.get(
  ROUTES.SUBJECTS.SUBROUTES.BY_GRADE_LEVEL,
  subjectController.getSubjectsByGradeLevel
);

// Search subjects - MUST come before /:id routes
router.get(ROUTES.SUBJECTS.SUBROUTES.SEARCH, subjectController.searchSubjects);

// Get subjects DDL (dropdown list) - MUST come before /:id routes
router.get(ROUTES.SUBJECTS.SUBROUTES.DDL, subjectController.getSubjectsDDL);

// Get subject grades DDL (dropdown list) - MUST come before /:id routes
router.get(
  ROUTES.SUBJECTS.SUBROUTES.GRADES_DDL,
  subjectController.getSubjectGradesDDL
);

// Get subject classes - MUST come before /:id route to avoid route matching conflicts
// This route uses /:id/classes pattern, so it must be defined before the generic /:id route
router.get(
  ROUTES.SUBJECTS.SUBROUTES.CLASSES,
  validate(getSubjectClassesSchema),
  subjectController.getSubjectClasses
);

// Get subject by ID - MUST come after all specific routes
router.get(
  ROUTES.SUBJECTS.SUBROUTES.ID,
  validate(getSubjectSchema),
  subjectController.getSubjectById
);

// Update subject
router.put(
  ROUTES.SUBJECTS.SUBROUTES.ID,
  validate(updateSubjectSchema),
  subjectController.updateSubject
);

// Delete subject
router.delete(
  ROUTES.SUBJECTS.SUBROUTES.ID,
  validate(deleteSubjectSchema),
  subjectController.deleteSubject
);

export default router;

import { Router } from 'express';
import { ClassController } from '../controllers/v1/class.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  createClassSchema,
  updateClassSchema,
  getClassSchema,
  deleteClassSchema,
  getClassStudentsSchema,
  getClassSubjectsSchema,
  getClassSubjectDetailsSchema,
  removeTeacherFromClassSubjectSchema,
  assignClassToTeacherSubjectWiseSchema,
  promoteStudentsSchema
} from '../utils/requestValidators/class.validator';
import { ROUTES } from '../utils/constants/routes';

/**
 * Class Routes
 * 
 * Defines all class-related API endpoints
 * Uses global authentication middleware for access control
 */
const router = Router();
const classController = new ClassController();

// Create class
router.post(
  ROUTES.CLASSES.SUBROUTES.ROOT,
  validate(createClassSchema),
  classController.createClass
);

// Get all classes
router.get(
  ROUTES.CLASSES.SUBROUTES.ROOT,
  classController.getAllClasses
);

// Get classes DDL (dropdown list) - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.DDL,
  classController.getClassesDDL
);

// Get all classes DDL with subjects - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.ALL_CLASSES_DDL,
  classController.getAllClassesDDL
);

// Get batches DDL (dropdown list) - for class filters - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.BATCHES_DDL,
  classController.getBatchesDDL
);

// Get teacher assigned classes DDL (dropdown list) - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.MY_CLASSES_DDL,
  classController.getMyClassesDDL
);

// Get teacher assigned classes with subjects - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.MY_CLASSES,
  classController.getMyClassesWithSubjects
);

// Get student enrolled classes with subjects - MUST come before /:id routes
router.get(
  ROUTES.CLASSES.SUBROUTES.MY_STUDENT_CLASSES,
  classController.getMyStudentClassesWithSubjects
);

// Get class statistics
router.get(
  ROUTES.CLASSES.SUBROUTES.STATS,
  classController.getClassStats
);

// Get classes by grade
router.get(
  ROUTES.CLASSES.SUBROUTES.BY_GRADE,
  classController.getClassesByGrade
);

// Get classes by academic year
router.get(
  ROUTES.CLASSES.SUBROUTES.BY_ACADEMIC_YEAR,
  classController.getClassesByAcademicYear
);

// Get class by ID - MUST come after specific routes
router.get(
  ROUTES.CLASSES.SUBROUTES.ID,
  validate(getClassSchema),
  classController.getClassById
);

// Update class
router.put(
  ROUTES.CLASSES.SUBROUTES.ID,
  validate(updateClassSchema),
  classController.updateClass
);

// Delete class
router.delete(
  ROUTES.CLASSES.SUBROUTES.ID,
  validate(deleteClassSchema),
  classController.deleteClass
);

// Get class students
router.get(
  ROUTES.CLASSES.SUBROUTES.STUDENTS,
  validate(getClassStudentsSchema),
  classController.getClassStudents
);

// Get class subjects
router.get(
  ROUTES.CLASSES.SUBROUTES.SUBJECTS,
  validate(getClassSubjectsSchema),
  classController.getClassSubjects
);

// Get class subject details with teacher assignments
router.get(
  ROUTES.CLASSES.SUBROUTES.SUBJECT_DETAILS,
  validate(getClassSubjectDetailsSchema),
  classController.getClassSubjectDetails
);

// Create teacher assignments to class subjects and assign main teacher to class
router.post(
  ROUTES.CLASSES.SUBROUTES.TEACHER_ASSIGNMENTS,
  validate(assignClassToTeacherSubjectWiseSchema),
  classController.createTeacherAssignments
);

// Remove teacher from class-subject assignment
router.post(
  ROUTES.CLASSES.SUBROUTES.TEACHER_ASSIGNMENTS_REMOVE,
  validate(removeTeacherFromClassSubjectSchema),
  classController.removeTeacherAssignment
);

// Promote selected students to a new class
router.post(
  ROUTES.CLASSES.SUBROUTES.PROMOTE_STUDENTS,
  validate(promoteStudentsSchema),
  classController.promoteStudents
);

export default router;


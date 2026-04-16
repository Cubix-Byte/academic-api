import {
  RouteAccessLevel,
  RouteAccessMap,
  routeKey,
} from "../utils/shared-lib-imports";
import { ROUTES } from "../utils/constants/routes";
import { ROLE_NAMES } from "../utils/shared-lib-imports";

/**
 * Route Access Configuration for Academy API
 *
 * This configuration defines access levels for all routes in the application.
 * The global route access middleware will automatically handle authentication
 * based on these settings.
 *
 * Access Levels:
 * - PUBLIC: No authentication required
 * - PRIVATE: Authentication required (any logged-in user)
 * - ADMIN: Admin role required
 * - ROLE_BASED: Specific role(s) required (defined in roles array)
 * - INTERNAL: Internal microservice API key required
 */
export const routeAccessConfig: RouteAccessMap = {
  // ============================================
  // HEALTH CHECK ROUTES (PUBLIC)
  // ============================================
  [routeKey("GET", "/health")]: {
    level: RouteAccessLevel.PUBLIC,
    active: true,
  },

  [routeKey("GET", `${ROUTES.BASE}${ROUTES.HEALTH.BASE}`)]: {
    level: RouteAccessLevel.PUBLIC,
    active: true,
  },

  // ============================================
  // CLASS ROUTES
  // ============================================
  // Create class - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all classes - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get class by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update class - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete class - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get class students - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.STUDENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get class subjects - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.SUBJECTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get class subject details with teacher assignments - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.SUBJECT_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Create teacher assignments to class subjects - Private
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.TEACHER_ASSIGNMENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Remove teacher from class-subject assignment - Private
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.TEACHER_ASSIGNMENTS_REMOVE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get classes DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all classes DDL with subjects - Private (for dropdowns with subjects)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.ALL_CLASSES_DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get batches DDL - Private (for class filters)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.BATCHES_DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teacher assigned classes DDL - ROLE_BASED (Teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.MY_CLASSES_DDL}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  // Get student enrolled classes with subjects - PRIVATE (role check in controller)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CLASSES.BASE}${ROUTES.CLASSES.SUBROUTES.MY_STUDENT_CLASSES}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // CONTENT LIBRARY ROUTES (Teacher-only)
  // ============================================
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY.BASE}${ROUTES.CONTENT_LIBRARY.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY.BASE}${ROUTES.CONTENT_LIBRARY.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY.BASE}${ROUTES.CONTENT_LIBRARY.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY.BASE}${ROUTES.CONTENT_LIBRARY.SUBROUTES.RENAME}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY.BASE}${ROUTES.CONTENT_LIBRARY.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.RENAME}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.BASE}${ROUTES.CONTENT_LIBRARY_CONTENT.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  // ============================================
  // SUBJECT ROUTES
  // ============================================
  // Create subject - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all subjects - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Get subject by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update subject - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete subject - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subject classes - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.CLASSES}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subjects DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subject grades DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.GRADES_DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subject statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subject counts - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.SUBJECTS.BASE}${ROUTES.SUBJECTS.SUBROUTES.COUNTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // TEACHER ROUTES
  // ============================================
  // Create teacher - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all teachers - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teacher by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teacher profile details with statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.PROFILE_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my teacher profile - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.PROFILE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update my teacher profile - Private
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.PROFILE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my class detail - ROLE_BASED (Teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.MY_CLASS_DETAIL}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  // Get my classes with students - ROLE_BASED (Teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.MY_CLASSES_STUDENTS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  // Update teacher - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete teacher - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Assign classes to teacher - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ASSIGN_CLASSES}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Assign subjects to teacher - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.ASSIGN_SUBJECTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teacher classes with subjects - ADMIN only
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.CLASSES}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get teachers by class - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.BY_CLASS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teachers by subject - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.BY_SUBJECT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teachers DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get teacher statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get active stats (teachers and subjects) - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get active counts (active teachers and active subjects) - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.COUNTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Bulk create teachers - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.BULK_CREATE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Sync teacher data - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHERS.BASE}${ROUTES.TEACHERS.SUBROUTES.SYNC}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT ROUTES
  // ============================================
  // Create student - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all students - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get active students DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my student profile - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.PROFILE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my class details - Private (for students)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.CLASS_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my performance breakdown - Private (for students)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.PERFORMANCE_BREAKDOWN}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get my graded exams - Private (for students)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.GRADED_EXAMS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Student folders (my-courses) - Private (for students)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDERS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDERS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_BY_ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "PATCH",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_BY_ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_BY_ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_CONTENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_CONTENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.FOLDER_CONTENT_BY_ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student cumulative insights - ROLE_BASED (Admin/Superadmin)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ADMIN_CUMULATIVE_INSIGHTS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Get top students ranked by average exam percentage - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.TOP_STUDENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get active stats (students) - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student profile details with statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.PROFILE_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update my student profile - Private
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.PROFILE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update student - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete student - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get students by class - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.BY_CLASS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Bulk create students - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.BULK_CREATE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Sync student data - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.SYNC}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Search students - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}/search`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student by user ID - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}/user/:userId`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Assign subjects to student - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.ID}/subjects`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get students by subject - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}/subject/:subjectId`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student classes (active and promoted) - Private (student, parent, admin, or teacher)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}${ROUTES.STUDENTS.SUBROUTES.CLASSES}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student enrollment data - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENTS.BASE}/enrollment/:id`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // BATCH ROUTES
  // ============================================
  // Create batch - Admin
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get comprehensive student report - Private (student or parent or staff logic handled in controller)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.REPORTS.BASE}/students/:studentId/comprehensive`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get all batches - Admin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get batch by ID - Admin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Update batch - Admin
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Delete batch - Admin
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get batches DDL - Private (for dropdowns) - MAIN ENDPOINT REQUESTED
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Search batches - Admin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.SEARCH}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get batch stats - Admin (simplified - total and active)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get batch statistics - Admin (detailed)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.BATCHES.BASE}${ROUTES.BATCHES.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // ============================================
  // EXAM MODE ROUTES (Superadmin Only)
  // ============================================
  // Create exam mode - Admin (superadmin only)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get all exam modes - ROLE_BASED (Admins, Teachers, and Students e.g. for results mode selection)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [
      ROLE_NAMES.ADMIN,
      ROLE_NAMES.PRIMARYADMIN,
      ROLE_NAMES.SUPERADMIN,
      ROLE_NAMES.TEACHER,
      ROLE_NAMES.STUDENT,
    ],
    active: true,
  },

  // Get exam mode by ID - Admin (superadmin only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Update exam mode - Admin (superadmin only)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Delete exam mode - Admin (superadmin only)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Search exam modes - Admin (superadmin only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.SEARCH}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get exam mode statistics - Admin (superadmin only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get exam modes DDL - Private (for dropdowns)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_MODES.BASE}${ROUTES.EXAM_MODES.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // GRADING SYSTEM ROUTES
  // ============================================
  // Create grading system - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all grading systems - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get grading system by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update grading system - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete grading system - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Search grading systems - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.SEARCH}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get grading system statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Calculate grade from percentage - Private (for internal calculations)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING_SYSTEMS.BASE}${ROUTES.GRADING_SYSTEMS.SUBROUTES.CALCULATE_GRADE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // EXAM ROUTES
  // ============================================
  // Create exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all exams - Private (Teachers, Students, Admins)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Search exams - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.SEARCH}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get published exams DDL list - ROLE_BASED (Teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.PUBLISHED_DDL}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.TEACHER],
    active: true,
  },

  // Get exam logs - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.LOGS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get school performance - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.EXAMS.BASE}/school-performance`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam with questions - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.WITH_QUESTIONS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Publish exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.PUBLISH}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Unpublish exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.UNPUBLISH}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Assign students to exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ASSIGN_STUDENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update exam - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete exam - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.EXAMS.BASE}${ROUTES.EXAMS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // EXAM QUESTION ROUTES
  // ============================================
  // Create exam question - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all exam questions - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Bulk create questions - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.BULK}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Reorder questions - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.REORDER}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get next question number - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.NEXT_NUMBER}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam question by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update exam question - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete exam question - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.EXAM_QUESTIONS.BASE}${ROUTES.EXAM_QUESTIONS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT EXAM TAKING ROUTES
  // ============================================
  // Start exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.START}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Submit answer - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.SUBMIT_ANSWER}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Submit exam - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.SUBMIT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Save draft answer - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.SAVE_DRAFT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all student exams - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam instructions - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.INSTRUCTIONS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get attempt history - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.HISTORY}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get attempt status - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.ATTEMPT_STATUS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get draft answers - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.DRAFT_ANSWERS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get current class stats - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.CURRENT_CLASS_STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get subject stats - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.SUBJECT_STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get recent results - Private (student only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAMS.BASE}${ROUTES.STUDENT_EXAMS.SUBROUTES.RECENT_RESULTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // TEACHER GRADING ROUTES (New Grading System)
  // ============================================
  // Get grading list - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_GRADING.BASE}${ROUTES.TEACHER_GRADING.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get grading statistics for teacher - Private (teachers only)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.TEACHER_GRADING.BASE}/stats`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam grading details - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_GRADING.BASE}${ROUTES.TEACHER_GRADING.SUBROUTES.EXAM_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student answers for grading - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_GRADING.BASE}${ROUTES.TEACHER_GRADING.SUBROUTES.STUDENT_ANSWERS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Submit grading - Private (teachers only)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TEACHER_GRADING.BASE}${ROUTES.TEACHER_GRADING.SUBROUTES.SUBMIT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // TEACHER DASHBOARD ROUTES
  // ============================================
  // Get top students - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_DASHBOARD.BASE}${ROUTES.TEACHER_DASHBOARD.SUBROUTES.TOP_STUDENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get class analytics - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_DASHBOARD.BASE}${ROUTES.TEACHER_DASHBOARD.SUBROUTES.CLASS_ANALYTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get student activity - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_DASHBOARD.BASE}${ROUTES.TEACHER_DASHBOARD.SUBROUTES.STUDENT_ACTIVITY}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get teacher dashboard stats - Private (teachers only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_DASHBOARD.BASE}${ROUTES.TEACHER_DASHBOARD.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // GRADING ROUTES
  // ============================================
  // Auto-grade attempt - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.AUTO_GRADE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Auto-grade attempt with data - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}/auto-grade-with-data`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get pending submissions - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.PENDING}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Manual grade attempt - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.MANUAL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update marks - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.UPDATE_MARKS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Publish results - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.PUBLISH}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get grading statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam leaderboard - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.LEADERBOARD}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get attempt grading details - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Bulk auto-grade - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.BULK_AUTO_GRADE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get question performance - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.GRADING.BASE}${ROUTES.GRADING.SUBROUTES.QUESTION_PERFORMANCE}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT RESULTS ROUTES
  // ============================================
  // Get results history - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get exam result - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/:examId`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Compare exams - Private (any authenticated user)
  [routeKey("POST", `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/compare`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get detailed result - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/detailed/:attemptId`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Performance analytics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/analytics/performance`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Subject-wise analytics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/analytics/subject-wise`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Class ranking - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/analytics/ranking`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Progress tracking - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/analytics/progress`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Peer comparison - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_RESULTS.BASE}/analytics/peer-comparison`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT DASHBOARD ROUTES
  // ============================================
  // Get dashboard overview - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_DASHBOARD.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get upcoming exams - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_DASHBOARD.BASE}/upcoming`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_DASHBOARD.BASE}/statistics`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT CREDENTIALS ROUTES
  // ============================================
  // Get all credentials - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credential by ID - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/:credentialId`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Verify credential - Public
  [routeKey("POST", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/verify`)]:
  {
    level: RouteAccessLevel.PUBLIC,
    active: true,
  },
  // Get achievements - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/achievements`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get badges - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/badges`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student credentials statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/statistics`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get student credentials dashboard - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/dashboard`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get recent credentials - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/recent`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get expiring credentials - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/expiring`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get credentials by type - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/by-type`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get credentials by exam - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_CREDENTIALS.BASE}/by-exam`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // STUDENT EXAM LIST ROUTES
  // ============================================
  // Get all exams for student - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get exam by ID for student - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}/:examId`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get student exam statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}/statistics`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get student exam dashboard - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}/dashboard`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get upcoming exams for student - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}/upcoming`)]:
  {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get past exams for student - Private
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.STUDENT_EXAM_LIST.BASE}/past`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // TEACHER CREDENTIALS ROUTES
  // ============================================
  // Create credentials - Private (any authenticated user)
  [routeKey("POST", `${ROUTES.BASE}${ROUTES.TEACHER_CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Update credential - Private (any authenticated user)
  [routeKey("PUT", `${ROUTES.BASE}${ROUTES.TEACHER_CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Delete credential - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.TEACHER_CREDENTIALS.BASE}/:credentialId`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credentials - Private (any authenticated user)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.TEACHER_CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get issued credentials - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TEACHER_CREDENTIALS.BASE}${ROUTES.TEACHER_CREDENTIALS.SUBROUTES.ISSUED}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // CREDENTIAL TEMPLATES ROUTES
  // ============================================
  // Create credential template - Admin only (Admin/SuperAdmin)
  [routeKey("POST", `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },
  // Get credential templates - Private (any authenticated user can view)
  [routeKey("GET", `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}`)]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credential repository - Private (any authenticated user can view)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.REPOSITORY}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credential template by ID - Private (any authenticated user can view)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Update credential template - Admin only (Admin/SuperAdmin)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },
  // Delete credential template - Admin only (Admin/SuperAdmin)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },
  // Assign credential to teachers - Admin only (Admin/SuperAdmin)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ASSIGN_TEACHERS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },
  // Get teacher credential assignments - Private (any authenticated user can view)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ASSIGNMENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credential assignments details - Private (any authenticated user can view)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ASSIGNMENTS_DETAILS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },
  // Get credential analytics - Private (any authenticated user can view)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.ANALYTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get credential template stats - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CREDENTIALS.BASE}${ROUTES.CREDENTIALS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // PARENT ROUTES
  // ============================================
  // Create parent - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all parents - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update parent - Private (any authenticated user)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete parent - Private (any authenticated user)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent counts - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.COUNTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get child's achievements - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.CHILD_ACHIEVEMENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get child's badges - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.CHILD_BADGES}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get child's leaderboard - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.CHILD_LEADERBOARD}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Add child to parent - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.ADD_CHILD}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Remove child from parent - Private (any authenticated user)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.REMOVE_CHILD}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent children - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}${ROUTES.PARENTS.SUBROUTES.CHILDREN}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent subject stats - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENTS.BASE}/dashboard/subject-stats`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // PARENT-CHILD RELATIONSHIP ROUTES
  // ============================================
  // Create parent-child relationship - Private
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get children by parent ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.PARENT_CHILDREN}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parents by child ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.CHILD_PARENTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update parent-child relationship - Private
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Set primary parent - Private
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.SET_PRIMARY}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete parent-child relationship - Private
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get parent-child statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get child's subjects with assigned teachers - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARENT_CHILD.BASE}${ROUTES.PARENT_CHILD.SUBROUTES.CHILD_SUBJECTS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // INTERNAL API ROUTES
  // ============================================
  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.HEALTH}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_CLASS_BY_ID}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_CLASSES_BY_IDS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_SUBJECT_BY_ID}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_SUBJECTS_BY_IDS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.VALIDATE_CLASS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.VALIDATE_SUBJECT}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.SYNC_CLASS_DATA}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.SYNC_SUBJECT_DATA}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  // Additional validation endpoints
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-batch/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey("GET", `${ROUTES.INTERNAL}/validate-student/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey("GET", `${ROUTES.INTERNAL}/validate-teacher/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  // Send exam notifications - Comprehensive exam notifications for students and teachers
  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.SEND_EXAM_NOTIFICATIONS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  // Update embedded status for content library content
  // Support both versioned and non-versioned paths
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.INTERNAL_ROUTES.BASE}${ROUTES.INTERNAL_ROUTES.SUBROUTES.UPDATE_EMBEDDED_STATUS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey(
    "POST",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.UPDATE_EMBEDDED_STATUS}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey("GET", `${ROUTES.INTERNAL}/student/:id/classes`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey("GET", `${ROUTES.INTERNAL}/students/:studentId`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  [routeKey("GET", `${ROUTES.INTERNAL}/parents/:parentId`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  // ============================================
  // PARTNER ROUTES
  // ============================================
  // Create partner - SUPERADMIN only
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Get all partners - Private (any authenticated user with appropriate role)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.SUPERADMIN, ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get partner statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.SUPERADMIN, ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get partner by ID - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update partner - SUPERADMIN only
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Delete partner - SUPERADMIN only
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.PARTNERS.BASE}${ROUTES.PARTNERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // ============================================
  // TENANT ROUTES
  // ============================================
  // Create tenant - Admin/Superadmin
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Get all tenants - Admin/Superadmin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Get tenant statistics - Admin/Superadmin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.STATS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get tenant DDL - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.DDL}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get tenant by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get tenant by name - Public
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.NAME}`
  )]: {
    level: RouteAccessLevel.PUBLIC,
    active: true,
  },

  // Update tenant - Admin/Superadmin
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // Delete tenant - Admin/Superadmin
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.TENANTS.BASE}${ROUTES.TENANTS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // ============================================
  // EXAM BUILDER ROUTES
  // ============================================
  // Create exam builder - Private (teachers and admins)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all exam builders - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam builder statistics - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get exam builder by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update exam builder - Private (owner or admin)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete exam builder - Private (owner or admin)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.EXAM_BUILDERS.BASE}${ROUTES.EXAM_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // CONTENT BUILDER ROUTES
  // ============================================
  // Create content builder - Private (teachers and admins)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.CONTENT_BUILDERS.BASE}${ROUTES.CONTENT_BUILDERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get all content builders - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_BUILDERS.BASE}${ROUTES.CONTENT_BUILDERS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get content builder by ID - Private
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.CONTENT_BUILDERS.BASE}${ROUTES.CONTENT_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Update content builder - Private (owner or admin)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.CONTENT_BUILDERS.BASE}${ROUTES.CONTENT_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Delete content builder - Private (owner or admin)
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.CONTENT_BUILDERS.BASE}${ROUTES.CONTENT_BUILDERS.SUBROUTES.ID}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // DASHBOARD ROUTES
  // ============================================
  // Get dashboard statistics - Private (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.DASHBOARD.BASE}${ROUTES.DASHBOARD.SUBROUTES.STATISTICS}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // NOTIFICATION ROUTES
  // ============================================
  // Test send notifications - Public (no authentication required for testing)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.NOTIFICATIONS.BASE}${ROUTES.NOTIFICATIONS.SUBROUTES.TEST}`
  )]: {
    level: RouteAccessLevel.PUBLIC,
    active: true,
  },

  // ============================================
  // INTERNAL MICROSERVICE ROUTES (API KEY)
  // ============================================
  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.HEALTH}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_TENANT_BY_NAME}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey(
    "GET",
    `${ROUTES.INTERNAL}${ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_ADMIN_TENANT_CONTEXT}`
  )]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-class/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-subject/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-batch/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-student/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/validate-teacher/:id`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },
  [routeKey("GET", `${ROUTES.INTERNAL}/student/:id/classes`)]: {
    level: RouteAccessLevel.INTERNAL,
    active: true,
  },

  // ============================================
  // ADMIN ROUTES
  // ============================================
  // Create admin - Only primary admin can create additional admins
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.ADMINS.BASE}${ROUTES.ADMINS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get all admins - Admin/Superadmin/PrimaryAdmin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ADMINS.BASE}${ROUTES.ADMINS.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Get admin by tenant ID - Admin/Superadmin/PrimaryAdmin
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ADMINS.BASE}${ROUTES.ADMINS.SUBROUTES.TENANT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Update admin by tenant ID - Admin/Superadmin/PrimaryAdmin
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.ADMINS.BASE}${ROUTES.ADMINS.SUBROUTES.TENANT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // Delete admin by tenant ID - Admin/Superadmin/PrimaryAdmin
  [routeKey(
    "DELETE",
    `${ROUTES.BASE}${ROUTES.ADMINS.BASE}${ROUTES.ADMINS.SUBROUTES.TENANT}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPERADMIN, ROLE_NAMES.PRIMARYADMIN],
    active: true,
  },

  // ============================================
  // RESEND EMAIL ROUTES (UNIFIED ENDPOINT)
  // ============================================
  // Resend welcome email (unified endpoint for students, teachers, and parents) - Private
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.RESEND_EMAIL.BASE}${ROUTES.RESEND_EMAIL.SUBROUTES.ROOT}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // ============================================
  // ATTENDANCE & CLASS SESSION ROUTES
  // ============================================
  // Start class session - ROLE_BASED (Teachers, Admins, PrimaryAdmin, SuperAdmin)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.START_SESSION}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [
      ROLE_NAMES.TEACHER,
      ROLE_NAMES.ADMIN,
      ROLE_NAMES.PRIMARYADMIN,
      ROLE_NAMES.SUPERADMIN,
    ],
    active: true,
  },

  // Update class session status - ROLE_BASED (Teachers, Admins, PrimaryAdmin, SuperAdmin)
  [routeKey(
    "PUT",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.UPDATE_SESSION_STATUS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [
      ROLE_NAMES.TEACHER,
      ROLE_NAMES.ADMIN,
      ROLE_NAMES.PRIMARYADMIN,
      ROLE_NAMES.SUPERADMIN,
    ],
    active: true,
  },

  // Mark attendance - ROLE_BASED (Teachers, Admins, PrimaryAdmin, SuperAdmin)
  [routeKey(
    "POST",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.MARK_ATTENDANCE}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [
      ROLE_NAMES.TEACHER,
      ROLE_NAMES.ADMIN,
      ROLE_NAMES.PRIMARYADMIN,
      ROLE_NAMES.SUPERADMIN,
    ],
    active: true,
  },

  // Get session attendance - ROLE_BASED (Teachers, Admins, PrimaryAdmin, SuperAdmin)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.SESSION_ATTENDANCE}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [
      ROLE_NAMES.TEACHER,
      ROLE_NAMES.ADMIN,
      ROLE_NAMES.PRIMARYADMIN,
      ROLE_NAMES.SUPERADMIN,
    ],
    active: true,
  },

  // Get logged-in student's attendance summary - PRIVATE (any authenticated user)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.MY_SUMMARY}`
  )]: {
    level: RouteAccessLevel.PRIVATE,
    active: true,
  },

  // Get logged-in student's current class attendance stats - ROLE_BASED (Students only)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.MY_CURRENT_CLASS_STATS}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.STUDENT],
    active: true,
  },

  // Get teacher attendance summary - ROLE_BASED (Admins, PrimaryAdmin, SuperAdmin)
  [routeKey(
    "GET",
    `${ROUTES.BASE}${ROUTES.ATTENDANCE.BASE}${ROUTES.ATTENDANCE.SUBROUTES.TEACHER_SUMMARY}`
  )]: {
    level: RouteAccessLevel.ROLE_BASED,
    roles: [ROLE_NAMES.ADMIN, ROLE_NAMES.PRIMARYADMIN, ROLE_NAMES.SUPERADMIN],
    active: true,
  },

  // // ============================================
  // // CLASS SCHEDULE / TIMETABLE ROUTES
  // // ============================================
  // // Create class schedule - Private (any authenticated user)
  // [routeKey(
  //   "POST",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.ROOT}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Get all class schedules - Private (any authenticated user)
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.ROOT}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Get class schedule by ID - Private
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.ID}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Update class schedule - Private (any authenticated user)
  // [routeKey(
  //   "PUT",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.ID}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Delete class schedule - Private (any authenticated user)
  // [routeKey(
  //   "DELETE",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.ID}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Get class timetable - Private (any authenticated user)
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.CLASS_TIMETABLE}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Get teacher timetable - ROLE_BASED (Teachers only)
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.TEACHER_TIMETABLE}`
  // )]: {
  //   level: RouteAccessLevel.ROLE_BASED,
  //   roles: [ROLE_NAMES.TEACHER],
  //   active: true,
  // },

  // // Get student timetable - Private (any authenticated user)
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.STUDENT_TIMETABLE}`
  // )]: {
  //   level: RouteAccessLevel.PRIVATE,
  //   active: true,
  // },

  // // Get class timetable summary - ROLE_BASED (Primary Admin only)
  // [routeKey(
  //   "GET",
  //   `${ROUTES.BASE}${ROUTES.CLASS_SCHEDULES.BASE}${ROUTES.CLASS_SCHEDULES.SUBROUTES.CLASS_TIMETABLE_SUMMARY}`
  // )]: {
  //   level: RouteAccessLevel.ROLE_BASED,
  //   roles: [ROLE_NAMES.PRIMARYADMIN],
  //   active: true,
  // },
};

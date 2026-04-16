// Route constants for Academy API
// Centralized route definitions for easy management and versioning

export const ROUTES = {
  SERVICE_BASE: "/academy", // Service base path
  API_BASE: "/api",
  INTERNAL_BASE: "/internal",
  VERSION: "v1", // API version (can be changed to v2, v3, etc.)

  // Complete base path for current version
  get BASE() {
    return `${this.SERVICE_BASE}${this.API_BASE}/${this.VERSION}`;
  },

  // Internal API base path (no versioning needed for internal APIs)
  get INTERNAL() {
    return `${this.SERVICE_BASE}${this.INTERNAL_BASE}`;
  },

  // Class routes
  CLASSES: {
    BASE: "/classes",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      STUDENTS: "/:id/students",
      SUBJECTS: "/:id/subjects",
      SUBJECT_DETAILS: "/:id/subject-details", // Get class subject details with teacher assignments
      TEACHER_ASSIGNMENTS: "/teacher-assignments", // Create teacher assignments to class subjects
      TEACHER_ASSIGNMENTS_REMOVE: "/teacher-assignments/remove", // Remove teacher from class-subject assignment
      STATS: "/stats",
      BY_GRADE: "/by-grade/:grade",
      BY_ACADEMIC_YEAR: "/by-academic-year/:year",
      DDL: "/ddl", // Dropdown list for classes
      ALL_CLASSES_DDL: "/all-classes/ddl", // All classes DDL with subjects
      BATCHES_DDL: "/batches/ddl", // Dropdown list for batches (for class filters)
      MY_CLASSES_DDL: "/myclassesddl", // Teacher assigned classes DDL
      MY_CLASSES: "/myclasses", // Teacher assigned classes with subjects
      MY_STUDENT_CLASSES: "/mystudentclasses", // Student enrolled classes with subjects
      PROMOTE_STUDENTS: "/promote-students", // Promote selected students to a new class
    },
  },

  // Class Schedule / Timetable routes
  CLASS_SCHEDULES: {
    BASE: "/class-schedules",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      CLASS_TIMETABLE: "/class/:classId/timetable",
      TEACHER_TIMETABLE: "/teacher/timetable",
      STUDENT_TIMETABLE: "/student/timetable",
      CLASS_TIMETABLE_SUMMARY: "/classes/timetable-summary",
    },
  },

  // Subject routes
  SUBJECTS: {
    BASE: "/subjects",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      CLASSES: "/:id/classes",
      STATS: "/stats",
      BY_TYPE: "/by-type/:type",
      BY_GRADE_LEVEL: "/by-grade-level/:grade",
      SEARCH: "/search",
      DDL: "/ddl", // Dropdown list for subjects
      GRADES_DDL: "/grades/ddl", // Dropdown list for subject grades
      COUNTS: "/counts", // Subject counts (total and active)
    },
  },

  // Teacher routes
  TEACHERS: {
    BASE: "/teachers",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      PROFILE: "/profile",
      PROFILE_DETAILS: "/:id/profile-details", // Get detailed teacher profile with statistics
      MY_CLASS_DETAIL: "/my-class-detail",
      MY_CLASSES_STUDENTS: "/my-classes-students", // Get teacher's classes with students
      ASSIGN_CLASSES: "/:id/assign-classes",
      ASSIGN_SUBJECTS: "/:id/assign-subjects",
      CLASSES: "/:id/classes", // Admin: Get teacher classes with subjects
      BY_CLASS: "/class/:classId",
      BY_SUBJECT: "/subject/:subjectId",
      STATISTICS: "/statistics",
      STATS: "/stats", // Active teachers and subjects stats (simplified)
      COUNTS: "/counts", // Active teachers and active subjects counts
      BULK_CREATE: "/bulk-create",
      SYNC: "/:id/sync",
      DDL: "/ddl", // Dropdown list for teachers
    },
  },

  // Student routes
  STUDENTS: {
    BASE: "/students",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      DDL: "/ddl", // Dropdown list for active students
      PROFILE: "/profile",
      CLASS_DETAILS: "/class-details",
      PERFORMANCE_BREAKDOWN: "/performance-breakdown",
      GRADED_EXAMS: "/graded-exams",
      ADMIN_CUMULATIVE_INSIGHTS: "/admin/:studentId/cumulative-insights",
      BY_CLASS: "/class/:classId",
      BY_PARENT: "/parent/:parentId",
      STATISTICS: "/statistics",
      STATS: "/stats", // Active students stats (simplified)
      BULK_CREATE: "/bulk-create",
      SYNC: "/:id/sync",
      TOP_STUDENTS: "/top-students", // Top students ranked by average exam percentage
      PROFILE_DETAILS: "/:id/profile-details", // Get detailed student profile with statistics
      WALLET: "/:studentId/wallet", // Get student wallet balance
      CREDIT_USAGE_HISTORY: "/:studentId/credit-usage-history", // Get credit usage history
      CLASSES: "/:id/classes", // Get all classes for a student (active and promoted)
      FOLDERS: "/folders", // Student folders (my-courses organization)
      FOLDER_BY_ID: "/folders/:folderId",
      FOLDER_CONTENTS: "/folders/:folderId/contents",
      FOLDER_CONTENT_BY_ID: "/folders/:folderId/contents/:contentId",
    },
  },

  // Batch routes
  BATCHES: {
    BASE: "/batches",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      DDL: "/ddl", // Dropdown list for batches
      STATS: "/stats", // Batch statistics
      SEARCH: "/search",
      STATISTICS: "/statistics",
    },
  },

  // Parent routes
  PARENTS: {
    BASE: "/parents",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      PROFILE: "/profile",
      CHILDREN: "/children",
      CHILDREN_WALLETS: "/:parentId/children/wallets",
      CHILD_ACHIEVEMENTS: "/children/:childId/achievements",
      CHILD_BADGES: "/children/:childId/badges",
      CHILD_LEADERBOARD: "/children/:childId/leaderboard",
      ADD_CHILD: "/add-child",
      REMOVE_CHILD: "/remove-child",
      COUNTS: "/counts", // Parent counts (total, active, inactive)
      STATISTICS: "/statistics",
      BULK_CREATE: "/bulk-create",
      SYNC: "/:id/sync",
    },
  },

  // Parent-Child relationship routes
  PARENT_CHILD: {
    BASE: "/parent-child",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      PARENT_CHILDREN: "/parent/:parentId/children",
      CHILD_PARENTS: "/child/:childId/parents",
      CHILD_SUBJECTS: "/child/:childId/subjects",
      SET_PRIMARY: "/set-primary",
      STATISTICS: "/statistics",
    },
  },

  // Exam Mode routes
  EXAM_MODES: {
    BASE: "/exam-modes",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      SEARCH: "/search",
      STATISTICS: "/statistics",
      DDL: "/ddl", // Dropdown list for exam modes
    },
  },

  // Grading System routes
  GRADING_SYSTEMS: {
    BASE: "/grading-systems",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      SEARCH: "/search",
      STATISTICS: "/statistics",
      CALCULATE_GRADE: "/calculate-grade",
    },
  },

  // Exam routes
  EXAMS: {
    BASE: "/exams",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      WITH_QUESTIONS: "/:id/with-questions",
      PUBLISH: "/:id/publish",
      UNPUBLISH: "/:id/unpublish",
      ASSIGN_STUDENTS: "/:id/assign-students",
      SEARCH: "/search",
      STATISTICS: "/statistics",
      PUBLISHED_DDL: "/published/ddl", // Published exams DDL list for teachers
      LOGS: "/logs", // Exam logs (paginated listing with filters)
    },
  },

  // Exam Question routes
  EXAM_QUESTIONS: {
    BASE: "/exam-questions",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      BULK: "/bulk",
      REORDER: "/:examId/reorder",
      NEXT_NUMBER: "/:examId/next-number",
    },
  },

  // Student Exam Taking routes
  STUDENT_EXAMS: {
    BASE: "/student-exams",
    SUBROUTES: {
      ROOT: "/",
      START: "/start",
      SUBMIT_ANSWER: "/submit-answer",
      SUBMIT: "/submit",
      SAVE_DRAFT: "/save-draft",
      INSTRUCTIONS: "/:examId/instructions",
      HISTORY: "/:examId/history",
      ATTEMPT_STATUS: "/attempts/:attemptId/status",
      DRAFT_ANSWERS: "/attempts/:attemptId/drafts",
      CURRENT_CLASS_STATS: "/current-class-stats",
      SUBJECT_STATS: "/subject-stats",
      RECENT_RESULTS: "/recent-results",
    },
  },

  // Grading routes
  GRADING: {
    BASE: "/grading",
    SUBROUTES: {
      AUTO_GRADE: "/auto-grade/:attemptId",
      AUTO_GRADE_ATTEMPT: "/auto-grade-attempt/:attemptId",
      PENDING: "/pending",
      MANUAL: "/manual",
      UPDATE_MARKS: "/update-marks",
      PUBLISH: "/publish/:attemptId",
      STATISTICS: "/statistics/:examId",
      LEADERBOARD: "/leaderboard/:examId",
      DETAILS: "/details/:attemptId",
      BULK_AUTO_GRADE: "/bulk-auto-grade",
      QUESTION_PERFORMANCE: "/question-performance/:examId",
    },
  },

  // Student Results routes
  STUDENT_RESULTS: {
    BASE: "/student-results",
    SUBROUTES: {
      ROOT: "/",
      EXAM_RESULT: "/:examId",
      COMPARE: "/compare",
      DETAILED: "/detailed/:attemptId",
      ANALYTICS_PERFORMANCE: "/analytics/performance",
      ANALYTICS_SUBJECT_WISE: "/analytics/subject-wise",
      ANALYTICS_RANKING: "/analytics/ranking",
      ANALYTICS_PROGRESS: "/analytics/progress",
      ANALYTICS_PEER: "/analytics/peer-comparison",
    },
  },

  // Student Dashboard routes
  STUDENT_DASHBOARD: {
    BASE: "/student-dashboard",
    SUBROUTES: {
      ROOT: "/",
      UPCOMING: "/upcoming",
      STATISTICS: "/statistics",
      TOP_STUDENTS: "/top-students",
    },
  },

  // Teacher Dashboard routes
  TEACHER_DASHBOARD: {
    BASE: "/teacher-dashboard",
    SUBROUTES: {
      TOP_STUDENTS: "/top-students",
      CLASS_ANALYTICS: "/class-analytics",
      STUDENT_ACTIVITY: "/student-activity",
      STATS: "/stats",
    },
  },

  // Student Credentials routes
  STUDENT_CREDENTIALS: {
    BASE: "/student-credentials",
    SUBROUTES: {
      ROOT: "/",
      DETAIL: "/:credentialId",
      VERIFY: "/verify",
      ACHIEVEMENTS: "/achievements",
      BADGES: "/badges",
    },
  },

  // Student Exam List routes (for viewing assigned exams)
  STUDENT_EXAM_LIST: {
    BASE: "/student-exam-list",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:examId",
      STATISTICS: "/statistics",
      DASHBOARD: "/dashboard",
      UPCOMING: "/upcoming",
      PAST: "/past",
    },
  },

  // Teacher Credentials routes
  TEACHER_CREDENTIALS: {
    BASE: "/teacher-credentials",
    SUBROUTES: {
      ROOT: "/",
      DELETE: "/:credentialId",
      ISSUED: "/issued",
    },
  },

  // Credential Templates routes
  CREDENTIALS: {
    BASE: "/credentials",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      REPOSITORY: "/repository",
      ASSIGN_TEACHERS: "/:credentialId/assign-teachers",
      ASSIGNMENTS: "/assignments",
      ASSIGNMENTS_DETAILS: "/:credentialId/assignments-details",
      ANALYTICS: "/analytics",
      STATISTICS: "/statistics",
      STATS: "/stats",
      ISSUED: "/issued",
    },
  },

  // Teacher Grading routes (new grading system)
  TEACHER_GRADING: {
    BASE: "/teacher-grading",
    SUBROUTES: {
      ROOT: "/",
      EXAM_DETAILS: "/:examId",
      STUDENT_ANSWERS: "/:examId/student/:studentId",
      SUBMIT: "/submit",
    },
  },

  // Content Library routes
  CONTENT_LIBRARY: {
    BASE: "/content-libraries",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      RENAME: "/:id/rename",
      WITH_CONTENTS: "/with-contents",
    },
  },

  // Content Library Content routes
  CONTENT_LIBRARY_CONTENT: {
    BASE: "/content-library-contents",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      RENAME: "/:id/rename",
      ASSIGN_CLASSES: "/:id/assign-classes",
      UNASSIGN_CLASSES: "/:id/unassign-classes",
      BULK_UPLOAD: "/bulk-upload",
    },
  },

  // Activity Log routes
  ACTIVITY_LOGS: {
    BASE: "/activity-logs",
    SUBROUTES: {
      ROOT: "/",
      TEACHER: "/teacher",
      TEACHER_BY_ID: "/teacher/:teacherId",
      STUDENT: "/student",
      STUDENT_BY_ID: "/student/:studentId",
      CLASS: "/class/:classId",
      SUBJECT: "/subject/:subjectId",
      USER: "/user/:userId",
      TEACHER_ACTIVITIES: "/teacher-activities",
      EXAM_ACTIVITIES: "/exam-activities",
      STUDENT_ACTIVITIES: "/student-activities",
    },
  },

  // Health check routes
  HEALTH: {
    BASE: "/health",
  },
  INTERNAL_ROUTES: {
    BASE: "/internal",
    SUBROUTES: {
      HEALTH: "/health",
      GET_CLASS_BY_ID: "/class/:id",
      GET_CLASSES_BY_IDS: "/classes/batch",
      GET_SUBJECT_BY_ID: "/subject/:id",
      GET_SUBJECTS_BY_IDS: "/subjects/batch",
      VALIDATE_CLASS: "/validate-class",
      VALIDATE_SUBJECT: "/validate-subject",
      SYNC_CLASS_DATA: "/sync/class-data",
      SYNC_SUBJECT_DATA: "/sync/subject-data",
      SEND_EXAM_NOTIFICATIONS: "/send-exam-notifications",
      UPDATE_EMBEDDED_STATUS: "/update-embedded-status",
      GET_TENANT_BY_NAME: "/tenant/by-name/:name",
      GET_TENANT_BY_ID: "/tenant/:tenantId",
      GET_ADMIN_TENANT_CONTEXT: "/admin/:id/tenant-context",
      ADD_STUDENT_WALLET_CREDITS: "/student-wallets/:studentId/add-credits",
      VALIDATE_PARENT_STUDENT:
        "/parents/:parentId/students/:studentId/validate",
      GET_PARENT_BY_USER_ID: "/parents/by-user-id/:userId",
    },
  },
  // Report routes
  REPORTS: {
    BASE: "/reports",
  },

  // Exam Builder routes
  EXAM_BUILDERS: {
    BASE: "/exam-builders",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      STATISTICS: "/statistics",
    },
  },

  // Content Builder routes
  CONTENT_BUILDERS: {
    BASE: "/content-builders",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
    },
  },

  // Dashboard routes
  DASHBOARD: {
    BASE: "/dashboard",
    SUBROUTES: {
      ROOT: "/",
      STATISTICS: "/statistics",
    },
  },

  // Notification routes
  NOTIFICATIONS: {
    BASE: "/notifications",
    SUBROUTES: {
      TEST: "/test",
    },
  },

  // Tenant routes
  TENANTS: {
    BASE: "/tenants",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      NAME: "/by-name/:name",
      STATS: "/stats",
      DDL: "/ddl",
    },
  },

  // Partner routes
  PARTNERS: {
    BASE: "/partners",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      STATS: "/stats",
      DDL: "/ddl",
    },
  },

  // Admin routes
  ADMINS: {
    BASE: "/admins",
    SUBROUTES: {
      ROOT: "/",
      TENANT: "/tenant/:tenantId",
    },
  },

  // Resend Email routes (unified endpoint)
  RESEND_EMAIL: {
    BASE: "/resend-email",
    SUBROUTES: {
      ROOT: "/",
    },
  },

  // Image routes
  IMAGES: {
    BASE: "/images",
    SUBROUTES: {
      DOWNLOAD: "/download",
    },
  },

  // Tenant Analytics routes
  TENANT_ANALYTICS: {
    BASE: "/tenant-analytics",
    SUBROUTES: {
      MONTHLY_TRENDS: "/monthly-trends/:tenantId",
    },
  },

  // Chat routes
  CHAT: {
    BASE: "/chat",
    SUBROUTES: {
      CONVERSATIONS: "/conversations",
      MESSAGES: "/conversations/:conversationId/messages",
    },
  },

  // School Time Config routes
  SCHOOL_TIME_CONFIGS: {
    BASE: "/school-time-configs",
    SUBROUTES: {
      ROOT: "/",
    },
  },

  // Attendance & Class Session routes
  ATTENDANCE: {
    BASE: "/attendance",
    SUBROUTES: {
      START_SESSION: "/start-session",
      UPDATE_SESSION_STATUS: "/sessions/:sessionId/status",
      MARK_ATTENDANCE: "/mark",
      SESSION_ATTENDANCE: "/sessions/:sessionId/attendance",
      MY_SUMMARY: "/my/summary",
      TEACHER_SUMMARY: "/teacher/:teacherId/summary",
      MY_CURRENT_CLASS_STATS: "/my/current-class-stats",
    },
  },

  // Announcement routes
  ANNOUNCEMENTS: {
    BASE: "/announcements",
    SUBROUTES: {
      ROOT: "/",
      ID: "/:id",
      ACTIVE: "/active",
    },
  },
} as const;

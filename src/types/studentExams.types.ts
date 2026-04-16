/**
 * Student Exams Types - Request and Response interfaces for student exam management
 */

// Request Types
export interface GetStudentExamsRequest {
  pageNo?: number;
  pageSize?: number;
  examType?: "Official" | "Practice" | "Exam Repository";
  examStatus?:
  | "Draft"
  | "Unpublished"
  | "Published"
  | "In Progress"
  | "Completed"
  | "Released"
  | "Cancelled";
  /** Filter by ExamStudent status - "Completed" = student has attempted and submitted */
  examStudentStatus?: "Pending" | "Started" | "Completed";
  timeFilter?: "upcoming" | "past" | "all";
  sortBy?: "startOn" | "examTitle" | "totalMarks";
  sortOrder?: "asc" | "desc";
  subjectId?: string;
  classId?: string;
  /** When true, exclude exams for which this student already has a credential assigned (one credential per exam per student) */
  excludeExamsWithCredentialForStudent?: boolean;
  /** When set (e.g. credential template id / assignmentId), exclude only exams where student already has this specific credential. Requires excludeExamsWithCredentialForStudent. */
  credentialId?: string;
}

export interface GetStudentExamByIdRequest {
  examId: string;
}

// Response Types
export interface StudentExamResponse {
  examId: string;
  examTitle: string;
  description: string;
  examType: "Official" | "Practice" | "Exam Repository";
  totalMarks: number;
  maxAttempts: number;
  durationInMinutes: number;
  startOn: Date;
  endOn: Date;
  examStatus:
  | "Draft"
  | "Unpublished"
  | "Published"
  | "In Progress"
  | "Completed"
  | "Cancelled";
  teacherId: string;
  teacherName?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  batchId: string;
  batchName?: string;
  isActive: boolean;
  attemptsTaken?: number;
  questionsCount?: number;
  isSubmitted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetStudentExamsResponse {
  success: boolean;
  message: string;
  data: {
    exams: StudentExamResponse[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalExams: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    filters: {
      examType?: string;
      examStatus?: string;
      timeFilter?: string;
      subjectId?: string;
    };
  };
}

export interface GetStudentExamByIdResponse {
  success: boolean;
  message: string;
  data: StudentExamResponse;
}

export interface PerformedExamResponse {
  examId: string;
  title: string;
  subject: string;
  subjectId: string;
  attemptedOn: Date;
  isResultGraded: boolean;
  examType: "Official" | "Practice" | "Exam Repository";
  status: "Started" | "Completed";
  gradingStatus: "Waiting for Grading" | "In Progress" | "Completed";
  percentage?: number;
  grade?: string;
  createdBy?: string; // Teacher name who created the exam
  paperDuration?: number; // Exam duration in minutes
  startTime?: Date; // When student started the exam
  submitTime?: Date; // When student submitted the exam
  endOn?: Date; // Exam end time
  questionsCount?: number; // Total number of questions in the exam
  examStatus?:
  | "Draft"
  | "Unpublished"
  | "Published"
  | "Released"
  | "In Progress"
  | "Completed"
  | "Cancelled";
  releaseDate?: Date | null; // When the exam was released (null if not released)
}

export interface StartedExamResponse extends PerformedExamResponse {
  durationInMinutes: number;
  questionsCount: number;
  totalMarks: number;
}

export interface StudentExamStatisticsResponse {
  success: boolean;
  message: string;
  data: {
    totalExams: number;
    openedExams: number;
    performedExams: number;
    scheduledExams: number;
    expiredExams: number;
  };
}

export interface StudentExamDashboardResponse {
  success: boolean;
  message: string;
  data: {
    upcomingExams: StudentExamResponse[];
    recentExams: StudentExamResponse[];
    examStatistics: {
      totalExams: number;
      completedExams: number;
      averageScore?: number;
      totalAttempts: number;
    };
  };
}

export interface GetCurrentClassStatsResponse {
  success: boolean;
  message: string;
  data: {
    totalCompletedExams: number;
    officialExamsCount: number;
    practiceExamsCount: number;
  };
}

export interface GetSubjectStatsRequest {
  examType?: "Official" | "Practice" | "Exam Repository" | "all";
}

export interface GetSubjectStatsResponse {
  success: boolean;
  message: string;
  data: Array<{
    subjectId: string;
    subjectName: string;
    averagePercentage: number;
    grade: string;
    totalExams: number;
    completedExams: number;
  }>;
}

export interface GetRecentResultsResponse {
  success: boolean;
  message: string;
  data: Array<{
    examId: string;
    examTitle: string;
    examType: "Official" | "Practice" | "Exam Repository";
    subjectId: string;
    subjectName: string;
    percentage: number;
    grade?: string;
    isFirstTime: boolean;
    completedAt: Date;
  }>;
}

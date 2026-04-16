/**
 * Student Dashboard Types - Dashboard overview for students
 */

// Dashboard Overview Response
export interface StudentDashboardResponse {
  upcomingExams: UpcomingExam[];
  recentResults: RecentResult[];
  statistics: DashboardStatistics;
  notifications: DashboardNotification[];
}

// Upcoming Exam
export interface UpcomingExam {
  examId: string;
  examTitle: string;
  examType: string;
  subjectName: string;
  scheduledStartDate: Date;
  scheduledEndDate: Date;
  durationInMinutes: number;
  totalMarks: number;
  attemptNumber: number;
  attemptsLeft: number;
  isAssigned: boolean;
}

// Recent Result
export interface RecentResult {
  examId: string;
  examTitle: string;
  examType: string;
  submittedAt: Date;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: string;
  grade?: string;
  classRank?: number;
}

// Dashboard Statistics
export interface DashboardStatistics {
  totalExamsAssigned: number;
  totalExamsTaken: number;
  totalExamsPending: number;
  averagePercentage: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
  currentRank: number;
  totalStudents: number;
}

// Dashboard Notification
export interface DashboardNotification {
  id: string;
  type: 'exam_assigned' | 'result_published' | 'exam_reminder' | 'rank_update';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  isRead: boolean;
  createdAt: Date;
  relatedExamId?: string;
}

// Get Upcoming Exams Request
export interface GetUpcomingExamsRequest {
  pageNo?: number;
  pageSize?: number;
  subjectId?: string;
  examType?: string;
}

// Get Upcoming Exams Response
export interface GetUpcomingExamsResponse {
  exams: UpcomingExam[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Top Student Item
export interface TopStudentItem {
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  className: string;
  subjectName?: string;
  rank: number;
  overallScore: number; // percentage
  totalStudentsInClass: number;
}

// Get Top Students Response
export interface GetTopStudentsResponse {
  students: TopStudentItem[];
}


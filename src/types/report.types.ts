export interface MonthlyProgressSummary {
  totalStudyTime: number; // in minutes
  completedLessons: number;
  quizzesTaken: number;
  averageScore: number;
  month: string; // e.g., "November 2023"
}

export interface ActivityDataPoint {
  date: string; // ISO date string
  studyTime: number; // in minutes
  quizScore?: number; // percentage, 0-100
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  activityType: 'lesson' | 'quiz' | 'assignment' | 'exam';
  title: string;
  subject: string;
  duration?: number; // in minutes, for study sessions
  score?: number; // percentage, 0-100, for quizzes/exams
}

export interface SubjectProgress {
  subjectId: string;
  subjectName: string;
  progress: number; // 0-100
  lastActivity: string; // ISO date string
}

export interface StudentProgressReport {
  summary: MonthlyProgressSummary;
  activityOverview: ActivityDataPoint[];
  recentActivities: RecentActivity[];
  subjectProgress: SubjectProgress[];
}

// Request types
export interface GetProgressReportRequest {
  studentId: string;
  month?: number; // 1-12
  year?: number; // e.g., 2023
}

export interface GetComprehensiveReportRequest {
  studentId: string;
  tenantId: string;
  classId?: string;
  subjectId?: string;
  requestingUserId?: string;
  examId?: string;
}

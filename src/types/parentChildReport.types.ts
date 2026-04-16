export interface RankInfo {
  rank: number;
  totalStudents: number;
  percentile: string;
}

export interface StrongestSubject {
  rank: number;
  subjectName: string;
  subjectRank: string;
  trend: "up" | "down" | "stable";
}

export interface GetChildReportRequest {
  parentId: string;
  childId: string;
  tenantId: string;
  semester?: string;      // "fall_2024", "spring_2025"
  startDate?: string;     // "2024-08-01"
  endDate?: string;       // "2024-12-31"
}

export interface ChildReportResponse {
  childId: string;
  childName: string;
  className: string;
  overallPercentage: number;
  achievements: number;
  rankings: {
    classRanking: RankInfo;
    schoolRanking: RankInfo;
  };
  strongestSubjects: StrongestSubject[];
}

// Performance Details Types
export interface MonthlyScore {
  month: string;
  score: number | null;
}

export interface SubjectTrend {
  subjectId: string;
  subjectName: string;
  color: string;
  monthlyScores: MonthlyScore[];
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  letterGrade: string;
  score: number;
  classRank: string;
  teacher: {
    teacherId: string;
    teacherName: string;
  } | null;
  feedback: string | null;
  feedbackDate: Date | null;
}

export interface GetChildPerformanceDetailsRequest {
  parentId: string;
  childId: string;
  tenantId: string;
  classId: string;
  year?: number;
  semester?: string;      // "fall_2024", "spring_2025"
  startDate?: string;     // "2024-08-01"
  endDate?: string;       // "2024-12-31"
}

export interface ChildPerformanceDetailsResponse {
  childId: string;
  childName: string;
  className: string;
  year: number;
  performanceTrends: SubjectTrend[];
  performanceSummary: SubjectPerformance[];
}

// Semester Types
export interface SemesterInfo {
  value: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface GetChildSemestersRequest {
  parentId: string;
  childId: string;
}

export interface ChildSemestersResponse {
  childId: string;
  childName: string;
  admissionDate: string;
  semesters: SemesterInfo[];
}

// Child Subject Details Types
export interface GetChildSubjectDetailsRequest {
  parentId: string;
  childId: string;
  subjectId: string;
  tenantId: string;
  classId?: string; // Optional - auto-fetched from student data if not provided
}

export interface GetChildSubjectPerformanceScoreRequest extends GetChildSubjectDetailsRequest {
  months?: number; // 3, 6, or 12 months for performance graph
}

export interface SubjectDetailsSummary {
  currentGrade: string;
  currentScore: number;
  classAverage: number;
  classRank: number;
  totalStudents: number;
  assessmentsCount: number;
}

export interface PerformanceDataPoint {
  month: string;
  studentScore: number | null;
  classAverage: number | null;
}

export interface ExamResult {
  examId: string;
  attemptId: string;
  examType: string;
  examMode: string;
  grade: string | null;
  examDate: string;
  examTitle: string;
  classAverage: number;
  rank: string;
  feedback: string | null;
  score: number;
  maxScore: number;
  topics: string[];
}

export interface TeacherFeedbackItem {
  feedbackId: string;
  teacherId: string;
  teacherName: string;
  feedbackType: string;
  date: string;
  teacherFeedback: string;
  aiFeedback: string;
}

export interface ChildSubjectDetailsResponse {
  subjectId: string;
  subjectName: string;
  childId: string;
  childName: string;
  className: string;
  gradeLevel: string;
  summary: SubjectDetailsSummary;
  examResults: ExamResult[];
  teacherFeedback: TeacherFeedbackItem[];
}

export interface ChildSubjectPerformanceScoreResponse {
  performanceOverTime: PerformanceDataPoint[];
}

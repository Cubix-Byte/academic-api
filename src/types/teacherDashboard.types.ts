/**
 * Teacher Dashboard Types - Dashboard data for teachers
 */

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

// Get Top Students Request
export interface GetTopStudentsRequest {
  month?: number; // 1-12
  year?: number;
  classId?: string;
  subjectId?: string;
  rankType?: 'Class Rank' | 'Subject Rank' | 'Overall Rank';
  pageNo?: number;
  pageSize?: number;
}

// Get Top Students Response
export interface GetTopStudentsResponse {
  students: TopStudentItem[];
  pagination?: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Class Analytics Topic Performance
export interface TopicPerformance {
  topicName: string;
  score: number; // 0-100
  maxScore: number;
  description?: string;
}

// Get Class Analytics Request
export interface GetClassAnalyticsRequest {
  classId: string;
  subjectId: string;
  viewAs?: 'Radar chart' | 'Bar chart' | 'Table';
}

// Get Class Analytics Response
export interface GetClassAnalyticsResponse {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  topics: TopicPerformance[];
  overallAverage: number;
  totalStudents: number;
}

// Student Activity Item
export interface StudentActivityItem {
  activityId: string;
  studentId: string;
  studentName: string;
  activityType: 'ExamCompleted' | 'PracticeCompleted' | 'BadgeEarned' | 'CertificateEarned';
  activityDescription: string;
  logDate: Date;
  relativeTime: string; // e.g., "1h ago", "1day ago", "1w ago"
  relatedEntityId?: string;
  relatedEntityType?: string;
}

// Get Student Activity Request
export interface GetStudentActivityRequest {
  month?: number; // 1-12
  year?: number;
  classId?: string;
  subjectId?: string;
  activityType?: string;
  pageNo?: number;
  pageSize?: number;
}

// Get Student Activity Response
export interface GetStudentActivityResponse {
  activities: StudentActivityItem[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Get Teacher Students Activities Request (new endpoint - only teacherId, no classId/subjectId)
export interface GetTeacherStudentsActivitiesRequest {
  month?: number; // 1-12
  year?: number;
  activityType?: string;
  pageNo?: number;
  pageSize?: number;
}

// Get Teacher Students Activities Response
export interface GetTeacherStudentsActivitiesResponse {
  activities: StudentActivityItem[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------
// New Analytics Types
// ----------------------------------------------------------------------

// Get Class Monthly Trends Request
export interface GetClassMonthlyTrendsRequest {
  classId: string;
  subjectId: string;
}

// Get Class Monthly Trends Response
export interface GetClassMonthlyTrendsResponse {
  success: boolean;
  message: string;
  data: Array<{
    month: string; // Month label (e.g., "Jan", "Feb", "Mar")
    score: number; // Class average score for that month (0-100)
    classAvg?: number; // Overall school or subject average for comparison
    topScore: number; // Highest individual score achieved in the class that month
  }>;
}

// Get Question Type Performance Request
export interface GetQuestionTypePerformanceRequest {
  classId: string;
  subjectId: string;
}

// Get Question Type Performance Response
export interface GetQuestionTypePerformanceResponse {
  success: boolean;
  message: string;
  data: {
    questionTypes: Array<{
      questionType: string; // e.g., "MCQs", "Fill in the Blanks", "True/False", "Short Answers", "Long Answers"
      totalQuestions: number; // Total questions of this type attempted
      correctAnswers: number; // Total correct answers for this type
      percentage: number; // Overall performance percentage (0-100)
    }>;
  };
}

// Get Class Exam Time Analysis Request
export interface GetClassExamTimeAnalysisRequest {
  classId: string;
  subjectId: string;
}

// Get Class Exam Time Analysis Response
export interface GetClassExamTimeAnalysisResponse {
  success: boolean;
  message: string;
  data: {
    avgTimePerExam: number; // Average time spent per exam in seconds
    avgTimePerQuestion: number; // Average time spent per question in seconds
    totalTimeSpent: number; // Cumulative time spent by all students in seconds
  };
}

// Get Class Score Distribution Request
export interface GetClassScoreDistributionRequest {
  classId: string;
  subjectId: string;
}

// Get Class Score Distribution Response
export interface GetClassScoreDistributionResponse {
  success: boolean;
  message: string;
  data: Array<{
    range: string; // e.g., "0-20%", "21-40%", "41-60%", "61-80%", "81-100%"
    count: number; // Number of students in this range
  }>;
}


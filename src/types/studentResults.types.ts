/**
 * Student Results Types - Student exam results and analytics
 */

// Get Exam Result Request
export interface GetExamResultRequest {
  examId: string;
}

// Exam Result Response
export interface ExamResultResponse {
  examId: string;
  examTitle: string;
  examType: string;
  attemptId: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt: Date;
  examStartTime: Date;
  examEndTime: Date;
  examDuration: number;
  timeTaken: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  result: string;
  grade?: string;
  classRank?: number;
  totalStudents: number;
  passPercentage: number;
  averageMarks: number;
  answers: Array<{
    questionNumber: number;
    questionType: string;
    questionText: string;
    studentAnswer: string | string[];
    correctAnswer: string | string[];
    isCorrect?: boolean;
    marksObtained: number;
    maxMarks: number;
    feedback?: string;
    // AI Grading fields
    aiGradingNotes?: string;
    aiConfidence?: number;
    aiFeedback?: string;
    aiMarksObtained?: number;
    gradedBy?: "manual" | "ai" | "hybrid";
    aiGradedAt?: Date;
  }>;
  // AI Data from attempt
  aiData?: {
    overallFeedback?: string;
    gapAnalysis?: string;
    weakTopics?: Array<{
      topic: string;
      performance: number;
      suggestions: string;
    }>;
  };
  // AI Data from examStudent
  aiPrompts?: Array<{
    prompt: string;
    createdBy: string;
    createdAt: Date;
  }>;
  recommendedResources?: Array<{
    title: string;
    url: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
  }>;
}

// Get Results History Request
export interface GetResultsHistoryRequest {
  pageNo?: number;
  pageSize?: number;
  examType?: string;
  result?: string; // Pass, Fail
  sortBy?: "submittedAt" | "percentage";
  sortOrder?: "asc" | "desc";
}

// Result History Item
export interface ResultHistoryItem {
  examId: string;
  examTitle: string;
  examType: string;
  attemptId: string;
  submittedAt: Date;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  result: string;
  grade?: string;
  classRank?: number;
}

// Get Results History Response
export interface GetResultsHistoryResponse {
  results: ResultHistoryItem[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Student Performance Analytics
export interface StudentPerformanceAnalytics {
  totalExamsTaken: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalTimeSpent: number;
  performanceTrend: Array<{
    examTitle: string;
    percentage: number;
    submittedAt: Date;
  }>;
  strengthAreas: string[];
  improvementAreas: string[];
}

// Subject-wise Performance
export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  examsTaken: number;
  averagePercentage: number;
  highestScore: number;
  lowestScore: number;
  totalMarks: number;
  obtainedMarks: number;
  passCount: number;
  failCount: number;
}

// Subject-wise Analytics Response
export interface SubjectWiseAnalyticsResponse {
  subjects: SubjectPerformance[];
  overallPerformance: {
    totalExams: number;
    averagePercentage: number;
    bestSubject: string;
    needsImprovement: string;
  };
}

// Class Ranking
export interface ClassRankingResponse {
  studentId: string;
  currentRank: number;
  totalStudents: number;
  percentile: number;
  averagePercentage: number;
  classAverage: number;
  pointsAboveAverage: number;
  topPerformers: Array<{
    rank: number;
    studentName: string;
    averagePercentage: number;
  }>;
  nearbyRanks: Array<{
    rank: number;
    studentName: string;
    averagePercentage: number;
  }>;
}

// Progress Tracking
export interface ProgressTrackingResponse {
  currentMonth: {
    examsTaken: number;
    averagePercentage: number;
    passRate: number;
  };
  lastMonth: {
    examsTaken: number;
    averagePercentage: number;
    passRate: number;
  };
  improvement: {
    examsChange: number;
    percentageChange: number;
    passRateChange: number;
  };
  monthlyTrend: Array<{
    month: string;
    examsTaken: number;
    averagePercentage: number;
    passRate: number;
  }>;
}

// Peer Comparison
export interface PeerComparisonResponse {
  student: {
    averagePercentage: number;
    totalExams: number;
    rank: number;
  };
  classAverage: {
    averagePercentage: number;
    totalExams: number;
  };
  comparison: {
    percentageDifference: number;
    examsDifference: number;
    performanceBetter: boolean;
  };
  distribution: Array<{
    range: string;
    count: number;
    studentInRange: boolean;
  }>;
}

// Exam Comparison Request
export interface ExamComparisonRequest {
  examIds: string[];
}

// Exam Comparison Response
export interface ExamComparisonResponse {
  exams: Array<{
    examId: string;
    examTitle: string;
    percentage: number;
    rank: number;
    result: string;
    submittedAt: Date;
  }>;
  analysis: {
    bestPerformance: string;
    worstPerformance: string;
    averageImprovement: number;
    consistencyScore: number;
  };
}

// Detailed Result Request
export interface GetDetailedResultRequest {
  attemptId: string;
}

// Detailed Result Response
export interface DetailedResultResponse {
  attempt: {
    attemptId?: string;
    feAttemptId?: string;
    examTitle: string;
    examType: string;
    examStartTime: Date;
    examEndTime: Date;
    examDuration: number;
    startedAt?: Date;
    submittedAt: Date;
    timeTaken: number;
    subjectName?: string;
    className?: string;
    teacherName?: string;
  };
  marks: {
    obtainedMarks: number;
    totalMarks: number;
    percentage: number;
    result: string;
    grade?: string;
  };
  ranking?: {
    classRank?: number;
    totalStudents: number;
    percentile: number;
  };
  questionAnalysis: {
    totalQuestions: number;
    correct: number;
    incorrect: number;
    unanswered?: number;
    partiallyCorrect?: number;
  };
  typeWisePerformance?: Array<{
    questionType: string;
    totalQuestions: number;
    correct: number;
    percentage: number;
  }>;
  difficultyWisePerformance: Array<{
    difficulty: string;
    totalQuestions: number;
    correct: number;
    percentage: number;
  }>;
  timeAnalysis: {
    totalTime: number;
    averageTimePerQuestion?: number;
    fastestAnswer?: number;
    slowestAnswer?: number;
  };
  recommendations?: string[];
  // AI Data from attempt
  aiData?: {
    overallFeedback?: string;
    gapAnalysis?: string;
    weakTopics?: Array<{
      topic: string;
      performance: number;
      suggestions: string;
    }>;
  };
  // AI Data from examStudent
  aiPrompts?: Array<{
    prompt: string;
    createdBy: string;
    createdAt: Date;
  }>;
  recommendedResources?: Array<{
    title: string;
    url: string;
    description?: string;
    createdBy: string;
    createdAt: Date;
  }>;
  // Additional fields for full grading payload compatibility
  teacherFeedback?: string;
  overallFeedback?: string;
  aiFeedback?: string;
  aiPrompt?: string[];
  gapAnalysis?: string;
  weakTopics?: Array<{
    topic: string;
    performance: number;
    suggestions: string;
  }>;
  answers?: Array<{
    questionNumber: number;
    questionType: string;
    questionText: string;
    studentAnswer: string | string[];
    correctAnswer: string | string[];
    isCorrect?: boolean;
    marksObtained: number;
    maxMarks: number;
    feedback?: string;
    teacherComment?: string;
    aiGradingNotes?: string;
    aiConfidence?: number;
    aiFeedback?: string;
    aiMarksObtained?: number;
    gradedBy?: "manual" | "ai" | "hybrid";
    aiGradedAt?: Date;
  }>;
}

// Get Month-wise Ranking Request
export interface GetMonthWiseRankingRequest {
  studentId: string;
  subjectId?: string;
  classId?: string;
}

// Month Ranking Data
export interface MonthRankingData {
  month: string; // "Jan", "Feb", etc.
  year: number;
  rank: number | null; // null if no exams in that month
  totalStudents: number;
  averagePercentage: number;
}

// Month-wise Ranking Response
export interface MonthWiseRankingResponse {
  studentId: string;
  classId: string;
  subjectId?: string;
  currentRank: number | null;
  previousRank: number | null;
  totalStudents: number;
  monthlyRankings: MonthRankingData[];
}

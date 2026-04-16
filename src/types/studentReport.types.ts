export interface ApiResponse {
  students: StudentData[];
}

export interface StudentData {
  id: string; // "0", "1", "2"
  name: string;
  grade: string;
  className?: string; // Optional for subject reports
  subjectName?: string; // Only for subject-specific reports
  stdId: string;
  rollNumber: string;
  overall: OverallStats;
  performanceTrend: MonthlyTrend[];
  aiInsights: AIInsights;
  timeAnalysis: Record<string, TimeMetrics>; // Keys: 'all', 'math', 'science', etc.
  questionTypePerformance: Record<string, QuestionPerformance[]>;
  peerDistribution: Record<string, PeerDistribution[]>;
  subjects?: SubjectDetail[]; // For comprehensive reports
  exams?: ExamDetail[]; // For subject-specific reports
}

export interface OverallStats {
  percentage: number;
  grade: string;
  classRank?: number; // For comprehensive reports
  subjectRank?: number; // For subject-specific reports
  totalStudents: number;
  percentile: number;
  totalExamsTaken: number;
  passRate: number;

  achievements?: {
    total: number;
    badges: number;
    certificates: number;
    awards: number;
  };
}

export interface MonthlyTrend {
  month: string;
  score: number;
  classAvg: number;
  topScore: number;
  percentile: number;
}

export interface AIInsights {
  overallFeedback: string;
  teacherRecommendation: string;
  gapAnalysisData: TopicPerformance[] | { subject: string; score: number; classAvg: number }[];
  cognitiveAbilities: { skill: string; score: number }[];
  strongAreas: string[];
  weakTopics: { topic: string; performance: number; suggestions: string }[];
  
  // Lists based on Thresholds (>80, 50-80, <50)
  strongSubjects?: { subject: string; score: number; points: string[] }[];
  weakSubjects?: { subject: string; score: number; points: string[] }[];
  averageSubjects?: { subject: string; score: number; points: string[] }[];

  strongTopics?: { topic: string; score: number; points: string[] }[]; // List version
  averageTopics?: { topic: string; score: number; points: string[] }[]; // List version
  weakTopicsList?: { topic: string; score: number; points: string[] }[]; // List version (distinct from existing weakTopics structure)

  strongestSubject?: { subject: string; score: number; points: string[] };
  weakestSubject?: { subject: string; score: number; points: string[] };
  strongestTopic?: { topic: string; score: number; points: string[] };
  weakestTopic?: { topic: string; score: number; points: string[] };
}

export interface TimeMetrics {
  averageTimePerExam: number; // In seconds
  averageTimePerQuestion: number; // In seconds
  totalTimeSpent: number; // In seconds
  efficiency: number;
  timeComparison: { student: number; classAverage: number; recommended: number }; // All in seconds
}

export interface QuestionPerformance {
  type: string;
  percentage: number;
  correct: number;
  total: number;
}

export interface PeerDistribution {
  range: string;
  count: number;
  isStudentBucket: boolean;
}

export interface SubjectDetail {
  id: string;
  name: string;
  score: number;
  grade: string;
  classRank: number;
  totalStudents: number; // Added for Rank Context (Ref: 2/5)
  percentile: number;
  trend: string;
  feedback: string;
  aiFeedback: string;
  classAverage?: number; // Added for Gap Analysis
  weakTopics: string[];
  strongTopics: string[];
  exams: { topic: string; score: number; date: string | Date; teacherFeedback?: string | null }[];
  monthlyPerformance: MonthlyTrend[];
}

export interface ExamDetail {
  id: string;
  examTitle: string;
  score: number;
  percentage: number;
  grade: string;
  totalMarks: number;
  obtainedMarks: number;
  rank: number;
  totalStudents: number;
  percentile: number;
  date: Date;
  timeTaken: number; // in seconds
  topics: string[]; // Topics covered in this exam
  topicBreakdown?: {
    topic: string;
    percentage: number; // Student's score on this topic (was structural percentage)
    weightage: number; // Original weightage of topic in exam
    questionCount: number;
    totalMarks: number;
  }[];
  teacherFeedback?: string | null; // Feedback from teacher on this specific attempt
  aiPerExamFeedback?: string | null; // Per-exam AI feedback from grading (overallAssessment from ExamAttempt)
  classAverage?: number; // Class average score for this exam
}

export interface TopicPerformance {
  topic: string;
  score: number;
  classAvg: number;
}

/**
 * Parent Dashboard Types
 * Types for parent dashboard exam results, academic reports, and all filters
 */

// ============ EXAM RESULTS TYPES ============

export interface ExamResultItem {
  examId: string;
  examTitle: string;
  examType: 'Official' | 'Practice' | 'Exam Repository';
  subject: string;
  subjectId: string;
  date: Date;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  result: 'Pass' | 'Fail' | 'Pending';
  classRank?: number;
  totalStudentsInClass?: number;
  aiSuggestion?: string;
}

export interface GetChildExamResultsRequest {
  childId: string;
  examType?: 'Official' | 'Practice' | 'Exam Repository';
  subject?: string;
  month?: number; // 1-12
  year?: number;
  result?: 'Pass' | 'Fail';
  pageNo?: number;
  pageSize?: number;
  sortBy?: 'date' | 'percentage' | 'subject';
  sortOrder?: 'asc' | 'desc';
}

export interface ExamResultsResponse {
  results: ExamResultItem[];
  filters: {
    examTypes: string[];
    subjects: string[];
    months: number[];
    years: number[];
  };
  summary: {
    totalExams: number;
    passedExams: number;
    failedExams: number;
    averagePercentage: number;
    highestScore: number;
    lowestScore: number;
  };
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============ ACADEMIC REPORT TYPES ============

export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  grade: string;
  percentage: number;
  progressBar: number;
}

export interface AcademicReportSummary {
  childId: string;
  childName: string;
  reportType: 'Final Grade Report' | 'Monthly Progress Report' | 'Semester Report' | 'Exam Result Report';
  generatedDate: Date;
  academicYear: string;
  semester?: string;
  month?: string;
  overallGrade: string;
  overallPercentage: number;
  englishGrade: string;
  englishPercentage: number;
  socialStudiesGrade: string;
  socialStudiesPercentage: number;
  mathGrade: string;
  mathPercentage: number;
  scienceGrade?: string;
  sciencePercentage?: number;
  otherSubjects?: SubjectGrade[];
  status: string;
}

export interface AvailableReport {
  id: string;
  title: string;
  reportType: string;
  generatedDate: Date;
  subject?: string;
  tags?: string[];
  teacher?: string;
}

export interface GetChildAcademicReportsRequest {
  childId: string;
  reportType?: 'All' | 'Final Grade Report' | 'Monthly Progress Report' | 'Semester Report' | 'Exam Result Report';
  subject?: string;
  fromDate?: Date;
  toDate?: Date;
  year?: number;
  pageNo?: number;
  pageSize?: number;
  sortBy?: 'generatedDate' | 'reportType';
  sortOrder?: 'asc' | 'desc';
}

export interface AcademicReportsResponse {
  currentReport: AcademicReportSummary;
  availableReports: AvailableReport[];
  filters: {
    reportTypes: string[];
    subjects: string[];
    teachers: string[];
    years: number[];
  };
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============ CHILD SELECTION TYPES ============

export interface ChildInfo {
  childId: string;
  firstName: string;
  lastName: string;
  email: string;
  rollNumber: string;
  className: string;
  classGrade: number; // Added for numeric grade level
  classId: string;
  classTeacher: string;
  session?: string; // Added for academic session
  photo: string;
  rank: number;
  rankDirection: "up" | "down";
  totalStudents: number;
  tenantName: string;
  badgesCount: number;
  grade: string;
  avgGrade: string;
  nextExam?: {
    examId: string;
    examTitle: string;
    subject: string;
    subjectId: string;
    startOn: Date;
    endOn: Date;
    durationInMinutes: number;
    totalMarks: number;
  };
  studentWallet?: {
    balance: number;
    totalCreditsPurchased: number;
    totalCreditsUsed: number;
    lastTopupDate?: Date;
  };
}

export interface GetParentChildrenRequest {
  parentId: string;
  status?: 'active' | 'all';
}

export interface ParentChildrenResponse {
  children: ChildInfo[];
  totalChildren: number;
}

// ============ PARENT DASHBOARD OVERVIEW ============

export interface ChildPerformanceSummary {
  childId: string;
  childName: string;
  totalExams: number;
  passedExams: number;
  failedExams: number;
  averagePercentage: number;
  currentGrade: string;
  trends: {
    isImproving: boolean;
    percentageChange: number;
  };
}

export interface ParentDashboardOverview {
  children: ChildPerformanceSummary[];
  recentExams: ExamResultItem[];
  notifications?: string[];
  upcomingExams?: {
    examId: string;
    examTitle: string;
    date: Date;
    subject: string;
  }[];
}

// ============ FILTER OPTIONS TYPES ============

export interface FilterOptions {
  examTypes: {
    value: string;
    label: string;
    count: number;
  }[];
  subjects: {
    value: string;
    label: string;
    count: number;
  }[];
  months: {
    value: number;
    label: string;
    count: number;
  }[];
  years: {
    value: number;
    label: string;
  }[];
  teachers: {
    value: string;
    label: string;
  }[];
  reportTypes: {
    value: string;
    label: string;
  }[];
}

// ============ AI SUGGESTION TYPES ============

export interface AISuggestion {
  examId: string;
  studentId: string;
  suggestion: string;
  recommendedResources?: {
    title: string;
    subject: string;
    resourceType: string;
  }[];
  strengthAreas?: string[];
  improvementAreas?: string[];
}

// ============ COMPARATIVE ANALYSIS ============

export interface ComparisonMetric {
  metric: string;
  studentValue: number;
  classAverage: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ChildPerformanceComparison {
  childId: string;
  childName: string;
  comparisons: ComparisonMetric[];
  classRank: number;
  totalStudents: number;
}

// ============ CHILDREN ACTIVITIES TYPES ============

export interface ChildActivityItem {
  activityId: string;
  childId: string;
  childName: string;
  childPhoto: string;
  activityType: string;
  activityDescription: string;
  relatedEntityId: string;
  relatedEntityType: string;
  title?: string;
  score?: number;
  duration?: number;
  createdAt: Date;

  // Extra fields for rich data
  subjectId?: string;
  subjectName?: string;
  obtainedMarks?: number;
  percentage?: number;
  grade?: string;
  classRank?: number;
  totalStudentsInClass?: number;
  rankLabel?: string;
  result?: string;
  totalMarks?: number;

  // Badge fields
  badgeName?: string;
  badgeType?: string;
  tier?: string;
  icon?: string;
  description?: string; // Generic description field which can be used for Badge description

  // Certificate/Credential fields
  credentialName?: string;
  credentialType?: string;
  issuedDate?: Date;
  verificationCode?: string;
  examType?: string; // Type of the exam (e.g., Official, Practice)
  examTitle?: string;
  examModeName?: string; // Name of the exam mode (e.g., MCQs, Flashcards)
}

export interface GetChildrenActivitiesRequest {
  parentId: string;
  activityType?: string;
  tab?: string; // Tab name from frontend (e.g., 'all', 'examScores', etc.)
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  childId?: string;
}

export interface ChildrenActivitiesResponse {
  activities: ChildActivityItem[];
  pagination: {
    total: number;
    limit: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
  };
}

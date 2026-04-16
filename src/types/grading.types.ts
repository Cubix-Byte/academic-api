import { IExam } from "../models/exam.schema";
import { IExamStudent } from "../models/examStudent.schema";
import { IExamAttempt } from "../models/examAttempt.schema";

/**
 * Grading Types - Teacher grading interfaces
 */

// Grading List Request
export interface GetGradingListRequest {
  pageNo?: number;
  pageSize?: number;
  gradingTypeStatus?:
  | "Waiting for Grading"
  | "In Progress"
  | "Completed"
  | "all";
  sortBy?: "endOn" | "examTitle" | "createdAt";
  sortOrder?: "asc" | "desc";
  search?: string;
  classId?: string;
  class?: string;
  subjectId?: string;
  batchId?: string; // Filter by batch
  examModeId?: string; // Filter by exam mode
  clientTime?: string; // ISO date string from client side
}

// Grading List Item
export interface GradingListItem {
  examId: string;
  examTitle: string;
  examType: string;
  totalMarks: number;
  durationInMinutes?: number;
  startOn: Date;
  endOn: Date;
  gradingTypeStatus: "Waiting for Grading" | "In Progress" | "Completed";
  totalStudents: number;
  studentsCompleted: number;
  studentsStarted: number;
  studentsNotAttempted: number;
  numQuestions?: number;
  questionTypes?: string[];
  className: string;
  subjectName: string;
  batchName: string;
  createdAt: Date;
  examSubmissions: number;
  gradedExams: number;
  gradingProgress: number;
}

// Grading List Response
export interface GetGradingListResponse {
  success: boolean;
  message: string;
  data: {
    exams: GradingListItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalExams: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    filters: {
      gradingTypeStatus?: string;
      classId?: string;
      class?: string;
      subjectId?: string;
    };
  };
}

// Student Performance in Exam
export interface StudentPerformance {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  attemptId?: string;
  score?: number;
  percentage?: number;
  grade?: string;
  status: "Waiting for Grading" | "In Progress" | "Completed" | "Pending" | "Expired";
  hasAttempted: boolean; // Indicates if student has attempted the exam
  submittedAt?: Date;
  timeTaken?: number;
  questionsGraded?: number;
  questionsPending?: number;
}

// Exam Grading Details Response
export interface GetExamGradingDetailsResponse {
  success: boolean;
  message: string;
  data: {
    exam: {
      examId: string;
      examTitle: string;
      description: string;
      examType: string;
      totalMarks: number;
      durationInMinutes: number;
      numQuestions?: number;
      questionTypes?: string[];
      startOn: Date;
      endOn: Date;
      gradingTypeStatus: string;
      releasedAt: Date | undefined;
      className: string;
      subjectName: string;
      batchName: string;
    };
    statistics: {
      totalStudents: number;
      studentsCompleted: number;
      studentsStarted: number;
      studentsNotAttempted: number;
      passRate: number;
      averageScore: number;
      highestScore: number;
      lowestScore: number;
    };
    questions: Array<{
      questionId: string;
      questionNumber: number;
      questionType: string;
      questionText: string;
      questionContent?: string[];
      imageUrl?: string;
      videoUrl?: string;
      options?: Array<{
        optionId: string;
        optionText: string;
        isCorrect: boolean;
        optionContent?: string[];
      }>;
      correctAnswer: string | string[];
      explanation?: string;
      marks: number;
      averageMarksObtained: number;
      averageMarksPercentage: number;
      correctPercentage: number; // percentage of students who answered correctly
      averageCorrectPercentage?: number; // from question doc if available
    }>;
    students: StudentPerformance[];
  };
}

// Question Answer for Grading
export interface QuestionAnswerForGrading {
  questionId: string;
  questionNumber: number;
  questionType: string;
  questionText: string;
  marks: number;
  correctAnswer: string | string[];
  studentAnswer: string | string[];
  isCorrect?: boolean;
  marksObtained?: number;
  teacherComment?: string;
  options?: Array<{
    optionId: string;
    optionText: string;
    isCorrect: boolean;
    optionContent?: string[];
  }>;
  // AI Grading fields
  aiGradingNotes?: string;
  aiConfidence?: number;
  aiFeedback?: string;
  aiMarksObtained?: number;
  gradedBy?: "manual" | "ai" | "hybrid";
  aiGradedAt?: Date;
}

// Get Student Answers Request
export interface GetStudentAnswersRequest {
  examId: string;
  studentId: string;
}

// AI Grading Request Data (for direct frontend API calls)
export interface AIGradingRequestData {
  feAttemptId: string;
  ai_examId: string;
  feStudentId: string;
  questions: Array<{
    questionId: string;
    questionText: string;
    correctAnswer?: string | string[];
    explanation?: string;
    studentAnswer: string | string[];
    questionType: string;
    maxMarks: number;
    difficulty?: string;
    topic: string;
  }>;
  topicBreakdown: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
}

// Get Student Answers Response
export interface GetStudentAnswersResponse {
  success: boolean;
  message: string;
  data: {
    attemptId: string;
    studentId: string;
    studentName: string;
    examId: string;
    examTitle: string;
    totalMarks: number;
    submittedAt?: Date;
    timeTaken?: number;
    questionsGraded?: number;
    questionsPending?: number;
    questions: QuestionAnswerForGrading[];
    // AI Grading data for direct API calls (only included if exam has aiExamId)
    aiGradingData?: AIGradingRequestData;
    // Attempt-level AI data
    aiFeedback?: string;
    teacherFeedback?: string;
    overallFeedback?: string;
    grade?: string;
    percentage?: number;
    result?: string;
    gapAnalysis?: string;
    weakTopics?: Array<{
      topic: string;
      performance: number;
      suggestions: string;
    }>;
  };
}

// Grade Answer Item - Merged format with both teacher and AI data
export interface GradeAnswerItem {
  questionId: string;
  // Teacher data
  marksObtained?: number;
  teacherComment?: string;
  feedback?: string;
  // AI Grading fields (merged into same object)
  aiGradingNotes?: string;
  aiConfidence?: number;
  aiFeedback?: string;
  aiMarksObtained?: number;
  isCorrect?: boolean; // Can come from AI or be set by teacher
}

// Submit Grading Request
export interface SubmitGradingRequest {
  examId: string;
  studentId: string;
  attemptId: string;
  answers: GradeAnswerItem[];
  feedback?: string;
  teacherFeedback?: string; // Alias for feedback
  aiPrompt?: string;
  recommendedResources?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
  // AI Grading analysis fields
  overallFeedback?: string;
  aiFeedback?: string; // Alias for overallFeedback
  gapAnalysis?: string;
  weakTopics?: Array<{
    topic: string;
    performance: number;
    suggestions: string;
  }>;
  // AI Response - stores the entire AI grading response (mixed type)
  aiResponse?: any;
}

// Submit Grading Response
export interface SubmitGradingResponse {
  success: boolean;
  message: string;
  data: {
    attemptId: string;
    studentId: string;
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
    grade: string;
    result: "Pass" | "Fail";
    gradingCompletedAt: Date;
  };
}

// Grading System Interface
export interface IGradingSystem {
  systemName: string;
  description: string;
  gradeRanges: Array<{
    grade: string;
    minPercentage: number;
    maxPercentage: number;
    remarks: string;
  }>;
  isActive: boolean;
  tenantId: string;
  createdBy: string;
  createdDate: Date;
}

// Old Grading System Types (for backward compatibility)
export interface GetPendingSubmissionsRequest {
  pageNo?: number;
  pageSize?: number;
  examId?: string;
  tenantId?: string;
}

export interface ManualGradeAttemptRequest {
  attemptId: string;
  answers: Array<{
    answerId: string;
    marksObtained: number;
    feedback?: string;
  }>;
}

export interface UpdateMarksRequest {
  attemptId: string;
  answerId: string;
  marksObtained: number;
  feedback?: string;
}

export interface BulkGradeRequest {
  attemptIds: string[];
  examId: string;
}

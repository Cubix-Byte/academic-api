import { Types as MongooseTypes } from 'mongoose';

/**
 * Exam Attempt Types
 * Types for student exam taking, submission, and attempt management
 */

// Start Exam Request
export interface StartExamRequest {
  examId: string;
}

// Start Exam Response
export interface StartExamResponse {
  attemptId: string;
  exam: {
    _id: string;
    examTitle: string;
    description: string;
    durationInMinutes: number;
    totalMarks: number;
    startOn: Date;
    endOn: Date;
    allowedAttempts: number;
  };
  questions: Array<{
    _id: string;
    questionNumber: number;
    questionType: string;
    questionText: string;
    options?: string[];
    marks: number;
    imageUrl?: string; // Image URL for the question
    savedAnswer?: string | string[]; // For resume functionality
    isFlagged?: boolean; // Flag status for review
  }>;
  attemptNumber: number;
  startedAt: Date;
  endTime: Date;
  isResuming?: boolean; // Indicates if this is a resume or new start
}

// Submit Answer Request
export interface SubmitAnswerRequest {
  attemptId: string;
  questionId: string;
  answer: string | string[];
  timeTaken: number; // in seconds
}

// Submit Answer Response
export interface SubmitAnswerResponse {
  success: boolean;
  message: string;
  savedAt: Date;
  answeredQuestions?: number; // Current count of answered questions
  totalQuestions?: number; // Total questions in exam
  isCompleted?: boolean; // True if all questions are answered
}

// Submit Exam Request
export interface SubmitExamRequest {
  attemptId: string;
  answers: Array<{
    questionId: string;
    answer: string | string[];
    timeTaken: number;
  }>;
  isAutoSubmit?: boolean;
}

// Submit Exam Response
export interface SubmitExamResponse {
  success: boolean;
  attemptId: string;
  submittedAt: Date;
  totalTimeTaken: number;
  message: string;
}

// Get Attempt Status Request
export interface GetAttemptStatusRequest {
  attemptId: string;
}

// Get Attempt Status Response
export interface GetAttemptStatusResponse {
  attemptId: string;
  examId: string;
  examTitle: string;
  status: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt?: Date;
  timeRemaining: number; // in seconds
  questionsAnswered: number;
  totalQuestions: number;
  obtainedMarks?: number;
  totalMarks: number;
  percentage?: number;
  result?: string;
  answers: Array<{
    questionId: string;
    questionNumber: number;
    answer?: string | string[];
    timeTaken?: number;
    isCorrect?: boolean;
    marksObtained?: number;
    maxMarks: number;
  }>;
}

// Get Student Exams Request
export interface GetStudentExamsRequest {
  pageNo?: number;
  pageSize?: number;
  examStatus?: string; // Published, Ongoing, Completed, Cancelled
  examType?: string; // Official, Practice, Exam Repository
  classId?: string;
  subjectId?: string;
  search?: string;
}

// Student Exam Card
export interface StudentExamCard {
  _id: string;
  examTitle: string;
  description: string;
  examType: string;
  examStatus: string;
  totalMarks: number;
  durationInMinutes: number;
  startOn: Date;
  endOn: Date;
  allowedAttempts: number;
  attemptsTaken: number;
  bestScore?: number;
  lastAttemptAt?: Date;
  canAttempt: boolean;
  attemptStatus?: string; // Not Started, In Progress, Submitted, Expired
}

// Get Student Exams Response
export interface GetStudentExamsResponse {
  exams: StudentExamCard[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Get Student Attempt History Request
export interface GetStudentAttemptHistoryRequest {
  examId: string;
}

// Student Attempt History Item
export interface StudentAttemptHistoryItem {
  attemptId: string;
  attemptNumber: number;
  startedAt: Date;
  submittedAt?: Date;
  timeTaken: number;
  status: string;
  obtainedMarks?: number;
  totalMarks: number;
  percentage?: number;
  result?: string;
}

// Get Student Attempt History Response
export interface GetStudentAttemptHistoryResponse {
  examId: string;
  examTitle: string;
  attempts: StudentAttemptHistoryItem[];
}

// Pause Exam Request
export interface PauseExamRequest {
  attemptId: string;
}

// Pause Exam Response
export interface PauseExamResponse {
  success: boolean;
  pausedAt: Date;
  timeRemaining: number;
}

// Resume Exam Request
export interface ResumeExamRequest {
  attemptId: string;
}

// Resume Exam Response
export interface ResumeExamResponse {
  success: boolean;
  resumedAt: Date;
  timeRemaining: number;
}

// Get Exam Instructions Request
export interface GetExamInstructionsRequest {
  examId: string;
}

// Get Exam Instructions Response
export interface GetExamInstructionsResponse {
  examId: string;
  examTitle: string;
  description: string;
  examType: "Official" | "Practice" | "Exam Repository";
  totalMarks: number;
  passingMarks: number;
  durationInMinutes: number;
  totalQuestions: number;
  questionDistribution: {
    questionType: string;
    count: number;
    marks: number;
  }[];
  difficultyDistribution: {
    difficulty: string;
    count: number;
  }[];
  instructions: string[];
  maxAttempts: number;
  allowedAttempts: number;
  attemptsTaken: number;
  canAttempt: boolean;
  startOn: Date;
  endOn: Date;
}

// Save Draft Answer Request
export interface SaveDraftAnswerRequest {
  attemptId: string;
  questionId: string;
  answer: string | string[];
}

// Save Draft Answer Response
export interface SaveDraftAnswerResponse {
  success: boolean;
  savedAt: Date;
}

// Get Draft Answers Request
export interface GetDraftAnswersRequest {
  attemptId: string;
}

// Get Draft Answers Response
export interface GetDraftAnswersResponse {
  attemptId: string;
  draftAnswers: Array<{
    questionId: string;
    questionNumber: number;
    answer: string | string[];
    savedAt: Date;
  }>;
}

// Flag Question Request
export interface FlagQuestionRequest {
  attemptId: string;
  questionId: string;
}

// Flag Question Response
export interface FlagQuestionResponse {
  success: boolean;
  isFlagged: boolean;
  flaggedCount: number;
}


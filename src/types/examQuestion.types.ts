import { IExamQuestion, IQuestionOption } from "../models/examQuestion.schema";

/**
 * ExamQuestion Types - Request and Response interfaces for Exam Question management
 */

// Create Exam Question Request
export interface CreateExamQuestionRequest {
  examId: string;
  questionNumber: number;
  questionType:
    | "MCQs"
    | "Fill in the Blanks"
    | "True/False"
    | "Short Answers"
    | "Long Answers";
  questionGenerateType:
    | "Manually"
    | "Question Bank"
    | "External Library"
    | "AI Generated"
    | "AI Generated but modified by teacher";
  questionText: string;
  questionContent?: string[]; // S3 paths
  imageUrl?: string; // Image URL for the question
  videoUrl?: string; // Video URL for the question
  marks: number;
  options?: IQuestionOption[]; // For MCQs
  correctAnswer: string | string[];
  explanation?: string; // Explanation for the answer
  difficulty: "Easy" | "Medium" | "Hard";
  subjectId: string;
  classId: string;
  aiQuestionId?: string; // AI team's question ID from sync-and-get-topics API
}

// Update Exam Question Request
export interface UpdateExamQuestionRequest {
  questionNumber?: number;
  questionType?:
    | "MCQs"
    | "Fill in the Blanks"
    | "True/False"
    | "Short Answers"
    | "Long Answers";
  questionGenerateType?:
    | "Manually"
    | "Question Bank"
    | "External Library"
    | "AI Generated"
    | "AI Generated but modified by teacher";
  questionText?: string;
  questionContent?: string[];
  imageUrl?: string; // Image URL for the question
  videoUrl?: string; // Video URL for the question
  marks?: number;
  options?: IQuestionOption[];
  correctAnswer?: string | string[];
  explanation?: string; // Explanation for the answer
  difficulty?: "Easy" | "Medium" | "Hard";
  isActive?: boolean;
  aiQuestionId?: string; // AI team's question ID from sync-and-get-topics API
}

// Exam Question Response
export interface ExamQuestionResponse extends IExamQuestion {
  // Additional response fields if needed
}

// Get All Exam Questions Request
export interface GetAllExamQuestionsRequest {
  examId: string;
  questionType?: string;
  difficulty?: string;
  isActive?: boolean;
}

// Get All Exam Questions Response
export interface GetAllExamQuestionsResponse {
  questions: ExamQuestionResponse[];
  total: number;
  byType: Array<{
    type: string;
    count: number;
  }>;
  byDifficulty: Array<{
    difficulty: string;
    count: number;
  }>;
}

// Bulk Create Questions Request
export interface BulkCreateQuestionsRequest {
  examId: string;
  questions: Omit<CreateExamQuestionRequest, "examId">[];
}

// Bulk Create Questions Response
export interface BulkCreateQuestionsResponse {
  createdCount: number;
  questions: ExamQuestionResponse[];
}

// Reorder Questions Request
export interface ReorderQuestionsRequest {
  questionOrders: Array<{
    questionId: string;
    newQuestionNumber: number;
  }>;
}

// Question Success Rate Update
export interface UpdateQuestionSuccessRateRequest {
  questionId: string;
  successRate: number;
}

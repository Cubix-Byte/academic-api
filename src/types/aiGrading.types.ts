// AI Grading Types for Academic API
// These types match the AI API types for integration

export interface GradingRequest {
  questionId: string;
  questionText: string;
  correctAnswer?: string | string[]; // Optional - only for MCQs/True-False
  explanation?: string;
  studentAnswer: string | string[];
  questionType:
    | "MCQs"
    | "Fill in the Blanks"
    | "True/False"
    | "Short Answers"
    | "Long Answers";
  maxMarks: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  // File-based content (NEW)
  fileIds?: string[]; // File IDs from exam contents
  filePaths?: string[]; // S3 paths (alternative to fileIds)
  // Keep sourceContent as optional fallback
  sourceContent?: string; // Relevant excerpt from source files (fallback)
}

export interface QuestionGradingResult {
  questionId: string;
  marksObtained: number;
  maxMarks: number;
  isCorrect: boolean;
  feedback: string;
  gradingNotes?: string;
  confidence?: number;
}

export interface GradingResponse {
  success: boolean;
  message: string;
  data?: QuestionGradingResult;
  error?: string;
}

export interface AttemptGradingRequest {
  attemptId: string;
  examId: string;
  questions: Array<{
    questionId: string;
    questionText: string;
    correctAnswer?: string | string[]; // Optional - only for objective questions
    explanation?: string;
    studentAnswer: string | string[];
    questionType: string;
    maxMarks: number;
    difficulty?: string;
    topic?: string; // Question topic for gap analysis
  }>;
  // File-based content (NEW)
  fileIds?: string[]; // File IDs from exam contents
  filePaths?: string[]; // S3 paths (alternative to fileIds)
  // Keep sourceContent as optional fallback
  sourceContent?: string; // Full exam source content (fallback)
  // Topic breakdown for gap analysis
  topicBreakdown?: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
}

export interface AttemptGradingResult {
  attemptId: string;
  totalMarksObtained: number;
  totalMarks: number;
  percentage: number;
  questionsGraded: number;
  results: QuestionGradingResult[];
  overallFeedback?: string;
  overallAssessment?: string; // New field for AI assessment
  gapAnalysis?: string;
  weakTopics?: Array<{
    topic: string;
    performance: number;
    suggestions: string;
  }>;
}

export interface AttemptGradingResponse {
  success: boolean;
  message: string;
  data?: AttemptGradingResult;
  error?: string;
}

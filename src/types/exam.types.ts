import { IExam } from "../models/exam.schema";
import { IExamQuestion } from "../models/examQuestion.schema";

/**
 * Exam Types - Request and Response interfaces for Exam management
 */

// Enhanced Create Exam Request with nested data
export interface CreateExamWithNestedDataRequest {
  examTitle: string;
  description: string;
  classId: string;
  subjectId: string;
  batchId: string;
  examType: "Official" | "Practice" | "Exam Repository";
  examModeId: string;
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  durationInMinutes: number;
  startOn: string; // ISO date string
  endOn: string; // ISO date string
  topicBreakdown: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
  aiExamId?: string;

  // Optional nested data
  exam_ai_prompt_history?: Array<{
    prompt: string;
    response: string;
    aiModel: string;
    tokensUsed: number;
  }>;

  exam_contents?: Array<{
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
  }>;

  exam_questions?: Array<{
    questionNumber: number;
    questionType:
      | "MCQs"
      | "Short Answers"
      | "Long Answers"
      | "True/False"
      | "Fill in the Blanks";
    questionGenerateType: "AI Generated" | "Manually";
    questionText: string;
    imageUrl?: string; // Image URL for the question
    videoUrl?: string; // Video URL for the question
    questionContent?: string[]; // Array of S3 paths/URLs for multiple images or files
    explanation?: string;
    marks: number;
    options?: Array<{
      optionId: string;
      optionText: string;
      isCorrect: boolean;
    }>;
    correctAnswer?: string;
    difficulty: "Easy" | "Medium" | "Hard";
    aiQuestionId?: string; // AI team's question ID from sync-and-get-topics API
  }>;

  exam_students?: Array<{
    studentId: string;
  }>;

  exam_settings?: Array<{
    settingKey: string;
    settingValue: string;
    settingType: "boolean" | "string" | "number" | "json";
    description?: string;
  }>;
  shouldPublish?: boolean; // Flag to indicate if exam should be published after creation
  selectedDocuments?: Array<{
    id: string;
    title: string;
    fileSize: number;
    subject?: string;
    grade?: string;
  }>;
  sourceConfig?: Array<{
    file_id: string;
    topics: string[];
  }>;
}

// Create Exam Request
export interface CreateExamRequest {
  examTitle: string;
  description: string;
  classId: string;
  subjectId: string;
  batchId: string;
  examType: "Official" | "Practice" | "Exam Repository";
  examModeId: string;
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  durationInMinutes: number;
  startOn: string; // ISO date string
  endOn: string; // ISO date string
  topicBreakdown: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
  aiExamId?: string;
  shouldPublish?: boolean; // Flag to indicate if exam should be published after creation
  selectedDocuments?: Array<{
    id: string;
    title: string;
    fileSize: number;
    subject?: string;
    grade?: string;
  }>;
}

// Update Exam Request
export interface UpdateExamRequest {
  examTitle?: string;
  description?: string;
  classId?: string;
  subjectId?: string;
  batchId?: string;
  examType?: "Official" | "Practice" | "Exam Repository";
  examModeId?: string;
  totalMarks?: number;
  passingMarks?: number;
  maxAttempts?: number;
  durationInMinutes?: number;
  startOn?: string;
  endOn?: string;
  examStatus?:
    | "Draft"
    | "Unpublished"
    | "Published"
    | "In Progress"
    | "Completed"
    | "Cancelled";
  topicBreakdown: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
  aiExamId?: string;

  // Optional nested data for updates
  exam_ai_prompt_history?: Array<{
    prompt: string;
    response: string;
    aiModel: string;
    tokensUsed: number;
  }>;

  exam_contents?: Array<{
    fileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
  }>;

  exam_questions?: Array<{
    questionNumber: number;
    questionType:
      | "MCQs"
      | "Short Answers"
      | "Long Answers"
      | "True/False"
      | "Fill in the Blanks";
    questionGenerateType: "AI Generated" | "Manually";
    questionText: string;
    imageUrl?: string; // Image URL for the question
    videoUrl?: string; // Video URL for the question
    questionContent?: string[]; // Array of S3 paths/URLs for multiple images or files
    marks: number;
    options?: Array<{
      optionId: string;
      optionText: string;
      isCorrect: boolean;
    }>;
    correctAnswer?: string;
    explanation?: string;
    difficulty: "Easy" | "Medium" | "Hard";
    aiQuestionId?: string; // AI team's question ID from sync-and-get-topics API
  }>;

  exam_students?: Array<{
    studentId: string;
  }>;

  exam_settings?: Array<{
    settingKey: string;
    settingValue: string;
    settingType: "boolean" | "string" | "number" | "json";
    description?: string;
  }>;
  shouldPublish?: boolean; // Flag to indicate if exam should be published after update
  selectedDocuments?: Array<{
    id: string;
    title: string;
    fileSize: number;
    subject?: string;
    grade?: string;
  }>;
  sourceConfig?: Array<{
    file_id: string;
    topics: string[];
  }>;
}

// Enhanced Create Exam Response with nested data results
export interface CreateExamWithNestedDataResponse {
  exam: IExam;
  questions?: {
    createdCount: number;
    questions: IExamQuestion[];
  };
  students?: {
    assignedCount: number;
    alreadyAssignedCount: number;
    totalStudents: number;
  };
  contents?: {
    processedCount: number;
  };
  aiPromptHistory?: {
    processedCount: number;
  };
  settings?: {
    processedCount: number;
  };
}

// Exam Response
export interface ExamResponse extends IExam {
  // Additional response fields if needed
  questionCount?: number;
  studentCount?: number;
}

// Get All Exams Request
export interface GetAllExamsRequest {
  pageNo?: number;
  pageSize?: number;
  search?: string;
  examStatus?: string;
  examType?: string;
  classId?: string;
  subjectId?: string;
  batchId?: string;
  tenantId?: string;
  teacherId?: string;
}

// Get All Exams Response
export interface GetAllExamsResponse {
  exams: ExamResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Exam Statistics
export interface ExamStatistics {
  totalExams: number;
  completed: number;
  inProgress: number;
  scheduled: number;
  draft: number;
  published: number;
  released: number;
  unpublished: number;
  practiceExamCount: number;
  officialExamCount: number;
  overallAverageScore?: number;
  averageScore?: number;
  byType: Array<{
    type: string;
    count: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

// Exam with Questions Response
export interface ExamWithQuestionsResponse extends ExamResponse {
  questions: IExamQuestion[];
}

// Publish Exam Request
export interface PublishExamRequest {
  examId: string;
}

// Assign Students Request
export interface AssignStudentsRequest {
  studentIds: string[];
}

// Assign Students Response
export interface AssignStudentsResponse {
  assignedCount: number;
  alreadyAssignedCount: number;
  totalStudents: number;
}

// Exam Card Data (for dashboard display)
export interface ExamCardData {
  _id: string;
  examTitle: string;
  examType: string;
  examStatus: string;
  totalMarks: number;
  durationInMinutes: number;
  startOn: Date;
  endOn: Date;
  questionCount: number;
  studentCount: number;
  completedCount?: number;
  averageScore?: number;
  className?: string;
  subjectName?: string;
  batchName?: string;
}

// School Performance Request
export interface SchoolPerformanceRequest {
  currentMonth: string; // YYYY-MM format
}

// Subject Performance (for school performance)
export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  averagePercentage: number;
}

// School Performance Response
export interface SchoolPerformanceResponse {
  currentMonth: string;
  subjects: SubjectPerformance[];
  overallAverage: number;
  previousMonthAverage: number;
  monthOverMonthIncrease: number; // Can be negative if decreased
}

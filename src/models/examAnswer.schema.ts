import mongoose, { Schema, Document } from "mongoose";

/**
 * ExamAnswer Interface - Student answers for exam questions
 */
export interface IExamAnswer extends Document {
  attemptId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  questionNumber: number;
  questionType:
    | "MCQs"
    | "Fill in the Blanks"
    | "True/False"
    | "Short Answers"
    | "Long Answers";
  studentAnswer: string | string[];
  correctAnswer: string | string[];
  isCorrect: boolean | null;
  marksObtained: number;
  maxMarks: number;
  timeTakenInSeconds: number;
  feedback?: string;
  teacherComment?: string;
  // AI Grading fields
  aiGradingNotes?: string;
  aiConfidence?: number;
  aiFeedback?: string;
  aiMarksObtained?: number;
  gradedBy?: "manual" | "ai" | "hybrid";
  aiGradedAt?: Date;
  isGraded: boolean;
  isFlagged: boolean;
  tenantId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamAnswer Schema - Stores student answers and grading
 */
const ExamAnswerSchema = new Schema(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ExamAttempt",
      index: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Exam",
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "ExamQuestion",
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      required: true,
    },
    questionType: {
      type: String,
      enum: [
        "MCQs",
        "Fill in the Blanks",
        "True/False",
        "Short Answers",
        "Long Answers",
      ],
      required: true,
    },
    studentAnswer: {
      type: Schema.Types.Mixed, // Can be string or array of strings
      default: null,
    },
    correctAnswer: {
      type: Schema.Types.Mixed, // Can be string or array of strings
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: null, // null means not graded yet
    },
    marksObtained: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    timeTakenInSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    feedback: {
      type: String,
      maxlength: 1000,
    },
    teacherComment: {
      type: String,
      maxlength: 500,
    },
    // AI Grading fields
    aiGradingNotes: {
      type: String,
      maxlength: 1000,
    },
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    aiFeedback: {
      type: String,
      maxlength: 1000,
    },
    aiMarksObtained: {
      type: Number,
      min: 0,
    },
    gradedBy: {
      type: String,
      enum: ["manual", "ai", "hybrid"],
      default: "manual",
    },
    aiGradedAt: {
      type: Date,
    },
    isGraded: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
ExamAnswerSchema.index({ attemptId: 1, questionId: 1 });
ExamAnswerSchema.index({ attemptId: 1, questionNumber: 1 });
ExamAnswerSchema.index({ examId: 1, questionId: 1 });
ExamAnswerSchema.index({ studentId: 1, examId: 1 });
ExamAnswerSchema.index({ tenantId: 1, isDeleted: 1 });
ExamAnswerSchema.index({ attemptId: 1, studentId: 1, isGraded: 1 });
ExamAnswerSchema.index({ attemptId: 1, isFlagged: 1 });

const ExamAnswer = mongoose.model<IExamAnswer>("ExamAnswer", ExamAnswerSchema);

export default ExamAnswer;

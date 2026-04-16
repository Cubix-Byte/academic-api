import mongoose, { Schema, Document } from "mongoose";

/**
 * AIPracticeAttempt — stores student practice attempts created from AI task recommendations.
 * Self-contained: does NOT reference the exams or exam_attempts collections.
 */
export interface IAIPracticeAttempt extends Document {
  studentId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  sourceExamId?: mongoose.Types.ObjectId; // original exam the AI based this on (optional)
  feAttemptId: string; // AI API reference ID
  subject: string;
  examTitle: string; // e.g. "AI Practice — Software Engineering · Mid-Term 2024"
  questions: Array<{
    questionId: string;
    questionNumber: number;
    questionType: string;
    questionText: string;
    options?: string[];
    correctAnswer?: string;
    marks: number;
    topic?: string;
    difficulty?: string;
  }>;
  totalMarks: number;
  durationInMinutes: number;
  status: "In Progress" | "Submitted" | "Graded";
  startedAt: Date;
  submittedAt?: Date;
  timeTakenInSeconds: number;
  answers: Array<{
    questionId: string;
    answer: string | string[];
    timeTaken: number;
    isCorrect?: boolean;
    marksObtained?: number;
  }>;
  obtainedMarks?: number;
  percentage?: number;
  aiFeedback?: string;
  gapAnalysis?: string;
  weakTopics?: Array<{
    topic: string;
    performance: number;
    suggestions: string;
  }>;
  aiResponse?: any;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AIPracticeAttemptSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    sourceExamId: { type: Schema.Types.ObjectId, ref: "Exam", required: false },
    feAttemptId: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    examTitle: { type: String, required: true, trim: true },
    questions: [
      {
        questionId: { type: String, required: true },
        questionNumber: { type: Number, required: true },
        questionType: { type: String, required: true },
        questionText: { type: String, required: true },
        options: [{ type: String }],
        correctAnswer: { type: String },
        marks: { type: Number, required: true },
        topic: { type: String },
        difficulty: { type: String },
      },
    ],
    totalMarks: { type: Number, required: true, min: 0 },
    durationInMinutes: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["In Progress", "Submitted", "Graded"],
      default: "In Progress",
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    submittedAt: { type: Date },
    timeTakenInSeconds: { type: Number, default: 0, min: 0 },
    answers: [
      {
        questionId: { type: String, required: true },
        answer: { type: Schema.Types.Mixed },
        timeTaken: { type: Number, default: 0 },
        isCorrect: { type: Boolean },
        marksObtained: { type: Number },
      },
    ],
    obtainedMarks: { type: Number, default: 0, min: 0 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    aiFeedback: { type: String, trim: true },
    gapAnalysis: { type: String, trim: true },
    weakTopics: [
      {
        topic: { type: String, required: true },
        performance: { type: Number, required: true },
        suggestions: { type: String, required: true },
      },
    ],
    aiResponse: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    collection: "ai_practice_attempts",
  },
);

AIPracticeAttemptSchema.index({ studentId: 1, status: 1, createdAt: -1 });
AIPracticeAttemptSchema.index({ tenantId: 1, studentId: 1, isDeleted: 1 });

AIPracticeAttemptSchema.set("toJSON", { virtuals: true });
AIPracticeAttemptSchema.set("toObject", { virtuals: true });

export const AIPracticeAttempt = mongoose.model<IAIPracticeAttempt>(
  "AIPracticeAttempt",
  AIPracticeAttemptSchema,
);
export default AIPracticeAttempt;

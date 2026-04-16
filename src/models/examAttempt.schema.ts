import mongoose, { Schema, Document } from "mongoose";

/**
 * ExamAttempt Interface - Student exam attempts
 */
export interface IExamAttempt extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  attemptNumber: number;
  startedAt?: Date;
  submittedAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  totalMarks: number;
  obtainedMarks?: number;
  percentage?: number;
  result?: string; // Pass, Fail
  grade?: string;
  classRank?: number;
  attemptStatus:
  | "In Progress"
  | "Paused"
  | "Submitted"
  | "Graded"
  | "Abandoned"
  | "Not Started";
  timeTakenInSeconds: number;
  tenantId: mongoose.Types.ObjectId;
  // AI Grading fields
  aiFeedback?: string;
  teacherFeedback?: string;
  overallFeedback?: string;
  overallAssessment?: string; // New field per analytics spec
  gapAnalysis?: string;
  weakTopics?: Array<{
    topic: string;
    performance: number;
    suggestions: string;
  }>;
  skillMastery?: Array<{ // New field per analytics spec
    skill: string;
    performance: number;
    suggestions: string;
  }>;
  averageTopics?: string[]; // New field per analytics spec
  strongestTopics?: string[]; // New field per analytics spec
  aiResponse?: any; // Stores the entire AI grading response (mixed type)
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  examName?: string; // Optional property for the exam name
}

/**
 * ExamAttempt Schema - Tracks student exam attempts
 */
const ExamAttemptSchema = new Schema(
  {
    examId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Exam",
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Subject",
      index: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    startedAt: {
      type: Date,
      index: true,
    },
    submittedAt: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    resumedAt: {
      type: Date,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    result: {
      type: String,
      enum: ["Pending", "Pass", "Fail"],
      default: "Pending",
      maxlength: 20,
    },
    grade: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    classRank: {
      type: Number,
      min: 1,
    },
    attemptStatus: {
      type: String,
      enum: [
        "In Progress",
        "Paused",
        "Submitted",
        "Graded",
        "Abandoned",
        "Not Started",
      ],
      default: "In Progress",
      index: true,
    },
    timeTakenInSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    // AI Grading fields
    aiFeedback: {
      type: String,
      trim: true,
    },
    teacherFeedback: {
      type: String,
      trim: true,
    },
    overallFeedback: {
      type: String,
      trim: true,
    },
    overallAssessment: {
      type: String,
      trim: true,
    },
    gapAnalysis: {
      type: String,
      trim: true,
    },
    weakTopics: [
      {
        topic: {
          type: String,
          required: true,
          trim: true,
        },
        performance: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        suggestions: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    skillMastery: [
      {
        skill: {
          type: String,
          required: true,
          trim: true,
        },
        performance: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        suggestions: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    averageTopics: [
      {
        type: String,
        trim: true,
      },
    ],
    strongestTopics: [
      {
        type: String,
        trim: true,
      },
    ],
    aiResponse: {
      type: Schema.Types.Mixed,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    examName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "exam_attempts",
  }
);

// Indexes for high performance
ExamAttemptSchema.index(
  { examId: 1, studentId: 1, attemptNumber: 1 },
  { unique: true }
);
ExamAttemptSchema.index({ studentId: 1, attemptStatus: 1, createdAt: -1 });
ExamAttemptSchema.index({ examId: 1, attemptStatus: 1 });
ExamAttemptSchema.index({ tenantId: 1, studentId: 1, attemptStatus: 1 });
ExamAttemptSchema.index({ classId: 1, subjectId: 1, attemptStatus: 1 });
ExamAttemptSchema.index({ tenantId: 1, isDeleted: 1, attemptStatus: 1 });

// Ensure virtual fields are serialized
ExamAttemptSchema.set("toJSON", { virtuals: true });
ExamAttemptSchema.set("toObject", { virtuals: true });

export const ExamAttempt = mongoose.model<IExamAttempt>(
  "ExamAttempt",
  ExamAttemptSchema
);
export default ExamAttempt;

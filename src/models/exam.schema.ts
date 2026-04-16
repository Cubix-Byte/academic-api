import mongoose, { Schema, Document } from "mongoose";

/**
 * Exam Interface - Main exam management table
 */
export interface IExam extends Document {
  examTitle: string;
  description: string;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  examType: "Official" | "Practice" | "Exam Repository";
  examModeId: mongoose.Types.ObjectId;
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  allowedAttempts: number; // Alias for maxAttempts
  durationInMinutes: number;
  startOn: Date;
  endOn: Date;
  examStatus:
  | "Draft"
  | "Unpublished"
  | "Published"
  | "Released"
  | "In Progress"
  | "Completed"
  | "Cancelled";
  gradingTypeStatus: "Waiting for Grading" | "In Progress" | "Completed";
  teacherId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  topicBreakdown: Array<{
    topic: string;
    percentage: number;
    questionCount: number;
    totalMarks: number;
  }>;
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
  aiExamId?: string;
  releasedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exam Schema - Complete exam configuration and management
 */
const ExamSchema = new Schema(
  {
    examTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    examType: {
      type: String,
      enum: ["Official", "Practice", "Exam Repository"],
      required: true,
      index: true,
    },
    examModeId: {
      type: Schema.Types.ObjectId,
      ref: "ExamMode",
      required: true,
      index: true,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },
    passingMarks: {
      type: Number,
      required: true,
      min: 0,
      max: 1000,
    },
    maxAttempts: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    durationInMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 480, // 8 hours max
    },
    startOn: {
      type: Date,
      required: true,
      index: true,
    },
    endOn: {
      type: Date,
      required: true,
      index: true,
    },
    examStatus: {
      type: String,
      enum: [
        "Draft",
        "Unpublished",
        "Published",
        "Released",
        "In Progress",
        "Completed",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },
    gradingTypeStatus: {
      type: String,
      enum: ["Waiting for Grading", "In Progress", "Completed"],
      default: "Waiting for Grading",
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    topicBreakdown: {
      type: [
        {
          topic: {
            type: String,
            required: true,
            trim: true,
          },
          percentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
          },
          questionCount: {
            type: Number,
            required: true,
            min: 0,
          },
          totalMarks: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      required: false,
      validate: {
        validator: function (
          v: Array<{
            topic: string;
            percentage: number;
            questionCount: number;
            totalMarks: number;
          }>
        ) {
          // If topicBreakdown is provided, it must be an array (can be empty)
          if (v !== undefined && v !== null) {
            return Array.isArray(v);
          }
          // If not provided, it's valid (optional)
          return true;
        },
        message: "Topic breakdown must be an array",
      },
    },
    selectedDocuments: {
      type: [
        {
          id: { type: String, required: true },
          title: { type: String, required: true },
          fileSize: { type: Number, required: true },
          subject: { type: String },
          grade: { type: String },
        },
      ],
      required: false,
      default: [],
    },
    sourceConfig: {
      type: [
        {
          file_id: { type: String, required: true },
          topics: { type: [String], default: [] },
        },
      ],
      required: false,
      default: [],
    },
    aiExamId: {
      type: String,
      trim: true,
      index: true,
    },
    releasedAt: {
      type: Date,
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
    collection: "exams",
  }
);

// Validation: endOn must be after startOn
ExamSchema.pre("save", function (next) {
  if (this.endOn <= this.startOn) {
    next(new Error("endOn must be after startOn"));
  } else {
    next();
  }
});

// Indexes for high performance
ExamSchema.index({ tenantId: 1, teacherId: 1, examStatus: 1 });
ExamSchema.index({ classId: 1, subjectId: 1, examStatus: 1 });
ExamSchema.index({ startOn: 1, endOn: 1 });
ExamSchema.index({ examType: 1, examStatus: 1 });
ExamSchema.index({ batchId: 1, examStatus: 1 });
ExamSchema.index({ isDeleted: 1, tenantId: 1, examStatus: 1 });

// Virtual property: allowedAttempts (alias for maxAttempts)
ExamSchema.virtual("allowedAttempts").get(function () {
  return this.maxAttempts;
});

// Ensure virtual fields are serialized
ExamSchema.set("toJSON", { virtuals: true });
ExamSchema.set("toObject", { virtuals: true });

export const Exam = mongoose.model<IExam>("Exam", ExamSchema);
export default Exam;

import mongoose, { Schema, Document } from "mongoose";

/**
 * Question Option Interface - For MCQ options
 */
export interface IQuestionOption {
  optionId: string; // A, B, C, D
  optionText: string;
  isCorrect: boolean;
  optionContent?: string[]; // S3 paths for images
}

/**
 * ExamQuestion Interface - Questions for exams
 */
export interface IExamQuestion extends Document {
  examId: mongoose.Types.ObjectId;
  aiQuestionId?: string; // AI team's question ID from sync-and-get-topics API
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
  questionContent: string[]; // S3 paths for images/files
  imageUrl?: string; // Image URL for the question
  videoUrl?: string; // Video URL for the question
  marks: number;
  options?: IQuestionOption[]; // For MCQs
  correctAnswer: string | string[]; // Can be single or multiple answers
  explanation?: string; // Explanation for the answer
  successRate: number; // Percentage
  averageCorrectPercentage: number; // Average percentage of students who answered correctly
  difficulty: "Easy" | "Medium" | "Hard";
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Question Option Schema
 */
const QuestionOptionSchema = new Schema(
  {
    optionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5,
    },
    optionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
    optionContent: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

/**
 * ExamQuestion Schema - Complete question configuration
 */
const ExamQuestionSchema = new Schema(
  {
    examId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Exam",
      index: true,
    },
    aiQuestionId: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    questionNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true,
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
      index: true,
    },
    questionGenerateType: {
      type: String,
      enum: [
        "Manually",
        "Question Bank",
        "External Library",
        "AI Generated",
        "AI Generated but modified by teacher",
      ],
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    questionContent: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    options: {
      type: [QuestionOptionSchema],
      default: undefined,
    },
    correctAnswer: {
      type: Schema.Types.Mixed, // Can be string or array
      required: true,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    averageCorrectPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
      default: "Medium",
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      required: true,
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "exam_questions",
  }
);

// Validation: MCQs must have options
ExamQuestionSchema.pre("save", function (next) {
  if (
    this.questionType === "MCQs" &&
    (!this.options || this.options.length === 0)
  ) {
    next(new Error("MCQs must have options"));
  } else {
    next();
  }
});

// Indexes for high performance
ExamQuestionSchema.index({ examId: 1, questionNumber: 1 }, { unique: true });
ExamQuestionSchema.index({ examId: 1, questionType: 1 });
ExamQuestionSchema.index({ tenantId: 1, subjectId: 1, questionType: 1 });
ExamQuestionSchema.index({ difficulty: 1, questionType: 1 });
ExamQuestionSchema.index({ successRate: 1 });

// Ensure virtual fields are serialized
ExamQuestionSchema.set("toJSON", { virtuals: true });
ExamQuestionSchema.set("toObject", { virtuals: true });

export const ExamQuestion = mongoose.model<IExamQuestion>(
  "ExamQuestion",
  ExamQuestionSchema
);
export default ExamQuestion;

import mongoose, { Schema, Document } from "mongoose";

/**
 * ConversationMessage Interface - Chat history structure
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * ExamBuilder Interface - Exam builder content management
 */
export interface IExamBuilder extends Document {
  contentTitle: string;
  description?: string;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  contentType: "Syllabus" | "Lesson Plan" | "Study Material" | "Worksheet";
  chatHistory?: ConversationMessage[];
  // AI-generated content types with download links
  sessions?: {
    content?: string; // AI-generated sessions text/content
    downloadLink?: string; // Generated download link for sessions
    fileName?: string;
    filePath?: string; // S3 path
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  videoScript?: {
    content?: string; // AI-generated video script text/content
    downloadLink?: string; // Generated download link for video script
    fileName?: string;
    filePath?: string; // S3 path
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  presentationPdf?: {
    content?: string; // AI-generated presentation/PDF content/text
    downloadLink?: string; // Generated download link for presentation/PDF
    fileName?: string;
    filePath?: string; // S3 path
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  status: "Recent" | "Draft";
  createdBy: mongoose.Types.ObjectId; // Teacher ID
  tenantId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamBuilder Schema - Manages exam builder content
 */
const ExamBuilderSchema = new Schema(
  {
    contentTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
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
    contentType: {
      type: String,
      enum: ["Syllabus", "Lesson Plan", "Study Material", "Worksheet"],
      required: true,
      index: true,
    },
    chatHistory: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Number,
          required: true,
        },
      },
    ],
    // AI-generated Sessions with download link
    sessions: {
      content: {
        type: String,
        trim: true,
      },
      downloadLink: {
        type: String,
        trim: true,
      },
      fileName: String,
      filePath: String,
      mimeType: String,
      size: Number,
      generatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    // AI-generated Video Script with download link
    videoScript: {
      content: {
        type: String,
        trim: true,
      },
      downloadLink: {
        type: String,
        trim: true,
      },
      fileName: String,
      filePath: String,
      mimeType: String,
      size: Number,
      generatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    // AI-generated Presentation/PDF with download link
    presentationPdf: {
      content: {
        type: String,
        trim: true,
      },
      downloadLink: {
        type: String,
        trim: true,
      },
      fileName: String,
      filePath: String,
      mimeType: String,
      size: Number,
      generatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    status: {
      type: String,
      enum: ["Recent", "Draft", "Published"],
      default: "Draft",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    collection: "exam_builders",
  }
);

// Indexes for better performance
ExamBuilderSchema.index({ tenantId: 1, createdBy: 1, status: 1 });
ExamBuilderSchema.index({ tenantId: 1, contentTitle: 1 });
ExamBuilderSchema.index({ tenantId: 1, classId: 1, subjectId: 1, batchId: 1 });
ExamBuilderSchema.index({ tenantId: 1, createdAt: -1 });
ExamBuilderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// Text index for search
ExamBuilderSchema.index({
  contentTitle: "text",
  description: "text",
});

// Ensure virtual fields are serialized
ExamBuilderSchema.set("toJSON", { virtuals: true });
ExamBuilderSchema.set("toObject", { virtuals: true });

export const ExamBuilder = mongoose.model<IExamBuilder>(
  "ExamBuilder",
  ExamBuilderSchema
);
export default ExamBuilder;


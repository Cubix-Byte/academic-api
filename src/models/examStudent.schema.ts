import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamStudent Interface - Many-to-many relationship between exams and students
 */
export interface IExamStudent extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  status: 'Pending' | 'Started' | 'Completed';
  gradingStatus: 'Waiting for Grading' | 'In Progress' | 'Completed';
  grade?: string; // A+, A, B+, etc.
  percentage?: number;
  feedback?: Array<{
    comment: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  aiPrompt?: Array<{
    prompt: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  recommendedResources?: Array<{
    title: string;
    url: string;
    description?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  isActive: boolean;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamStudent Schema - Assigns students to exams
 */
const ExamStudentSchema = new Schema({
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    index: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  batchId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Started', 'Completed'],
    default: 'Pending',
    index: true
  },
  gradingStatus: {
    type: String,
    enum: ['Waiting for Grading', 'In Progress', 'Completed'],
    default: 'Waiting for Grading',
    index: true
  },
  grade: {
    type: String,
    trim: true
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  feedback: [{
    comment: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  aiPrompt: [{
    prompt: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  recommendedResources: [{
    title: {
      type: String,
      trim: true,
      required: true
    },
    url: {
      type: String,
      trim: true,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  gradedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'exam_students'
});

// Indexes for high performance queries
ExamStudentSchema.index({ examId: 1, studentId: 1 }, { unique: true });
ExamStudentSchema.index({ studentId: 1, isActive: 1 });
ExamStudentSchema.index({ examId: 1, isActive: 1 });
ExamStudentSchema.index({ tenantId: 1, studentId: 1 });
ExamStudentSchema.index({ classId: 1, subjectId: 1, batchId: 1 });
// Index for school performance query optimization
ExamStudentSchema.index({ tenantId: 1, gradingStatus: 1, isActive: 1 });

// Ensure virtual fields are serialized
ExamStudentSchema.set('toJSON', { virtuals: true });
ExamStudentSchema.set('toObject', { virtuals: true });

export const ExamStudent = mongoose.model<IExamStudent>('ExamStudent', ExamStudentSchema);
export default ExamStudent;


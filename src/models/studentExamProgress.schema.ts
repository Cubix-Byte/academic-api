import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentExamProgress Interface - Real-time exam progress tracking
 */
export interface IStudentExamProgress extends Document {
  studentId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredQuestions: number;
  flaggedQuestions: number;
  timeRemaining: number; // in seconds
  isCompleted: boolean;
  lastActivityAt: Date;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentExamProgress Schema - Tracks real-time exam progress
 */
const StudentExamProgressSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    index: true
  },
  attemptId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamAttempt',
    index: true
  },
  currentQuestionIndex: {
    type: Number,
    required: true,
    min: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },
  answeredQuestions: {
    type: Number,
    default: 0,
    min: 0
  },
  flaggedQuestions: {
    type: Number,
    default: 0,
    min: 0
  },
  timeRemaining: {
    type: Number,
    required: true,
    min: 0
  },
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  lastActivityAt: {
    type: Date,
    required: true,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'student_exam_progress'
});

// Indexes for high performance
StudentExamProgressSchema.index({ attemptId: 1 }, { unique: true });
StudentExamProgressSchema.index({ studentId: 1, examId: 1 });
StudentExamProgressSchema.index({ isCompleted: 1, lastActivityAt: -1 });

// Ensure virtual fields are serialized
StudentExamProgressSchema.set('toJSON', { virtuals: true });
StudentExamProgressSchema.set('toObject', { virtuals: true });

export const StudentExamProgress = mongoose.model<IStudentExamProgress>('StudentExamProgress', StudentExamProgressSchema);
export default StudentExamProgress;


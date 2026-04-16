import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamAttemptLog Interface - Detailed student answers
 */
export interface IExamAttemptLog extends Document {
  attemptId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  studentAnswer: string | string[];
  selectedOptions?: string[]; // For MCQs
  isCorrect: boolean;
  marksObtained: number;
  timeSpent: number; // in seconds
  isFlagged: boolean;
  isSkipped: boolean;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamAttemptLog Schema - Logs each answer in an attempt
 */
const ExamAttemptLogSchema = new Schema({
  attemptId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamAttempt',
    index: true
  },
  questionId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamQuestion',
    index: true
  },
  studentAnswer: {
    type: Schema.Types.Mixed, // Can be string or array
    required: true
  },
  selectedOptions: {
    type: [String],
    default: undefined
  },
  isCorrect: {
    type: Boolean,
    default: false,
    index: true
  },
  marksObtained: {
    type: Number,
    default: 0,
    min: 0
  },
  timeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  isSkipped: {
    type: Boolean,
    default: false
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'exam_attempt_logs'
});

// Indexes for high performance
ExamAttemptLogSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });
ExamAttemptLogSchema.index({ attemptId: 1, isCorrect: 1 });
ExamAttemptLogSchema.index({ questionId: 1, isCorrect: 1 });

// Ensure virtual fields are serialized
ExamAttemptLogSchema.set('toJSON', { virtuals: true });
ExamAttemptLogSchema.set('toObject', { virtuals: true });

export const ExamAttemptLog = mongoose.model<IExamAttemptLog>('ExamAttemptLog', ExamAttemptLogSchema);
export default ExamAttemptLog;


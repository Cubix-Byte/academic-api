import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentExamHistory Interface - Historical exam records
 */
export interface IStudentExamHistory extends Document {
  studentId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  attemptNumber: number;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  timeTaken: number; // in seconds
  attemptedDate: Date;
  status: 'In Progress' | 'Waiting for Grading' | 'Completed' | 'Abandoned';
  isNewHighScore: boolean;
  improvementPercentage?: number;
  tags: string[]; // Practice, Official, New High Score, First Time, etc.
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentExamHistory Schema - Complete exam history tracking
 */
const StudentExamHistorySchema = new Schema({
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
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    trim: true,
    maxlength: 10
  },
  timeTaken: {
    type: Number,
    required: true,
    min: 0
  },
  attemptedDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['In Progress', 'Waiting for Grading', 'Completed', 'Abandoned'],
    required: true,
    index: true
  },
  isNewHighScore: {
    type: Boolean,
    default: false,
    index: true
  },
  improvementPercentage: {
    type: Number,
    min: -100,
    max: 100
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'student_exam_history'
});

// Indexes for high performance
StudentExamHistorySchema.index({ studentId: 1, examId: 1, attemptNumber: 1 }, { unique: true });
StudentExamHistorySchema.index({ studentId: 1, attemptedDate: -1 });
StudentExamHistorySchema.index({ examId: 1, percentage: -1 });
StudentExamHistorySchema.index({ tenantId: 1, status: 1, attemptedDate: -1 });
StudentExamHistorySchema.index({ tags: 1, isNewHighScore: 1 });

// Ensure virtual fields are serialized
StudentExamHistorySchema.set('toJSON', { virtuals: true });
StudentExamHistorySchema.set('toObject', { virtuals: true });

export const StudentExamHistory = mongoose.model<IStudentExamHistory>('StudentExamHistory', StudentExamHistorySchema);
export default StudentExamHistory;


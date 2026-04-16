import mongoose, { Schema, Document } from 'mongoose';

/**
 * Topic Performance Interface
 */
export interface ITopicPerformance {
  topicId: mongoose.Types.ObjectId;
  topicName: string;
  score: number;
  totalQuestions: number;
  lastAttemptDate: Date;
}

/**
 * StudentSubjectProgress Interface - Subject-wise student progress
 */
export interface IStudentSubjectProgress extends Document {
  studentId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  currentGrade: string;
  averageScore: number;
  totalExams: number;
  completedExams: number;
  topicPerformance: ITopicPerformance[];
  lastExamDate?: Date;
  improvementTrend: 'Improving' | 'Declining' | 'Stable';
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Topic Performance Schema
 */
const TopicPerformanceSchema = new Schema({
  topicId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  topicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 0
  },
  lastAttemptDate: {
    type: Date,
    required: true
  }
}, { _id: false });

/**
 * StudentSubjectProgress Schema - Tracks progress per subject
 */
const StudentSubjectProgressSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  currentGrade: {
    type: String,
    trim: true,
    maxlength: 10
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalExams: {
    type: Number,
    default: 0,
    min: 0
  },
  completedExams: {
    type: Number,
    default: 0,
    min: 0
  },
  topicPerformance: {
    type: [TopicPerformanceSchema],
    default: []
  },
  lastExamDate: {
    type: Date
  },
  improvementTrend: {
    type: String,
    enum: ['Improving', 'Declining', 'Stable'],
    default: 'Stable',
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'student_subject_progress'
});

// Indexes for high performance
StudentSubjectProgressSchema.index({ studentId: 1, subjectId: 1, classId: 1 }, { unique: true });
StudentSubjectProgressSchema.index({ tenantId: 1, averageScore: -1 });
StudentSubjectProgressSchema.index({ improvementTrend: 1, lastExamDate: -1 });

// Ensure virtual fields are serialized
StudentSubjectProgressSchema.set('toJSON', { virtuals: true });
StudentSubjectProgressSchema.set('toObject', { virtuals: true });

export const StudentSubjectProgress = mongoose.model<IStudentSubjectProgress>('StudentSubjectProgress', StudentSubjectProgressSchema);
export default StudentSubjectProgress;


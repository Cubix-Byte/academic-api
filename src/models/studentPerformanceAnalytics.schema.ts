import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentPerformanceAnalytics Interface - Comprehensive student performance tracking
 */
export interface IStudentPerformanceAnalytics extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId?: mongoose.Types.ObjectId;
  currentRank: number;
  nationalRank: number;
  averageScore: number;
  performanceTrend: 'Improving' | 'Declining' | 'Stable';
  strongestArea: string;
  weakArea: string;
  examPace: number; // average time per question in seconds
  improvementPercentage: number;
  lastCalculated: Date;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentPerformanceAnalytics Schema - Detailed student analytics
 */
const StudentPerformanceAnalyticsSchema = new Schema({
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
  topicId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  currentRank: {
    type: Number,
    required: true,
    min: 1
  },
  nationalRank: {
    type: Number,
    required: true,
    min: 1
  },
  averageScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  performanceTrend: {
    type: String,
    enum: ['Improving', 'Declining', 'Stable'],
    default: 'Stable',
    index: true
  },
  strongestArea: {
    type: String,
    trim: true,
    maxlength: 200
  },
  weakArea: {
    type: String,
    trim: true,
    maxlength: 200
  },
  examPace: {
    type: Number,
    default: 0,
    min: 0
  },
  improvementPercentage: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  lastCalculated: {
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
  collection: 'student_performance_analytics'
});

// Indexes for high performance
StudentPerformanceAnalyticsSchema.index({ studentId: 1, classId: 1, subjectId: 1 }, { unique: true });
StudentPerformanceAnalyticsSchema.index({ tenantId: 1, currentRank: 1 });
StudentPerformanceAnalyticsSchema.index({ nationalRank: 1 });
StudentPerformanceAnalyticsSchema.index({ performanceTrend: 1, averageScore: -1 });

// Ensure virtual fields are serialized
StudentPerformanceAnalyticsSchema.set('toJSON', { virtuals: true });
StudentPerformanceAnalyticsSchema.set('toObject', { virtuals: true });

export const StudentPerformanceAnalytics = mongoose.model<IStudentPerformanceAnalytics>('StudentPerformanceAnalytics', StudentPerformanceAnalyticsSchema);
export default StudentPerformanceAnalytics;


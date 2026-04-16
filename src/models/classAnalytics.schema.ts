import mongoose, { Schema, Document } from 'mongoose';

/**
 * ClassAnalytics Interface - Class performance analytics
 */
export interface IClassAnalytics extends Document {
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId?: mongoose.Types.ObjectId;
  averageScore: number;
  totalStudents: number;
  passingStudents: number;
  failingStudents: number;
  performanceTrend: 'Improving' | 'Declining' | 'Stable';
  aiSuggestions: string[];
  tenantId: mongoose.Types.ObjectId;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ClassAnalytics Schema - Tracks class-level performance
 */
const ClassAnalyticsSchema = new Schema({
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
  averageScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalStudents: {
    type: Number,
    required: true,
    min: 0
  },
  passingStudents: {
    type: Number,
    required: true,
    min: 0
  },
  failingStudents: {
    type: Number,
    required: true,
    min: 0
  },
  performanceTrend: {
    type: String,
    enum: ['Improving', 'Declining', 'Stable'],
    default: 'Stable',
    index: true
  },
  aiSuggestions: {
    type: [String],
    default: []
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  calculatedAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'class_analytics'
});

// Indexes for high performance
ClassAnalyticsSchema.index({ classId: 1, subjectId: 1, calculatedAt: -1 });
ClassAnalyticsSchema.index({ tenantId: 1, performanceTrend: 1 });
ClassAnalyticsSchema.index({ topicId: 1, averageScore: 1 });

// Ensure virtual fields are serialized
ClassAnalyticsSchema.set('toJSON', { virtuals: true });
ClassAnalyticsSchema.set('toObject', { virtuals: true });

export const ClassAnalytics = mongoose.model<IClassAnalytics>('ClassAnalytics', ClassAnalyticsSchema);
export default ClassAnalytics;


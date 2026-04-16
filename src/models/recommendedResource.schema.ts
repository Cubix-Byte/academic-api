import mongoose, { Schema, Document } from 'mongoose';

/**
 * RecommendedResource Interface - Learning resources for students
 */
export interface IRecommendedResource extends Document {
  attemptId: mongoose.Types.ObjectId;
  resourceTitle: string;
  resourceType: 'Article' | 'Video' | 'Course' | 'Document';
  resourceUrl: string;
  resourceDescription: string;
  isGeneratedByAI: boolean;
  teacherId?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RecommendedResource Schema - Manages recommended learning materials
 */
const RecommendedResourceSchema = new Schema({
  attemptId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamAttempt',
    index: true
  },
  resourceTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  resourceType: {
    type: String,
    enum: ['Article', 'Video', 'Course', 'Document'],
    required: true,
    index: true
  },
  resourceUrl: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  resourceDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isGeneratedByAI: {
    type: Boolean,
    default: true,
    index: true
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'recommended_resources'
});

// Indexes for high performance
RecommendedResourceSchema.index({ attemptId: 1, resourceType: 1 });
RecommendedResourceSchema.index({ tenantId: 1, isGeneratedByAI: 1 });

// Ensure virtual fields are serialized
RecommendedResourceSchema.set('toJSON', { virtuals: true });
RecommendedResourceSchema.set('toObject', { virtuals: true });

export const RecommendedResource = mongoose.model<IRecommendedResource>('RecommendedResource', RecommendedResourceSchema);
export default RecommendedResource;


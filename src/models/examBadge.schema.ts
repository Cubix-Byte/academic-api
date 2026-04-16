import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamBadge Interface - Student badges
 */
export interface IExamBadge extends Document {
  badgeName: string;
  description: string;
  badgeType: string;
  tier: string;
  icon: string;
  studentId: mongoose.Types.ObjectId;
  earnedDate: Date;
  progress: number;
  isEarned: boolean;
  tenantId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamBadge Schema
 */
const ExamBadgeSchema = new Schema({
  badgeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  badgeType: {
    type: String,
    required: true,
    maxlength: 50,
    index: true
  },
  tier: {
    type: String,
    required: true,
    maxlength: 50,
    index: true
  },
  icon: {
    type: String,
    required: true,
    maxlength: 500
  },
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  earnedDate: {
    type: Date,
    required: true,
    index: true
  },
  progress: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  isEarned: {
    type: Boolean,
    default: false,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true, collection: 'exam_badges' });

// Indexes
ExamBadgeSchema.index({ studentId: 1, isDeleted: 1, isEarned: 1 });
ExamBadgeSchema.index({ tenantId: 1, earnedDate: -1 });
ExamBadgeSchema.index({ badgeType: 1, tier: 1, isEarned: 1 });

export const ExamBadge = mongoose.model<IExamBadge>('ExamBadge', ExamBadgeSchema);
export default ExamBadge;


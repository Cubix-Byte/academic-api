import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentCredentialProgress Interface - Credential progress tracking
 */
export interface IStudentCredentialProgress extends Document {
  studentId: mongoose.Types.ObjectId;
  credentialType: 'Badge' | 'Certificate' | 'Award' | 'CPD';
  totalEarned: number;
  thisMonthEarned: number;
  lastEarnedDate?: Date;
  progressPercentage: number;
  nextMilestone: string;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentCredentialProgress Schema - Tracks credential earning progress
 */
const StudentCredentialProgressSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  credentialType: {
    type: String,
    enum: ['Badge', 'Certificate', 'Award', 'CPD'],
    required: true,
    index: true
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  thisMonthEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  lastEarnedDate: {
    type: Date
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  nextMilestone: {
    type: String,
    trim: true,
    maxlength: 200
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'student_credential_progress'
});

// Indexes for high performance
StudentCredentialProgressSchema.index({ studentId: 1, credentialType: 1 }, { unique: true });
StudentCredentialProgressSchema.index({ tenantId: 1, totalEarned: -1 });
StudentCredentialProgressSchema.index({ lastEarnedDate: -1 });

// Ensure virtual fields are serialized
StudentCredentialProgressSchema.set('toJSON', { virtuals: true });
StudentCredentialProgressSchema.set('toObject', { virtuals: true });

export const StudentCredentialProgress = mongoose.model<IStudentCredentialProgress>('StudentCredentialProgress', StudentCredentialProgressSchema);
export default StudentCredentialProgress;


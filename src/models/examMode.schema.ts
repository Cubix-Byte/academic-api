import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamMode Interface - Exam mode management (Mid Term, Final Term, Quiz, Assignment)
 */
export interface IExamMode extends Document {
  name: string;
  description: string;
  isActive: boolean;
  tenantId?: mongoose.Types.ObjectId; // Optional for backward compatibility
  createdBy: mongoose.Types.ObjectId; // Admin ID
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

/**
 * ExamMode Schema - Defines different types of exam modes
 */
const ExamModeSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: false, // Optional for backward compatibility
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'exam_modes'
});

// Indexes for better performance
// Unique index on name per tenant (tenant-scoped uniqueness)
ExamModeSchema.index({ name: 1, tenantId: 1 }, { unique: true, sparse: true });
// Compound index for filtering active/deleted examModes
ExamModeSchema.index({ isActive: 1, isDeleted: 1 });

// Ensure virtual fields are serialized
ExamModeSchema.set('toJSON', { virtuals: true });
ExamModeSchema.set('toObject', { virtuals: true });

export const ExamMode = mongoose.model<IExamMode>('ExamMode', ExamModeSchema);
export default ExamMode;


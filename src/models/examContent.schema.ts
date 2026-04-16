import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamContent Interface - File management for exams
 */
export interface IExamContent extends Document {
  examId: mongoose.Types.ObjectId;
  fileName: string;
  filePath: string; // S3 path
  fileType: string;
  fileSize: number;
  uploadedBy: mongoose.Types.ObjectId; // Teacher ID
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamContent Schema - Manages exam-related files
 */
const ExamContentSchema = new Schema({
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    index: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  filePath: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  fileType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
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
  collection: 'exam_contents'
});

// Indexes for better performance
ExamContentSchema.index({ examId: 1, createdAt: -1 });
ExamContentSchema.index({ tenantId: 1, uploadedBy: 1 });

// Ensure virtual fields are serialized
ExamContentSchema.set('toJSON', { virtuals: true });
ExamContentSchema.set('toObject', { virtuals: true });

export const ExamContent = mongoose.model<IExamContent>('ExamContent', ExamContentSchema);
export default ExamContent;


import mongoose, { Schema, Document } from 'mongoose';
import { CredentialCategory, CREDENTIAL_CATEGORY_ARRAY } from '../utils/constants/credentialEnums';

/**
 * ExamCredential Interface - Credentials earned from exams
 */
export interface IExamCredential extends Document {
  credentialName: string;
  description?: string;
  credentialType: string;
  examId?: mongoose.Types.ObjectId;
  /** Reference to credential template/definition (e.g. "Good Performance" template id). Used to exclude exams in current-class when assigning same credential. */
  credentialId?: mongoose.Types.ObjectId;
  /** Denormalized from exam.classId for class-scoped queries. */
  classId?: mongoose.Types.ObjectId;
  credentialCategory: CredentialCategory;
  otherDetails?: string;
  studentId: mongoose.Types.ObjectId;
  issuedDate: Date;
  validUntil?: Date;
  credentialUrl?: string;
  verificationCode: string;
  isActive: boolean;
  tenantId: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamCredential Schema
 */
const ExamCredentialSchema = new Schema({
  credentialName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000
  },
  credentialType: {
    type: String,
    required: true,
    maxlength: 50
  },
  examId: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'Exam',
    index: true
  },
  credentialId: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'CredentialTemplate',
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'Class',
    index: true
  },
  credentialCategory: {
    type: String,
    enum: CREDENTIAL_CATEGORY_ARRAY,
    default: CredentialCategory.EXAM,
    index: true
  },
  otherDetails: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000
  },
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  issuedDate: {
    type: Date,
    required: true,
    index: true
  },
  validUntil: {
    type: Date
  },
  credentialUrl: {
    type: String,
    maxlength: 500
  },
  verificationCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: false, // Optional for backward compatibility
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true, collection: 'exam_credentials' });

// Indexes
ExamCredentialSchema.index({ studentId: 1, isDeleted: 1, isActive: 1 });
ExamCredentialSchema.index({ tenantId: 1, issuedDate: -1 });
ExamCredentialSchema.index({ examId: 1, studentId: 1 });
ExamCredentialSchema.index({ studentId: 1, credentialId: 1, isDeleted: 1 });
ExamCredentialSchema.index({ classId: 1, isDeleted: 1 });

export const ExamCredential = mongoose.model<IExamCredential>('ExamCredential', ExamCredentialSchema);
export default ExamCredential;


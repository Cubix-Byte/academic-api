import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamSettings Interface - Exam configuration and settings
 */
export interface IExamSettings extends Document {
  examId: mongoose.Types.ObjectId;
  isAdaptiveDifficultyEnabled: boolean;
  allowedQuestionTypes: string[];
  aiGenerationPrompt?: string;
  contentExternalLink?: string;
  percipioContentLibraryIntegration: boolean;
  moeDelimaRepositoryIntegration: boolean;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamSettings Schema - Advanced exam configuration
 */
const ExamSettingsSchema = new Schema({
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    unique: true,
    index: true
  },
  isAdaptiveDifficultyEnabled: {
    type: Boolean,
    default: false
  },
  allowedQuestionTypes: {
    type: [String],
    enum: ['MCQs', 'Fill in the Blanks', 'True/False', 'Short Answers', 'Long Answers'],
    default: ['MCQs']
  },
  aiGenerationPrompt: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  contentExternalLink: {
    type: String,
    trim: true,
    maxlength: 500
  },
  percipioContentLibraryIntegration: {
    type: Boolean,
    default: false
  },
  moeDelimaRepositoryIntegration: {
    type: Boolean,
    default: false
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'exam_settings'
});

// Indexes for better performance
ExamSettingsSchema.index({ tenantId: 1, examId: 1 });

// Ensure virtual fields are serialized
ExamSettingsSchema.set('toJSON', { virtuals: true });
ExamSettingsSchema.set('toObject', { virtuals: true });

export const ExamSettings = mongoose.model<IExamSettings>('ExamSettings', ExamSettingsSchema);
export default ExamSettings;


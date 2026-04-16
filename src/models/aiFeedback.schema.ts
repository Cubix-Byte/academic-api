import mongoose, { Schema, Document } from 'mongoose';

/**
 * AIFeedback Interface - AI-generated feedback for students
 */
export interface IAIFeedback extends Document {
  attemptId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  feedbackText: string;
  feedbackType: 'Motivational' | 'Constructive' | 'Improvement';
  isGeneratedByAI: boolean;
  teacherId?: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AIFeedback Schema - Manages AI and teacher feedback
 */
const AIFeedbackSchema = new Schema({
  attemptId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamAttempt',
    index: true
  },
  questionId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'ExamQuestion',
    index: true
  },
  feedbackText: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  feedbackType: {
    type: String,
    enum: ['Motivational', 'Constructive', 'Improvement'],
    required: true,
    index: true
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
  collection: 'ai_feedbacks'
});

// Indexes for high performance
AIFeedbackSchema.index({ attemptId: 1, questionId: 1 });
AIFeedbackSchema.index({ tenantId: 1, feedbackType: 1 });
AIFeedbackSchema.index({ isGeneratedByAI: 1, createdAt: -1 });

// Ensure virtual fields are serialized
AIFeedbackSchema.set('toJSON', { virtuals: true });
AIFeedbackSchema.set('toObject', { virtuals: true });

export const AIFeedback = mongoose.model<IAIFeedback>('AIFeedback', AIFeedbackSchema);
export default AIFeedback;


import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamAIPromptHistory Interface - AI prompt history logs
 */
export interface IExamAIPromptHistory extends Document {
  examId: mongoose.Types.ObjectId;
  questionId?: mongoose.Types.ObjectId;
  prompt: string;
  response: string;
  aiModel: string; // Renamed from 'model' to avoid conflict with mongoose Document
  tokensUsed: number;
  teacherId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ExamAIPromptHistory Schema - Logs all AI interactions
 */
const ExamAIPromptHistorySchema = new Schema({
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    index: true
  },
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'ExamQuestion',
    index: true
  },
  prompt: {
    type: String,
    required: true,
    trim: true
  },
  response: {
    type: String,
    required: true,
    trim: true
  },
  aiModel: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  tokensUsed: {
    type: Number,
    required: true,
    min: 0
  },
  teacherId: {
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
  collection: 'exam_ai_prompt_history'
});

// Indexes for better performance
ExamAIPromptHistorySchema.index({ examId: 1, createdAt: -1 });
ExamAIPromptHistorySchema.index({ teacherId: 1, createdAt: -1 });
ExamAIPromptHistorySchema.index({ tenantId: 1, aiModel: 1 });

// Ensure virtual fields are serialized
ExamAIPromptHistorySchema.set('toJSON', { virtuals: true });
ExamAIPromptHistorySchema.set('toObject', { virtuals: true });

export const ExamAIPromptHistory = mongoose.model<IExamAIPromptHistory>('ExamAIPromptHistory', ExamAIPromptHistorySchema);
export default ExamAIPromptHistory;


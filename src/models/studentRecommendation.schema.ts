import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentRecommendation Interface - Learning recommendations for students
 */
export interface IStudentRecommendation extends Document {
  studentId: mongoose.Types.ObjectId;
  recommendationType: 'RetryQuestions' | 'ReviseTopic' | 'PracticeExam' | 'WatchVideo' | 'ReadArticle';
  title: string;
  description: string;
  targetEntityId: mongoose.Types.ObjectId; // Question IDs, Topic ID, Exam ID, etc.
  targetEntityType: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  isCompleted: boolean;
  completedAt?: Date;
  generatedBy: string; // AI, Teacher, System
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentRecommendation Schema - Personalized learning recommendations
 */
const StudentRecommendationSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  recommendationType: {
    type: String,
    enum: ['RetryQuestions', 'ReviseTopic', 'PracticeExam', 'WatchVideo', 'ReadArticle'],
    required: true,
    index: true
  },
  title: {
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
  targetEntityId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  targetEntityType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date
  },
  generatedBy: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'student_recommendations'
});

// Indexes for high performance
StudentRecommendationSchema.index({ studentId: 1, isCompleted: 1, priority: 1 });
StudentRecommendationSchema.index({ tenantId: 1, recommendationType: 1 });
StudentRecommendationSchema.index({ generatedBy: 1, createdAt: -1 });

// Ensure virtual fields are serialized
StudentRecommendationSchema.set('toJSON', { virtuals: true });
StudentRecommendationSchema.set('toObject', { virtuals: true });

export const StudentRecommendation = mongoose.model<IStudentRecommendation>('StudentRecommendation', StudentRecommendationSchema);
export default StudentRecommendation;


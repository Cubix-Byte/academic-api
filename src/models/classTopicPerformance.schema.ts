import mongoose, { Schema, Document } from 'mongoose';

/**
 * ClassTopicPerformance Interface - Topic-wise class performance aggregation
 */
export interface IClassTopicPerformance extends Document {
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  topicName: string;
  weightageInExam: number; // Percentage/weightage of topic in exam
  totalMarks: number; // Total marks for this topic in exam
  totalStudents: number; // Count of students who attempted
  averagePerformance: number; // Average percentage/score
  totalMarksObtained: number; // Sum of marks obtained by all students
  totalMarksPossible: number; // Sum of max marks possible
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ClassTopicPerformance Schema - Aggregates topic performance per exam
 */
const ClassTopicPerformanceSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Class',
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Subject',
    index: true
  },
  examId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Exam',
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  topicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  weightageInExam: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  totalStudents: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  averagePerformance: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  totalMarksObtained: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalMarksPossible: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'class_topic_performance'
});

// Unique index: one record per class/subject/exam/topic combination
ClassTopicPerformanceSchema.index({ classId: 1, subjectId: 1, examId: 1, topicName: 1 }, { unique: true });

// Index for querying by class and subject
ClassTopicPerformanceSchema.index({ classId: 1, subjectId: 1 });

// Index for querying by exam
ClassTopicPerformanceSchema.index({ examId: 1 });

// Index for tenant-based queries
ClassTopicPerformanceSchema.index({ tenantId: 1, classId: 1, subjectId: 1 });

// Ensure virtual fields are serialized
ClassTopicPerformanceSchema.set('toJSON', { virtuals: true });
ClassTopicPerformanceSchema.set('toObject', { virtuals: true });

export const ClassTopicPerformance = mongoose.model<IClassTopicPerformance>('ClassTopicPerformance', ClassTopicPerformanceSchema);
export default ClassTopicPerformance;


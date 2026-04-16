import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentTopicPerformance Interface - Topic-wise student performance tracking
 */
export interface IStudentTopicPerformance extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  topicName: string;
  weightageInExam: number; // Percentage/weightage of topic in exam
  totalMarks: number; // Total marks for this topic in exam
  marksObtained: number; // Marks obtained by student in this topic
  marksPossible: number; // Max marks possible for student in this topic
  performance: number; // Percentage/score for this topic
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StudentTopicPerformance Schema - Tracks topic performance per student per exam
 */
const StudentTopicPerformanceSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
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
  marksObtained: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  marksPossible: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  performance: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
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
  collection: 'student_topic_performance'
});

// Unique index: one record per student/class/subject/exam/topic combination
StudentTopicPerformanceSchema.index({ studentId: 1, classId: 1, subjectId: 1, examId: 1, topicName: 1 }, { unique: true });

// Index for querying by student, class and subject
StudentTopicPerformanceSchema.index({ studentId: 1, classId: 1, subjectId: 1 });

// Index for querying by student and subject (cross-class)
StudentTopicPerformanceSchema.index({ studentId: 1, subjectId: 1 });

// Index for querying by exam
StudentTopicPerformanceSchema.index({ examId: 1, studentId: 1 });

// Index for tenant-based queries
StudentTopicPerformanceSchema.index({ tenantId: 1, studentId: 1, classId: 1, subjectId: 1 });

// Ensure virtual fields are serialized
StudentTopicPerformanceSchema.set('toJSON', { virtuals: true });
StudentTopicPerformanceSchema.set('toObject', { virtuals: true });

export const StudentTopicPerformance = mongoose.model<IStudentTopicPerformance>('StudentTopicPerformance', StudentTopicPerformanceSchema);
export default StudentTopicPerformance;



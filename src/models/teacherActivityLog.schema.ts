import mongoose, { Schema, Document } from 'mongoose';

/**
 * TeacherActivityLog Interface - Teacher activity tracking
 */
export interface ITeacherActivityLog extends Document {
  teacherId: mongoose.Types.ObjectId;
  activityType: 'ExamCreated' | 'ExamEdited' | 'ExamScheduled' | 'PracticeExamCreated' | 'PracticeExamEdited' | 'CredentialCreated' | 'CredentialAssigned';
  activityDescription: string;
  relatedEntityId: mongoose.Types.ObjectId; // Exam ID, Credential ID, etc.
  relatedEntityType: string; // 'Exam', 'PracticeExam', 'Credential'
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId; // Optional - for credential assignment
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TeacherActivityLog Schema - Logs all teacher activities
 */
const TeacherActivityLogSchema = new Schema({
  teacherId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  activityType: {
    type: String,
    enum: ['ExamCreated', 'ExamEdited', 'ExamScheduled', 'PracticeExamCreated', 'PracticeExamEdited', 'CredentialCreated', 'CredentialAssigned'],
    required: true,
    index: true
  },
  activityDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  relatedEntityId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  relatedEntityType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  classId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    required: false,
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'teacher_activity_logs'
});

// Indexes for high performance
TeacherActivityLogSchema.index({ teacherId: 1, createdAt: -1 });
TeacherActivityLogSchema.index({ tenantId: 1, activityType: 1, createdAt: -1 });
TeacherActivityLogSchema.index({ classId: 1, createdAt: -1 });
TeacherActivityLogSchema.index({ subjectId: 1, createdAt: -1 });
TeacherActivityLogSchema.index({ classId: 1, subjectId: 1, createdAt: -1 });
TeacherActivityLogSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
TeacherActivityLogSchema.index({ tenantId: 1, createdAt: -1 });

// Ensure virtual fields are serialized
TeacherActivityLogSchema.set('toJSON', { virtuals: true });
TeacherActivityLogSchema.set('toObject', { virtuals: true });

export const TeacherActivityLog = mongoose.model<ITeacherActivityLog>('TeacherActivityLog', TeacherActivityLogSchema);
export default TeacherActivityLog;



import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentActivityLog Interface - Student activity tracking
 */
export interface IStudentActivityLog extends Document {
	studentId: mongoose.Types.ObjectId;
	activityType:
		| 'ExamCompleted'
		| 'PracticeCompleted'
		| 'BadgeEarned'
		| 'CertificateEarned';
	activityDescription: string;
	relatedEntityId: mongoose.Types.ObjectId; // Exam ID, Credential ID, etc.
	relatedEntityType: string;
	classId: mongoose.Types.ObjectId;
	subjectId: mongoose.Types.ObjectId;
	tenantId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	duration?: number; // Duration of the activity in seconds
	score?: number; // Score achieved in the activity
	title?: string; // Title of the activity
	status?: 'completed' | 'in-progress'; // Status of the activity
}

/**
 * StudentActivityLog Schema - Logs all student activities
 */
const StudentActivityLogSchema = new Schema(
	{
		studentId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		activityType: {
			type: String,
			enum: [
				'ExamCompleted',
				'PracticeCompleted',
				'BadgeEarned',
				'CertificateEarned',
			],
			required: true,
			index: true,
		},
		activityDescription: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
		relatedEntityId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		relatedEntityType: {
			type: String,
			required: true,
			trim: true,
			maxlength: 50,
		},
		classId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		subjectId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		tenantId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
	},
	{
		timestamps: true,
		collection: 'student_activity_logs',
	},
);

// Indexes for high performance
StudentActivityLogSchema.index({ studentId: 1, createdAt: -1 });
StudentActivityLogSchema.index({ tenantId: 1, activityType: 1, createdAt: -1 });
StudentActivityLogSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
StudentActivityLogSchema.index({ classId: 1, createdAt: -1 });
StudentActivityLogSchema.index({ subjectId: 1, createdAt: -1 });
StudentActivityLogSchema.index({ classId: 1, subjectId: 1, createdAt: -1 });
StudentActivityLogSchema.index({ tenantId: 1, createdAt: -1 });

// Ensure virtual fields are serialized
StudentActivityLogSchema.set('toJSON', { virtuals: true });
StudentActivityLogSchema.set('toObject', { virtuals: true });

export const StudentActivityLog = mongoose.model<IStudentActivityLog>(
	'StudentActivityLog',
	StudentActivityLogSchema,
);
export default StudentActivityLog;

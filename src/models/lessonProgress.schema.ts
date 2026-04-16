import mongoose, { Schema, Document } from 'mongoose';

/**
 * LessonProgress Interface - Lesson progress tracking for students
 */
export interface ILessonProgress extends Document {
	studentId: mongoose.Types.ObjectId;
	lessonId: mongoose.Types.ObjectId;
	lessonTitle: string;
	subject: string;
	status: 'not-started' | 'in-progress' | 'completed' | 'reviewed';
	progress: number; // 0-100
	lastAccessed: Date;
	timeSpent: number; // in minutes
	completedAt?: Date;
	score?: number; // 0-100, for quizzes/assessments in the lesson
	metadata?: Record<string, any>;
	tenantId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * LessonProgress Schema - Tracks student progress through lessons
 */
const LessonProgressSchema = new Schema(
	{
		studentId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		lessonId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		lessonTitle: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500,
		},
		subject: {
			type: String,
			required: true,
			index: true,
			trim: true,
			maxlength: 100,
		},
		status: {
			type: String,
			required: true,
			enum: ['not-started', 'in-progress', 'completed', 'reviewed'],
			default: 'not-started',
			index: true,
		},
		progress: {
			type: Number,
			required: true,
			min: 0,
			max: 100,
			default: 0,
		},
		lastAccessed: {
			type: Date,
			default: Date.now,
			index: true,
		},
		timeSpent: {
			type: Number,
			required: true,
			min: 0,
			default: 0,
		},
		completedAt: {
			type: Date,
			index: true,
		},
		score: {
			type: Number,
			min: 0,
			max: 100,
		},
		metadata: {
			type: Schema.Types.Mixed,
		},
		tenantId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'lesson_progress' },
);

// Indexes for common queries
LessonProgressSchema.index({ studentId: 1, status: 1 });
LessonProgressSchema.index({ studentId: 1, subject: 1, status: 1 });
LessonProgressSchema.index({ studentId: 1, lastAccessed: -1 });
LessonProgressSchema.index({ tenantId: 1, status: 1 });

export const LessonProgress = mongoose.model<ILessonProgress>(
	'LessonProgress',
	LessonProgressSchema,
);

export default LessonProgress;

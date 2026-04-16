import mongoose, { Schema, Document } from 'mongoose';

/**
 * ExamAchievement Interface - Student achievements
 */
export interface IExamAchievement extends Document {
	achievementName: string;
	description: string;
	achievementType: string;
	category: string;
	icon: string;
	studentId: mongoose.Types.ObjectId;
	teacherId?: mongoose.Types.ObjectId;
	teacherName?: string;
	unlockedDate: Date;
	progress: number;
	isUnlocked: boolean;
	tenantId: mongoose.Types.ObjectId;
	isDeleted: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * ExamAchievement Schema
 */
const ExamAchievementSchema = new Schema(
	{
		achievementName: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200,
		},
		description: {
			type: String,
			required: true,
			trim: true,
			maxlength: 1000,
		},
		achievementType: {
			type: String,
			required: true,
			maxlength: 50,
		},
		category: {
			type: String,
			required: true,
			maxlength: 50,
			index: true,
		},
		icon: {
			type: String,
			required: true,
			maxlength: 500,
		},
		studentId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		teacherId: {
			type: Schema.Types.ObjectId,
			required: false,
			index: true,
		},
		teacherName: {
			type: String,
			required: false,
			trim: true,
			maxlength: 200,
		},
		unlockedDate: {
			type: Date,
			required: true,
			index: true,
		},
		progress: {
			type: Number,
			required: true,
			min: 0,
			max: 100,
			default: 0,
		},
		isUnlocked: {
			type: Boolean,
			default: false,
			index: true,
		},
		tenantId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		isDeleted: {
			type: Boolean,
			default: false,
			index: true,
		},
	},
	{ timestamps: true, collection: 'exam_achievements' },
);

// Indexes
ExamAchievementSchema.index({ studentId: 1, isDeleted: 1, isUnlocked: 1 });
ExamAchievementSchema.index({ tenantId: 1, unlockedDate: -1 });
ExamAchievementSchema.index({ category: 1, isUnlocked: 1 });

export const ExamAchievement = mongoose.model<IExamAchievement>(
	'ExamAchievement',
	ExamAchievementSchema,
);
export default ExamAchievement;

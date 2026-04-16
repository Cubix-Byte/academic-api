import { LessonProgress, ILessonProgress } from '../models';
export { ILessonProgress };

/**
 * LessonProgress Repository - Data access layer for lesson progress
 */

export const getStudentLessonProgress = async (
	studentId: string,
	startDate?: Date,
	endDate?: Date,
): Promise<ILessonProgress[]> => {
	const query: any = { studentId };

	if (startDate || endDate) {
		query.lastAccessed = {};
		if (startDate) query.lastAccessed.$gte = startDate;
		if (endDate) query.lastAccessed.$lte = endDate;
	}

	return LessonProgress.find(query).sort({ lastAccessed: -1 }).lean().exec();
};

export const getCompletedLessons = async (
	studentId: string,
	subject?: string,
	limit: number = 10,
): Promise<ILessonProgress[]> => {
	const query: any = {
		studentId,
		status: { $in: ['completed', 'reviewed'] },
	};

	if (subject) {
		query.subject = subject;
	}

	return LessonProgress.find(query)
		.sort({ completedAt: -1 })
		.limit(limit)
		.lean()
		.exec();
};

export const getSubjectProgress = async (
	studentId: string,
	subject: string,
): Promise<{
	totalLessons: number;
	completedLessons: number;
	inProgressLessons: number;
	averageScore: number | null;
	totalTimeSpent: number;
}> => {
	const [stats] = await LessonProgress.aggregate([
		{ $match: { studentId, subject } },
		{
			$group: {
				_id: null,
				totalLessons: { $sum: 1 },
				completedLessons: {
					$sum: {
						$cond: [{ $in: ['$status', ['completed', 'reviewed']] }, 1, 0],
					},
				},
				inProgressLessons: {
					$sum: {
						$cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0],
					},
				},
				totalScore: { $sum: { $ifNull: ['$score', 0] } },
				scoreCount: {
					$sum: { $cond: [{ $ifNull: ['$score', false] }, 1, 0] },
				},
				totalTimeSpent: { $sum: { $ifNull: ['$timeSpent', 0] } },
			},
		},
	]);

	if (!stats) {
		return {
			totalLessons: 0,
			completedLessons: 0,
			inProgressLessons: 0,
			averageScore: null,
			totalTimeSpent: 0,
		};
	}

	return {
		totalLessons: stats.totalLessons,
		completedLessons: stats.completedLessons,
		inProgressLessons: stats.inProgressLessons,
		averageScore:
			stats.scoreCount > 0
				? Math.round((stats.totalScore / stats.scoreCount) * 10) / 10
				: null,
		totalTimeSpent: stats.totalTimeSpent,
	};
};

export const createLessonProgress = async (
	data: Partial<ILessonProgress>,
): Promise<ILessonProgress> => {
	const progress = new LessonProgress(data);
	return progress.save();
};

export const updateLessonProgress = async (
	id: string,
	updates: Partial<ILessonProgress>,
): Promise<ILessonProgress | null> => {
	return LessonProgress.findByIdAndUpdate(id, updates, { new: true }).exec();
};

export const getLessonProgressById = async (
	id: string,
): Promise<ILessonProgress | null> => {
	return LessonProgress.findById(id).exec();
};

export const deleteLessonProgress = async (id: string): Promise<boolean> => {
	const result = await LessonProgress.findByIdAndDelete(id).exec();
	return result !== null;
};

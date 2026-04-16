import { StudentActivityLog, IStudentActivityLog } from '../models';
export { IStudentActivityLog };

/**
 * Student Activity Repository - Data access layer for student activities
 */

export const getStudentActivities = async (
	studentId: string,
	startDate: Date,
	endDate: Date,
): Promise<IStudentActivityLog[]> => {
	return StudentActivityLog.find({
		studentId,
		createdAt: { $gte: startDate, $lte: endDate },
	})
		.sort({ createdAt: -1 })
		.lean()
		.exec();
};

export const createStudentActivity = async (
	activityData: Partial<IStudentActivityLog>,
): Promise<IStudentActivityLog> => {
	const activity = new StudentActivityLog(activityData);
	return activity.save();
};

export const updateStudentActivity = async (
	id: string,
	updates: Partial<IStudentActivityLog>,
): Promise<IStudentActivityLog | null> => {
	return StudentActivityLog.findByIdAndUpdate(id, updates, {
		new: true,
	}).exec();
};

export const getRecentActivities = async (
	studentId: string,
	limit: number = 10,
): Promise<IStudentActivityLog[]> => {
	return StudentActivityLog.find({ studentId })
		.sort({ createdAt: -1 })
		.limit(limit)
		.lean()
		.exec();
};

export const getActivityByType = async (
	studentId: string,
	activityType: string,
): Promise<IStudentActivityLog[]> => {
	return StudentActivityLog.find({ studentId, activityType })
		.sort({ createdAt: -1 })
		.lean()
		.exec();
};

export const deleteStudentActivity = async (id: string): Promise<boolean> => {
	const result = await StudentActivityLog.findByIdAndDelete(id).exec();
	return result !== null;
};

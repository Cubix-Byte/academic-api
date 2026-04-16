import { Student, Teacher, ExamCredential, CredentialTemplate, ExamStudent } from '../models';
import { DashboardStatistics } from '../types/dashboard.types';
import mongoose from 'mongoose';

/**
 * Dashboard Repository - Data access layer for Dashboard statistics
 */

// Get dashboard statistics
export const getDashboardStatistics = async (
	tenantId: string,
): Promise<DashboardStatistics> => {
	try {
		if (!tenantId) {
			throw new Error('tenantId is required');
		}

		// Count total students (active and not deleted)
		// Student tenantId is stored as string, not ObjectId
		const totalStudentCount = await Student.countDocuments({
			isDeleted: false,
			isActive: true,
			tenantId: tenantId.toString(),
		});

		// Count total teachers (active and not deleted)
		const teachersCount = await Teacher.countDocuments({
			isDeleted: false,
			isActive: true,
			tenantId: tenantId,
		});

		// Count total certificates (active and not deleted)
		const certificatesCount = await CredentialTemplate.countDocuments({
			isDeleted: false,
			tenantId: mongoose.Types.ObjectId.isValid(tenantId)
				? new mongoose.Types.ObjectId(tenantId)
				: tenantId,
		});


		// Calculate overall average score from exam_students
		// This includes all students assigned to exams that are graded and published.
		// If a student hasn't attempted/completed the exam, their score is 0.
		const averageScoreResult = await ExamStudent.aggregate([
			{
				$match: {
					tenantId: mongoose.Types.ObjectId.isValid(tenantId)
						? new mongoose.Types.ObjectId(tenantId)
						: tenantId,
					isActive: true, // Only consider active student assignments
				},
			},
			{
				$lookup: {
					from: 'exams',
					localField: 'examId',
					foreignField: '_id',
					as: 'exam',
				},
			},
			{
				$unwind: '$exam',
			},
			{
				$match: {
					'exam.gradingTypeStatus': 'Completed',
					'exam.examStatus': {
						$in: ['Published', 'Released', 'In Progress', 'Completed'],
					},
					'exam.isDeleted': false,
				},
			},
			{
				$project: {
					percentage: {
						$cond: {
							if: { $eq: ['$status', 'Completed'] },
							then: { $ifNull: ['$percentage', 0] },
							else: 0,
						},
					},
				},
			},
			{
				$group: {
					_id: null,
					averagePercentage: { $avg: '$percentage' },
				},
			},
		]);

		const overallAverageScore =
			averageScoreResult.length > 0 && averageScoreResult[0].averagePercentage
				? Math.round(averageScoreResult[0].averagePercentage * 100) / 100
				: undefined;

		return {
			totalStudentCount,
			teachersCount,
			certificatesCount,
			overallAverageScore,
		};
	} catch (error: any) {
		console.error('Error getting dashboard statistics:', error);
		throw error;
	}
};


import {
	StudentProgressReport,
	GetProgressReportRequest,
	ActivityDataPoint,
	RecentActivity,
	SubjectProgress,
	MonthlyProgressSummary,
} from '@/types/report.types';
import {
	IStudentActivityLog,
	getStudentActivities,
} from '../repositories/studentActivity.repository';
import {
	IExamAttempt,
	getStudentExamAttempts,
} from '../repositories/examAttempt.repository';
import {
	ILessonProgress,
	getStudentLessonProgress,
} from '../repositories/lessonProgress.repository';
import mongoose from 'mongoose';

export const getStudentProgressReport = async (
	request: GetProgressReportRequest,
): Promise<StudentProgressReport> => {
	try {
		const { studentId, month, year } = request;
		const now = new Date();
		const targetMonth = month || now.getMonth() + 1; // Default to current month
		const targetYear = year || now.getFullYear(); // Default to current year

		// Get the first and last day of the target month
		const startDate = new Date(targetYear, targetMonth - 1, 1);
		const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

		// Fetch data in parallel
		const [activities, examAttempts, lessonProgress] = await Promise.all([
			getStudentActivities(studentId, startDate, endDate),
			getStudentExamAttempts(studentId, startDate, undefined, endDate),
			getStudentLessonProgress(studentId, startDate, endDate),
		]);

		// Calculate summary
		// const totalStudyTime = activities
		//   .filter((activity: IStudentActivityLog) => activity.activityType === 'study')
		//   .reduce((sum: number, activity: IStudentActivityLog) => sum + (activity.duration || 0), 0);
		const totalStudyTime = 0;

		const completedLessons = lessonProgress.filter(
			(lp: ILessonProgress) => lp.status === 'completed',
		).length;
		const quizzesTaken = examAttempts.length;

		const avgScore =
			examAttempts.length > 0
				? examAttempts.reduce(
						(sum: number, attempt: IExamAttempt) =>
							sum + (attempt.percentage || 0),
						0,
				  ) / examAttempts.length
				: 0;

		// Group activities by date for the chart
		const activityByDate = new Map<
			string,
			{ studyTime: number; quizScores: number[] }
		>();

		activities.forEach((activity: IStudentActivityLog) => {
			const dateStr = activity.createdAt.toISOString().split('T')[0];
			if (!activityByDate.has(dateStr)) {
				activityByDate.set(dateStr, { studyTime: 0, quizScores: [] });
			}
			const dateData = activityByDate.get(dateStr)!;

			if (
				activity.activityType === 'ExamCompleted' ||
				activity.activityType === 'PracticeCompleted'
			) {
				dateData.studyTime += activity.duration || 0;
			} else if (
				activity.activityType === 'BadgeEarned' ||
				activity.activityType === 'CertificateEarned'
			) {
				if (activity.score !== undefined) {
					dateData.quizScores.push(activity.score);
				}
			}
		});

		// Convert to ActivityDataPoint array
		const activityOverview: ActivityDataPoint[] = Array.from(
			activityByDate.entries(),
		).map(([date, data]) => {
			const avgQuizScore =
				data.quizScores.length > 0
					? data.quizScores.reduce(
							(sum: number, score: number) => sum + score,
							0,
					  ) / data.quizScores.length
					: undefined;

			return {
				date,
				studyTime: data.studyTime,
				quizScore: avgQuizScore,
			} as ActivityDataPoint;
		});

		// Get recent activities (last 10)
		const allActivities: RecentActivity[] = [
			...activities.map(
				(activity: IStudentActivityLog) =>
					({
						id: activity._id?.toString() || '',
						timestamp: activity.createdAt.toISOString(),
						activityType: activity.activityType as
							| 'lesson'
							| 'quiz'
							| 'assignment'
							| 'exam',
						title: activity.title,
						subject: activity.subjectId.toString(),
						duration: activity.duration,
						score: activity.score,
					} as RecentActivity),
			),
			...examAttempts.map(
				(attempt: IExamAttempt) =>
					({
						id: attempt._id?.toString() || '',
						timestamp:
							attempt.submittedAt?.toISOString() || new Date().toISOString(),
						activityType: 'exam' as const,
						title: attempt.examName || 'Exam',
						subject: attempt.subjectId?.toString() || 'General',
						score: attempt.percentage,
					} as RecentActivity),
			),
		]
			.sort(
				(a: RecentActivity, b: RecentActivity) =>
					new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
			)
			.slice(0, 10);

		// Calculate subject progress
		const subjectProgress: SubjectProgress[] = Array.from(
			new Set([
				...activities.map((a: IStudentActivityLog) => a.subjectId),
				...examAttempts.map(
					(e: IExamAttempt) => e.subjectId?.toString() || 'General',
				),
			]),
		).map((subject: string | mongoose.Types.ObjectId) => {
			const subjectStr = subject.toString();
			const subjectActivities = activities.filter(
				(a: IStudentActivityLog) => a.subjectId.toString() === subjectStr,
			);
			const subjectExams = examAttempts.filter(
				(e: IExamAttempt) => e.subjectId?.toString() === subjectStr,
			);
			const completedLessons = subjectActivities.filter(
				(a: IStudentActivityLog) => a.status === 'completed',
			).length;
			const avgScore =
				subjectExams.length > 0
					? subjectExams.reduce(
							(sum: number, e: IExamAttempt) => sum + (e.percentage || 0),
							0,
					  ) / subjectExams.length
					: 0;

			// Simple progress calculation (this can be more sophisticated)
			const progress = Math.min(100, completedLessons * 2 + avgScore * 0.8);

			return {
				subjectId: subjectStr.toLowerCase().replace(/\s+/g, '-'),
				subjectName: subjectStr,
				progress,
				lastActivity:
					subjectActivities[0]?.createdAt.toISOString() ||
					new Date().toISOString(),
			} as SubjectProgress;
		});

		// Build the final response
		const summary: MonthlyProgressSummary = {
			totalStudyTime: Math.round(totalStudyTime / 60), // convert to hours
			completedLessons,
			quizzesTaken,
			averageScore: Math.round(avgScore * 10) / 10, // round to 1 decimal
			month: startDate.toLocaleString('default', {
				month: 'long',
				year: 'numeric',
			}),
		};

		const report: StudentProgressReport = {
			summary,
			activityOverview,
			recentActivities: allActivities,
			subjectProgress,
		};

		return report;
	} catch (error) {
		console.error('Error generating progress report:', error);
		throw new Error('Failed to generate progress report');
	}
// ... (existing helper function and end of file)
};

import * as studentReportService from './studentReport.service';
import { Student } from '../models';
import { GetComprehensiveReportRequest } from '@/types/report.types';
import { StudentData } from '@/types/studentReport.types';

export const getComprehensiveStudentReport = async (
    request: GetComprehensiveReportRequest
): Promise<StudentData> => {
    const { studentId, tenantId, classId, subjectId, requestingUserId } = request;
    
    let targetClassId = classId;

    if (!targetClassId) {
         // Resolve classId from student if not provided
         const student = await Student.findOne({ _id: studentId, tenantId, isDeleted: false }).select('classId');
         if (!student) {
             throw new Error('Student not found');
         }
         
         if (!student.classId) {
             throw new Error('Student is not assigned to a class');
         }
         targetClassId = student.classId.toString();
    }

    // Call the specific sub-service for report generation
    return studentReportService.getStudentPdfReport(
        studentId,
        targetClassId,
        tenantId,
        subjectId,
        request.examId,
        requestingUserId
    );
};

import mongoose from 'mongoose';
import { ExamStudent, IExamStudent } from '../models';

/**
 * ExamStudent Repository - Data access layer for Exam-Student relationship management
 */

// Assign student to exam
export const assignStudentToExam = async (data: {
	examId: string;
	studentId: string;
	classId: string;
	subjectId: string;
	batchId: string;
	tenantId: string;
}): Promise<IExamStudent> => {
	try {
		// Check if already assigned
		const existing = await ExamStudent.findOne({
			examId: data.examId,
			studentId: data.studentId,
		});

		if (existing) {
			// Reactivate if previously deactivated
			if (!existing.isActive) {
				existing.isActive = true;
				return await existing.save();
			}
			return existing;
		}

		const examStudent = new ExamStudent(data);
		return await examStudent.save();
	} catch (error: any) {
		console.error('Error assigning student to exam:', error);
		throw error;
	}
};

// Bulk assign students to exam
export const bulkAssignStudentsToExam = async (
	students: Array<{
		examId: string;
		studentId: string;
		classId: string;
		subjectId: string;
		batchId: string;
		tenantId: string;
	}>,
	session?: mongoose.ClientSession,
): Promise<{ assignedCount: number; alreadyAssignedCount: number }> => {
	try {
		if (students.length === 0) {
			return { assignedCount: 0, alreadyAssignedCount: 0 };
		}

		// Get existing active assignments to count alreadyAssignedCount
		const examId = students[0].examId;
		const studentIds = students.map(
			(s) => new mongoose.Types.ObjectId(s.studentId),
		);

		const existingActive = await ExamStudent.find(
			{
				examId: new mongoose.Types.ObjectId(examId),
				studentId: { $in: studentIds },
				isActive: true,
			},
			null,
			{ session },
		).lean();

		const existingActiveStudentIds = new Set(
			existingActive.map((e) => e.studentId.toString()),
		);

		// Build bulkWrite operations using atomic upsert
		const bulkOps = students.map((student) => ({
			updateOne: {
				filter: {
					examId: new mongoose.Types.ObjectId(student.examId),
					studentId: new mongoose.Types.ObjectId(student.studentId),
				},
				update: {
					$set: {
						isActive: true,
						classId: new mongoose.Types.ObjectId(student.classId),
						subjectId: new mongoose.Types.ObjectId(student.subjectId),
						batchId: new mongoose.Types.ObjectId(student.batchId),
						tenantId: new mongoose.Types.ObjectId(student.tenantId),
					},
					// Only set these fields on insert (new documents)
					$setOnInsert: {
						status: 'Pending',
						gradingStatus: 'Waiting for Grading',
					},
				},
				upsert: true,
			},
		}));

		// Execute bulkWrite atomically
		const bulkWriteOptions: any = { ordered: false };
		if (session) {
			bulkWriteOptions.session = session;
		}

		await ExamStudent.bulkWrite(bulkOps, bulkWriteOptions);

		// Calculate counts
		const alreadyAssignedCount = existingActiveStudentIds.size;
		const assignedCount = students.length - alreadyAssignedCount;

		return { assignedCount, alreadyAssignedCount };
	} catch (error: any) {
		console.error('Error bulk assigning students to exam:', error);
		throw error;
	}
};

// Remove student from exam
export const removeStudentFromExam = async (
	examId: string,
	studentId: string,
): Promise<IExamStudent | null> => {
	try {
		return await ExamStudent.findOneAndUpdate(
			{ examId, studentId },
			{ $set: { isActive: false } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error removing student from exam:', error);
		throw error;
	}
};

// Get all students for an exam
export const getStudentsForExam = async (
	examId: string,
): Promise<IExamStudent[]> => {
	try {
		return await ExamStudent.find({
			examId: examId,
			isActive: true,
		}).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error getting students for exam:', error);
		throw error;
	}
};

// Get all exams for a student
export const getExamsForStudent = async (
	studentId: string,
	tenantId: string,
): Promise<IExamStudent[]> => {
	try {
		return await ExamStudent.find({
			studentId: studentId,
			tenantId: tenantId,
			isActive: true,
		}).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error getting exams for student:', error);
		throw error;
	}
};

// Count students for exam
export const countStudentsForExam = async (examId: string): Promise<number> => {
	try {
		return await ExamStudent.countDocuments({
			examId: examId,
			isActive: true,
		});
	} catch (error: any) {
		console.error('Error counting students for exam:', error);
		throw error;
	}
};

// Check if student is assigned to exam
export const isStudentAssignedToExam = async (
	examId: string,
	studentId: string,
): Promise<boolean> => {
	try {
		const assignment = await ExamStudent.findOne({
			examId: examId,
			studentId: studentId,
			isActive: true,
		});
		return !!assignment;
	} catch (error: any) {
		console.error('Error checking student assignment:', error);
		throw error;
	}
};

// Get student IDs for exam
export const getStudentIdsForExam = async (
	examId: string,
): Promise<string[]> => {
	try {
		const assignments = await ExamStudent.find({
			examId: examId,
			isActive: true,
		})
			.select('studentId')
			.lean();

		return assignments.map((a) => a.studentId.toString());
	} catch (error: any) {
		console.error('Error getting student IDs for exam:', error);
		throw error;
	}
};

/**
 * Get student IDs who haven't attempted the exam yet
 * For "Exam Expiring" notifications - only notify those who haven't taken it
 */
export const getStudentIdsNotAttempted = async (
	examId: string,
): Promise<string[]> => {
	try {
		const assignments = await ExamStudent.find({
			examId: examId,
			isActive: true,
			status: 'Pending', // Only students who haven't started
		})
			.select('studentId')
			.lean();

		return assignments.map((a) => a.studentId.toString());
	} catch (error: any) {
		console.error('Error getting student IDs not attempted:', error);
		throw error;
	}
};

// Remove all students from exam
export const removeAllStudentsFromExam = async (
	examId: string,
	session?: mongoose.ClientSession,
): Promise<void> => {
	try {
		const options = session ? { session } : {};
		await ExamStudent.updateMany(
			{ examId: examId },
			{ $set: { isActive: false } },
			options,
		);
	} catch (error: any) {
		console.error('Error removing all students from exam:', error);
		throw error;
	}
};

// Find exams by student
export const findExamsByStudent = async (
	studentId: string,
): Promise<IExamStudent[]> => {
	try {
		return await ExamStudent.find({
			studentId: studentId,
			isActive: true,
		}).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error finding exams by student:', error);
		throw error;
	}
};

// Check if student is assigned to exam (alias)
export const checkStudentAssignedToExam = isStudentAssignedToExam;

// Update exam student status
export const updateExamStudentStatus = async (
	examId: string,
	studentId: string,
	status: 'Pending' | 'Started' | 'Completed',
): Promise<IExamStudent | null> => {
	try {
		return await ExamStudent.findOneAndUpdate(
			{ examId: examId, studentId: studentId, isActive: true },
			{ $set: { status: status } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating exam student status:', error);
		throw error;
	}
};

// Get exam student record
export const getExamStudentRecord = async (
	examId: string,
	studentId: string,
): Promise<IExamStudent | null> => {
	try {
		return await ExamStudent.findOne({
			examId: examId,
			studentId: studentId,
			isActive: true,
		});
	} catch (error: any) {
		console.error('Error getting exam student record:', error);
		throw error;
	}
};

import mongoose from 'mongoose';
import { ExamContent, IExamContent } from '../models';

/**
 * ExamContent Repository - Data access layer for exam content/file management
 */

// Create new exam content entry
export const createExamContent = async (data: {
	examId: string;
	fileName: string;
	filePath: string;
	fileType: string;
	fileSize: number;
	uploadedBy: string;
	tenantId: string;
}): Promise<IExamContent> => {
	try {
		const examContent = new ExamContent(data);
		return await examContent.save();
	} catch (error: any) {
		console.error('Error creating exam content:', error);
		throw error;
	}
};

// Find exam content by ID
export const findExamContentById = async (
	id: string,
): Promise<IExamContent | null> => {
	try {
		return await ExamContent.findById(id);
	} catch (error: any) {
		console.error('Error finding exam content by ID:', error);
		throw error;
	}
};

// Find all content files for an exam
export const findContentByExamId = async (
	examId: string,
): Promise<IExamContent[]> => {
	try {
		return await ExamContent.find({ examId }).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error finding content by exam ID:', error);
		throw error;
	}
};

// Find content files by uploader
export const findContentByUploader = async (
	uploadedBy: string,
	tenantId: string,
): Promise<IExamContent[]> => {
	try {
		return await ExamContent.find({ uploadedBy, tenantId }).sort({
			createdAt: -1,
		});
	} catch (error: any) {
		console.error('Error finding content by uploader:', error);
		throw error;
	}
};

// Find content files by type
export const findContentByFileType = async (
	examId: string,
	fileType: string,
): Promise<IExamContent[]> => {
	try {
		return await ExamContent.find({ examId, fileType }).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error finding content by file type:', error);
		throw error;
	}
};

// Count content files for an exam
export const countContentByExamId = async (examId: string): Promise<number> => {
	try {
		return await ExamContent.countDocuments({ examId });
	} catch (error: any) {
		console.error('Error counting content by exam ID:', error);
		throw error;
	}
};

// Get total file size for an exam
export const getTotalFileSizeForExam = async (
	examId: string,
): Promise<number> => {
	try {
		const result = await ExamContent.aggregate([
			{ $match: { examId } },
			{ $group: { _id: null, totalSize: { $sum: '$fileSize' } } },
		]);

		return result.length > 0 ? result[0].totalSize : 0;
	} catch (error: any) {
		console.error('Error getting total file size for exam:', error);
		throw error;
	}
};

// Get file type statistics for an exam
export const getFileTypeStatsForExam = async (
	examId: string,
): Promise<Array<{ fileType: string; count: number; totalSize: number }>> => {
	try {
		const result = await ExamContent.aggregate([
			{ $match: { examId } },
			{
				$group: {
					_id: '$fileType',
					count: { $sum: 1 },
					totalSize: { $sum: '$fileSize' },
				},
			},
			{ $project: { fileType: '$_id', count: 1, totalSize: 1, _id: 0 } },
		]);

		return result;
	} catch (error: any) {
		console.error('Error getting file type stats for exam:', error);
		throw error;
	}
};

// Update exam content
export const updateExamContentById = async (
	id: string,
	data: {
		fileName?: string;
		filePath?: string;
		fileType?: string;
		fileSize?: number;
	},
): Promise<IExamContent | null> => {
	try {
		return await ExamContent.findByIdAndUpdate(
			id,
			{ $set: data },
			{ new: true, runValidators: true },
		);
	} catch (error: any) {
		console.error('Error updating exam content:', error);
		throw error;
	}
};

// Delete exam content by ID
export const deleteExamContentById = async (
	id: string,
): Promise<IExamContent | null> => {
	try {
		return await ExamContent.findByIdAndDelete(id);
	} catch (error: any) {
		console.error('Error deleting exam content:', error);
		throw error;
	}
};

// Bulk create exam content entries
export const bulkCreateExamContent = async (
	contents: Array<{
		examId: string;
		fileName: string;
		filePath: string;
		fileType: string;
		fileSize: number;
		uploadedBy: string;
		tenantId: string;
	}>,
	session?: any,
): Promise<IExamContent[]> => {
	try {
		const options = session ? { session } : {};
		const result = await ExamContent.insertMany(contents, options);
		return result as unknown as IExamContent[];
	} catch (error: any) {
		console.error('Error bulk creating exam content:', error);
		throw error;
	}
};

// Delete all content files for an exam
export const deleteContentByExamId = async (
	examId: string,
	session?: mongoose.ClientSession,
): Promise<void> => {
	try {
		const options = session ? { session } : {};
		await ExamContent.deleteMany({ examId }, options);
	} catch (error: any) {
		console.error('Error deleting content by exam ID:', error);
		throw error;
	}
};

// Check if file exists for exam
export const checkFileExistsForExam = async (
	examId: string,
	fileName: string,
): Promise<boolean> => {
	try {
		const content = await ExamContent.findOne({ examId, fileName });
		return !!content;
	} catch (error: any) {
		console.error('Error checking if file exists for exam:', error);
		throw error;
	}
};

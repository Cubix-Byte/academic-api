import { ExamSettings, IExamSettings } from '../models';
import mongoose from 'mongoose';

/**
 * ExamSettings Repository - Data access layer for exam settings management
 */

// Create new exam settings
export const createExamSettings = async (
	data: {
		examId: string;
		isAdaptiveDifficultyEnabled?: boolean;
		allowedQuestionTypes?: string[];
		aiGenerationPrompt?: string;
		contentExternalLink?: string;
		percipioContentLibraryIntegration?: boolean;
		moeDelimaRepositoryIntegration?: boolean;
		tenantId: string;
	},
	session?: mongoose.ClientSession,
): Promise<IExamSettings> => {
	try {
		const examSettings = new ExamSettings(data);
		return await examSettings.save({ session });
	} catch (error: any) {
		console.error('Error creating exam settings:', error);
		throw error;
	}
};

// Find exam settings by ID
export const findExamSettingsById = async (
	id: string,
): Promise<IExamSettings | null> => {
	try {
		return await ExamSettings.findById(id);
	} catch (error: any) {
		console.error('Error finding exam settings by ID:', error);
		throw error;
	}
};

// Find exam settings by exam ID
export const findSettingsByExamId = async (
	examId: string,
): Promise<IExamSettings | null> => {
	try {
		return await ExamSettings.findOne({ examId });
	} catch (error: any) {
		console.error('Error finding settings by exam ID:', error);
		throw error;
	}
};

// Update exam settings by exam ID
export const updateSettingsByExamId = async (
	examId: string,
	data: {
		isAdaptiveDifficultyEnabled?: boolean;
		allowedQuestionTypes?: string[];
		aiGenerationPrompt?: string;
		contentExternalLink?: string;
		percipioContentLibraryIntegration?: boolean;
		moeDelimaRepositoryIntegration?: boolean;
	},
): Promise<IExamSettings | null> => {
	try {
		return await ExamSettings.findOneAndUpdate(
			{ examId },
			{ $set: data },
			{ new: true, runValidators: true },
		);
	} catch (error: any) {
		console.error('Error updating exam settings:', error);
		throw error;
	}
};

// Upsert exam settings (create or update)
export const upsertExamSettings = async (
	data: {
		examId: string;
		isAdaptiveDifficultyEnabled?: boolean;
		allowedQuestionTypes?: string[];
		aiGenerationPrompt?: string;
		contentExternalLink?: string;
		percipioContentLibraryIntegration?: boolean;
		moeDelimaRepositoryIntegration?: boolean;
		tenantId: string;
	},
	session?: mongoose.ClientSession,
): Promise<IExamSettings> => {
	try {
		const options: any = {
			upsert: true,
			new: true,
			runValidators: true,
			setDefaultsOnInsert: true,
		};

		if (session) {
			options.session = session;
		}

		const result = await ExamSettings.findOneAndUpdate(
			{ examId: data.examId },
			{ $set: data },
			options,
		);

		return result as IExamSettings;
	} catch (error: any) {
		console.error('Error upserting exam settings:', error);
		throw error;
	}
};

// Delete exam settings by exam ID
export const deleteSettingsByExamId = async (examId: string): Promise<void> => {
	try {
		await ExamSettings.deleteOne({ examId });
	} catch (error: any) {
		console.error('Error deleting settings by exam ID:', error);
		throw error;
	}
};

// Check if settings exist for exam
export const checkSettingsExistForExam = async (
	examId: string,
): Promise<boolean> => {
	try {
		const settings = await ExamSettings.findOne({ examId });
		return !!settings;
	} catch (error: any) {
		console.error('Error checking if settings exist for exam:', error);
		throw error;
	}
};

// Get settings for multiple exams
export const findSettingsByExamIds = async (
	examIds: string[],
): Promise<IExamSettings[]> => {
	try {
		return await ExamSettings.find({
			examId: { $in: examIds.map((id) => new mongoose.Types.ObjectId(id)) },
		});
	} catch (error: any) {
		console.error('Error finding settings by exam IDs:', error);
		throw error;
	}
};

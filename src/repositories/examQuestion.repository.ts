import mongoose from 'mongoose';
import { ExamQuestion, IExamQuestion } from '../models';
import {
	CreateExamQuestionRequest,
	UpdateExamQuestionRequest,
	GetAllExamQuestionsRequest,
} from '../types/examQuestion.types';

/**
 * ExamQuestion Repository - Data access layer for Exam Question management
 */

// Create new exam question
export const createExamQuestion = async (
	data: CreateExamQuestionRequest & { teacherId: string; tenantId: string },
): Promise<IExamQuestion> => {
	try {
		const examQuestion = new ExamQuestion(data);
		return await examQuestion.save();
	} catch (error: any) {
		console.error('Error creating exam question:', error);
		throw error;
	}
};

// Find exam question by ID
export const findExamQuestionById = async (
	id: string,
): Promise<IExamQuestion | null> => {
	try {
		return await ExamQuestion.findOne({ _id: id, isActive: true });
	} catch (error: any) {
		console.error('Error finding exam question by ID:', error);
		throw error;
	}
};

// Find all questions for an exam
export const findQuestionsByExamId = async (
	examId: string,
): Promise<IExamQuestion[]> => {
	try {
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: (examId as any);
		return await ExamQuestion.find({
			examId: examObjectId,
			isActive: true,
		})
			.select(
				'-__v -isActive -createdAt -updatedAt -successRate -teacherId -tenantId -subjectId -classId',
			)
			.sort({ questionNumber: 1 })
			.lean();
	} catch (error: any) {
		console.error('Error finding questions by exam ID:', error);
		throw error;
	}
};

// Find questions with filters
export const findExamQuestions = async (
	params: GetAllExamQuestionsRequest,
): Promise<IExamQuestion[]> => {
	try {
		const { examId, questionType, difficulty, isActive } = params;

		// Build query
		const query: any = { examId };

		if (questionType) {
			query.questionType = questionType;
		}

		if (difficulty) {
			query.difficulty = difficulty;
		}

		if (isActive !== undefined) {
			query.isActive = isActive;
		}

		// Execute query
		const questions = await ExamQuestion.find(query)
			.sort({ questionNumber: 1 })
			.lean();

		return questions as unknown as IExamQuestion[];
	} catch (error: any) {
		console.error('Error finding exam questions:', error);
		throw error;
	}
};

// Count exam questions
export const countExamQuestions = async (examId: string): Promise<number> => {
	try {
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: (examId as any);
		return await ExamQuestion.countDocuments({
			examId: examObjectId,
			isActive: true,
		});
	} catch (error: any) {
		console.error('Error counting exam questions:', error);
		throw error;
	}
};

// Count questions by type
export const countQuestionsByType = async (
	examId: string,
): Promise<Array<{ type: string; count: number }>> => {
	try {
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: (examId as any);
		const result = await ExamQuestion.aggregate([
			{ $match: { examId: examObjectId, isActive: true } },
			{ $group: { _id: '$questionType', count: { $sum: 1 } } },
			{ $project: { type: '$_id', count: 1, _id: 0 } },
		]);
		return result;
	} catch (error: any) {
		console.error('Error counting questions by type:', error);
		throw error;
	}
};

// Count questions by difficulty
export const countQuestionsByDifficulty = async (
	examId: string,
): Promise<Array<{ difficulty: string; count: number }>> => {
	try {
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: (examId as any);
		const result = await ExamQuestion.aggregate([
			{ $match: { examId: examObjectId, isActive: true } },
			{ $group: { _id: '$difficulty', count: { $sum: 1 } } },
			{ $project: { difficulty: '$_id', count: 1, _id: 0 } },
		]);
		return result;
	} catch (error: any) {
		console.error('Error counting questions by difficulty:', error);
		throw error;
	}
};

// Update exam question by ID
export const updateExamQuestionById = async (
	id: string,
	data: UpdateExamQuestionRequest,
): Promise<IExamQuestion | null> => {
	try {
		return await ExamQuestion.findOneAndUpdate(
			{ _id: id, isActive: true },
			{ $set: data },
			{ new: true, runValidators: true },
		);
	} catch (error: any) {
		console.error('Error updating exam question:', error);
		throw error;
	}
};

// Soft delete exam question by ID
export const softDeleteExamQuestionById = async (
	id: string,
): Promise<IExamQuestion | null> => {
	try {
		return await ExamQuestion.findOneAndUpdate(
			{ _id: id, isActive: true },
			{ $set: { isActive: false } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error soft deleting exam question:', error);
		throw error;
	}
};

// Delete all questions for an exam
export const deleteQuestionsByExamId = async (
	examId: string,
	session?: any,
): Promise<void> => {
	try {
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: (examId as any);
		const options = session ? { session } : {};
		await ExamQuestion.updateMany(
			{ examId: examObjectId },
			{ $set: { isActive: false } },
			options,
		);
	} catch (error: any) {
		console.error('Error deleting questions by exam ID:', error);
		throw error;
	}
};

// Soft delete all questions for an exam except provided IDs
export const softDeleteAllExceptIds = async (
	examId: string,
	keepIds: string[],
	session?: any,
): Promise<void> => {
	try {
		const filter: any = { examId: examId, isActive: true };
		if (keepIds && keepIds.length > 0) {
			filter._id = { $nin: keepIds };
		}
		const options = session ? { session } : {};
		await ExamQuestion.updateMany(
			filter,
			{ $set: { isActive: false } },
			options,
		);
	} catch (error: any) {
		console.error('Error soft deleting questions except provided IDs:', error);
		throw error;
	}
};

// Check if question number exists
export const checkQuestionNumberExists = async (
	examId: string,
	questionNumber: number,
	excludeQuestionId?: string,
): Promise<boolean> => {
	try {
		const query: any = {
			examId: mongoose.Types.ObjectId.isValid(examId)
				? new mongoose.Types.ObjectId(examId)
				: examId,
			questionNumber: questionNumber,
			isActive: true,
		};

		if (excludeQuestionId) {
			query._id = { $ne: excludeQuestionId };
		}

		const question = await ExamQuestion.findOne(query);
		return !!question;
	} catch (error: any) {
		console.error('Error checking question number exists:', error);
		throw error;
	}
};

// Get next question number
export const getNextQuestionNumber = async (
	examId: string,
): Promise<number> => {
	try {
		const lastQuestion = await ExamQuestion.findOne({
			examId: examId,
			isActive: true,
		}).sort({ questionNumber: -1 });

		return lastQuestion ? lastQuestion.questionNumber + 1 : 1;
	} catch (error: any) {
		console.error('Error getting next question number:', error);
		throw error;
	}
};

// Bulk create questions
export const bulkCreateQuestions = async (
	questions: Array<
		CreateExamQuestionRequest & { teacherId: string; tenantId: string }
	>,
	session?: any,
): Promise<IExamQuestion[]> => {
	try {
		const options = session ? { session } : {};
		const result = await ExamQuestion.insertMany(questions, options);

		// Convert to plain objects and remove unnecessary fields
		const cleanQuestions = result.map((q: any) => {
			const question = q.toObject ? q.toObject() : q;
			const {
				__v,
				isActive,
				createdAt,
				updatedAt,
				successRate,
				teacherId,
				tenantId,
				subjectId,
				classId,
				examId,
				questionContent,
				...cleanQuestion
			} = question;

			// Remove empty arrays from options
			if (cleanQuestion.options && Array.isArray(cleanQuestion.options)) {
				cleanQuestion.options = cleanQuestion.options.map((opt: any) => {
					const { optionContent, ...cleanOpt } = opt;
					return cleanOpt;
				});
			}

			return cleanQuestion;
		});

		return cleanQuestions as unknown as IExamQuestion[];
	} catch (error: any) {
		console.error('Error bulk creating questions:', error);
		throw error;
	}
};

// Update question success rate
export const updateQuestionSuccessRate = async (
	questionId: string,
	successRate: number,
): Promise<IExamQuestion | null> => {
	try {
		return await ExamQuestion.findByIdAndUpdate(
			questionId,
			{ $set: { successRate } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating question success rate:', error);
		throw error;
	}
};

// Reorder questions
export const reorderQuestions = async (
	questionOrders: Array<{ questionId: string; newQuestionNumber: number }>,
): Promise<void> => {
	try {
		const bulkOps = questionOrders.map((order) => ({
			updateOne: {
				filter: { _id: order.questionId },
				update: { $set: { questionNumber: order.newQuestionNumber } },
			},
		}));

		await ExamQuestion.bulkWrite(bulkOps);
	} catch (error: any) {
		console.error('Error reordering questions:', error);
		throw error;
	}
};

// Get total marks for exam
export const getTotalMarksForExam = async (examId: string): Promise<number> => {
	try {
		console.log(
			'🔍 getTotalMarksForExam called with examId:',
			examId,
			'Type:',
			typeof examId,
		);

		// Convert string to ObjectId for proper matching
		const mongoose = require('mongoose');
		const examObjectId = mongoose.Types.ObjectId.isValid(examId)
			? new mongoose.Types.ObjectId(examId)
			: examId;

		console.log('🔍 Converted examObjectId:', examObjectId);

		// First, let's see what we're matching
		const sampleQuestion = await ExamQuestion.findOne({
			examId: examObjectId,
			isActive: true,
		});
		console.log(
			'🔍 Sample question found:',
			sampleQuestion
				? {
						_id: sampleQuestion._id,
						examId: sampleQuestion.examId,
						marks: sampleQuestion.marks,
						isActive: sampleQuestion.isActive,
				  }
				: 'No questions found',
		);

		const result = await ExamQuestion.aggregate([
			{ $match: { examId: examObjectId, isActive: true } },
			{ $group: { _id: null, totalMarks: { $sum: '$marks' } } },
		]);

		console.log('🔍 Aggregation result:', result);

		const totalMarks = result.length > 0 ? result[0].totalMarks : 0;
		console.log('🔍 Total marks calculated:', totalMarks);

		return totalMarks;
	} catch (error: any) {
		console.error('Error getting total marks:', error);
		throw error;
	}
};

// Upsert by (examId, questionNumber)
export const upsertByExamAndQuestionNumber = async (
	examId: string,
	questionNumber: number,
	data: Partial<IExamQuestion>,
	session?: any,
): Promise<IExamQuestion> => {
	try {
		const options: any = { new: true, upsert: true, setDefaultsOnInsert: true };
		if (session) options.session = session;
		// Avoid updating the same path in multiple operators
		const { isActive: _omitIsActive, ...setData } = data as any;
		return (await ExamQuestion.findOneAndUpdate(
			{ examId, questionNumber },
			{ $set: setData, $setOnInsert: { isActive: true } },
			options,
		)) as unknown as IExamQuestion;
	} catch (error: any) {
		console.error('Error upserting question by exam+number:', error);
		throw error;
	}
};

// Deactivate questions not in the provided question numbers list
export const deactivateNotInQuestionNumbers = async (
	examId: string,
	keepNumbers: number[],
	session?: any,
): Promise<void> => {
	try {
		const filter: any = { examId };
		if (keepNumbers && keepNumbers.length > 0) {
			filter.questionNumber = { $nin: keepNumbers };
		}
		const options = session ? { session } : {};
		await ExamQuestion.updateMany(
			filter,
			{ $set: { isActive: false } },
			options,
		);
	} catch (error: any) {
		console.error('Error deactivating questions not in numbers:', error);
		throw error;
	}
};

import { ExamAnswer, IExamAnswer } from '../models';
import mongoose from 'mongoose';

/**
 * ExamAnswer Repository - Data access layer for exam answers
 */

// Create new exam answer
export const createExamAnswer = async (
	answerData: Partial<IExamAnswer>,
): Promise<IExamAnswer> => {
	try {
		const answer = new ExamAnswer(answerData);
		return await answer.save();
	} catch (error: any) {
		console.error('Error creating exam answer:', error);
		throw error;
	}
};

// Find exam answer by ID
export const findExamAnswerById = async (
	answerId: string,
): Promise<IExamAnswer | null> => {
	try {
		return await ExamAnswer.findById(answerId);
	} catch (error: any) {
		console.error('Error finding exam answer by ID:', error);
		throw error;
	}
};

// Find all answers for an attempt
export const findAnswersByAttemptId = async (
	attemptId: string,
): Promise<IExamAnswer[]> => {
	try {
		return await ExamAnswer.find({
			attemptId: attemptId,
			isDeleted: false,
		}).sort({ questionNumber: 1 });
	} catch (error: any) {
		console.error('Error finding answers by attempt ID:', error);
		throw error;
	}
};

// Find answer by attempt and question
export const findAnswerByAttemptAndQuestion = async (
	attemptId: string,
	questionId: string,
): Promise<IExamAnswer | null> => {
	try {
		return await ExamAnswer.findOne({
			attemptId: attemptId,
			questionId: questionId,
			isDeleted: false,
		});
	} catch (error: any) {
		console.error('Error finding answer by attempt and question:', error);
		throw error;
	}
};

// Upsert exam answer (create or update)
export const upsertExamAnswer = async (
	attemptId: string,
	questionId: string,
	answerData: Partial<IExamAnswer>,
): Promise<IExamAnswer> => {
	try {
		const existingAnswer = await findAnswerByAttemptAndQuestion(
			attemptId,
			questionId,
		);

		if (existingAnswer) {
			// Update existing answer
			if (answerData.studentAnswer !== undefined) {
				existingAnswer.studentAnswer = answerData.studentAnswer;
			}
			if (answerData.timeTakenInSeconds !== undefined) {
				existingAnswer.timeTakenInSeconds = answerData.timeTakenInSeconds;
			}
			existingAnswer.updatedAt = new Date();
			return await existingAnswer.save();
		} else {
			// Create new answer
			return await createExamAnswer(answerData);
		}
	} catch (error: any) {
		console.error('Error upserting exam answer:', error);
		throw error;
	}
};

// Update exam answer with grading
export const updateAnswerGrading = async (
	answerId: string,
	gradingData: {
		isCorrect: boolean;
		marksObtained: number;
		feedback?: string;
		teacherComment?: string;
	},
): Promise<IExamAnswer | null> => {
	try {
		return await ExamAnswer.findByIdAndUpdate(
			answerId,
			{
				...gradingData,
				updatedAt: new Date(),
			},
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating answer grading:', error);
		throw error;
	}
};

// Update exam answer (by attemptId and questionId)
export const updateExamAnswer = async (
	attemptId: string,
	questionId: string,
	updateData: {
		marksObtained?: number;
		teacherComment?: string;
		isCorrect?: boolean;
		feedback?: string;
		// AI Grading fields
		aiGradingNotes?: string;
		aiConfidence?: number;
		aiFeedback?: string;
		aiMarksObtained?: number;
		gradedBy?: 'manual' | 'ai' | 'hybrid';
		aiGradedAt?: Date;
	},
): Promise<IExamAnswer | null> => {
	try {
		const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
			? new mongoose.Types.ObjectId(attemptId)
			: attemptId;

		const questionObjectId = mongoose.Types.ObjectId.isValid(questionId)
			? new mongoose.Types.ObjectId(questionId)
			: questionId;

		// Filter out undefined values to ensure they don't interfere with $set
		const filteredUpdateData: any = {};
		Object.keys(updateData).forEach((key) => {
			if (updateData[key as keyof typeof updateData] !== undefined) {
				filteredUpdateData[key] = updateData[key as keyof typeof updateData];
			}
		});

		return await ExamAnswer.findOneAndUpdate(
			{
				attemptId: attemptObjectId,
				questionId: questionObjectId,
				isDeleted: false,
			},
			{
				$set: {
					...filteredUpdateData,
					updatedAt: new Date(),
				},
			},
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating exam answer:', error);
		throw error;
	}
};

// Bulk update answers with grading
export const bulkUpdateAnswersGrading = async (
	answers: Array<{
		answerId: string;
		isCorrect: boolean;
		marksObtained: number;
		feedback?: string;
	}>,
): Promise<void> => {
	try {
		const bulkOps = answers.map((answer) => ({
			updateOne: {
				filter: { _id: answer.answerId },
				update: {
					$set: {
						isCorrect: answer.isCorrect,
						marksObtained: answer.marksObtained,
						feedback: answer.feedback,
						updatedAt: new Date(),
					},
				},
			},
		}));

		await ExamAnswer.bulkWrite(bulkOps);
	} catch (error: any) {
		console.error('Error bulk updating answers grading:', error);
		throw error;
	}
};

// Count answered questions in attempt
export const countAnsweredQuestions = async (
	attemptId: string,
): Promise<number> => {
	try {
		return await ExamAnswer.countDocuments({
			attemptId: attemptId,
			studentAnswer: { $exists: true, $ne: null },
			isDeleted: false,
		});
	} catch (error: any) {
		console.error('Error counting answered questions:', error);
		throw error;
	}
};

// Calculate total marks obtained for attempt
export const calculateTotalMarksForAttempt = async (
	attemptId: string,
): Promise<number> => {
	try {
		const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
			? new mongoose.Types.ObjectId(attemptId)
			: attemptId;

		const result = await ExamAnswer.aggregate([
			{
				$match: {
					attemptId: attemptObjectId,
					isDeleted: false,
					marksObtained: { $exists: true, $ne: null },
				},
			},
			{
				$group: {
					_id: null,
					totalMarks: { $sum: { $ifNull: ['$marksObtained', 0] } },
					totalQuestions: { $sum: 1 },
				},
			},
		]);

		if (
			result.length > 0 &&
			result[0].totalMarks !== null &&
			result[0].totalMarks !== undefined
		) {
			return result[0].totalMarks || 0;
		}
		return 0;
	} catch (error: any) {
		console.error('Error calculating total marks:', error);
		throw error;
	}
};

// Count total answers for an attempt (all questions with answers)
export const countTotalAnswersForAttempt = async (
	attemptId: string,
): Promise<number> => {
	try {
		const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
			? new mongoose.Types.ObjectId(attemptId)
			: attemptId;

		return await ExamAnswer.countDocuments({
			attemptId: attemptObjectId,
			isDeleted: false,
		});
	} catch (error: any) {
		console.error('Error counting total answers:', error);
		throw error;
	}
};

// Count graded answers for an attempt (optionally filtered by student)
// An answer is considered graded if: isCorrect is not null OR marksObtained > 0 OR isGraded is true
export const countGradedAnswersForAttempt = async (
	attemptId: string,
	studentId?: string,
): Promise<number> => {
	try {
		const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
			? new mongoose.Types.ObjectId(attemptId)
			: attemptId;

		const filter: any = {
			attemptId: attemptObjectId,
			isDeleted: false,
			$or: [
				{ isCorrect: { $ne: null } },
				{ marksObtained: { $gt: 0 } },
				{ isGraded: true },
			],
		};

		if (studentId) {
			filter.studentId = mongoose.Types.ObjectId.isValid(studentId)
				? new mongoose.Types.ObjectId(studentId)
				: studentId;
		}

		return await ExamAnswer.countDocuments(filter);
	} catch (error: any) {
		console.error('Error counting graded answers:', error);
		throw error;
	}
};

// Get answers requiring manual grading
export const getAnswersRequiringManualGrading = async (
	attemptId: string,
): Promise<IExamAnswer[]> => {
	try {
		return await ExamAnswer.find({
			attemptId: attemptId,
			questionType: { $in: ['Short Answers', 'Long Answers'] },
			isCorrect: null,
			isDeleted: false,
		}).sort({ questionNumber: 1 });
	} catch (error: any) {
		console.error('Error getting answers requiring manual grading:', error);
		throw error;
	}
};

// Delete all answers for an attempt
export const deleteAnswersByAttemptId = async (
	attemptId: string,
): Promise<void> => {
	try {
		await ExamAnswer.updateMany(
			{ attemptId: attemptId },
			{
				$set: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			},
		);
	} catch (error: any) {
		console.error('Error deleting answers by attempt ID:', error);
		throw error;
	}
};

// Delete all answers for an exam
export const deleteAnswersByExamId = async (examId: string): Promise<void> => {
	try {
		await ExamAnswer.updateMany(
			{ examId: examId },
			{
				$set: {
					isDeleted: true,
					updatedAt: new Date(),
				},
			},
		);
	} catch (error: any) {
		console.error('Error deleting answers by exam ID:', error);
		throw error;
	}
};

// Soft delete exam answer
export const softDeleteExamAnswerById = async (
	answerId: string,
): Promise<IExamAnswer | null> => {
	try {
		return await ExamAnswer.findByIdAndUpdate(
			answerId,
			{
				isDeleted: true,
				updatedAt: new Date(),
			},
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error soft deleting exam answer:', error);
		throw error;
	}
};

// Get answer statistics for a question
export const getQuestionAnswerStatistics = async (
	questionId: string,
	examId: string,
): Promise<{
	totalAttempts: number;
	correctAnswers: number;
	incorrectAnswers: number;
	averageMarks: number;
	successRate: number;
}> => {
	try {
		const stats = await ExamAnswer.aggregate([
			{
				$match: {
					questionId: questionId,
					examId: examId,
					isDeleted: false,
				},
			},
			{
				$group: {
					_id: null,
					totalAttempts: { $sum: 1 },
					correctAnswers: {
						$sum: {
							$cond: [{ $eq: ['$isCorrect', true] }, 1, 0],
						},
					},
					incorrectAnswers: {
						$sum: {
							$cond: [{ $eq: ['$isCorrect', false] }, 1, 0],
						},
					},
					averageMarks: { $avg: '$marksObtained' },
				},
			},
		]);

		if (stats.length === 0) {
			return {
				totalAttempts: 0,
				correctAnswers: 0,
				incorrectAnswers: 0,
				averageMarks: 0,
				successRate: 0,
			};
		}

		const result = stats[0];
		result.successRate =
			result.totalAttempts > 0
				? (result.correctAnswers / result.totalAttempts) * 100
				: 0;

		return result;
	} catch (error: any) {
		console.error('Error getting question answer statistics:', error);
		throw error;
	}
};

// Flag a question - Create or update ExamAnswer with isFlagged=true
export const flagQuestion = async (
  attemptId: string,
  questionId: string,
  answerData: Partial<IExamAnswer>
): Promise<IExamAnswer> => {
  try {
    const existingAnswer = await findAnswerByAttemptAndQuestion(
      attemptId,
      questionId
    );

    if (existingAnswer) {
      // Update existing answer with flag
      existingAnswer.isFlagged = true;
      existingAnswer.updatedAt = new Date();
      return await existingAnswer.save();
    } else {
      // Create new answer with flag set
      const flaggedAnswer = {
        ...answerData,
        isFlagged: true,
      };
      return await createExamAnswer(flaggedAnswer);
    }
  } catch (error: any) {
    console.error("Error flagging question:", error);
    throw error;
  }
};

// Unflag a question - Update ExamAnswer with isFlagged=false
export const unflagQuestion = async (
  attemptId: string,
  questionId: string
): Promise<IExamAnswer | null> => {
  try {
    const existingAnswer = await findAnswerByAttemptAndQuestion(
      attemptId,
      questionId
    );

    if (existingAnswer) {
      existingAnswer.isFlagged = false;
      existingAnswer.updatedAt = new Date();
      return await existingAnswer.save();
    }
    return null;
  } catch (error: any) {
    console.error("Error unflagging question:", error);
    throw error;
  }
};

// Get all flagged question IDs for an attempt
export const getFlaggedQuestions = async (
  attemptId: string
): Promise<string[]> => {
  try {
    const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
      ? new mongoose.Types.ObjectId(attemptId)
      : attemptId;

    const flaggedAnswers = await ExamAnswer.find({
      attemptId: attemptObjectId,
      isFlagged: true,
      isDeleted: false,
    }).select("questionId");

    return flaggedAnswers.map((answer) => answer.questionId.toString());
  } catch (error: any) {
    console.error("Error getting flagged questions:", error);
    throw error;
  }
};

// Count flagged questions for an attempt
export const countFlaggedQuestions = async (
  attemptId: string
): Promise<number> => {
  try {
    const attemptObjectId = mongoose.Types.ObjectId.isValid(attemptId)
      ? new mongoose.Types.ObjectId(attemptId)
      : attemptId;

    return await ExamAnswer.countDocuments({
      attemptId: attemptObjectId,
      isFlagged: true,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error counting flagged questions:", error);
    throw error;
  }
};

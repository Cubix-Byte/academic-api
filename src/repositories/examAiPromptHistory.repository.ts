import mongoose from "mongoose";
import {
  ExamAIPromptHistory,
  IExamAIPromptHistory,
} from "../models/examAIPromptHistory.schema";

/**
 * ExamAIPromptHistory Repository - Data access layer for AI prompt history management
 */

// Create new AI prompt history entry
export const createExamAIPromptHistory = async (data: {
  examId: string;
  questionId?: string;
  prompt: string;
  response: string;
  aiModel: string;
  tokensUsed: number;
  teacherId: string;
  tenantId: string;
}): Promise<IExamAIPromptHistory> => {
  try {
    const promptHistory = new ExamAIPromptHistory(data);
    return await promptHistory.save();
  } catch (error: any) {
    console.error("Error creating exam AI prompt history:", error);
    throw error;
  }
};

// Find AI prompt history by ID
export const findExamAIPromptHistoryById = async (
  id: string
): Promise<IExamAIPromptHistory | null> => {
  try {
    return await ExamAIPromptHistory.findById(id);
  } catch (error: any) {
    console.error("Error finding exam AI prompt history by ID:", error);
    throw error;
  }
};

// Find all AI prompt history entries for an exam
export const findAIPromptHistoryByExamId = async (
  examId: string
): Promise<IExamAIPromptHistory[]> => {
  try {
    return await ExamAIPromptHistory.find({ examId }).sort({ createdAt: -1 });
  } catch (error: any) {
    console.error("Error finding AI prompt history by exam ID:", error);
    throw error;
  }
};

// Find AI prompt history entries for a specific question
export const findAIPromptHistoryByQuestionId = async (
  questionId: string
): Promise<IExamAIPromptHistory[]> => {
  try {
    return await ExamAIPromptHistory.find({ questionId }).sort({
      createdAt: -1,
    });
  } catch (error: any) {
    console.error("Error finding AI prompt history by question ID:", error);
    throw error;
  }
};

// Find AI prompt history entries by teacher
export const findAIPromptHistoryByTeacher = async (
  teacherId: string,
  tenantId: string
): Promise<IExamAIPromptHistory[]> => {
  try {
    return await ExamAIPromptHistory.find({ teacherId, tenantId }).sort({
      createdAt: -1,
    });
  } catch (error: any) {
    console.error("Error finding AI prompt history by teacher:", error);
    throw error;
  }
};

// Count AI prompt history entries for an exam
export const countAIPromptHistoryByExamId = async (
  examId: string
): Promise<number> => {
  try {
    return await ExamAIPromptHistory.countDocuments({ examId });
  } catch (error: any) {
    console.error("Error counting AI prompt history by exam ID:", error);
    throw error;
  }
};

// Get total tokens used for an exam
export const getTotalTokensUsedForExam = async (
  examId: string
): Promise<number> => {
  try {
    const result = await ExamAIPromptHistory.aggregate([
      { $match: { examId } },
      { $group: { _id: null, totalTokens: { $sum: "$tokensUsed" } } },
    ]);

    return result.length > 0 ? result[0].totalTokens : 0;
  } catch (error: any) {
    console.error("Error getting total tokens used for exam:", error);
    throw error;
  }
};

// Get AI model usage statistics
export const getAIModelUsageStats = async (
  tenantId: string
): Promise<Array<{ model: string; count: number; totalTokens: number }>> => {
  try {
    const result = await ExamAIPromptHistory.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: "$aiModel",
          count: { $sum: 1 },
          totalTokens: { $sum: "$tokensUsed" },
        },
      },
      { $project: { model: "$_id", count: 1, totalTokens: 1, _id: 0 } },
    ]);

    return result;
  } catch (error: any) {
    console.error("Error getting AI model usage stats:", error);
    throw error;
  }
};

// Bulk create AI prompt history entries
export const bulkCreateAIPromptHistory = async (
  entries: Array<{
    examId: string;
    questionId?: string;
    prompt: string;
    response: string;
    aiModel: string;
    tokensUsed: number;
    teacherId: string;
    tenantId: string;
  }>,
  session?: any
): Promise<IExamAIPromptHistory[]> => {
  try {
    const options = session ? { session } : {};
    const result = await ExamAIPromptHistory.insertMany(entries, options);
    return result as unknown as IExamAIPromptHistory[];
  } catch (error: any) {
    console.error("Error bulk creating AI prompt history:", error);
    throw error;
  }
};

// Delete AI prompt history entries for an exam
export const deleteAIPromptHistoryByExamId = async (
  examId: string,
  session?: mongoose.ClientSession
): Promise<void> => {
  try {
    const options = session ? { session } : {};
    await ExamAIPromptHistory.deleteMany({ examId }, options);
  } catch (error: any) {
    console.error("Error deleting AI prompt history by exam ID:", error);
    throw error;
  }
};

// Delete AI prompt history entries for a question
export const deleteAIPromptHistoryByQuestionId = async (
  questionId: string
): Promise<void> => {
  try {
    await ExamAIPromptHistory.deleteMany({ questionId });
  } catch (error: any) {
    console.error("Error deleting AI prompt history by question ID:", error);
    throw error;
  }
};

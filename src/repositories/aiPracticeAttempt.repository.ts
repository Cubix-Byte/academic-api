import {
  AIPracticeAttempt,
  IAIPracticeAttempt,
} from "../models/aiPracticeAttempt.schema";
import mongoose from "mongoose";

/**
 * Repository — ai_practice_attempts CRUD
 */

export const create = async (
  data: Partial<IAIPracticeAttempt>,
): Promise<IAIPracticeAttempt> => {
  return AIPracticeAttempt.create(data);
};

export const findById = async (
  attemptId: string,
): Promise<IAIPracticeAttempt | null> => {
  return AIPracticeAttempt.findOne({
    _id: attemptId,
    isDeleted: false,
  });
};

export const findByStudentId = async (
  studentId: string,
  tenantId: string,
): Promise<IAIPracticeAttempt[]> => {
  return AIPracticeAttempt.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  }).sort({ createdAt: -1 });
};

export const updateById = async (
  attemptId: string,
  update: Partial<IAIPracticeAttempt>,
): Promise<IAIPracticeAttempt | null> => {
  return AIPracticeAttempt.findByIdAndUpdate(attemptId, update, { new: true });
};

export const upsertAnswer = async (
  attemptId: string,
  questionId: string,
  answer: string | string[],
  timeTaken: number,
): Promise<void> => {
  // Remove existing answer for this question, then push updated one
  await AIPracticeAttempt.updateOne(
    { _id: attemptId },
    { $pull: { answers: { questionId } } },
  );
  await AIPracticeAttempt.updateOne(
    { _id: attemptId },
    { $push: { answers: { questionId, answer, timeTaken } } },
  );
};

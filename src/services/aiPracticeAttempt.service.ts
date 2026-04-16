import * as repo from "../repositories/aiPracticeAttempt.repository";
import { IAIPracticeAttempt } from "../models/aiPracticeAttempt.schema";
import mongoose from "mongoose";
import crypto from "crypto";

/**
 * Service — business logic for AI practice attempts
 */

export interface StartAIPracticePayload {
  questions: Array<{
    questionId?: string;
    questionType: string;
    questionText: string;
    options?: string[];
    correctAnswer?: string;
    marks: number;
    topic?: string;
    difficulty?: string;
  }>;
  totalMarks: number;
  subject: string;
  examTitle: string;
  feAttemptId: string;
  sourceExamId?: string;
  durationInMinutes?: number;
}

export const startAIPractice = async (
  studentId: string,
  tenantId: string,
  payload: StartAIPracticePayload,
): Promise<{
  attemptId: string;
  questions: any[];
  examTitle: string;
  durationInMinutes: number;
}> => {
  const {
    questions,
    totalMarks,
    subject,
    examTitle,
    feAttemptId,
    sourceExamId,
    durationInMinutes: rawDuration,
  } = payload;

  // Normalize questions — assign stable IDs and question numbers
  const normalizedQuestions = questions.map((q, i) => ({
    questionId: q.questionId || crypto.randomUUID(),
    questionNumber: i + 1,
    questionType: q.questionType || "MCQ",
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    marks: q.marks || 1,
    topic: q.topic,
    difficulty: q.difficulty,
  }));

  const durationInMinutes =
    rawDuration ?? Math.max(10, Math.round(totalMarks * 2));

  const attempt = await repo.create({
    studentId: new mongoose.Types.ObjectId(studentId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    sourceExamId: sourceExamId
      ? new mongoose.Types.ObjectId(sourceExamId)
      : undefined,
    feAttemptId,
    subject,
    examTitle,
    questions: normalizedQuestions,
    totalMarks,
    durationInMinutes,
    status: "In Progress",
    startedAt: new Date(),
    timeTakenInSeconds: 0,
    answers: [],
    isDeleted: false,
  } as any);

  return {
    attemptId: (attempt._id as mongoose.Types.ObjectId).toString(),
    questions: normalizedQuestions,
    examTitle,
    durationInMinutes,
  };
};

export const submitAnswer = async (
  attemptId: string,
  studentId: string,
  questionId: string,
  answer: string | string[],
  timeTaken: number,
): Promise<void> => {
  const attempt = await repo.findById(attemptId);
  if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
  if (attempt.studentId.toString() !== studentId) throw new Error("FORBIDDEN");
  if (attempt.status !== "In Progress")
    throw new Error("ATTEMPT_NOT_IN_PROGRESS");

  await repo.upsertAnswer(attemptId, questionId, answer, timeTaken);
};

export const submitAttempt = async (
  attemptId: string,
  studentId: string,
  totalTimeTaken: number,
): Promise<{ submittedAt: Date }> => {
  const attempt = await repo.findById(attemptId);
  if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
  if (attempt.studentId.toString() !== studentId) throw new Error("FORBIDDEN");
  if (attempt.status !== "In Progress")
    throw new Error("ATTEMPT_ALREADY_SUBMITTED");

  // --- Auto-Grading Logic ---
  let obtainedMarks = 0;
  const gradedAnswers: any[] = [];

  // Map answers for easy lookup
  const answerMap = new Map<string, any>();
  if (attempt.answers && attempt.answers.length > 0) {
    attempt.answers.forEach((ans) => {
      answerMap.set(ans.questionId, ans);
    });
  }

  attempt.questions.forEach((question) => {
    const studentAnswerObj = answerMap.get(question.questionId);
    let isCorrect = false;
    let marks = 0;

    if (studentAnswerObj) {
      const studentAnswer = studentAnswerObj.answer;
      // Simple string matching for now (case-insensitive)
      // Check if correctAnswer exists and matches
      if (
        question.correctAnswer &&
        typeof studentAnswer === "string" &&
        studentAnswer.trim().toLowerCase() ===
          question.correctAnswer.trim().toLowerCase()
      ) {
        isCorrect = true;
        marks = question.marks;
      }
      // Handle array answers if necessary (e.g. multi-select), ensuring exact match or partial?
      // For now, assuming single string match as per typical "correctAnswer" field.

      gradedAnswers.push({
        questionId: question.questionId,
        answer: studentAnswer,
        timeTaken: studentAnswerObj.timeTaken,
        isCorrect,
        marksObtained: marks,
      });
    } else {
      // Unanswered
      gradedAnswers.push({
        questionId: question.questionId,
        answer: null,
        timeTaken: 0,
        isCorrect: false,
        marksObtained: 0,
      });
    }
    obtainedMarks += marks;
  });

  const percentage =
    attempt.totalMarks > 0 ? (obtainedMarks / attempt.totalMarks) * 100 : 0;

  const submittedAt = new Date();

  // Update with graded results
  await repo.updateById(attemptId, {
    status: "Graded", // Mark as Graded so frontend shows result
    submittedAt,
    timeTakenInSeconds: totalTimeTaken,
    answers: gradedAnswers,
    obtainedMarks,
    percentage,
  } as any);

  return { submittedAt };
};

export const getAttemptResult = async (
  attemptId: string,
  userId: string,
  userRole?: string,
): Promise<IAIPracticeAttempt> => {
  const attempt = await repo.findById(attemptId);
  if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");

  // Strict check for students: must own the attempt
  if (userRole === "Student" && attempt.studentId.toString() !== userId) {
    throw new Error("FORBIDDEN");
  }

  // Implicitly allow other roles (Parent, Teacher, Admin) for now
  // In a stricter system, we'd check parent-child relationship here

  return attempt;
};

export const listByStudent = async (
  studentId: string,
  tenantId: string,
): Promise<IAIPracticeAttempt[]> => {
  return repo.findByStudentId(studentId, tenantId);
};

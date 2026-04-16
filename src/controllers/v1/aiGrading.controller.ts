import { Request, Response, NextFunction } from "express";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";
import { aiGradingService } from "@/services/aiGrading.service";
import * as gradingService from "../../services/grading.service";
import * as examService from "../../services/exam.service";
import * as examQuestionRepository from "../../repositories/examQuestion.repository";
import * as examAnswerRepository from "../../repositories/examAnswer.repository";
import * as examAttemptRepository from "../../repositories/examAttempt.repository";
import * as gradingSystemRepository from "../../repositories/gradingSystem.repository";
import * as examRepository from "../../repositories/exam.repository";
import { sourceContentService } from "@/services/sourceContent.service";

/**
 * AI Grading Controller - Handles HTTP requests for AI-powered grading
 */

/**
 * Auto-grade a single exam attempt
 * POST /api/v1/grading/auto-grade/:attemptId
 */
export const autoGradeAttempt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { attemptId } = req.params;
    const authToken = req.headers.authorization;

    if (!attemptId) {
      return sendErrorResponse(
        res,
        "Attempt ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    console.log(`🤖 Auto-grading attempt ${attemptId}`);

    // Grade the attempt using AI
    const gradingResult = await aiGradingService.gradeAttempt(
      attemptId,
      authToken,
    );

    if (!gradingResult.success || !gradingResult.data) {
      return sendErrorResponse(
        res,
        gradingResult.message || "Failed to grade attempt",
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        { error: gradingResult.error },
      );
    }

    // Update exam answers with AI grading results
    const { results } = gradingResult.data;
    for (const result of results) {
      try {
        await gradingService.updateAnswerWithAIGrading(
          attemptId,
          result.questionId,
          {
            marksObtained: result.marksObtained,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
          },
        );
      } catch (error: any) {
        console.error(
          `Error updating answer for question ${result.questionId}:`,
          error,
        );
        // Continue with other questions even if one fails
      }
    }

    // Update attempt totals
    await gradingService.updateAttemptAfterAIGrading(
      attemptId,
      gradingResult.data,
    );

    // Enrich results with question and answer details for teacher visibility
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        try {
          // Fetch question details
          const question = await examQuestionRepository.findExamQuestionById(
            result.questionId,
          );

          // Fetch student answer
          const answer =
            await examAnswerRepository.findAnswerByAttemptAndQuestion(
              attemptId,
              result.questionId,
            );

          return {
            // AI grading fields (from AI API)
            questionId: result.questionId,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
            gradingNotes: result.gradingNotes,
            confidence: result.confidence,
            // Enriched context (from database)
            questionNumber: question?.questionNumber || 0,
            questionText: question?.questionText || "",
            questionType: question?.questionType || "",
            studentAnswer: answer?.studentAnswer || "",
            correctAnswer:
              question?.questionType === "Short Answers" ||
              question?.questionType === "Long Answers"
                ? undefined
                : question?.correctAnswer,
          };
        } catch (error: any) {
          console.error(
            `Error enriching result for question ${result.questionId}:`,
            error,
          );
          // Return basic result if enrichment fails (still include all AI grading data)
          return {
            // AI grading fields (from AI API)
            questionId: result.questionId,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
            gradingNotes: result.gradingNotes,
            confidence: result.confidence,
            // Enriched context (defaults when enrichment fails)
            questionNumber: 0,
            questionText: "",
            questionType: "",
            studentAnswer: "",
            correctAnswer: undefined,
          };
        }
      }),
    );

    return sendSuccessResponse(res, "Attempt graded successfully using AI", {
      attemptId,
      totalMarksObtained: gradingResult.data.totalMarksObtained,
      totalMarks: gradingResult.data.totalMarks,
      percentage: gradingResult.data.percentage,
      questionsGraded: gradingResult.data.questionsGraded,
      results: enrichedResults,
    });
  } catch (error: any) {
    console.error("Error in autoGradeAttempt:", error);
    return sendErrorResponse(
      res,
      "Failed to auto-grade attempt: " + (error.message || "Unknown error"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      {},
    );
  }
};

/**
 * Auto-grade attempt with data in request body
 * POST /api/v1/grading/auto-grade-with-data
 * Accepts the data format from getStudentAnswers
 */
export const autoGradeAttemptWithData = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requestData = req.body;
    const authToken = req.headers.authorization;

    // Validate required fields
    if (!requestData.attemptId || !requestData.examId) {
      return sendErrorResponse(
        res,
        "Missing required fields: attemptId, examId",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    if (
      !requestData.questions ||
      !Array.isArray(requestData.questions) ||
      requestData.questions.length === 0
    ) {
      return sendErrorResponse(
        res,
        "Missing or empty questions array",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    console.log(
      `🤖 Auto-grading attempt ${requestData.attemptId} with provided data`,
    );

    // Grade the attempt using AI (with data transformation)
    const gradingResult = await aiGradingService.gradeAttempt(
      requestData,
      authToken,
    );

    if (!gradingResult.success || !gradingResult.data) {
      return sendErrorResponse(
        res,
        gradingResult.message || "Failed to grade attempt",
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        { error: gradingResult.error },
      );
    }

    // Update exam answers with AI grading results
    const { results } = gradingResult.data;
    for (const result of results) {
      try {
        await gradingService.updateAnswerWithAIGrading(
          requestData.attemptId,
          result.questionId,
          {
            marksObtained: result.marksObtained,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
          },
        );
      } catch (error: any) {
        console.error(
          `Error updating answer for question ${result.questionId}:`,
          error,
        );
        // Continue with other questions even if one fails
      }
    }

    // Update attempt totals
    await gradingService.updateAttemptAfterAIGrading(
      requestData.attemptId,
      gradingResult.data,
    );

    return sendSuccessResponse(res, "Attempt graded successfully using AI", {
      attemptId: requestData.attemptId,
      totalMarksObtained: gradingResult.data.totalMarksObtained,
      totalMarks: gradingResult.data.totalMarks,
      percentage: gradingResult.data.percentage,
      questionsGraded: gradingResult.data.questionsGraded,
    });
  } catch (error: any) {
    console.error("Error in autoGradeAttemptWithData:", error);
    return sendErrorResponse(
      res,
      "Failed to auto-grade attempt: " + (error.message || "Unknown error"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      {},
    );
  }
};

/**
 * Auto-grade all submitted attempts for an exam
 * POST /api/v1/grading/auto-grade-exam/:examId
 */
export const autoGradeExam = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { examId } = req.params;
    const authToken = req.headers.authorization;
    const teacherId = req.user?.id;

    if (!examId) {
      return sendErrorResponse(
        res,
        "Exam ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    if (!teacherId) {
      return sendErrorResponse(
        res,
        "Teacher ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    console.log(`🤖 Auto-grading all attempts for exam ${examId}`);

    // Get exam to get tenantId
    const exam = await examService.getExamById(examId);

    // Get all submitted attempts for this exam
    const attempts = await gradingService.getSubmittedAttemptsForExam(
      examId,
      exam.tenantId?.toString(),
    );

    if (attempts.length === 0) {
      return sendSuccessResponse(
        res,
        "No submitted attempts found for grading",
        {
          examId,
          totalAttempts: 0,
          gradedAttempts: 0,
        },
      );
    }

    const results: Array<{
      attemptId: string;
      success: boolean;
      error?: string;
    }> = [];

    // Grade each attempt
    for (const attempt of attempts) {
      try {
        // Grade the attempt using AI
        const gradingResult = await aiGradingService.gradeAttempt(
          attempt._id.toString(),
          authToken,
        );

        if (gradingResult.success && gradingResult.data) {
          // Update answers
          for (const result of gradingResult.data.results) {
            await gradingService.updateAnswerWithAIGrading(
              attempt._id.toString(),
              result.questionId,
              {
                marksObtained: result.marksObtained,
                isCorrect: result.isCorrect,
                feedback: result.feedback,
              },
            );
          }

          // Update attempt
          await gradingService.updateAttemptAfterAIGrading(
            attempt._id.toString(),
            gradingResult.data,
          );

          results.push({
            attemptId: attempt._id.toString(),
            success: true,
          });
        } else {
          results.push({
            attemptId: attempt._id.toString(),
            success: false,
            error: gradingResult.message || "Unknown error",
          });
        }
      } catch (error: any) {
        console.error(`Error grading attempt ${attempt._id}:`, error);
        results.push({
          attemptId: attempt._id.toString(),
          success: false,
          error: error.message || "Unknown error",
        });
      }
    }

    const gradedCount = results.filter((r) => r.success).length;

    return sendSuccessResponse(
      res,
      `Graded ${gradedCount} of ${attempts.length} attempts`,
      {
        examId,
        totalAttempts: attempts.length,
        gradedAttempts: gradedCount,
        failedAttempts: attempts.length - gradedCount,
        results,
      },
    );
  } catch (error: any) {
    console.error("Error in autoGradeExam:", error);
    return sendErrorResponse(
      res,
      "Failed to auto-grade exam: " + (error.message || "Unknown error"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      {},
    );
  }
};

/**
 * Auto-grade a single attempt (preview mode - no database updates)
 * POST /api/v1/grading/auto-grade-attempt/:attemptId
 */
export const autoGradeAttemptPreview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { attemptId } = req.params;
    const authToken = req.headers.authorization;
    const useNewExamFlow = req.query.useNewExamFlow === "true";

    if (!attemptId) {
      return sendErrorResponse(
        res,
        "Attempt ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    console.log(
      `🤖 Auto-grading attempt ${attemptId} (useNewExamFlow: ${useNewExamFlow})`,
    );

    // Get attempt details
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      return sendErrorResponse(
        res,
        "Attempt not found",
        HttpStatusCodes.NOT_FOUND,
      );
    }

    // Get exam with topicBreakdown
    const exam = await examService.getExamById(attempt.examId.toString());
    if (!exam) {
      return sendErrorResponse(
        res,
        "Exam not found",
        HttpStatusCodes.NOT_FOUND,
      );
    }

    // Ensure topicBreakdown is accessible (it should be preserved in getExamById)
    let topicBreakdown = (exam as any).topicBreakdown || exam.topicBreakdown;

    // Fallback: If topicBreakdown is missing, fetch it directly from repository
    if (!topicBreakdown) {
      console.warn(
        `⚠️ topicBreakdown not found in exam object, fetching directly from repository...`,
      );
      const rawExam = await examRepository.findExamById(
        attempt.examId.toString(),
      );
      if (rawExam) {
        topicBreakdown = (rawExam as any).topicBreakdown;
        console.log(`📊 Fetched topicBreakdown from repository:`, {
          hasTopicBreakdown: !!topicBreakdown,
          topicBreakdownCount: topicBreakdown?.length || 0,
        });
      }
    }

    console.log(`📊 Exam retrieved:`, {
      examId: exam._id.toString(),
      hasTopicBreakdown: !!topicBreakdown,
      topicBreakdownCount: topicBreakdown?.length || 0,
      topicBreakdown: topicBreakdown,
      examKeys: Object.keys(exam),
      examType: typeof exam,
      examHasTopicBreakdown: "topicBreakdown" in exam,
    });

    // Get all questions for the exam
    const questions = await examQuestionRepository.findQuestionsByExamId(
      exam._id.toString(),
    );

    if (questions.length === 0) {
      return sendErrorResponse(
        res,
        "No questions found for exam",
        HttpStatusCodes.NOT_FOUND,
      );
    }

    // Get all answers for the attempt
    const answers =
      await examAnswerRepository.findAnswersByAttemptId(attemptId);

    // Get file references for AI context
    const fileReferences = await sourceContentService.getExamFileReferences(
      exam._id.toString(),
    );

    // Sort questions by questionNumber to ensure correct order
    const sortedQuestions = [...questions].sort((a, b) => {
      const numA = a.questionNumber || 0;
      const numB = b.questionNumber || 0;
      return numA - numB;
    });

    // Map questions to topics based on topicBreakdown using questionNumber ranges
    const questionsWithTopics = sortedQuestions.map((question) => {
      let topic = "Other";
      const questionNum = question.questionNumber || 0;
      let startQuestionNum = 1;

      if (topicBreakdown && topicBreakdown.length > 0) {
        for (const topicInfo of topicBreakdown) {
          const endQuestionNum = startQuestionNum + topicInfo.questionCount - 1;

          if (
            questionNum >= startQuestionNum &&
            questionNum <= endQuestionNum
          ) {
            topic = topicInfo.topic;
            break;
          }

          startQuestionNum = endQuestionNum + 1;
        }
      }

      console.log(`📊 Question ${questionNum} mapped to topic: ${topic}`);
      return { ...question, topic };
    });

    console.log(`📊 Topic mapping complete. Topic breakdown:`, topicBreakdown);

    const topicSummary = questionsWithTopics.reduce(
      (acc, q) => {
        acc[q.topic] = (acc[q.topic] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(`📊 Questions with topics summary:`, {
      total: questionsWithTopics.length,
      byTopic: topicSummary,
      expectedTopics: topicBreakdown?.map((t: any) => t.topic) || [],
    });

    // Validate topic mapping
    if (topicBreakdown && topicBreakdown.length > 0) {
      const totalExpectedQuestions = topicBreakdown.reduce(
        (sum: number, t: any) => sum + t.questionCount,
        0,
      );
      const totalMappedQuestions = questionsWithTopics.length;

      if (totalExpectedQuestions !== totalMappedQuestions) {
        console.warn(
          `⚠️ Topic mapping mismatch: Expected ${totalExpectedQuestions} questions, but mapped ${totalMappedQuestions}`,
        );
      }

      // Check if all topics from breakdown have questions
      for (const topicInfo of topicBreakdown) {
        const mappedCount = topicSummary[topicInfo.topic] || 0;
        if (mappedCount !== topicInfo.questionCount) {
          console.warn(
            `⚠️ Topic "${topicInfo.topic}": Expected ${topicInfo.questionCount} questions, but mapped ${mappedCount}`,
          );
        }
      }
    }

    // Build questions array with answers and topics
    const questionsWithAnswers = questionsWithTopics
      .filter((question) => {
        return (
          question._id &&
          question.questionText &&
          question.questionType &&
          question.marks
        );
      })
      .map((question) => {
        const answer = answers.find(
          (a) => a.questionId.toString() === question._id.toString(),
        );

        let studentAnswer = answer?.studentAnswer;
        if (studentAnswer === null || studentAnswer === undefined) {
          studentAnswer = "";
        }

        return {
          questionId: question._id.toString(),
          questionText: question.questionText,
          correctAnswer:
            question.questionType === "Short Answers" ||
            question.questionType === "Long Answers"
              ? undefined
              : question.correctAnswer,
          explanation: question.explanation,
          studentAnswer: studentAnswer,
          questionType: question.questionType,
          maxMarks: question.marks, // Use maxMarks for AI API
          difficulty: question.difficulty,
          topic: question.topic, // Add topic for gap analysis
        };
      });

    // Build grading request
    const gradingRequest = {
      attemptId: attempt._id.toString(),
      examId: exam._id.toString(),
      questions: questionsWithAnswers,
      fileIds: fileReferences.fileIds?.length
        ? fileReferences.fileIds
        : undefined,
      filePaths: fileReferences.filePaths?.length
        ? fileReferences.filePaths
        : undefined,
      topicBreakdown: topicBreakdown, // Include topic breakdown for analysis
    };

    // Verify all questions have topics before sending
    const questionsWithoutTopics = gradingRequest.questions.filter(
      (q) => !q.topic,
    );
    if (questionsWithoutTopics.length > 0) {
      console.warn(
        `⚠️ ${questionsWithoutTopics.length} questions without topics:`,
        questionsWithoutTopics.map((q) => ({ questionId: q.questionId })),
      );
    }

    console.log(`📊 Grading request built:`, {
      attemptId: gradingRequest.attemptId,
      examId: gradingRequest.examId,
      questionsCount: gradingRequest.questions.length,
      questionsWithTopics: gradingRequest.questions.filter((q) => q.topic)
        .length,
      questionsWithoutTopics: questionsWithoutTopics.length,
      hasTopicBreakdown: !!gradingRequest.topicBreakdown,
      topicBreakdown: gradingRequest.topicBreakdown,
      sampleQuestion: gradingRequest.questions[0]
        ? {
            questionId: gradingRequest.questions[0].questionId,
            topic: gradingRequest.questions[0].topic,
            hasTopic: !!gradingRequest.questions[0].topic,
          }
        : null,
    });

    // Grade the attempt using AI
    console.log(`🤖 Calling AI grading service...`);
    const gradingResult = await aiGradingService.gradeAttempt(
      gradingRequest,
      authToken,
      useNewExamFlow,
    );

    console.log(`📊 Grading result received:`, {
      success: gradingResult.success,
      hasData: !!gradingResult.data,
      hasOverallFeedback: !!gradingResult.data?.overallFeedback,
      hasGapAnalysis: !!gradingResult.data?.gapAnalysis,
      weakTopicsCount: gradingResult.data?.weakTopics?.length || 0,
    });

    if (!gradingResult.success || !gradingResult.data) {
      return sendErrorResponse(
        res,
        gradingResult.message || "Failed to grade attempt",
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
        { error: gradingResult.error },
      );
    }

    // Update exam answers with AI grading results
    const { results } = gradingResult.data;
    for (const result of results) {
      try {
        await gradingService.updateAnswerWithAIGrading(
          attemptId,
          result.questionId,
          {
            marksObtained: result.marksObtained,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
          },
        );
      } catch (error: any) {
        console.error(
          `Error updating answer for question ${result.questionId}:`,
          error,
        );
        // Continue with other questions even if one fails
      }
    }

    // Update attempt totals with grade and AI feedback
    await gradingService.updateAttemptAfterAIGrading(attemptId, {
      totalMarksObtained: gradingResult.data.totalMarksObtained,
      totalMarks: gradingResult.data.totalMarks,
      percentage: gradingResult.data.percentage,
      overallFeedback: gradingResult.data.overallFeedback,
      overallAssessment: gradingResult.data.overallAssessment,
      gapAnalysis: gradingResult.data.gapAnalysis,
      weakTopics: gradingResult.data.weakTopics,
    });

    // Calculate grade using grading system (for response)
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
      attempt.tenantId.toString(),
    );

    let grade = "F";
    if (gradingSystem && gradingSystem.gradeRanges) {
      for (const range of gradingSystem.gradeRanges) {
        if (
          gradingResult.data.percentage >= range.minPercentage &&
          gradingResult.data.percentage <= range.maxPercentage
        ) {
          grade = range.grade;
          break;
        }
      }
    }

    // Enrich results with question and answer details
    const enrichedResults = await Promise.all(
      gradingResult.data.results.map(async (result) => {
        try {
          const question = await examQuestionRepository.findExamQuestionById(
            result.questionId,
          );

          const answer =
            await examAnswerRepository.findAnswerByAttemptAndQuestion(
              attemptId,
              result.questionId,
            );

          return {
            questionId: result.questionId,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
            gradingNotes: result.gradingNotes,
            confidence: result.confidence,
            questionNumber: question?.questionNumber || 0,
            questionText: question?.questionText || "",
            questionType: question?.questionType || "",
            studentAnswer: answer?.studentAnswer || "",
            correctAnswer:
              question?.questionType === "Short Answers" ||
              question?.questionType === "Long Answers"
                ? undefined
                : question?.correctAnswer,
          };
        } catch (error: any) {
          console.error(
            `Error enriching result for question ${result.questionId}:`,
            error,
          );
          return {
            questionId: result.questionId,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            isCorrect: result.isCorrect,
            feedback: result.feedback,
            gradingNotes: result.gradingNotes,
            confidence: result.confidence,
            questionNumber: 0,
            questionText: "",
            questionType: "",
            studentAnswer: "",
            correctAnswer: undefined,
          };
        }
      }),
    );

    const responseData = {
      attemptId,
      totalMarksObtained: gradingResult.data.totalMarksObtained,
      totalMarks: gradingResult.data.totalMarks,
      percentage: gradingResult.data.percentage,
      grade,
      questionsGraded: gradingResult.data.questionsGraded,
      results: enrichedResults,
      overallFeedback: gradingResult.data.overallFeedback,
      gapAnalysis: gradingResult.data.gapAnalysis,
      weakTopics: gradingResult.data.weakTopics,
    };

    console.log(`✅ Response data prepared:`, {
      hasOverallFeedback: !!responseData.overallFeedback,
      hasGapAnalysis: !!responseData.gapAnalysis,
      weakTopicsCount: responseData.weakTopics?.length || 0,
      overallFeedbackLength: responseData.overallFeedback?.length || 0,
      gapAnalysisLength: responseData.gapAnalysis?.length || 0,
    });

    return sendSuccessResponse(
      res,
      "Attempt graded successfully using AI",
      responseData,
    );
  } catch (error: any) {
    console.error("Error in autoGradeAttemptPreview:", error);
    return sendErrorResponse(
      res,
      "Failed to auto-grade attempt: " + (error.message || "Unknown error"),
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      {},
    );
  }
};

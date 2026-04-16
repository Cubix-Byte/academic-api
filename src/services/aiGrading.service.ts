import axios from "axios";
import * as examRepository from "../repositories/exam.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examAnswerRepository from "../repositories/examAnswer.repository";
import { sourceContentService } from "./sourceContent.service";
import {
  AttemptGradingRequest,
  AttemptGradingResponse,
  GradingRequest,
  GradingResponse,
} from "@/types/aiGrading.types";

/**
 * AI Grading Service - Integration layer between academic-api and ai-api
 */
export class AIGradingService {
  private aiApiUrl: string;

  constructor() {
    this.aiApiUrl = process.env.BASE_URL || "http://localhost:3005";
  }

  /**
   * Transform AI API response from { code, message, data } to { success, message, data }
   */
  private transformApiResponse(apiResponse: any): any {
    // If response already has success field, return as-is
    if (apiResponse.success !== undefined) {
      // Ensure overallAssessment is mapped if present in data
      if (
        apiResponse.data &&
        (apiResponse.data.overall_assessment ||
          apiResponse.data.overallAssessment)
      ) {
        apiResponse.data.overallAssessment =
          apiResponse.data.overallAssessment ||
          apiResponse.data.overall_assessment;
      }
      return apiResponse;
    }

    // Transform from { code, message, data } format to { success, message, data }
    if (apiResponse.code === 200 && apiResponse.data) {
      // Ensure overallAssessment is mapped if present in data
      if (
        apiResponse.data.overall_assessment ||
        apiResponse.data.overallAssessment
      ) {
        apiResponse.data.overallAssessment =
          apiResponse.data.overallAssessment ||
          apiResponse.data.overall_assessment;
      }

      return {
        success: true,
        message: apiResponse.message || "Request successful",
        data: apiResponse.data,
      };
    } else {
      return {
        success: false,
        message: apiResponse.message || "Request failed",
        error: apiResponse.error || "Unknown error",
      };
    }
  }

  /**
   * Grade a single question using AI
   */
  async gradeQuestion(
    questionId: string,
    attemptId: string,
    authToken?: string,
  ): Promise<GradingResponse> {
    try {
      // Get question and answer details
      const question =
        await examQuestionRepository.findExamQuestionById(questionId);
      if (!question) {
        throw new Error("Question not found");
      }

      const answer = await examAnswerRepository.findAnswerByAttemptAndQuestion(
        attemptId,
        questionId,
      );
      if (!answer) {
        throw new Error("Answer not found");
      }

      // Get exam for source content
      const exam = await examRepository.findExamById(
        question.examId.toString(),
      );
      if (!exam) {
        throw new Error("Exam not found");
      }

      // Get file references (fileIds/filePaths) for AI to extract content
      const fileReferences = await sourceContentService.getExamFileReferences(
        exam._id.toString(),
      );

      // Build grading request
      const gradingRequest: GradingRequest = {
        questionId: questionId,
        questionText: question.questionText,
        // For subjective questions (Short/Long Answers), don't send correctAnswer
        correctAnswer:
          question.questionType === "Short Answers" ||
          question.questionType === "Long Answers"
            ? undefined
            : question.correctAnswer,
        explanation: question.explanation,
        studentAnswer: answer.studentAnswer || "",
        questionType: question.questionType as any,
        maxMarks: question.marks,
        difficulty: question.difficulty,
        // Pass file references instead of extracted content
        fileIds:
          fileReferences.fileIds.length > 0
            ? fileReferences.fileIds
            : undefined,
        filePaths:
          fileReferences.filePaths.length > 0
            ? fileReferences.filePaths
            : undefined,
      };

      // Call AI API
      const response = await axios.post(
        `${this.aiApiUrl}/ai/api/v1/grading/grade-question`,
        gradingRequest,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          timeout: 60000, // 60 seconds timeout
        },
      );

      return this.transformApiResponse(response.data);
    } catch (error: any) {
      console.error("Error in gradeQuestion:", error);
      throw new Error(
        `Failed to grade question: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }

  /**
   * Transform grading request data from getStudentAnswers format to AI grading format
   */
  private async transformGradingRequestData(requestData: {
    attemptId: string;
    examId: string;
    questions: Array<{
      questionId: string;
      questionNumber?: number;
      questionType: string;
      questionText: string;
      marks: number;
      correctAnswer?: string | string[];
      studentAnswer: string | string[];
      marksObtained?: number;
    }>;
  }): Promise<AttemptGradingRequest> {
    // Fetch all question details to get explanation and difficulty
    const questionIds = requestData.questions.map((q) => q.questionId);
    const questionDetails = await Promise.all(
      questionIds.map((id) => examQuestionRepository.findExamQuestionById(id)),
    );

    // Create a map for quick lookup
    const questionMap = new Map(
      questionDetails
        .filter((q) => q !== null)
        .map((q) => [q!._id.toString(), q!]),
    );

    // Transform questions array
    const transformedQuestions = requestData.questions.map((question) => {
      const questionDetail = questionMap.get(question.questionId);

      // Determine if this is a subjective question
      const isSubjective =
        question.questionType === "Short Answers" ||
        question.questionType === "Long Answers";

      return {
        questionId: question.questionId,
        questionText: question.questionText,
        // Exclude correctAnswer for subjective questions
        correctAnswer: isSubjective ? undefined : question.correctAnswer,
        explanation: questionDetail?.explanation,
        studentAnswer: question.studentAnswer || "", // Ensure it's always a string, even if empty
        questionType: question.questionType,
        maxMarks: question.marks, // Map marks to maxMarks
        difficulty: questionDetail?.difficulty,
      };
    });

    // Get file references from exam
    const fileReferences = await sourceContentService.getExamFileReferences(
      requestData.examId,
    );

    return {
      attemptId: requestData.attemptId,
      examId: requestData.examId,
      questions: transformedQuestions,
      fileIds:
        fileReferences.fileIds.length > 0 ? fileReferences.fileIds : undefined,
      filePaths:
        fileReferences.filePaths.length > 0
          ? fileReferences.filePaths
          : undefined,
    };
  }

  /**
   * Grade an entire exam attempt using AI
   * Supports both direct attemptId and pre-fetched data format
   */
  async gradeAttempt(
    attemptIdOrData:
      | string
      | AttemptGradingRequest
      | {
          attemptId: string;
          studentId?: string;
          studentName?: string;
          examId: string;
          examTitle?: string;
          totalMarks?: number;
          submittedAt?: Date;
          timeTaken?: number;
          questionsGraded?: number;
          questionsPending?: number;
          questions: Array<{
            questionId: string;
            questionNumber?: number;
            questionType: string;
            questionText: string;
            marks: number;
            correctAnswer?: string | string[];
            studentAnswer: string | string[];
            marksObtained?: number;
          }>;
        },
    authToken?: string,
    useNewExamFlow?: boolean,
  ): Promise<AttemptGradingResponse> {
    try {
      // Check if input is a string (attemptId) or an object (data format)
      if (typeof attemptIdOrData === "string") {
        // Original format: fetch data from database
        const attemptId = attemptIdOrData;

        // Get attempt details
        const attempt =
          await examAttemptRepository.findExamAttemptById(attemptId);
        if (!attempt) {
          throw new Error("Attempt not found");
        }

        // Get exam
        const exam = await examRepository.findExamById(
          attempt.examId.toString(),
        );
        if (!exam) {
          throw new Error("Exam not found");
        }

        // Get all questions for the exam
        const questions = await examQuestionRepository.findQuestionsByExamId(
          exam._id.toString(),
        );

        if (questions.length === 0) {
          throw new Error("No questions found for exam");
        }

        // Get all answers for the attempt
        const answers =
          await examAnswerRepository.findAnswersByAttemptId(attemptId);

        // Get file references (fileIds/filePaths) for AI to extract content
        const fileReferences = await sourceContentService.getExamFileReferences(
          exam._id.toString(),
        );

        // Build questions array with answers
        const questionsWithAnswers = questions
          .filter((question) => {
            // Filter out questions without required fields
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

            // Ensure studentAnswer is always provided (can be empty string or array)
            let studentAnswer = answer?.studentAnswer;
            if (studentAnswer === null || studentAnswer === undefined) {
              studentAnswer = "";
            }

            return {
              questionId: question._id.toString(),
              questionText: question.questionText,
              // For subjective questions (Short/Long Answers), don't send correctAnswer
              correctAnswer:
                question.questionType === "Short Answers" ||
                question.questionType === "Long Answers"
                  ? undefined
                  : question.correctAnswer,
              explanation: question.explanation,
              studentAnswer: studentAnswer,
              questionType: question.questionType,
              maxMarks: question.marks,
              difficulty: question.difficulty,
            };
          });

        // Validate we have questions after filtering
        if (questionsWithAnswers.length === 0) {
          throw new Error("No valid questions found for grading");
        }

        // Build grading request
        const gradingRequest: AttemptGradingRequest = {
          attemptId: attemptId,
          examId: exam._id.toString(),
          questions: questionsWithAnswers,
          // Pass file references instead of extracted content
          fileIds:
            fileReferences.fileIds.length > 0
              ? fileReferences.fileIds
              : undefined,
          filePaths:
            fileReferences.filePaths.length > 0
              ? fileReferences.filePaths
              : undefined,
          // Include topicBreakdown if available
          topicBreakdown: (exam as any).topicBreakdown,
        };

        // Handle new exam flow
        if (useNewExamFlow) {
          // Validate required fields for new flow
          if (!exam.aiExamId) {
            throw new Error(
              "aiExamId is required for new exam flow but is missing in exam",
            );
          }
          if (!attempt.studentId) {
            throw new Error(
              "studentId is required for new exam flow but is missing in attempt",
            );
          }

          // Transform to new API format
          const newFlowRequest = {
            feAttemptId: attemptId,
            ai_examId: exam.aiExamId,
            feStudentId: attempt.studentId.toString(),
            questions: questionsWithAnswers,
            topicBreakdown: (exam as any).topicBreakdown,
          };

          console.log(`🔄 Using new exam flow - calling new API endpoint:`, {
            feAttemptId: newFlowRequest.feAttemptId,
            ai_examId: newFlowRequest.ai_examId,
            feStudentId: newFlowRequest.feStudentId,
            questionsCount: newFlowRequest.questions.length,
          });

          // Call new AI API endpoint
          const response = await axios.post(
            `${this.aiApiUrl}/ai-llm/api/v1/grading/grade-attempt`,
            newFlowRequest,
            {
              headers: authToken
                ? { Authorization: `Bearer ${authToken}` }
                : {},
              timeout: 120000, // 2 minutes timeout for full attempt
            },
          );

          return this.transformApiResponse(response.data);
        }

        // Original flow - call existing AI API
        const response = await axios.post(
          `${this.aiApiUrl}/ai/api/v1/grading/grade-attempt`,
          gradingRequest,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            timeout: 120000, // 2 minutes timeout for full attempt
          },
        );

        return this.transformApiResponse(response.data);
      } else {
        // Check if this is already an AttemptGradingRequest
        if (
          "topicBreakdown" in attemptIdOrData ||
          ("questions" in attemptIdOrData &&
            Array.isArray(attemptIdOrData.questions) &&
            attemptIdOrData.questions.length > 0 &&
            "maxMarks" in attemptIdOrData.questions[0])
        ) {
          // This is already an AttemptGradingRequest, use it directly
          const gradingRequest = attemptIdOrData as AttemptGradingRequest;

          console.log(`📊 Passing AttemptGradingRequest to AI API:`, {
            attemptId: gradingRequest.attemptId,
            examId: gradingRequest.examId,
            questionsCount: gradingRequest.questions.length,
            questionsWithTopics: gradingRequest.questions.filter((q) => q.topic)
              .length,
            hasTopicBreakdown: !!gradingRequest.topicBreakdown,
            topicBreakdown: gradingRequest.topicBreakdown,
            useNewExamFlow: useNewExamFlow,
          });

          // Handle new exam flow
          if (useNewExamFlow) {
            // Fetch attempt and exam to get studentId and aiExamId
            const attempt = await examAttemptRepository.findExamAttemptById(
              gradingRequest.attemptId,
            );
            if (!attempt) {
              throw new Error("Attempt not found");
            }

            const exam = await examRepository.findExamById(
              gradingRequest.examId,
            );
            if (!exam) {
              throw new Error("Exam not found");
            }

            // Validate required fields for new flow
            if (!exam.aiExamId) {
              throw new Error(
                "aiExamId is required for new exam flow but is missing in exam",
              );
            }
            if (!attempt.studentId) {
              throw new Error(
                "studentId is required for new exam flow but is missing in attempt",
              );
            }

            // Transform to new API format
            const newFlowRequest = {
              feAttemptId: gradingRequest.attemptId,
              ai_examId: exam.aiExamId,
              feStudentId: attempt.studentId.toString(),
              questions: gradingRequest.questions,
              topicBreakdown: gradingRequest.topicBreakdown,
            };

            console.log(`🔄 Using new exam flow - calling new API endpoint:`, {
              feAttemptId: newFlowRequest.feAttemptId,
              ai_examId: newFlowRequest.ai_examId,
              feStudentId: newFlowRequest.feStudentId,
              questionsCount: newFlowRequest.questions.length,
            });

            // Call new AI API endpoint
            const response = await axios.post(
              `${this.aiApiUrl}/ai-llm/api/v1/grading/grade-attempt`,
              newFlowRequest,
              {
                headers: authToken
                  ? { Authorization: `Bearer ${authToken}` }
                  : {},
                timeout: 120000, // 2 minutes timeout for full attempt
              },
            );

            // New API returns same format, transform response
            const result = this.transformApiResponse(response.data);
            console.log(`📊 New AI API response received:`, {
              success: result.success,
              hasData: !!result.data,
              hasOverallFeedback: !!result.data?.overallFeedback,
              hasGapAnalysis: !!result.data?.gapAnalysis,
              weakTopicsCount: result.data?.weakTopics?.length || 0,
            });

            return result;
          }

          // Original flow - call existing AI API
          const response = await axios.post(
            `${this.aiApiUrl}/ai/api/v1/grading/grade-attempt`,
            gradingRequest,
            {
              headers: authToken
                ? { Authorization: `Bearer ${authToken}` }
                : {},
              timeout: 120000, // 2 minutes timeout for full attempt
            },
          );

          const result = this.transformApiResponse(response.data);
          console.log(`📊 AI API response received:`, {
            success: result.success,
            hasData: !!result.data,
            hasOverallFeedback: !!result.data?.overallFeedback,
            hasGapAnalysis: !!result.data?.gapAnalysis,
            weakTopicsCount: result.data?.weakTopics?.length || 0,
          });

          return result;
        }

        // New format: transform the provided data
        const requestData = attemptIdOrData as any;

        // Validate required fields
        if (!requestData.attemptId || !requestData.examId) {
          throw new Error("Missing required fields: attemptId, examId");
        }

        if (
          !requestData.questions ||
          !Array.isArray(requestData.questions) ||
          requestData.questions.length === 0
        ) {
          throw new Error("Missing or empty questions array");
        }

        // Detect if this is the new format (has marks instead of maxMarks)
        // Check if marks exists and maxMarks doesn't exist (using type assertion to check)
        const firstQuestion = requestData.questions[0] as any;
        const needsTransformation =
          firstQuestion?.marks !== undefined &&
          firstQuestion?.maxMarks === undefined;

        let gradingRequest: AttemptGradingRequest;

        if (needsTransformation) {
          // Transform the data format
          gradingRequest = await this.transformGradingRequestData({
            attemptId: requestData.attemptId,
            examId: requestData.examId,
            questions: requestData.questions,
          });
        } else {
          // Data is already in correct format, just add fileIds
          const fileReferences =
            await sourceContentService.getExamFileReferences(
              requestData.examId,
            );

          gradingRequest = {
            attemptId: requestData.attemptId,
            examId: requestData.examId,
            questions: requestData.questions.map((q: any) => ({
              questionId: q.questionId,
              questionText: q.questionText,
              correctAnswer:
                q.questionType === "Short Answers" ||
                q.questionType === "Long Answers"
                  ? undefined
                  : q.correctAnswer,
              explanation: q.explanation,
              studentAnswer: q.studentAnswer,
              questionType: q.questionType,
              maxMarks: q.maxMarks || q.marks,
              difficulty: q.difficulty,
              topic: q.topic, // Include topic if present
            })),
            fileIds:
              fileReferences.fileIds.length > 0
                ? fileReferences.fileIds
                : undefined,
            filePaths:
              fileReferences.filePaths.length > 0
                ? fileReferences.filePaths
                : undefined,
            topicBreakdown: requestData.topicBreakdown, // Include topicBreakdown if present
          };
        }

        // Handle new exam flow
        if (useNewExamFlow) {
          // Fetch attempt and exam to get studentId and aiExamId
          const attempt = await examAttemptRepository.findExamAttemptById(
            gradingRequest.attemptId,
          );
          if (!attempt) {
            throw new Error("Attempt not found");
          }

          const exam = await examRepository.findExamById(gradingRequest.examId);
          if (!exam) {
            throw new Error("Exam not found");
          }

          // Validate required fields for new flow
          if (!exam.aiExamId) {
            throw new Error(
              "aiExamId is required for new exam flow but is missing in exam",
            );
          }
          if (!attempt.studentId) {
            throw new Error(
              "studentId is required for new exam flow but is missing in attempt",
            );
          }

          // Transform to new API format
          const newFlowRequest = {
            feAttemptId: gradingRequest.attemptId,
            ai_examId: exam.aiExamId,
            feStudentId: attempt.studentId.toString(),
            questions: gradingRequest.questions,
            topicBreakdown: gradingRequest.topicBreakdown,
          };

          console.log(`🔄 Using new exam flow - calling new API endpoint:`, {
            feAttemptId: newFlowRequest.feAttemptId,
            ai_examId: newFlowRequest.ai_examId,
            feStudentId: newFlowRequest.feStudentId,
            questionsCount: newFlowRequest.questions.length,
          });

          console.log(
            `📤 Sending grade-attempt payload:`,
            JSON.stringify(newFlowRequest, null, 2),
          );

          // Call new AI API endpoint
          const response = await axios.post(
            `${this.aiApiUrl}/ai-llm/api/v1/grading/grade-attempt`,
            newFlowRequest,
            {
              headers: authToken
                ? { Authorization: `Bearer ${authToken}` }
                : {},
              timeout: 120000, // 2 minutes timeout for full attempt
            },
          );

          return this.transformApiResponse(response.data);
        }

        // Original flow - call existing AI API
        const response = await axios.post(
          `${this.aiApiUrl}/ai/api/v1/grading/grade-attempt`,
          gradingRequest,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            timeout: 120000, // 2 minutes timeout for full attempt
          },
        );

        return this.transformApiResponse(response.data);
      }
    } catch (error: any) {
      if (
        error.response?.data?.detail?.[0]?.loc?.includes("ai_examId") ||
        error.response?.data?.detail?.[0]?.loc?.includes("feAttemptId") ||
        error.response?.data?.detail?.[0]?.loc?.includes("feStudentId")
      ) {
        console.error(`❌ Validation error from AI API:`, {
          status: error.response?.status,
          detail: error.response?.data?.detail,
        });
      }
      console.error("Error in gradeAttempt:", error);
      throw new Error(
        `Failed to grade attempt: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }
}

// Export singleton instance
export const aiGradingService = new AIGradingService();

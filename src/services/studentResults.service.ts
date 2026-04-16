import * as examRepository from "../repositories/exam.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examAnswerRepository from "../repositories/examAnswer.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examStudentRepository from "../repositories/examStudent.repository";
import * as studentRepository from "../repositories/student.repository";
import { SubjectRepository } from "../repositories/subject.repository";
import { ClassRepository } from "../repositories/class.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import {
  ExamResultResponse,
  GetResultsHistoryRequest,
  GetResultsHistoryResponse,
  StudentPerformanceAnalytics,
  SubjectWiseAnalyticsResponse,
  SubjectPerformance,
  ClassRankingResponse,
  ProgressTrackingResponse,
  PeerComparisonResponse,
  ExamComparisonRequest,
  ExamComparisonResponse,
  DetailedResultResponse,
  GetMonthWiseRankingRequest,
  MonthWiseRankingResponse,
  MonthRankingData,
} from "@/types/studentResults.types";

/**
 * Student Results Service - Business logic for student results and analytics
 */

// Get exam result
export const getExamResult = async (
  examId: string,
  studentId: string,
): Promise<ExamResultResponse> => {
  try {
    // Get exam details
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get student's best graded attempt
    const bestAttempt = await examAttemptRepository.getBestAttemptForStudent(
      studentId,
      examId,
    );
    if (!bestAttempt || bestAttempt.attemptStatus !== "Graded") {
      throw new Error("RESULT_NOT_AVAILABLE");
    }

    // Get examStudent record for AI data (aiPrompt, recommendedResources)
    const examStudent = await examStudentRepository.getExamStudentRecord(
      examId,
      studentId,
    );

    // Get all answers for this attempt
    const answers = await examAnswerRepository.findAnswersByAttemptId(
      bestAttempt._id.toString(),
    );

    // Get all questions to fetch question text
    const questions =
      await examQuestionRepository.findQuestionsByExamId(examId);
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    // Get exam statistics
    const allAttempts =
      await examAttemptRepository.findAttemptsByExamId(examId);
    const gradedAttempts = allAttempts.filter(
      (a) => a.attemptStatus === "Graded",
    );
    const passedCount = gradedAttempts.filter(
      (a) => a.result === "Pass",
    ).length;
    const averageMarks =
      gradedAttempts.length > 0
        ? gradedAttempts.reduce((sum, a) => sum + (a.obtainedMarks || 0), 0) /
          gradedAttempts.length
        : 0;

    // Extract AI data from attempt
    const aiData =
      bestAttempt.aiFeedback ||
      bestAttempt.gapAnalysis ||
      (bestAttempt.weakTopics && bestAttempt.weakTopics.length > 0)
        ? {
            aiFeedback: bestAttempt.aiFeedback,
            gapAnalysis: bestAttempt.gapAnalysis,
            weakTopics: bestAttempt.weakTopics?.map((wt) => ({
              topic: wt.topic,
              performance: wt.performance,
              suggestions: wt.suggestions,
            })),
          }
        : undefined;

    // Extract AI data from examStudent
    const aiPrompts = examStudent?.aiPrompt?.map((ap) => ({
      prompt: ap.prompt,
      createdBy: ap.createdBy.toString(),
      createdAt: ap.createdAt,
    }));

    const recommendedResources = examStudent?.recommendedResources?.map(
      (rr) => ({
        title: rr.title,
        url: rr.url,
        description: rr.description,
        createdBy: rr.createdBy.toString(),
        createdAt: rr.createdAt,
      }),
    );

    return {
      examId: examId,
      examTitle: exam.examTitle,
      examType: exam.examType,
      attemptId: bestAttempt._id.toString(),
      attemptNumber: bestAttempt.attemptNumber || 1,
      startedAt: bestAttempt.startedAt!,
      submittedAt: bestAttempt.submittedAt!,
      examStartTime: exam.startOn!,
      examEndTime: exam.endOn!,
      examDuration: exam.durationInMinutes || 0,
      timeTaken: bestAttempt.timeTakenInSeconds || 0,
      totalMarks: bestAttempt.totalMarks || 0,
      obtainedMarks: bestAttempt.obtainedMarks!,
      percentage: bestAttempt.percentage!,
      result: bestAttempt.result!,
      grade: bestAttempt.grade,
      classRank: bestAttempt.classRank,
      totalStudents: gradedAttempts.length,
      passPercentage:
        gradedAttempts.length > 0
          ? (passedCount / gradedAttempts.length) * 100
          : 0,
      averageMarks: averageMarks,
      answers: answers.map((a) => {
        const question = questionMap.get(a.questionId.toString());
        return {
          questionNumber: a.questionNumber,
          questionType: a.questionType,
          questionText: question?.questionText || "Question text not available",
          studentAnswer: a.studentAnswer,
          correctAnswer: a.correctAnswer,
          isCorrect: a.isCorrect === null ? undefined : a.isCorrect,
          marksObtained: a.marksObtained,
          maxMarks: a.maxMarks,
          feedback: a.feedback,
          // AI Grading fields
          aiGradingNotes: a.aiGradingNotes,
          aiConfidence: a.aiConfidence,
          aiFeedback: a.aiFeedback,
          aiMarksObtained: a.aiMarksObtained,
          gradedBy: a.gradedBy,
          aiGradedAt: a.aiGradedAt,
        };
      }),
      aiData,
      aiPrompts,
      recommendedResources,
    };
  } catch (error) {
    console.error("Get exam result error:", error);
    throw error;
  }
};

// Get results history
export const getResultsHistory = async (
  params: GetResultsHistoryRequest & { studentId: string; tenantId: string },
): Promise<GetResultsHistoryResponse> => {
  try {
    // Get all graded attempts for student
    const studentStats = await examAttemptRepository.getStudentExamStatistics(
      params.studentId,
      params.tenantId,
    );

    // Get all attempts
    const mongoose = require("mongoose");
    const query: any = {
      studentId: new mongoose.Types.ObjectId(params.studentId),
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      attemptStatus: "Graded",
      isDeleted: false,
    };

    // Get attempts (simplified - in real implementation, use proper repository method)
    const attempts = await examAttemptRepository.getStudentAttemptHistory(
      params.studentId,
      "",
    );

    // Enrich with exam details
    const enrichedResults = await Promise.all(
      attempts
        .filter((a) => a.attemptStatus === "Graded")
        .map(async (attempt) => {
          const exam = await examRepository.findExamById(
            attempt.examId.toString(),
          );
          return {
            examId: attempt.examId.toString(),
            examTitle: exam?.examTitle || "Unknown Exam",
            examType: exam?.examType || "Official",
            attemptId: attempt._id.toString(),
            submittedAt: attempt.submittedAt!,
            obtainedMarks: attempt.obtainedMarks || 0,
            totalMarks: attempt.totalMarks,
            percentage: attempt.percentage || 0,
            result: attempt.result || "Pending",
            grade: attempt.grade,
            classRank: attempt.classRank,
          };
        }),
    );

    // Apply filters
    let filteredResults = enrichedResults;
    if (params.examType) {
      filteredResults = filteredResults.filter(
        (r) => r.examType === params.examType,
      );
    }
    if (params.result) {
      filteredResults = filteredResults.filter(
        (r) => r.result === params.result,
      );
    }

    // Sort
    if (params.sortBy === "submittedAt") {
      filteredResults.sort((a, b) => {
        const diff = a.submittedAt.getTime() - b.submittedAt.getTime();
        return params.sortOrder === "desc" ? -diff : diff;
      });
    } else if (params.sortBy === "percentage") {
      filteredResults.sort((a, b) => {
        const diff = a.percentage - b.percentage;
        return params.sortOrder === "desc" ? -diff : diff;
      });
    }

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedResults = filteredResults.slice(
      startIndex,
      startIndex + pageSize,
    );

    return {
      results: paginatedResults.map((r) => ({
        ...r,
        totalMarks: r.totalMarks || 0,
      })),
      pagination: {
        total: filteredResults.length,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(filteredResults.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get results history error:", error);
    throw error;
  }
};

// Get student performance analytics
export const getStudentPerformanceAnalytics = async (
  studentId: string,
  tenantId: string,
): Promise<StudentPerformanceAnalytics> => {
  try {
    // Get statistics
    const stats = await examAttemptRepository.getStudentExamStatistics(
      studentId,
      tenantId,
    );

    // Get all graded attempts for trend analysis
    const attempts = await examAttemptRepository.getStudentAttemptHistory(
      studentId,
      "",
    );
    const gradedAttempts = attempts.filter((a) => a.attemptStatus === "Graded");

    // Performance trend
    const performanceTrend = await Promise.all(
      gradedAttempts.slice(0, 10).map(async (attempt) => {
        const exam = await examRepository.findExamById(
          attempt.examId.toString(),
        );
        return {
          examTitle: exam?.examTitle || "Unknown",
          percentage: attempt.percentage || 0,
          submittedAt: attempt.submittedAt!,
        };
      }),
    );

    // Analyze strengths and weaknesses
    const strengthAreas: string[] = [];
    const improvementAreas: string[] = [];

    // Simple heuristic: if average > 80%, it's a strength
    if (stats.averagePercentage > 80) {
      strengthAreas.push("Overall exam performance");
    } else if (stats.averagePercentage < 60) {
      improvementAreas.push("Overall exam performance");
    }

    return {
      totalExamsTaken: stats.totalExamsTaken,
      totalPassed: stats.totalPassed,
      totalFailed: stats.totalFailed,
      passRate:
        stats.totalExamsTaken > 0
          ? (stats.totalPassed / stats.totalExamsTaken) * 100
          : 0,
      averagePercentage: stats.averagePercentage,
      highestScore:
        gradedAttempts.length > 0
          ? Math.max(...gradedAttempts.map((a) => a.percentage || 0))
          : 0,
      lowestScore:
        gradedAttempts.length > 0
          ? Math.min(...gradedAttempts.map((a) => a.percentage || 0))
          : 0,
      totalTimeSpent: stats.totalTimeSpent,
      performanceTrend: performanceTrend.sort(
        (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
      ),
      strengthAreas: strengthAreas,
      improvementAreas: improvementAreas,
    };
  } catch (error) {
    console.error("Get student performance analytics error:", error);
    throw error;
  }
};

// Get subject-wise analytics
export const getSubjectWiseAnalytics = async (
  studentId: string,
  tenantId: string,
): Promise<SubjectWiseAnalyticsResponse> => {
  try {
    // Get all attempts
    const attempts = await examAttemptRepository.getStudentAttemptHistory(
      studentId,
      "",
    );
    const gradedAttempts = attempts.filter((a) => a.attemptStatus === "Graded");

    // Group by subject
    const subjectMap = new Map<string, any[]>();

    for (const attempt of gradedAttempts) {
      const exam = await examRepository.findExamById(attempt.examId.toString());
      if (exam) {
        const subjectId = exam.subjectId.toString();
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, []);
        }
        subjectMap.get(subjectId)!.push({
          attempt,
          exam,
        });
      }
    }

    // Calculate subject performance
    const subjects: SubjectPerformance[] = [];
    let bestSubject = "";
    let bestPercentage = 0;
    let worstSubject = "";
    let worstPercentage = 100;

    for (const [subjectId, data] of subjectMap.entries()) {
      const examsTaken = data.length;
      const totalMarksSum = data.reduce(
        (sum, d) => sum + d.attempt.totalMarks,
        0,
      );
      const obtainedMarksSum = data.reduce(
        (sum, d) => sum + (d.attempt.obtainedMarks || 0),
        0,
      );
      const averagePercentage =
        data.reduce((sum, d) => sum + (d.attempt.percentage || 0), 0) /
        examsTaken;
      const highestScore = Math.max(
        ...data.map((d) => d.attempt.obtainedMarks || 0),
      );
      const lowestScore = Math.min(
        ...data.map((d) => d.attempt.obtainedMarks || 0),
      );
      const passCount = data.filter((d) => d.attempt.result === "Pass").length;
      const failCount = data.filter((d) => d.attempt.result === "Fail").length;

      const subjectName = `Subject ${subjectId.slice(-6)}`; // TODO: Fetch from subject API

      subjects.push({
        subjectId: subjectId,
        subjectName: subjectName,
        examsTaken: examsTaken,
        averagePercentage: averagePercentage,
        highestScore: highestScore,
        lowestScore: lowestScore,
        totalMarks: totalMarksSum,
        obtainedMarks: obtainedMarksSum,
        passCount: passCount,
        failCount: failCount,
      });

      // Track best and worst
      if (averagePercentage > bestPercentage) {
        bestPercentage = averagePercentage;
        bestSubject = subjectName;
      }
      if (averagePercentage < worstPercentage) {
        worstPercentage = averagePercentage;
        worstSubject = subjectName;
      }
    }

    return {
      subjects: subjects,
      overallPerformance: {
        totalExams: gradedAttempts.length,
        averagePercentage:
          subjects.length > 0
            ? subjects.reduce((sum, s) => sum + s.averagePercentage, 0) /
              subjects.length
            : 0,
        bestSubject: bestSubject,
        needsImprovement: worstSubject,
      },
    };
  } catch (error) {
    console.error("Get subject-wise analytics error:", error);
    throw error;
  }
};

// Get class ranking
export const getClassRanking = async (
  studentId: string,
  tenantId: string,
): Promise<ClassRankingResponse> => {
  try {
    // Get student's statistics
    const studentStats = await examAttemptRepository.getStudentExamStatistics(
      studentId,
      tenantId,
    );

    // TODO: In real implementation, calculate actual ranking across all students
    // For now, return mock data
    const currentRank = 15;
    const totalStudents = 50;
    const percentile =
      ((totalStudents - currentRank + 1) / totalStudents) * 100;

    return {
      studentId: studentId,
      currentRank: currentRank,
      totalStudents: totalStudents,
      percentile: percentile,
      averagePercentage: studentStats.averagePercentage,
      classAverage: 72.5,
      pointsAboveAverage: studentStats.averagePercentage - 72.5,
      topPerformers: [
        { rank: 1, studentName: "Student A", averagePercentage: 95.2 },
        { rank: 2, studentName: "Student B", averagePercentage: 92.8 },
        { rank: 3, studentName: "Student C", averagePercentage: 90.5 },
      ],
      nearbyRanks: [
        { rank: 14, studentName: "Student X", averagePercentage: 76.2 },
        {
          rank: 15,
          studentName: "You",
          averagePercentage: studentStats.averagePercentage,
        },
        { rank: 16, studentName: "Student Y", averagePercentage: 74.8 },
      ],
    };
  } catch (error) {
    console.error("Get class ranking error:", error);
    throw error;
  }
};

// Get progress tracking
export const getProgressTracking = async (
  studentId: string,
  tenantId: string,
): Promise<ProgressTrackingResponse> => {
  try {
    // Get all attempts
    const attempts = await examAttemptRepository.getStudentAttemptHistory(
      studentId,
      "",
    );
    const gradedAttempts = attempts.filter((a) => a.attemptStatus === "Graded");

    // Current month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthAttempts = gradedAttempts.filter(
      (a) => a.submittedAt && a.submittedAt >= currentMonthStart,
    );

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = currentMonthStart;
    const lastMonthAttempts = gradedAttempts.filter(
      (a) =>
        a.submittedAt &&
        a.submittedAt >= lastMonthStart &&
        a.submittedAt < lastMonthEnd,
    );

    const currentMonthStats = calculateMonthStats(currentMonthAttempts);
    const lastMonthStats = calculateMonthStats(lastMonthAttempts);

    return {
      currentMonth: currentMonthStats,
      lastMonth: lastMonthStats,
      improvement: {
        examsChange: currentMonthStats.examsTaken - lastMonthStats.examsTaken,
        percentageChange:
          currentMonthStats.averagePercentage -
          lastMonthStats.averagePercentage,
        passRateChange: currentMonthStats.passRate - lastMonthStats.passRate,
      },
      monthlyTrend: [], // TODO: Calculate last 6 months trend
    };
  } catch (error) {
    console.error("Get progress tracking error:", error);
    throw error;
  }
};

function calculateMonthStats(attempts: any[]) {
  const examsTaken = attempts.length;
  const averagePercentage =
    examsTaken > 0
      ? attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / examsTaken
      : 0;
  const passCount = attempts.filter((a) => a.result === "Pass").length;
  const passRate = examsTaken > 0 ? (passCount / examsTaken) * 100 : 0;

  return {
    examsTaken,
    averagePercentage,
    passRate,
  };
}

// Get peer comparison
export const getPeerComparison = async (
  studentId: string,
  tenantId: string,
): Promise<PeerComparisonResponse> => {
  try {
    // Get student stats
    const studentStats = await examAttemptRepository.getStudentExamStatistics(
      studentId,
      tenantId,
    );

    // TODO: Calculate actual class average
    const classAverage = {
      averagePercentage: 72.5,
      totalExams: 45,
    };

    const percentageDifference =
      studentStats.averagePercentage - classAverage.averagePercentage;

    return {
      student: {
        averagePercentage: studentStats.averagePercentage,
        totalExams: studentStats.totalExamsTaken,
        rank: 15, // TODO: Calculate actual rank
      },
      classAverage: classAverage,
      comparison: {
        percentageDifference: percentageDifference,
        examsDifference: studentStats.totalExamsTaken - classAverage.totalExams,
        performanceBetter: percentageDifference > 0,
      },
      distribution: [
        {
          range: "90-100%",
          count: 5,
          studentInRange: studentStats.averagePercentage >= 90,
        },
        {
          range: "80-89%",
          count: 12,
          studentInRange:
            studentStats.averagePercentage >= 80 &&
            studentStats.averagePercentage < 90,
        },
        {
          range: "70-79%",
          count: 18,
          studentInRange:
            studentStats.averagePercentage >= 70 &&
            studentStats.averagePercentage < 80,
        },
        {
          range: "60-69%",
          count: 10,
          studentInRange:
            studentStats.averagePercentage >= 60 &&
            studentStats.averagePercentage < 70,
        },
        {
          range: "Below 60%",
          count: 5,
          studentInRange: studentStats.averagePercentage < 60,
        },
      ],
    };
  } catch (error) {
    console.error("Get peer comparison error:", error);
    throw error;
  }
};

// Compare multiple exams
export const compareExams = async (
  data: ExamComparisonRequest,
  studentId: string,
): Promise<ExamComparisonResponse> => {
  try {
    const examResults = [];

    for (const examId of data.examIds) {
      const bestAttempt = await examAttemptRepository.getBestAttemptForStudent(
        studentId,
        examId,
      );
      if (bestAttempt && bestAttempt.attemptStatus === "Graded") {
        const exam = await examRepository.findExamById(examId);
        examResults.push({
          examId: examId,
          examTitle: exam?.examTitle || "Unknown",
          percentage: bestAttempt.percentage || 0,
          rank: bestAttempt.classRank || 0,
          result: bestAttempt.result || "Pending",
          submittedAt: bestAttempt.submittedAt!,
        });
      }
    }

    // Sort by date
    examResults.sort(
      (a, b) => a.submittedAt.getTime() - b.submittedAt.getTime(),
    );

    // Calculate analysis
    const percentages = examResults.map((e) => e.percentage);
    const bestPerformance = examResults.reduce(
      (best, current) =>
        current.percentage > best.percentage ? current : best,
      examResults[0],
    );
    const worstPerformance = examResults.reduce(
      (worst, current) =>
        current.percentage < worst.percentage ? current : worst,
      examResults[0],
    );

    // Calculate improvement trend
    let averageImprovement = 0;
    if (percentages.length > 1) {
      for (let i = 1; i < percentages.length; i++) {
        averageImprovement += percentages[i] - percentages[i - 1];
      }
      averageImprovement /= percentages.length - 1;
    }

    // Consistency score (lower standard deviation = more consistent)
    const mean =
      percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    const variance =
      percentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
      percentages.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - stdDev);

    return {
      exams: examResults,
      analysis: {
        bestPerformance: bestPerformance.examTitle,
        worstPerformance: worstPerformance.examTitle,
        averageImprovement: averageImprovement,
        consistencyScore: consistencyScore,
      },
    };
  } catch (error) {
    console.error("Compare exams error:", error);
    throw error;
  }
};

// Get detailed result by exam ID (gets best attempt automatically)
export const getDetailedResultByExamId = async (
  examId: string,
  studentId: string,
): Promise<DetailedResultResponse> => {
  try {
    // Get exam details
    const exam = await examRepository.findExamById(examId);
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Get student's best graded attempt
    const bestAttempt = await examAttemptRepository.getBestAttemptForStudent(
      studentId,
      examId,
    );
    if (!bestAttempt || bestAttempt.attemptStatus !== "Graded") {
      throw new Error("RESULT_NOT_AVAILABLE");
    }

    // Use the existing getDetailedResult function with the attemptId
    return await getDetailedResult(bestAttempt._id.toString(), studentId);
  } catch (error) {
    console.error("Get detailed result by exam ID error:", error);
    throw error;
  }
};

// Get detailed result
export const getDetailedResult = async (
  attemptId: string,
  studentId: string,
): Promise<DetailedResultResponse> => {
  try {
    // Get attempt
    const attempt = await examAttemptRepository.findExamAttemptById(attemptId);
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }

    // Verify ownership
    if (attempt.studentId.toString() !== studentId) {
      throw new Error("ATTEMPT_NOT_OWNED_BY_STUDENT");
    }

    // Check if graded
    if (attempt.attemptStatus !== "Graded") {
      throw new Error("RESULT_NOT_AVAILABLE");
    }

    // Get exam
    const exam = await examRepository.findExamById(attempt.examId.toString());
    if (!exam) {
      throw new Error("EXAM_NOT_FOUND");
    }

    // Concurrently fetch teacher name, examStudent, and answers
    const tenantId = exam.tenantId?.toString() || "";
    const [teacher, examStudent, answers] = await Promise.all([
      exam.teacherId
        ? teacherRepository.findTeacherById(exam.teacherId.toString())
        : Promise.resolve(null),
      examStudentRepository.getExamStudentRecord(
        attempt.examId.toString(),
        studentId,
      ),
      examAnswerRepository.findAnswersByAttemptId(attemptId),
    ]);

    // Use populated names from exam
    const subjectName =
      exam.subjectId && typeof exam.subjectId === "object"
        ? (exam.subjectId as any).name
        : undefined;
    const className =
      exam.classId && typeof exam.classId === "object"
        ? (exam.classId as any).name
        : undefined;
    const teacherName = teacher
      ? `${(teacher as any).firstName || ""} ${
          (teacher as any).lastName || ""
        }`.trim() || undefined
      : undefined;

    console.log(attempt, answers.length, "answers found for detailed result");

    // Question analysis
    const totalQuestions = answers.length;
    const correct = answers.filter((a) => a.isCorrect === true).length;
    const incorrect = answers.filter((a) => a.isCorrect === false).length;
    const unanswered = answers.filter((a) => !a.studentAnswer).length;
    const partiallyCorrect = answers.filter(
      (a) => a.marksObtained > 0 && a.marksObtained < a.maxMarks,
    ).length;

    // Type-wise performance
    const typeMap = new Map<string, { total: number; correct: number }>();
    answers.forEach((a) => {
      if (!typeMap.has(a.questionType)) {
        typeMap.set(a.questionType, { total: 0, correct: 0 });
      }
      const typeStats = typeMap.get(a.questionType)!;
      typeStats.total++;
      if (a.isCorrect === true) typeStats.correct++;
    });

    // const typeWisePerformance = Array.from(typeMap.entries()).map(
    //   ([type, stats]) => ({
    //     questionType: type,
    //     totalQuestions: stats.total,
    //     correct: stats.correct,
    //     percentage: (stats.correct / stats.total) * 100,
    //   })
    // );

    // Time analysis
    const totalTime = attempt.timeTakenInSeconds;
    const averageTimePerQuestion = totalTime ? totalTime / totalQuestions : 0;
    const timeTaken = answers
      .map((a) => a.timeTakenInSeconds)
      .filter((t) => t > 0);
    const fastestAnswer = timeTaken.length > 0 ? Math.min(...timeTaken) : 0;
    const slowestAnswer = timeTaken.length > 0 ? Math.max(...timeTaken) : 0;

    // Recommendations
    // const recommendations: string[] = [];
    // if (attempt.percentage! < 70) {
    //   recommendations.push("Practice more questions to improve understanding");
    // }
    // if (incorrect > correct) {
    //   recommendations.push(
    //     "Review incorrect answers and understand the concepts"
    //   );
    // }
    // if (averageTimePerQuestion > 120) {
    //   recommendations.push("Work on time management during exams");
    // }

    // Get all attempts for percentile (consider optimizing with aggregation if many attempts)
    const allAttempts = await examAttemptRepository.findAttemptsByExamId(
      attempt.examId.toString(),
    );
    const gradedAttempts = allAttempts.filter(
      (a) => a.attemptStatus === "Graded",
    );
    const totalStudents = gradedAttempts.length;
    const betterThan = gradedAttempts.filter(
      (a) => (a.obtainedMarks || 0) < (attempt.obtainedMarks || 0),
    ).length;
    const percentile =
      totalStudents > 0 ? (betterThan / totalStudents) * 100 : 0;

    // Extract feedbacks
    const teacherFeedback = attempt.teacherFeedback || "";
    const aiFeedback = attempt.aiFeedback || "";

    // AI data
    const aiData =
      attempt.aiFeedback ||
      attempt.gapAnalysis ||
      (attempt.weakTopics && attempt.weakTopics.length > 0) ||
      answers.some((a) => a.aiFeedback || a.aiGradingNotes || a.aiConfidence)
        ? {
            overallFeedback: aiFeedback,
            gapAnalysis: attempt.gapAnalysis,
            weakTopics: attempt.weakTopics?.map((wt) => ({
              topic: wt.topic,
              performance: wt.performance,
              suggestions: wt.suggestions,
            })),
          }
        : undefined;

    // AI prompts and resources
    const aiPrompts = examStudent?.aiPrompt?.map((ap) => ({
      prompt: ap.prompt,
      createdBy: ap.createdBy.toString(),
      createdAt: ap.createdAt,
    }));

    const recommendedResources = examStudent?.recommendedResources?.map(
      (rr) => ({
        title: rr.title,
        url: rr.url,
        description: rr.description,
        createdBy: rr.createdBy.toString(),
        createdAt: rr.createdAt,
      }),
    );

    const aiPrompt = examStudent?.aiPrompt?.map((ap) => ap.prompt) || [];

    // Get questions concurrently with other operations if possible, but here after
    const questions = await examQuestionRepository.findQuestionsByExamId(
      attempt.examId.toString(),
    );
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    // Build answers array
    const answersArray = answers.map((a) => {
      const question = questionMap.get(a.questionId.toString());
      return {
        questionNumber: a.questionNumber,
        questionType: a.questionType,
        questionText: question?.questionText || "Question text not available",
        options: question?.options || [],
        studentAnswer: a.studentAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect === null ? undefined : a.isCorrect,
        marksObtained: a.marksObtained,
        maxMarks: a.maxMarks,
        feedback: a.feedback,
        teacherComment: a.teacherComment,
        aiGradingNotes: a.aiGradingNotes,
        aiConfidence: a.aiConfidence,
        aiFeedback: a.aiFeedback,
        aiMarksObtained: a.aiMarksObtained,
        // gradedBy: a.gradedBy,
        // aiGradedAt: a.aiGradedAt,
      };
    });

    console.log("--------------------attempt", attempt);

    return {
      attempt: {
        attemptId: attempt._id.toString(),
        feAttemptId: attempt._id.toString(),
        examTitle: exam.examTitle,
        examType: exam.examType,
        examStartTime: exam.startOn!,
        examEndTime: exam.endOn!,
        examDuration: exam.durationInMinutes || 0,
        // startedAt: attempt.startedAt!,
        submittedAt: attempt.submittedAt!,
        timeTaken: totalTime || 0,
        subjectName,
        className,
        teacherName,
      },
      marks: {
        obtainedMarks: attempt.obtainedMarks!,
        totalMarks: attempt.totalMarks || 0,
        percentage: attempt.percentage!,
        result: attempt.result!,
        grade: attempt.grade,
      },
      questionAnalysis: {
        totalQuestions,
        correct,
        incorrect,
        // unanswered,
        // partiallyCorrect,
      },
      difficultyWisePerformance: [],
      timeAnalysis: {
        totalTime: totalTime || 0,
        // averageTimePerQuestion,
        // fastestAnswer,
        // slowestAnswer,
      },
      aiData,
      teacherFeedback,
      aiFeedback,
      overallFeedback: aiFeedback,
      answers: answersArray,
    };
  } catch (error) {
    console.error("Get detailed result error:", error);
    throw error;
  }
};

// Get month-wise ranking
export const getMonthWiseRanking = async (
  params: GetMonthWiseRankingRequest & { tenantId: string },
): Promise<MonthWiseRankingResponse> => {
  try {
    const { studentId, subjectId, classId, tenantId } = params;

    // Validate student exists and belongs to tenant
    const student = await studentRepository.findStudentById(studentId);
    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    if (student.tenantId !== tenantId) {
      throw new Error("STUDENT_NOT_IN_TENANT");
    }

    // Get classId from student if not provided
    let finalClassId = classId;
    if (!finalClassId) {
      if (!student.classId) {
        throw new Error("STUDENT_NOT_IN_CLASS");
      }
      finalClassId = student.classId;
    }

    // Get month-wise rankings
    const monthlyRankings = await examAttemptRepository.getMonthWiseRankings(
      studentId,
      finalClassId,
      tenantId,
      subjectId,
    );

    // Convert to MonthRankingData format
    const monthlyRankingsData: MonthRankingData[] = monthlyRankings.map(
      (r) => ({
        month: r.monthName,
        year: r.year,
        rank: r.studentRank,
        totalStudents: r.totalStudents,
        averagePercentage: r.averagePercentage,
      }),
    );

    // Get current rank (most recent month with data)
    let currentRank: number | null = null;
    let previousRank: number | null = null;
    let totalStudents = 0;

    if (monthlyRankingsData.length > 0) {
      // Sort by year and month to get most recent
      const sortedRankings = [...monthlyRankingsData].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const monthOrder = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month);
      });

      currentRank = sortedRankings[0]?.rank || null;
      totalStudents = sortedRankings[0]?.totalStudents || 0;

      // Get previous rank (second most recent month with data)
      if (sortedRankings.length > 1) {
        previousRank = sortedRankings[1]?.rank || null;
      }
    }

    return {
      studentId: studentId,
      classId: finalClassId,
      subjectId: subjectId,
      currentRank: currentRank,
      previousRank: previousRank,
      totalStudents: totalStudents,
      monthlyRankings: monthlyRankingsData,
    };
  } catch (error) {
    console.error("Get month-wise ranking error:", error);
    throw error;
  }
};

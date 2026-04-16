import * as studentTopicPerformanceRepository from "../repositories/studentTopicPerformance.repository";
import {
  GetStudentTopicStatisticsRequest,
  GetStudentTopicStatisticsResponse,
} from "@/types/studentTopicPerformance.types";
import { ExamStudent } from "../models";
import mongoose from "mongoose";
import { SubjectRepository } from "@/repositories/subject.repository";

/**
 * Student Topic Performance Service - Business logic for student topic performance statistics
 */

// Get student topic statistics for a class and subject
// Now returns exam results instead of topic statistics (similar to recent-results API)

export const getStudentTopicStatistics = async (
  params: GetStudentTopicStatisticsRequest & { tenantId: string; examType?: string }
): Promise<GetStudentTopicStatisticsResponse> => {
  try {
    const { studentId, classId, subjectId, tenantId, examType } = params;

    if (!studentId) {
      throw new Error("Student ID is required");
    }

    if (!classId) {
      throw new Error("Class ID is required");
    }

    if (!subjectId) {
      throw new Error("Subject ID is required");
    }

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    console.log(`[getStudentTopicStatistics] Fetching exam results for student ${studentId}, subject ${subjectId}, examType: ${examType || 'all'}`);

    // Get exam results for this student filtered by classId and subjectId
    // This now returns exam-based data similar to recent-results API
    const examResults = await getStudentExamResultsBySubject(
      studentId,
      classId,
      subjectId,
      tenantId,
      examType
    );

    console.log(`[getStudentTopicStatistics] Returning ${examResults.length} exam results`);

    return {
      success: true,
      message: "Student exam results retrieved successfully",
      data: {
        studentId,
        classId,
        subjectId,
        topics: examResults, // Using 'topics' key for backward compatibility, but contains exam results
      },
    };
  } catch (error: any) {
    console.error("Get student topic statistics error:", error);
    throw new Error(`Failed to get student exam results: ${error.message}`);
  }
};

/**
 * Get exam results for a student filtered by class and subject
 * Returns data similar to recent-results API but filtered by subject
 */
async function getStudentExamResultsBySubject(
  studentId: string,
  classId: string,
  subjectId: string,
  tenantId: string,
  examType?: string
): Promise<
  Array<{
    topicName: string; // Actually exam title for backward compatibility
    totalExams: number;
    averagePerformance: number;
    totalMarksObtained: number;
    totalMarksPossible: number;
    exams: Array<{
      examId: string;
      examTitle: string;
      examType: string;
      weightageInExam: number;
      performance: number;
      marksObtained: number;
      marksPossible: number;
    }>;
  }>
> {
  // Build query for completed and graded exams for this student
  const query: any = {
    studentId: new mongoose.Types.ObjectId(studentId),
    classId: new mongoose.Types.ObjectId(classId),
    subjectId: new mongoose.Types.ObjectId(subjectId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    status: "Completed",
    gradingStatus: "Completed",
    isActive: true,
    percentage: { $exists: true, $ne: null },
  };

  // Get completed and graded exams for this student and subject
  const gradedResults = await ExamStudent.find(query)
    .populate({
      path: "examId",
      select: "examTitle examType subjectId isDeleted totalMarks",
      populate: {
        path: "subjectId",
        select: "name",
      },
    })
    .sort({ updatedAt: -1 })
    .limit(7) // Limit to 7 for radar chart visualization
    .lean();

  // Process results - format as exam results similar to recent-results API
  const examResults: Array<{
    topicName: string;
    totalExams: number;
    averagePerformance: number;
    totalMarksObtained: number;
    totalMarksPossible: number;
    exams: Array<{
      examId: string;
      examTitle: string;
      examType: string;
      weightageInExam: number;
      performance: number;
      marksObtained: number;
      marksPossible: number;
    }>;
  }> = [];

  for (const examStudent of gradedResults) {
    const exam = examStudent.examId as any;

    // Skip if exam is deleted or not found
    if (!exam || exam.isDeleted) {
      continue;
    }

    // Filter by examType if provided
    if (examType && examType !== "all" && exam.examType !== examType) {
      continue;
    }

    const examIdStr = exam._id?.toString() || "";
    const examTitle = exam.examTitle || "Unknown Exam";
    const percentage = examStudent.percentage || 0;
    const totalMarks = exam.totalMarks || 100;
    const marksObtained = Math.round((percentage / 100) * totalMarks);

    // Each exam is treated as a separate "topic" entry for radar chart compatibility
    examResults.push({
      topicName: examTitle, // Use exam title as topic name for backward compatibility
      totalExams: 1,
      averagePerformance: percentage,
      totalMarksObtained: marksObtained,
      totalMarksPossible: totalMarks,
      exams: [
        {
          examId: examIdStr,
          examTitle: examTitle,
          examType: exam.examType || "Official",
          weightageInExam: 100,
          performance: percentage,
          marksObtained: marksObtained,
          marksPossible: totalMarks,
        },
      ],
    });
  }

  return examResults;
}


import {
  Exam,
  ExamStudent,
  ExamAttempt,
  ExamQuestion,
  ExamAnswer,
  Class,
} from "../models";
import { IExam, IExamStudent, IExamAttempt } from "../models";
import mongoose from "mongoose";
import { TeacherAssignClassesRepository } from "./teacherAssignClasses.repository";

/**
 * Grading Repository - Data access layer for grading operations
 */

// Get exams for grading (Published and Released exams with endOn in past)
export const findExamsForGrading = async (
  teacherId: string,
  tenantId: string,
  filters: {
    gradingTypeStatus?: string;
    search?: string;
    classId?: string;
    class?: string;
    subjectId?: string;
    batchId?: string; // Filter by batch
    examModeId?: string; // Filter by exam mode
    clientTime?: string; // ISO date string from client side
  } = {}
): Promise<IExam[]> => {
  try {
    // Use client time if provided, otherwise fall back to server time
    let now: Date;
    if (filters.clientTime) {
      now = new Date(filters.clientTime);
      // Validate the date
      if (isNaN(now.getTime())) {
        // Invalid date, fall back to server time
        now = new Date();
      }
    } else {
      now = new Date();
    }

    const query: any = {
      teacherId: teacherId,
      tenantId: tenantId,
      examStatus: { $in: ["Published", "Released"] }, // Include both Published and Released exams
      // endOn: { $lt: now }, // Exam must have ended (using client time)
      isDeleted: false,
    };

    // Filter by grading status
    if (filters.gradingTypeStatus && filters.gradingTypeStatus !== "all") {
      query.gradingTypeStatus = filters.gradingTypeStatus;
    }

    // Handle batchId filter: filter by classes in the batch, not by exam's batchId field
    let batchClassIds: mongoose.Types.ObjectId[] = [];
    if (filters.batchId && mongoose.Types.ObjectId.isValid(filters.batchId)) {
      const classesInBatch = await Class.find({
        batchId: new mongoose.Types.ObjectId(filters.batchId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .select("_id")
        .lean();

      batchClassIds = classesInBatch.map((cls: any) => cls._id);

      if (batchClassIds.length === 0) {
        // No classes in this batch, return empty result
        return [];
      }
    }

    // Filter by classId
    if (filters.classId) {
      const classIdObj = new mongoose.Types.ObjectId(filters.classId);

      // If batchId is provided, check if the classId is in the batch
      if (batchClassIds.length > 0) {
        const classIdStr = classIdObj.toString();
        const batchClassIdStrs = batchClassIds.map((id: any) => id.toString());
        if (!batchClassIdStrs.includes(classIdStr)) {
          // The requested classId is not in the batch, return empty result
          return [];
        }
      }

      query.classId = classIdObj;
    } else if (filters.class) {
      // Filter by class name if classId is not provided
      // If class is a valid ObjectId, treat it as classId
      if (mongoose.Types.ObjectId.isValid(filters.class)) {
        const classIdObj = new mongoose.Types.ObjectId(filters.class);

        // If batchId is provided, check if the classId is in the batch
        if (batchClassIds.length > 0) {
          const classIdStr = classIdObj.toString();
          const batchClassIdStrs = batchClassIds.map((id: any) => id.toString());
          if (!batchClassIdStrs.includes(classIdStr)) {
            // The requested classId is not in the batch, return empty result
            return [];
          }
        }

        query.classId = classIdObj;
      } else {
        // Search for classes by name matching the filter
        const classQuery: any = {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          name: { $regex: filters.class, $options: "i" },
          isDeleted: false,
        };

        // If batchId is provided, filter classes by batch
        if (batchClassIds.length > 0) {
          classQuery._id = { $in: batchClassIds };
        }

        const matchingClasses = await Class.find(classQuery)
          .select("_id")
          .lean();

        // If no classes found, return empty result
        if (matchingClasses.length === 0) {
          return [];
        }

        // Get array of class IDs
        const classIds = matchingClasses.map((cls: any) => cls._id);
        query.classId = { $in: classIds };
      }
    } else if (batchClassIds.length > 0) {
      // No classId filter but batchId is provided, filter by classes in batch
      query.classId = { $in: batchClassIds };
    }

    // Filter by subjectId
    if (filters.subjectId) {
      query.subjectId = new mongoose.Types.ObjectId(filters.subjectId);
    }

    // Filter by examModeId
    if (filters.examModeId && mongoose.Types.ObjectId.isValid(filters.examModeId)) {
      query.examModeId = new mongoose.Types.ObjectId(filters.examModeId);
    }

    // Search by exam title
    if (filters.search) {
      query.examTitle = { $regex: filters.search, $options: "i" };
    }

    return await Exam.find(query).sort({ endOn: -1 });
  } catch (error: any) {
    console.error("Error finding exams for grading:", error);
    throw error;
  }
};

// Count students by status for an exam
export const countStudentsByStatus = async (
  examId: string
): Promise<{
  totalStudents: number;
  studentsCompleted: number;
  studentsStarted: number;
  studentsNotAttempted: number;
}> => {
  try {
    const totalStudents = await ExamStudent.countDocuments({
      examId: examId,
      isActive: true,
    });

    const studentsCompleted = await ExamStudent.countDocuments({
      examId: examId,
      status: "Completed",
      isActive: true,
    });

    const studentsStarted = await ExamStudent.countDocuments({
      examId: examId,
      status: "Started",
      isActive: true,
    });

    const studentsNotAttempted = await ExamStudent.countDocuments({
      examId: examId,
      status: "Pending",
      isActive: true,
    });

    return {
      totalStudents,
      studentsCompleted,
      studentsStarted,
      studentsNotAttempted,
    };
  } catch (error: any) {
    console.error("Error counting students by status:", error);
    throw error;
  }
};

// Get exam statistics for grading
export const getExamStatisticsForGrading = async (
  examId: string
): Promise<{
  passRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}> => {
  try {
    const attempts = await ExamAttempt.find({
      examId: examId,
      attemptStatus: "Graded",
      isDeleted: false,
    });

    if (attempts.length === 0) {
      return {
        passRate: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
      };
    }

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a) => a.result === "Pass").length;
    const scores = attempts.map((a) => a.obtainedMarks || 0);

    const passRate = (passedAttempts / totalAttempts) * 100;
    const averageScore =
      scores.reduce((sum, score) => sum + score, 0) / totalAttempts;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    return {
      passRate: Math.round(passRate * 100) / 100,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
    };
  } catch (error: any) {
    console.error("Error getting exam statistics:", error);
    throw error;
  }
};

// Get students with their grading status for an exam
export const getStudentsForGrading = async (
  examId: string
): Promise<IExamStudent[]> => {
  try {
    return await ExamStudent.find({
      examId: examId,
      isActive: true,
    }).sort({ studentId: 1 });
  } catch (error: any) {
    console.error("Error getting students for grading:", error);
    throw error;
  }
};

// Update exam grading status
export const updateExamGradingStatus = async (
  examId: string,
  status: "Waiting for Grading" | "In Progress" | "Completed"
): Promise<IExam | null> => {
  try {
    return await Exam.findByIdAndUpdate(
      examId,
      { gradingTypeStatus: status },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error updating exam grading status:", error);
    throw error;
  }
};

// Update exam student grading status
export const updateExamStudentGradingStatus = async (
  examId: string,
  studentId: string,
  status: "Waiting for Grading" | "In Progress" | "Completed",
  grade?: string,
  percentage?: number
): Promise<IExamStudent | null> => {
  try {
    const updateData: any = { gradingStatus: status };
    if (grade) updateData.grade = grade;
    if (percentage !== undefined) updateData.percentage = percentage;

    // Set gradedAt if completed
    if (status === "Completed") {
      updateData.gradedAt = new Date();
    }

    return await ExamStudent.findOneAndUpdate(
      { examId, studentId, isActive: true },
      updateData,
      { new: true }
    );
  } catch (error: any) {
    console.error("Error updating exam student grading status:", error);
    throw error;
  }
};

// Add feedback to exam student
export const addFeedbackToExamStudent = async (
  examId: string,
  studentId: string,
  feedback: {
    comment: string;
    createdBy: mongoose.Types.ObjectId;
  }
): Promise<IExamStudent | null> => {
  try {
    return await ExamStudent.findOneAndUpdate(
      { examId, studentId, isActive: true },
      {
        $push: {
          feedback: {
            comment: feedback.comment,
            createdBy: feedback.createdBy,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error adding feedback:", error);
    throw error;
  }
};

// Add AI prompt to exam student
export const addAIPromptToExamStudent = async (
  examId: string,
  studentId: string,
  aiPrompt: {
    prompt: string;
    createdBy: mongoose.Types.ObjectId;
  }
): Promise<IExamStudent | null> => {
  try {
    return await ExamStudent.findOneAndUpdate(
      { examId, studentId, isActive: true },
      {
        $push: {
          aiPrompt: {
            prompt: aiPrompt.prompt,
            createdBy: aiPrompt.createdBy,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error adding AI prompt:", error);
    throw error;
  }
};

// Add recommended resources to exam student
export const addRecommendedResourcesToExamStudent = async (
  examId: string,
  studentId: string,
  resources: Array<{
    title: string;
    url: string;
    description?: string;
    createdBy: mongoose.Types.ObjectId;
  }>
): Promise<IExamStudent | null> => {
  try {
    const formattedResources = resources.map((r) => ({
      ...r,
      createdAt: new Date(),
    }));

    return await ExamStudent.findOneAndUpdate(
      { examId, studentId, isActive: true },
      {
        $push: {
          recommendedResources: { $each: formattedResources },
        },
      },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error adding recommended resources:", error);
    throw error;
  }
};

// Update question average correct percentage
export const updateQuestionAverageCorrectPercentage = async (
  examId: string,
  questionId: string
): Promise<void> => {
  try {
    // Get all answers for this question
    const answers = await ExamAnswer.find({
      examId: examId,
      questionId: questionId,
      isDeleted: false,
    });

    if (answers.length === 0) return;

    // Count correct answers
    const correctAnswers = answers.filter((a) => a.isCorrect === true).length;
    const averageCorrectPercentage = (correctAnswers / answers.length) * 100;

    // Update question
    await ExamQuestion.findByIdAndUpdate(questionId, {
      averageCorrectPercentage:
        Math.round(averageCorrectPercentage * 100) / 100,
    });
  } catch (error: any) {
    console.error("Error updating question average correct percentage:", error);
    throw error;
  }
};

// Check if all students are graded for an exam
export const checkAllStudentsGraded = async (
  examId: string
): Promise<boolean> => {
  try {
    const totalCompleted = await ExamStudent.countDocuments({
      examId: examId,
      status: "Completed",
      isActive: true,
    });

    const totalGraded = await ExamStudent.countDocuments({
      examId: examId,
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
    });

    return totalCompleted === totalGraded && totalCompleted > 0;
  } catch (error: any) {
    console.error("Error checking if all students are graded:", error);
    throw error;
  }
};

// Count students whose grading is completed for an exam
export const countGradedStudents = async (examId: string): Promise<number> => {
  try {
    return await ExamStudent.countDocuments({
      examId: examId,
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
    });
  } catch (error: any) {
    console.error("Error counting graded students:", error);
    throw error;
  }
};

// Get grading statistics by class (for exams where endOn has passed)
export const getGradingStatisticsByClass = async (
  classId: string,
  subjectId: string,
  tenantId: string,
  gradingType?: string,
  examType?: string
): Promise<{
  totalExams: number;
  inProgressCount: number;
  waitingForGradingCount: number;
  completedCount: number;
}> => {
  try {
    const now = new Date();
    const query: any = {
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      endOn: { $lt: now }, // Exam end time has passed
      isDeleted: false,
    };

    // Optional filter by gradingType
    if (gradingType && gradingType !== "all") {
      query.gradingTypeStatus = gradingType;
    }

    // Optional filter by examType (Official | Practice)
    if (examType && (examType === "Official" || examType === "Practice")) {
      query.examType = examType;
    }

    // Get total count
    const totalExams = await Exam.countDocuments(query);

    // Get counts by grading status (only for exams that have ended)
    const inProgressCount = await Exam.countDocuments({
      ...query,
      gradingTypeStatus: "In Progress",
    });

    const waitingForGradingCount = await Exam.countDocuments({
      ...query,
      gradingTypeStatus: "Waiting for Grading",
    });

    const completedCount = await Exam.countDocuments({
      ...query,
      gradingTypeStatus: "Completed",
    });

    return {
      totalExams,
      inProgressCount,
      waitingForGradingCount,
      completedCount,
    };
  } catch (error: any) {
    console.error("Error getting grading statistics by class:", error);
    throw error;
  }
};

// Get grading statistics for teacher across all assigned classes and subjects
export const getGradingStatisticsForTeacher = async (
  teacherId: string,
  tenantId: string,
  gradingType?: string,
  examType?: string,
  batchId?: string,
  examModeId?: string
): Promise<{
  totalExams: number;
  inProgressCount: number;
  waitingForGradingCount: number;
  completedCount: number;
}> => {
  try {
    // Get all teacher assignments
    const assignments =
      await TeacherAssignClassesRepository.findAssignmentsByTeacher(
        teacherId,
        tenantId
      );

    // If no assignments, return zeros
    if (!assignments || assignments.length === 0) {
      return {
        totalExams: 0,
        inProgressCount: 0,
        waitingForGradingCount: 0,
        completedCount: 0,
      };
    }

    // Extract unique classId-subjectId pairs
    let classSubjectPairs = assignments.map((assignment: any) => {
      // Handle both populated and non-populated classId/subjectId
      const classId = assignment.classId?._id
        ? assignment.classId._id.toString()
        : assignment.classId?.toString() || assignment.classId;
      const subjectId = assignment.subjectId?._id
        ? assignment.subjectId._id.toString()
        : assignment.subjectId?.toString() || assignment.subjectId;

      return {
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
      };
    });

    // Filter by batchId if provided
    if (batchId) {
      // Get all class IDs that belong to the batch
      const { Class } = await import("../models");
      const classesInBatch = await Class.find({
        batchId: new mongoose.Types.ObjectId(batchId),
        isDeleted: false,
      }).select("_id").lean();

      const batchClassIds = new Set(
        classesInBatch.map((cls: any) => cls._id.toString())
      );

      // Filter classSubjectPairs to only include classes in the batch
      classSubjectPairs = classSubjectPairs.filter((pair) =>
        batchClassIds.has(pair.classId.toString())
      );

      // If no pairs remain after filtering, return zeros
      if (classSubjectPairs.length === 0) {
        return {
          totalExams: 0,
          inProgressCount: 0,
          waitingForGradingCount: 0,
          completedCount: 0,
        };
      }
    }

    // Build query with $or condition matching any of these pairs
    const now = new Date();
    const baseQuery: any = {
      teacherId: new mongoose.Types.ObjectId(teacherId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      // endOn: { $lt: now }, // Exam end time has passed
      isDeleted: false,
      $or: classSubjectPairs.map((pair) => ({
        classId: pair.classId,
        subjectId: pair.subjectId,
      })),
    };

    // Optional filter by gradingType
    if (gradingType && gradingType !== "all") {
      baseQuery.gradingTypeStatus = gradingType;
    }

    // Optional filter by examType (Official | Practice)
    if (examType && (examType === "Official" || examType === "Practice")) {
      baseQuery.examType = examType;
    }

    // Optional filter by examModeId
    if (examModeId && mongoose.Types.ObjectId.isValid(examModeId)) {
      baseQuery.examModeId = new mongoose.Types.ObjectId(examModeId);
    }

    // Get total count
    const totalExams = await Exam.countDocuments(baseQuery);

    // Get counts by grading status (only for exams that have ended)
    const inProgressCount = await Exam.countDocuments({
      ...baseQuery,
      gradingTypeStatus: "In Progress",
    });

    const waitingForGradingCount = await Exam.countDocuments({
      ...baseQuery,
      gradingTypeStatus: "Waiting for Grading",
    });

    const completedCount = await Exam.countDocuments({
      ...baseQuery,
      gradingTypeStatus: "Completed",
    });

    return {
      totalExams,
      inProgressCount,
      waitingForGradingCount,
      completedCount,
    };
  } catch (error: any) {
    console.error("Error getting grading statistics for teacher:", error);
    throw error;
  }
};

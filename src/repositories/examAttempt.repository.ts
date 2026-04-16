import mongoose, { Types } from "mongoose";
import {
  ExamAttempt,
  IExamAttempt as IExamAttemptModel,
} from "../models/examAttempt.schema";
import { ExamStudent } from "../models";

/**
 * ExamAttempt Repository - Data access layer for exam attempts
 */

// Ensure consistent types for ObjectId fields
const convertToObjectId = (
  id: string | mongoose.Types.ObjectId,
): mongoose.Types.ObjectId => {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
};

// Create new exam attempt
export const createExamAttempt = async (
  data: Partial<IExamAttemptModel>,
): Promise<IExamAttemptModel> => {
  try {
    // Ensure required fields are present
    if (!data.studentId) throw new Error("studentId is required");
    if (!data.examId) throw new Error("examId is required");
    if (!data.tenantId) throw new Error("tenantId is required");

    // Set default values for required fields
    const attemptData: Partial<IExamAttemptModel> = {
      ...data,
      attemptNumber: data.attemptNumber || 1,
      startedAt: data.startedAt || new Date(),
      totalMarks: data.totalMarks || 0,
      obtainedMarks: data.obtainedMarks || 0,
      attemptStatus: data.attemptStatus || "Not Started",
      result: data.result || "Pending",
      isDeleted: false,
    };

    // Convert string IDs to ObjectId if they are strings
    if (typeof attemptData.studentId === "string") {
      attemptData.studentId = convertToObjectId(attemptData.studentId);
    }

    if (typeof attemptData.examId === "string") {
      attemptData.examId = convertToObjectId(attemptData.examId);
    }

    if (typeof attemptData.tenantId === "string") {
      attemptData.tenantId = convertToObjectId(attemptData.tenantId);
    }

    const attempt = new ExamAttempt(attemptData);
    const savedAttempt = await attempt.save();

    // Convert to plain object and handle ObjectId to string conversion
    const result = savedAttempt.toObject({
      transform: (doc: any, ret: any) => {
        ret._id = ret._id.toString();
        if (ret.studentId) ret.studentId = ret.studentId.toString();
        if (ret.examId) ret.examId = ret.examId.toString();
        if (ret.tenantId) ret.tenantId = ret.tenantId.toString();
        return ret;
      },
    });

    return result as IExamAttemptModel;
  } catch (error) {
    console.error("Error creating exam attempt:", error);
    throw error;
  }
};

// Find exam attempt by ID
export const findExamAttemptById = async (
  attemptId: string,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findById(attemptId);
  } catch (error: any) {
    console.error("Error finding exam attempt by ID:", error);
    throw error;
  }
};

// Find exam attempts by student and exam
export const findAttemptsByStudentAndExam = async (
  studentId: string,
  examId: string,
): Promise<IExamAttemptModel[]> => {
  try {
    return await ExamAttempt.find({
      studentId: studentId,
      examId: examId,
      isDeleted: false,
    }).sort({ attemptNumber: -1 });
  } catch (error: any) {
    console.error("Error finding attempts by student and exam:", error);
    throw error;
  }
};

// Count attempts by student and exam
export const countAttemptsByStudentAndExam = async (
  studentId: string,
  examId: string,
): Promise<number> => {
  try {
    return await ExamAttempt.countDocuments({
      studentId: studentId,
      examId: examId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error counting attempts:", error);
    throw error;
  }
};

// Update exam attempt status
export const updateAttemptStatus = async (
  attemptId: string,
  status: string,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        attemptStatus: status,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error updating attempt status:", error);
    throw error;
  }
};

// Submit exam attempt
export const submitExamAttempt = async (
  attemptId: string,
  submissionData: {
    submittedAt: Date;
    timeTakenInSeconds: number;
    attemptStatus: string;
  },
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        ...submissionData,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error submitting exam attempt:", error);
    throw error;
  }
};

// Update exam attempt with marks
export const updateAttemptMarks = async (
  attemptId: string,
  marksData: {
    obtainedMarks: number;
    percentage: number;
    result: string;
    attemptStatus: string;
    grade?: string;
    aiFeedback?: string;
    teacherFeedback?: string;
    overallFeedback?: string;
    overallAssessment?: string;
    gapAnalysis?: string;
    weakTopics?: Array<{
      topic: string;
      performance: number;
      suggestions: string;
    }>;
    aiResponse?: any; // Stores the entire AI grading response (mixed type)
  },
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        ...marksData,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error updating attempt marks:", error);
    throw error;
  }
};

// Pause exam attempt
export const pauseExamAttempt = async (
  attemptId: string,
  pausedAt: Date,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        attemptStatus: "Paused",
        pausedAt: pausedAt,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error pausing exam attempt:", error);
    throw error;
  }
};

// Resume exam attempt
export const resumeExamAttempt = async (
  attemptId: string,
  resumedAt: Date,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        attemptStatus: "In Progress",
        resumedAt: resumedAt,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error resuming exam attempt:", error);
    throw error;
  }
};

// Get student's exam attempt history
export const getStudentAttemptHistory = async (
  studentId: string,
  examId: string,
): Promise<IExamAttemptModel[]> => {
  try {
    return await ExamAttempt.find({
      studentId: studentId,
      examId: examId,
      isDeleted: false,
    })
      .sort({ attemptNumber: -1 })
      .select(
        "attemptNumber startedAt submittedAt timeTakenInSeconds attemptStatus obtainedMarks percentage result",
      );
  } catch (error: any) {
    console.error("Error getting student attempt history:", error);
    throw error;
  }
};

// Get best attempt for student and exam
export const getBestAttemptForStudent = async (
  studentId: string,
  examId: string,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findOne({
      studentId: studentId,
      examId: examId,
      attemptStatus: "Graded",
      isDeleted: false,
    })
      .sort({ obtainedMarks: -1, percentage: -1 })
      .limit(1);
  } catch (error: any) {
    console.error("Error getting best attempt:", error);
    throw error;
  }
};

// Get active attempt for student and exam
export const getActiveAttemptForStudent = async (
  studentId: string,
  examId: string,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findOne({
      studentId: studentId,
      examId: examId,
      attemptStatus: { $in: ["In Progress", "Paused"] },
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error getting active attempt:", error);
    throw error;
  }
};

// Find attempts by exam ID
export const findAttemptsByExamId = async (
  examId: string,
): Promise<IExamAttemptModel[]> => {
  try {
    return await ExamAttempt.find({
      examId: examId,
      isDeleted: false,
    }).sort({ createdAt: -1 });
  } catch (error: any) {
    console.error("Error finding attempts by exam ID:", error);
    throw error;
  }
};

// Count attempts by exam ID
export const countAttemptsByExamId = async (
  examId: string,
): Promise<number> => {
  try {
    return await ExamAttempt.countDocuments({
      examId: examId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error counting attempts by exam ID:", error);
    throw error;
  }
};

// Get attempts needing grading
export const getAttemptsNeedingGrading = async (
  examId: string,
  tenantId: string,
): Promise<IExamAttemptModel[]> => {
  try {
    return await ExamAttempt.find({
      examId: examId,
      tenantId: tenantId,
      attemptStatus: "Submitted",
      isDeleted: false,
    }).sort({ submittedAt: 1 });
  } catch (error: any) {
    console.error("Error getting attempts needing grading:", error);
    throw error;
  }
};

// Soft delete exam attempt
export const softDeleteExamAttemptById = async (
  attemptId: string,
): Promise<IExamAttemptModel | null> => {
  try {
    return await ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        isDeleted: true,
        updatedAt: new Date(),
      },
      { new: true },
    );
  } catch (error: any) {
    console.error("Error soft deleting exam attempt:", error);
    throw error;
  }
};

// Soft delete all attempts for an exam
export const softDeleteAttemptsByExamId = async (
  examId: string,
): Promise<void> => {
  try {
    await ExamAttempt.updateMany(
      { examId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );
  } catch (error: any) {
    console.error("Error soft deleting attempts by exam ID:", error);
    throw error;
  }
};

/**
 * Get student exam attempts within a date range
 */
export const getStudentExamAttempts = async (
  studentId: string | Types.ObjectId,
  startDate?: Date,
  examId?: string | Types.ObjectId,
  endDate?: Date,
): Promise<IExamAttemptModel[]> => {
  try {
    const query: any = {
      studentId: new Types.ObjectId(studentId),
      isDeleted: false,
    };

    if (examId) {
      query.examId = new Types.ObjectId(examId);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const attempts = await ExamAttempt.find(query)
      .sort({ startedAt: -1 })
      .lean();

    // Convert Mongoose document to plain object and ensure proper typing
    return attempts.map((attempt) => attempt);
  } catch (error) {
    console.error("Error getting student exam attempts:", error);
    throw error;
  }
};

// Get exam statistics for student
export const getStudentExamStatistics = async (
  studentId: string,
  tenantId: string,
): Promise<{
  totalExamsTaken: number;
  totalPassed: number;
  totalFailed: number;
  averagePercentage: number;
  totalTimeSpent: number;
}> => {
  try {
    const stats = await ExamAttempt.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalExamsTaken: { $sum: 1 },
          totalPassed: {
            $sum: {
              $cond: [{ $eq: ["$result", "Pass"] }, 1, 0],
            },
          },
          totalFailed: {
            $sum: {
              $cond: [{ $eq: ["$result", "Fail"] }, 1, 0],
            },
          },
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
          totalTimeSpent: { $sum: "$timeTakenInSeconds" },
        },
      },
      {
        $project: {
          totalExamsTaken: 1,
          totalPassed: 1,
          totalFailed: 1,
          totalTimeSpent: 1,
          averagePercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalExamsTaken: 0,
        totalPassed: 0,
        totalFailed: 0,
        averagePercentage: 0,
        totalTimeSpent: 0,
      };
    }

    return stats[0];
  } catch (error: any) {
    console.error("Error getting student exam statistics:", error);
    throw error;
  }
};

// Find graded attempts by classId and subjectId
export const findGradedAttemptsByClassAndSubject = async (
  classId: string,
  subjectId: string,
  tenantId: string,
): Promise<IExamAttemptModel[]> => {
  try {
    return await ExamAttempt.find({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptStatus: "Graded",
      isDeleted: false,
    }).lean();
  } catch (error: any) {
    console.error("Error finding graded attempts by class and subject:", error);
    throw error;
  }
};

// Get class and subject statistics from attempts
export const getClassSubjectStatistics = async (
  classId: string,
  subjectId: string,
  tenantId: string,
  examIds: string[],
): Promise<{
  totalStudents: number;
  totalAttempts: number;
  averagePercentage: number;
  studentStats: Array<{
    studentId: string;
    avgPercentage: number;
    totalAttempts: number;
  }>;
  examStats: Array<{
    examId: string;
    averageScore: number;
    totalStudents: number;
    completedCount: number;
  }>;
}> => {
  try {
    // Get distinct student count
    const distinctStudents = await ExamAttempt.distinct("studentId", {
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptStatus: "Graded",
      isDeleted: false,
    });

    // Get overall statistics
    const overallStats = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
        },
      },
      {
        $project: {
          totalAttempts: 1,
          averagePercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    // Get per-student statistics
    const studentStats = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$studentId",
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
          totalAttempts: { $sum: 1 },
        },
      },
      {
        $addFields: {
          avgPercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          studentId: { $toString: "$_id" },
          avgPercentage: 1,
          totalAttempts: 1,
          _id: 0,
        },
      },
    ]);

    // Get per-exam statistics
    const examStats = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          examId: { $in: examIds.map((id) => new mongoose.Types.ObjectId(id)) },
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$examId",
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
          completedCount: { $sum: 1 },
        },
      },
      {
        $addFields: {
          averageScore: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $project: {
          examId: { $toString: "$_id" },
          averageScore: 1,
          completedCount: 1,
          _id: 0,
        },
      },
    ]);

    // Get distinct students per exam
    const examStudentCounts = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          examId: { $in: examIds.map((id) => new mongoose.Types.ObjectId(id)) },
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$examId",
          totalStudents: { $addToSet: "$studentId" },
        },
      },
      {
        $project: {
          examId: { $toString: "$_id" },
          totalStudents: { $size: "$totalStudents" },
          _id: 0,
        },
      },
    ]);

    // Merge exam stats with student counts
    const examStatsWithCounts = examStats.map((stat) => {
      const count = examStudentCounts.find((c) => c.examId === stat.examId);
      return {
        ...stat,
        totalStudents: count?.totalStudents || 0,
      };
    });

    return {
      totalStudents: distinctStudents.length,
      totalAttempts: overallStats[0]?.totalAttempts || 0,
      averagePercentage: overallStats[0]?.averagePercentage || 0,
      studentStats,
      examStats: examStatsWithCounts,
    };
  } catch (error: any) {
    console.error("Error getting class subject statistics:", error);
    throw error;
  }
};

/**
 * Get month-wise rankings for a student
 * Returns ranking data grouped by month with student's rank in each month
 * Uses ExamStudent collection to match the profile-details API ranking logic
 */
export const getMonthWiseRankings = async (
  studentId: string,
  classId: string,
  tenantId: string,
  subjectId?: string,
): Promise<
  Array<{
    year: number;
    month: number; // 0-11 (0 = January)
    monthName: string; // "Jan", "Feb", etc.
    studentRank: number | null;
    totalStudents: number;
    averagePercentage: number;
  }>
> => {
  try {
    const studentIdObj = new mongoose.Types.ObjectId(studentId);
    const classIdObj = new mongoose.Types.ObjectId(classId);
    const tenantIdObj = new mongoose.Types.ObjectId(tenantId);

    // Build match query - using same filters as profile-details API
    const matchQuery: any = {
      classId: classIdObj,
      tenantId: tenantIdObj,
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
      percentage: { $exists: true, $ne: null },
    };

    // Add subject filter if provided
    if (subjectId) {
      matchQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    // First, get all months where THIS student has completed exams
    // Use updatedAt field (when exam was graded/completed)
    const studentMatchQuery = {
      ...matchQuery,
      studentId: studentIdObj,
      updatedAt: { $exists: true, $ne: null },
    };

    const monthsWithExams = await ExamStudent.aggregate([
      {
        $match: studentMatchQuery,
      },
      {
        $project: {
          year: { $year: "$updatedAt" },
          month: { $month: "$updatedAt" }, // 1-12
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },
          //count: { $sum: 1 },
          // MongoDB requires at least one accumulator in $group
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // For each month, calculate rankings
    const rankings = await Promise.all(
      monthsWithExams.map(async (monthData) => {
        const year = monthData._id.year;
        const month = monthData._id.month; // 1-12

        // Get date range for this month
        // MongoDB $month returns 1-12, JavaScript Date months are 0-11
        const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

        const monthMatchQuery: any = {
          ...matchQuery,
          updatedAt: {
            $gte: monthStart,
            $lte: monthEnd,
          },
        };

        // Get all students' average percentages for this month
        // Use same logic as profile-details API
        const studentAverages = await ExamStudent.aggregate([
          {
            $match: monthMatchQuery,
          },
          // Join with exams to get totalMarks
          {
            $lookup: {
              from: "exams",
              localField: "examId",
              foreignField: "_id",
              as: "exam",
            },
          },
          {
            $unwind: "$exam",
          },
          {
            $group: {
              _id: "$studentId",
              totalObtainedMarks: {
                $sum: {
                  $divide: [
                    { $multiply: ["$percentage", "$exam.totalMarks"] },
                    100,
                  ],
                },
              },
              totalPossibleMarks: { $sum: "$exam.totalMarks" },
            },
          },
          {
            $addFields: {
              averagePercentage: {
                $cond: {
                  if: { $gt: ["$totalPossibleMarks", 0] },
                  then: {
                    $multiply: [
                      {
                        $divide: ["$totalObtainedMarks", "$totalPossibleMarks"],
                      },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
          {
            $lookup: {
              from: "students",
              localField: "_id",
              foreignField: "_id",
              as: "student",
            },
          },
          {
            $unwind: {
              path: "$student",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              "student.isDeleted": false,
              "student.isActive": true,
              "student.tenantId": tenantId,
            },
          },
          {
            $project: {
              studentId: { $toString: "$_id" },
              averagePercentage: { $round: ["$averagePercentage", 2] },
            },
          },
          {
            $sort: { averagePercentage: -1 },
          },
        ]);

        // Find student's rank
        const studentIndex = studentAverages.findIndex(
          (s) => s.studentId === studentId,
        );

        const studentRank = studentIndex >= 0 ? studentIndex + 1 : null;
        const studentData = studentAverages[studentIndex];
        const averagePercentage = studentData
          ? studentData.averagePercentage
          : 0;

        const monthNames = [
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

        return {
          year: year,
          month: month - 1, // Convert to 0-11
          monthName: monthNames[month - 1],
          studentRank: studentRank,
          totalStudents: studentAverages.length,
          averagePercentage: averagePercentage,
        };
      }),
    );

    return rankings;
  } catch (error: any) {
    console.error("Error getting month-wise rankings:", error);
    throw error;
  }
};

export { IExamAttempt } from "../models/examAttempt.schema";

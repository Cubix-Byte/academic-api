import * as parentChildRepository from "../repositories/parentChild.repository";
import * as studentRepository from "../repositories/student.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import ExamAttempt from "../models/examAttempt.schema";
import ExamCredential from "../models/examCredential.schema";
import mongoose from "mongoose";
import {
  GetChildReportRequest,
  ChildReportResponse,
  RankInfo,
  StrongestSubject,
  GetChildPerformanceDetailsRequest,
  ChildPerformanceDetailsResponse,
  SubjectTrend,
  SubjectPerformance,
  GetChildSemestersRequest,
  ChildSemestersResponse,
  SemesterInfo,
  GetChildSubjectDetailsRequest,
  ChildSubjectDetailsResponse,
  ExamResult,
  TeacherFeedbackItem,
  PerformanceDataPoint,
  ChildSubjectPerformanceScoreResponse,
  GetChildSubjectPerformanceScoreRequest,
} from "@/types";

const ObjectId = mongoose.Types.ObjectId;

// Date range interface for semester filtering
interface DateRange {
  start: Date;
  end: Date;
}

// Parse semester or date params to date range
function getSemesterDateRange(
  semester?: string,
  startDate?: string,
  endDate?: string
): DateRange | null {
  // If explicit start/end dates are provided, use them
  if (startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate),
    };
  }

  // Parse semester format like "fall_2024" or "spring_2025"
  if (semester) {
    const [season, yearStr] = semester.split("_");
    const year = parseInt(yearStr, 10);

    if (isNaN(year)) return null;

    if (season === "spring") {
      // Spring: Jan 1 - May 31
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 4, 31, 23, 59, 59, 999),
      };
    } else if (season === "fall") {
      // Fall: Aug 1 - Dec 31
      return {
        start: new Date(year, 7, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }
  }

  return null; // No filter, return all data
}

// Calculate percentile string from rank and total

function calculatePercentile(rank: number, total: number): string {
  if (total === 0 || rank === 0) return "N/A";
  const percentile = Math.round((rank / total) * 100);
  return `Top ${percentile}%`;
}

// Get comprehensive child report

export const getChildReport = async (
  params: GetChildReportRequest
): Promise<ChildReportResponse> => {
  const { parentId, childId, tenantId, semester, startDate, endDate } = params;

  // Verify parent-child relationship
  const relationship = await parentChildRepository.findParentChildRelationship(
    parentId,
    childId
  );

  if (!relationship) {
    throw new Error("Parent-child relationship not found or inactive");
  }

  // Get student details
  const student = await studentRepository.findStudentById(childId);
  if (!student) {
    throw new Error("Student not found");
  }

  const classId = student.classId?.toString() || "";
  const currentGrade = student.currentGrade || "";
  const className = (student as any).className || currentGrade || "";

  // Get date range for filtering
  const dateRange = getSemesterDateRange(semester, startDate, endDate);

  // Build query filter
  const baseFilter: any = {
    studentId: new ObjectId(childId),
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    baseFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  // Get all graded attempts for this child
  const childAttempts = await ExamAttempt.find(baseFilter).lean();

  // Calculate overall percentage
  let overallPercentage = 0;
  if (childAttempts.length > 0) {
    const totalPercentage = childAttempts.reduce(
      (sum, a) => sum + (a.percentage || 0),
      0
    );
    overallPercentage =
      Math.round((totalPercentage / childAttempts.length) * 100) / 100;
  }

  // Calculate class rank
  const classRanking = await calculateClassRank(childId, classId, tenantId, dateRange);

  // Calculate school rank (all students in the tenant/school)
  const schoolRanking = await calculateSchoolRank(childId, tenantId, dateRange);

  // Get achievements count
  const achievements = await getAchievementsCount(childId);

  // Get strongest subjects
  const strongestSubjects = await getStrongestSubjects(childId, tenantId, dateRange);

  return {
    childId,
    childName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
    className,
    overallPercentage,
    achievements,
    rankings: {
      classRanking,
      schoolRanking,
    },
    strongestSubjects,
  };
};

// Calculate class rank for a student

async function calculateClassRank(
  childId: string,
  classId: string,
  tenantId: string,
  dateRange?: DateRange | null
): Promise<RankInfo> {
  if (!classId || !ObjectId.isValid(classId)) {
    return { rank: 0, totalStudents: 0, percentile: "N/A" };
  }

  const matchFilter: any = {
    classId: new ObjectId(classId),
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    matchFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const studentScores = await ExamAttempt.aggregate([
    {
      $match: matchFilter,
    },
    {
      $group: {
        _id: "$studentId",
        avgScore: { $avg: "$percentage" },
      },
    },
    {
      $sort: { avgScore: -1 },
    },
  ]);

  const childIndex = studentScores.findIndex(
    (s) => s._id.toString() === childId
  );
  const rank = childIndex >= 0 ? childIndex + 1 : 0;
  const totalStudents = studentScores.length;

  return {
    rank,
    totalStudents,
    percentile: calculatePercentile(rank, totalStudents),
  };
}

// Calculate school rank (all students in the tenant/school)

async function calculateSchoolRank(
  childId: string,
  tenantId: string,
  dateRange?: DateRange | null
): Promise<RankInfo> {
  const matchFilter: any = {
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    matchFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  // Aggregate all graded attempts for all students in the tenant
  const studentScores = await ExamAttempt.aggregate([
    {
      $match: matchFilter,
    },
    {
      $group: {
        _id: "$studentId",
        avgScore: { $avg: "$percentage" },
      },
    },
    {
      $sort: { avgScore: -1 },
    },
  ]);

  if (studentScores.length === 0) {
    return { rank: 0, totalStudents: 0, percentile: "N/A" };
  }

  const childIndex = studentScores.findIndex(
    (s) => s._id.toString() === childId
  );
  const rank = childIndex >= 0 ? childIndex + 1 : 0;
  const totalStudents = studentScores.length;

  return {
    rank,
    totalStudents,
    percentile: calculatePercentile(rank, totalStudents),
  };
}

// Get total achievements count (badges + achievements)

async function getAchievementsCount(childId: string): Promise<number> {
  try {
    const badgesCount = await ExamCredential.countDocuments({
      studentId: new mongoose.Types.ObjectId(childId),
      isActive: true,
      isDeleted: false
    });
    return badgesCount;
  } catch (error) {
    console.error("Error counting badges via ExamCredential:", error);
    return 0;
  }
}

// Get strongest subjects (top 3 by average score)

async function getStrongestSubjects(
  childId: string,
  tenantId: string,
  dateRange?: DateRange | null
): Promise<StrongestSubject[]> {
  const matchFilter: any = {
    studentId: new ObjectId(childId),
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    matchFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const subjectPerformance = await ExamAttempt.aggregate([
    {
      $match: matchFilter,
    },
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
      $lookup: {
        from: "subjects",
        localField: "exam.subjectId",
        foreignField: "_id",
        as: "subject",
      },
    },
    {
      $unwind: { path: "$subject", preserveNullAndEmptyArrays: true },
    },
    {
      $group: {
        _id: {
          subjectId: "$exam.subjectId",
          subjectName: "$subject.name",
        },
        avgScore: { $avg: "$percentage" },
        latestScore: { $last: "$percentage" },
        previousScore: { $first: "$percentage" },
      },
    },
    {
      $sort: { avgScore: -1 },
    },
    {
      $limit: 3,
    },
  ]);

  const result: StrongestSubject[] = [];

  for (let i = 0; i < subjectPerformance.length; i++) {
    const item = subjectPerformance[i];
    const latestScore = item.latestScore || 0;
    const previousScore = item.previousScore || latestScore;
    const diff = latestScore - previousScore;

    let trend: "up" | "down" | "stable" = "stable";
    if (diff > 2) trend = "up";
    else if (diff < -2) trend = "down";

    result.push({
      rank: i + 1,
      subjectName: item._id.subjectName || "Unknown",
      subjectRank: `#${i + 1}`,
      trend,
    });
  }

  return result;
}

// Subject colors for graph
const SUBJECT_COLORS = [
  "#22c55e", // green
  "#f97316", // orange
  "#3b82f6", // blue
  "#eab308", // yellow
  "#6b7280", // gray
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#84cc16", // lime
];

// Academic year months (Sep - Mar)
const ACADEMIC_MONTHS = [
  { num: 9, name: "Sep" },
  { num: 10, name: "Oct" },
  { num: 11, name: "Nov" },
  { num: 12, name: "Dec" },
  { num: 1, name: "Jan" },
  { num: 2, name: "Feb" },
  { num: 3, name: "Mar" },
];

// Helper function to get letter grade using tenant's grading system
async function getLetterGradeFromSystem(score: number, tenantId: string): Promise<string> {
  try {
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(tenantId);
    if (gradingSystem && gradingSystem.gradeRanges) {
      const range = gradingSystem.gradeRanges.find(
        (r: any) => score >= r.minPercentage && score <= r.maxPercentage
      );
      if (range) return range.grade;
    }

    // Fallback to standard grading if no tenant system found
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  } catch (error) {
    console.error("Error fetching grading system:", error);
    // Fallback to standard grading
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }
}

// Get child performance details (trends + summary)
export const getChildPerformanceDetails = async (
  params: GetChildPerformanceDetailsRequest
): Promise<ChildPerformanceDetailsResponse> => {
  const { parentId, childId, tenantId, classId, year = new Date().getFullYear(), semester, startDate, endDate } = params;

  // Verify parent-child relationship
  const relationship = await parentChildRepository.findParentChildRelationship(
    parentId,
    childId
  );

  if (!relationship) {
    throw new Error("Parent-child relationship not found or inactive");
  }

  // Get student details
  const student = await studentRepository.findStudentById(childId);
  if (!student) {
    throw new Error("Student not found");
  }

  const studentClassId = classId || student.classId?.toString() || "";
  const className = (student as any).className || student.currentGrade || "";

  // Get date range for filtering
  const dateRange = getSemesterDateRange(semester, startDate, endDate);

  // Get performance trends (monthly scores by subject)
  const performanceTrends = await getPerformanceTrends(
    childId,
    tenantId,
    year,
    dateRange
  );

  // Get performance summary (all subjects with class rank)
  const performanceSummary = await getPerformanceSummary(
    childId,
    studentClassId,
    tenantId,
    dateRange
  );

  return {
    childId,
    childName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
    className,
    year,
    performanceTrends,
    performanceSummary,
  };
};

// Get monthly performance trends by subject
async function getPerformanceTrends(
  childId: string,
  tenantId: string,
  year: number,
  dateRange?: DateRange | null
): Promise<SubjectTrend[]> {
  const matchFilter: any = {
    studentId: new ObjectId(childId),
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    matchFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  // Get all graded exams for the student
  const monthlyData = await ExamAttempt.aggregate([
    {
      $match: matchFilter,
    },
    {
      $lookup: {
        from: "subjects",
        localField: "subjectId",
        foreignField: "_id",
        as: "subject",
      },
    },
    {
      $unwind: { path: "$subject", preserveNullAndEmptyArrays: true },
    },
    {
      $group: {
        _id: {
          subjectId: "$subjectId",
          month: { $month: "$createdAt" },
        },
        subjectName: { $first: "$subject.name" },
        totalObtainedMarks: { $sum: "$obtainedMarks" },
        totalPossibleMarks: { $sum: "$totalMarks" },
      },
    },
    {
      $addFields: {
        avgScore: {
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
      $sort: { "_id.subjectId": 1, "_id.month": 1 },
    },
  ]);

  // Group by subject
  const subjectMap = new Map<
    string,
    { subjectName: string; monthScores: Map<number, number> }
  >();

  for (const item of monthlyData) {
    const subjectId = item._id.subjectId?.toString() || "unknown";
    const month = item._id.month;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subjectName: item.subjectName || "Unknown",
        monthScores: new Map(),
      });
    }

    subjectMap.get(subjectId)!.monthScores.set(month, Math.round(item.avgScore));
  }

  // Convert to response format
  const result: SubjectTrend[] = [];
  let colorIndex = 0;

  for (const [subjectId, data] of subjectMap) {
    const monthlyScores = ACADEMIC_MONTHS.map((m) => ({
      month: m.name,
      score: data.monthScores.get(m.num) ?? null,
    }));

    result.push({
      subjectId,
      subjectName: data.subjectName,
      color: SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length],
      monthlyScores,
    });

    colorIndex++;
  }

  return result;
}

// Get performance summary with class rank per subject
async function getPerformanceSummary(
  childId: string,
  classId: string,
  tenantId: string,
  dateRange?: DateRange | null
): Promise<SubjectPerformance[]> {
  const matchFilter: any = {
    studentId: new ObjectId(childId),
    tenantId: new ObjectId(tenantId),
    attemptStatus: "Graded",
    isDeleted: false,
  };

  // Add date filter if provided
  if (dateRange) {
    matchFilter.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  // Get child's average per subject with latest feedback
  const childSubjectScores = await ExamAttempt.aggregate([
    {
      $match: matchFilter,
    },
    {
      $sort: { createdAt: -1 }, // Sort to get latest first for feedback
    },
    {
      $lookup: {
        from: "subjects",
        localField: "subjectId",
        foreignField: "_id",
        as: "subject",
      },
    },
    {
      $unwind: { path: "$subject", preserveNullAndEmptyArrays: true },
    },
    {
      $group: {
        _id: { $toLower: "$subject.name" }, // Group by subject name (case-insensitive)
        subjectId: { $first: "$subjectId" }, // Take the most recent subjectId
        subjectName: { $first: "$subject.name" },
        totalObtainedMarks: { $sum: "$obtainedMarks" },
        totalPossibleMarks: { $sum: "$totalMarks" },
        latestFeedback: { $first: "$teacherFeedback" },
        latestFeedbackDate: { $first: "$createdAt" },
      },
    },
    {
      $addFields: {
        avgScore: {
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
      $sort: { subjectName: 1 },
    },
  ]);

  if (childSubjectScores.length === 0) {
    return [];
  }

  // Get teacher assignments for this class (single query for all subjects)
  const subjectIds = childSubjectScores.map((s) => s.subjectId).filter(Boolean);
  let teacherMap = new Map<string, { teacherId: string; teacherName: string }>();

  if (classId && ObjectId.isValid(classId) && subjectIds.length > 0) {
    try {
      const TeacherAssignClasses = (
        await import("../models/teacherAssignClasses.schema")
      ).default;

      const teacherAssignments = await TeacherAssignClasses.find({
        classId: new ObjectId(classId),
        subjectId: { $in: subjectIds.map((id) => new ObjectId(id)) },
        status: "active",
        isDeleted: false,
      })
        .populate("teacherId", "firstName lastName")
        .lean();

      for (const ta of teacherAssignments) {
        const teacher = ta.teacherId as any;
        if (teacher && ta.subjectId) {
          teacherMap.set(ta.subjectId.toString(), {
            teacherId: teacher._id?.toString() || "",
            teacherName: `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim(),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching teacher assignments:", error);
    }
  }

  // For each subject, calculate class rank and class average
  const result: SubjectPerformance[] = [];

  for (const subjectData of childSubjectScores) {
    const subjectId = subjectData.subjectId?.toString() || "";
    const childScore = Math.round(subjectData.avgScore * 100) / 100;

    // Get class rankings for this subject
    let classRank = "N/A";
    let totalStudents = 0;

    if (classId && ObjectId.isValid(classId)) {
      // Build class ranking filter
      const classMatchFilter: any = {
        classId: new ObjectId(classId),
        subjectId: new ObjectId(subjectId),
        tenantId: new ObjectId(tenantId),
        attemptStatus: "Graded",
        isDeleted: false,
      };

      // Add date filter if provided
      if (dateRange) {
        classMatchFilter.createdAt = {
          $gte: dateRange.start,
          $lte: dateRange.end,
        };
      }

      // Get all students' scores in this class for this subject
      const classScores = await ExamAttempt.aggregate([
        {
          $match: classMatchFilter,
        },
        {
          $group: {
            _id: "$studentId",
            totalObtainedMarks: { $sum: "$obtainedMarks" },
            totalPossibleMarks: { $sum: "$totalMarks" },
          },
        },
        {
          $addFields: {
            avgScore: {
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
          $sort: { avgScore: -1 },
        },
      ]);

      totalStudents = classScores.length;

      // Find child's rank
      const childIndex = classScores.findIndex(
        (s) => s._id.toString() === childId
      );
      const rank = childIndex >= 0 ? childIndex + 1 : 0;

      if (rank > 0) {
        classRank = `#${rank}/${totalStudents}`;
      }
    }

    // Get teacher for this subject
    const teacher = teacherMap.get(subjectId) || null;

    // Get letter grade using tenant's grading system
    const letterGrade = await getLetterGradeFromSystem(childScore, tenantId);

    result.push({
      subjectId,
      subjectName: subjectData.subjectName || "Unknown",
      letterGrade,
      score: childScore,
      classRank,
      teacher,
      feedback: subjectData.latestFeedback || null,
      feedbackDate: subjectData.latestFeedbackDate || null,
    });
  }

  return result;
}

// Check if date is within a semester range
function isCurrentSemester(startDate: Date, endDate: Date): boolean {
  const now = new Date();
  return now >= startDate && now <= endDate;
}

// Generate semesters from admission date to current date
function generateSemesters(admissionDate: Date): SemesterInfo[] {
  const semesters: SemesterInfo[] = [];
  const now = new Date();
  let currentYear = admissionDate.getFullYear();

  while (currentYear <= now.getFullYear()) {
    // Spring: Jan 1 - May 31
    const springStart = new Date(currentYear, 0, 1);
    const springEnd = new Date(currentYear, 4, 31);

    if (springStart >= admissionDate || (admissionDate <= springEnd && admissionDate.getFullYear() === currentYear)) {
      if (springStart <= now) {
        semesters.push({
          value: `spring_${currentYear}`,
          label: `Spring ${currentYear}`,
          startDate: springStart.toISOString().split("T")[0],
          endDate: springEnd.toISOString().split("T")[0],
          isCurrent: isCurrentSemester(springStart, springEnd),
        });
      }
    }

    // Fall: Aug 1 - Dec 31
    const fallStart = new Date(currentYear, 7, 1);
    const fallEnd = new Date(currentYear, 11, 31);

    if (fallStart >= admissionDate || (admissionDate <= fallEnd && admissionDate.getFullYear() === currentYear)) {
      if (fallStart <= now) {
        semesters.push({
          value: `fall_${currentYear}`,
          label: `Fall ${currentYear}`,
          startDate: fallStart.toISOString().split("T")[0],
          endDate: fallEnd.toISOString().split("T")[0],
          isCurrent: isCurrentSemester(fallStart, fallEnd),
        });
      }
    }

    currentYear++;
  }

  return semesters.reverse(); // Most recent first
}

// Get available semesters for a child
export const getChildSemesters = async (
  params: GetChildSemestersRequest
): Promise<ChildSemestersResponse> => {
  const { parentId, childId } = params;

  // Verify parent-child relationship
  const relationship = await parentChildRepository.findParentChildRelationship(
    parentId,
    childId
  );

  if (!relationship) {
    throw new Error("Parent-child relationship not found or inactive");
  }

  // Get student details
  const student = await studentRepository.findStudentById(childId);
  if (!student) {
    throw new Error("Student not found");
  }

  // Get admission date (fallback to createdAt if not available)
  const admissionDate = student.admissionDate
    ? new Date(student.admissionDate)
    : new Date(student.createdAt || Date.now());

  // Generate semesters
  const semesters = generateSemesters(admissionDate);

  return {
    childId,
    childName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
    admissionDate: admissionDate.toISOString().split("T")[0],
    semesters,
  };
};

// Get detailed subject performance for a child
export const getChildSubjectDetails = async (
  params: GetChildSubjectDetailsRequest
): Promise<ChildSubjectDetailsResponse> => {
  const { parentId, childId, subjectId, tenantId } = params;

  // Verify parent-child relationship
  const relationship = await parentChildRepository.findParentChildRelationship(
    parentId,
    childId
  );

  if (!relationship) {
    throw new Error("Parent-child relationship not found or inactive");
  }

  // Import models
  const { Class } = await import("../models/class.schema");
  const Subject = (await import("../models/subject.schema")).default;

  // Get student first to get classId
  const student = await studentRepository.findStudentById(childId);
  if (!student) {
    throw new Error("Student not found");
  }

  // Use provided classId or get from student data
  const classId = params.classId || student.classId?.toString();
  if (!classId) {
    throw new Error("Student is not assigned to any class");
  }

  // Parallel fetch: subject, class info
  const [subject, classData] = await Promise.all([
    Subject.findOne({ _id: new ObjectId(subjectId), isDeleted: false }).lean(),
    Class.findOne({ _id: new ObjectId(classId), isDeleted: false }).lean(),
  ]);

  if (!subject) {
    throw new Error("Subject not found");
  }

  const childName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  const className = (classData as any)?.name || "Unknown";
  const gradeLevel = (classData as any)?.grade?.toString() || "";

  // Get all exam attempts for this student + subject (graded only)
  const examAttempts = await ExamAttempt.aggregate([
    {
      $match: {
        studentId: new ObjectId(childId),
        subjectId: new ObjectId(subjectId),
        tenantId: new ObjectId(tenantId),
        attemptStatus: "Graded",
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: "exams",
        localField: "examId",
        foreignField: "_id",
        as: "exam",
      },
    },
    {
      $unwind: { path: "$exam", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "exam_modes",
        localField: "exam.examModeId",
        foreignField: "_id",
        as: "examMode",
      },
    },
    {
      $unwind: { path: "$examMode", preserveNullAndEmptyArrays: true },
    },
    {
      $sort: { createdAt: -1 },
    },
  ]);

  // Get class average for this subject (all students in class)
  const classSubjectStats = await ExamAttempt.aggregate([
    {
      $match: {
        classId: new ObjectId(classId),
        subjectId: new ObjectId(subjectId),
        tenantId: new ObjectId(tenantId),
        attemptStatus: "Graded",
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$studentId",
        avgScore: { $avg: "$percentage" },
      },
    },
    {
      $sort: { avgScore: -1 },
    },
  ]);

  const classAverage =
    classSubjectStats.length > 0
      ? classSubjectStats.reduce((sum, s) => sum + (s.totalObtainedMarks || 0), 0) /
      classSubjectStats.reduce((sum, s) => sum + (s.totalPossibleMarks || 1), 0) * 100
      : 0;

  // Find student's rank
  const studentRankIndex = classSubjectStats.findIndex(
    (s) => s._id.toString() === childId
  );
  const classRank = studentRankIndex >= 0 ? studentRankIndex + 1 : 0;
  const totalStudents = classSubjectStats.length;

  // Calculate latest stats for summary
  const latestPercentage = examAttempts[0]?.percentage || 0;

  // Get letter grade using tenant's grading system
  const currentGrade =
    examAttempts.length > 0
      ? await getLetterGradeFromSystem(latestPercentage, tenantId)
      : "--";

  // Build summary
  const summary = {
    currentGrade,
    currentScore: Math.round(latestPercentage * 100) / 100,
    classAverage: Math.round(classAverage * 100) / 100,
    classRank,
    totalStudents,
    assessmentsCount: examAttempts.length,
  };

  // Build exam results
  const examResults: ExamResult[] = await buildExamResults(
    examAttempts,
    classId,
    subjectId,
    tenantId
  );

  // Get teacher feedback from exam attempts
  const teacherFeedback: TeacherFeedbackItem[] = await getSubjectTeacherFeedback(
    examAttempts,
    classId,
    subjectId
  );

  return {
    subjectId,
    subjectName: (subject as any).name || "Unknown",
    childId,
    childName,
    className,
    gradeLevel,
    summary,
    examResults,
    teacherFeedback,
  };
};

// Get performance score over time for a subject
export const getChildSubjectPerformanceScore = async (
  params: GetChildSubjectPerformanceScoreRequest
): Promise<ChildSubjectPerformanceScoreResponse> => {
  const { parentId, childId, subjectId, tenantId, months = 6 } = params;

  // Verify parent-child relationship
  const relationship = await parentChildRepository.findParentChildRelationship(
    parentId,
    childId
  );

  if (!relationship) {
    throw new Error("Parent-child relationship not found or inactive");
  }

  // Get student first to get classId
  const student = await studentRepository.findStudentById(childId);
  if (!student) {
    throw new Error("Student not found");
  }

  // Use provided classId or get from student data
  const classId = params.classId || student.classId?.toString();
  if (!classId) {
    throw new Error("Student is not assigned to any class");
  }

  // Build performance over time (monthly)
  const performanceOverTime = await getSubjectPerformanceOverTime(
    childId,
    subjectId,
    classId,
    tenantId,
    months
  );

  return {
    performanceOverTime,
  };
};

// Helper: Get monthly performance for a subject
async function getSubjectPerformanceOverTime(
  childId: string,
  subjectId: string,
  classId: string,
  tenantId: string,
  months: number
): Promise<PerformanceDataPoint[]> {
  const result: PerformanceDataPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

    const monthName = monthDate.toLocaleString("en-US", { month: "short" });

    // Get student's average for this month
    const studentMonthly = await ExamAttempt.aggregate([
      {
        $match: {
          studentId: new ObjectId(childId),
          subjectId: new ObjectId(subjectId),
          tenantId: new ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
          createdAt: { $gte: monthStart, $lte: monthEnd },
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
        $addFields: {
          avgScore: {
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

    // Get class average for this month
    const classMonthly = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new ObjectId(classId),
          subjectId: new ObjectId(subjectId),
          tenantId: new ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
          createdAt: { $gte: monthStart, $lte: monthEnd },
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
        $addFields: {
          avgScore: {
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

    result.push({
      month: monthName,
      studentScore: studentMonthly[0]?.avgScore
        ? Math.round(studentMonthly[0].avgScore * 100) / 100
        : null,
      classAverage: classMonthly[0]?.avgScore
        ? Math.round(classMonthly[0].avgScore * 100) / 100
        : null,
    });
  }

  return result;
}

// Helper: Build exam results with class average and rank
async function buildExamResults(
  examAttempts: any[],
  classId: string,
  subjectId: string,
  tenantId: string
): Promise<ExamResult[]> {
  const results: ExamResult[] = [];

  for (const attempt of examAttempts) {
    const examId = attempt.examId?.toString() || "";

    // Get class stats for this specific exam
    const examClassStats = await ExamAttempt.aggregate([
      {
        $match: {
          examId: new ObjectId(examId),
          classId: new ObjectId(classId),
          subjectId: new ObjectId(subjectId),
          tenantId: new ObjectId(tenantId),
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
          scores: { $push: { studentId: "$studentId", score: "$obtainedMarks", totalMarks: "$totalMarks" } },
        },
      },
      {
        $addFields: {
          avgScore: {
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

    const examClassAvg = examClassStats[0]?.avgScore || 0;
    const examScoresRaw = examClassStats[0]?.scores || [];

    // Calculate percentage for ranking
    const examScores = examScoresRaw.map((s: any) => ({
      studentId: s.studentId,
      score: (s.score / (s.totalMarks || 1)) * 100
    }));

    // Sort to find rank
    examScores.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    const rankIndex = examScores.findIndex(
      (s: any) => s.studentId?.toString() === attempt.studentId?.toString()
    );
    const rank = rankIndex >= 0 ? `#${rankIndex + 1}/${examScores.length}` : "N/A";

    results.push({
      examId,
      attemptId: attempt._id?.toString() || "",
      examType: attempt.exam?.examType || "Unknown",
      examMode: attempt.examMode?.name || "Unknown",
      grade: attempt.grade || null,
      examDate: attempt.createdAt
        ? new Date(attempt.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        : "",
      examTitle: attempt.exam?.examTitle || "Unknown Exam",
      classAverage: Math.round(examClassAvg * 100) / 100,
      rank,
      feedback: attempt.teacherFeedback || null,
      score: attempt.obtainedMarks || 0,
      maxScore: attempt.totalMarks || 100,
      topics: attempt.exam?.topicBreakdown?.map((t: any) => t.topic) || [],
    });
  }

  return results;
}

// Helper: Get teacher feedback from exam attempts
async function getSubjectTeacherFeedback(
  examAttempts: any[],
  classId: string,
  subjectId: string
): Promise<TeacherFeedbackItem[]> {
  const feedbackItems: TeacherFeedbackItem[] = [];

  // Get teacher for this subject in this class
  let teacherName = "Teacher";
  let teacherId = "";

  try {
    const TeacherAssignClasses = (
      await import("../models/teacherAssignClasses.schema")
    ).default;

    const assignment = await TeacherAssignClasses.findOne({
      classId: new ObjectId(classId),
      subjectId: new ObjectId(subjectId),
      status: "active",
      isDeleted: false,
    })
      .populate("teacherId", "firstName lastName")
      .lean();

    if (assignment?.teacherId) {
      const teacher = assignment.teacherId as any;
      teacherId = teacher._id?.toString() || "";
      teacherName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "Teacher";
    }
  } catch (error) {
    console.error("Error fetching teacher:", error);
  }

  // Extract feedback from exam attempts
  for (const attempt of examAttempts) {
    if (attempt.teacherFeedback || attempt.aiFeedback || attempt.overallFeedback) {
      // Determine feedback type based on exam type
      let feedbackType = "Exam Feedback";
      const examType = attempt.exam?.examType?.toLowerCase() || "";

      if (examType.includes("final")) {
        feedbackType = "Progress Report";
      } else if (examType.includes("project")) {
        feedbackType = "Recommendation";
      }

      feedbackItems.push({
        feedbackId: attempt._id?.toString() || "",
        teacherId,
        teacherName,
        feedbackType,
        date: attempt.createdAt
          ? new Date(attempt.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
          : "",
        teacherFeedback: attempt.teacherFeedback || attempt.overallFeedback || "",
        aiFeedback: attempt.aiFeedback || "",
      });
    }
  }

  return feedbackItems;
}

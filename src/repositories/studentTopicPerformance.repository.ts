import mongoose from "mongoose";
import {
  StudentTopicPerformance,
  IStudentTopicPerformance,
} from "../models/studentTopicPerformance.schema";

/**
 * StudentTopicPerformance Repository - Data access layer for student topic performance tracking
 */

// Helper function to safely convert to string
const toIdString = (
  id: string | mongoose.Types.ObjectId | any,
  fieldName: string
): string => {
  if (typeof id === "string") {
    return id;
  }

  if (id instanceof mongoose.Types.ObjectId) {
    return id.toString();
  }

  // Check if it's an ObjectId-like object (has toString method)
  if (id && typeof id.toString === "function") {
    const str = id.toString();

    // If toString returns a valid ObjectId format, use it
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      return str;
    }

    // If toString returns [object Object], try to access _id or id property
    if (str === "[object Object]") {
      if (id._id) {
        return toIdString(id._id, `${fieldName}._id`);
      }
      if (id.id) {
        return toIdString(id.id, `${fieldName}.id`);
      }
    }
  }

  // Last resort: try to get the string representation
  if (id && id._id) {
    return toIdString(id._id, `${fieldName}._id`);
  }

  throw new Error(`Cannot convert ${fieldName} to string: ${JSON.stringify(id)}`);
};

// Upsert student topic performance (update if exists, create if not)
export const upsertStudentTopicPerformance = async (
  data: {
    studentId: string | mongoose.Types.ObjectId;
    classId: string | mongoose.Types.ObjectId;
    subjectId: string | mongoose.Types.ObjectId;
    examId: string | mongoose.Types.ObjectId;
    tenantId: string | mongoose.Types.ObjectId;
    topicName: string;
    weightageInExam: number;
    totalMarks: number;
    marksObtained: number;
    marksPossible: number;
    performance: number;
  }
): Promise<IStudentTopicPerformance> => {
  try {
    // Validate and convert IDs to ObjectId
    if (!data.studentId || !data.classId || !data.subjectId || !data.examId || !data.tenantId) {
      throw new Error(
        "Missing required IDs: studentId, classId, subjectId, examId, or tenantId"
      );
    }

    // Convert to string first
    const studentIdStr = toIdString(data.studentId, "studentId");
    const classIdStr = toIdString(data.classId, "classId");
    const subjectIdStr = toIdString(data.subjectId, "subjectId");
    const examIdStr = toIdString(data.examId, "examId");
    const tenantIdStr = toIdString(data.tenantId, "tenantId");

    if (!studentIdStr || !classIdStr || !subjectIdStr || !examIdStr || !tenantIdStr) {
      throw new Error(
        `Invalid IDs provided: studentId=${studentIdStr}, classId=${classIdStr}, subjectId=${subjectIdStr}, examId=${examIdStr}, tenantId=${tenantIdStr}`
      );
    }

    // Validate ObjectId format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (
      !objectIdRegex.test(studentIdStr) ||
      !objectIdRegex.test(classIdStr) ||
      !objectIdRegex.test(subjectIdStr) ||
      !objectIdRegex.test(examIdStr) ||
      !objectIdRegex.test(tenantIdStr)
    ) {
      throw new Error(
        `Invalid ObjectId format: studentId=${studentIdStr}, classId=${classIdStr}, subjectId=${subjectIdStr}, examId=${examIdStr}, tenantId=${tenantIdStr}`
      );
    }

    const studentIdObj = new mongoose.Types.ObjectId(studentIdStr);
    const classIdObj = new mongoose.Types.ObjectId(classIdStr);
    const subjectIdObj = new mongoose.Types.ObjectId(subjectIdStr);
    const examIdObj = new mongoose.Types.ObjectId(examIdStr);
    const tenantIdObj = new mongoose.Types.ObjectId(tenantIdStr);

    // Find existing record with case-insensitive topic name matching
    const existing = await findStudentTopicPerformanceByTopicName(
      studentIdStr,
      classIdStr,
      subjectIdStr,
      examIdStr,
      data.topicName
    );

    // Prepare update data - use new values (student performance is per attempt, so update not sum)
    const updateData: any = {
      studentId: studentIdObj,
      classId: classIdObj,
      subjectId: subjectIdObj,
      examId: examIdObj,
      tenantId: tenantIdObj,
      topicName: data.topicName, // Use the provided topic name (preserve original casing)
      weightageInExam: data.weightageInExam,
      totalMarks: data.totalMarks,
      marksObtained: data.marksObtained,
      marksPossible: data.marksPossible,
      performance: data.performance,
      lastUpdated: new Date(),
    };

    if (existing) {
      console.log(`[upsertStudentTopicPerformance] Updating existing topic "${existing.topicName}" for student ${studentIdStr}`);
    } else {
      console.log(`[upsertStudentTopicPerformance] Creating new topic "${data.topicName}" for student ${studentIdStr}`);
    }

    // Use the existing _id if found, otherwise create new
    const query = existing
      ? { _id: existing._id }
      : {
          studentId: studentIdObj,
          classId: classIdObj,
          subjectId: subjectIdObj,
          examId: examIdObj,
          topicName: { $regex: new RegExp(`^${data.topicName}$`, "i") },
        };

    return await StudentTopicPerformance.findOneAndUpdate(
      query,
      updateData,
      {
        upsert: true,
        new: true,
      }
    );
  } catch (error: any) {
    console.error("Error upserting student topic performance:", error);
    throw error;
  }
};

// Find student topic performance by exam
export const findStudentTopicPerformanceByExam = async (
  studentId: string,
  classId: string,
  subjectId: string,
  examId: string
): Promise<IStudentTopicPerformance[]> => {
  try {
    return await StudentTopicPerformance.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      examId: new mongoose.Types.ObjectId(examId),
    }).sort({ topicName: 1 });
  } catch (error: any) {
    console.error("Error finding student topic performance by exam:", error);
    throw error;
  }
};

// Find student topic performance by topic name (case-insensitive)
export const findStudentTopicPerformanceByTopicName = async (
  studentId: string,
  classId: string,
  subjectId: string,
  examId: string,
  topicName: string
): Promise<IStudentTopicPerformance | null> => {
  try {
    const studentIdObj = new mongoose.Types.ObjectId(studentId);
    const classIdObj = new mongoose.Types.ObjectId(classId);
    const subjectIdObj = new mongoose.Types.ObjectId(subjectId);
    const examIdObj = new mongoose.Types.ObjectId(examId);
    
    // Find with case-insensitive topic name matching
    const result = await StudentTopicPerformance.findOne({
      studentId: studentIdObj,
      classId: classIdObj,
      subjectId: subjectIdObj,
      examId: examIdObj,
      topicName: { $regex: new RegExp(`^${topicName}$`, "i") },
    });
    
    return result;
  } catch (error: any) {
    console.error("Error finding student topic performance by topic name:", error);
    throw error;
  }
};

// Find student topic performance by class and subject (across all exams)
export const findStudentTopicPerformanceByClassAndSubject = async (
  studentId: string,
  classId: string,
  subjectId: string,
  tenantId: string
): Promise<IStudentTopicPerformance[]> => {
  try {
    return await StudentTopicPerformance.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).sort({ topicName: 1, examId: 1 });
  } catch (error: any) {
    console.error(
      "Error finding student topic performance by class and subject:",
      error
    );
    throw error;
  }
};

// Aggregate student topic statistics
// ...existing code...

// Aggregate student topic statistics
export const aggregateStudentTopicStatistics = async (
  studentId: string,
  classId: string,
  subjectId: string,
  tenantId: string,
  examType?: string // Add examType parameter
): Promise<
  Array<{
    topicName: string;
    totalExams: number;
    averagePerformance: number;
    totalMarksObtained: number;
    totalMarksPossible: number;
    exams: Array<{
      examId: string;
      examTitle: string;
      examType: string; // Add examType to response
      weightageInExam: number;
      performance: number;
      marksObtained: number;
      marksPossible: number;
    }>;
  }>
> => {
  try {
    // First, get all student topic performance records for this student/class/subject
    const topicPerformances = await StudentTopicPerformance.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).populate("examId", "examTitle examType"); // Add examType to populate

    console.log(`[aggregateStudentTopicStatistics] Found ${topicPerformances.length} topic performances`);

    // Group by topic name
    const topicMap = new Map<
      string,
      {
        topicName: string;
        exams: Array<{
          examId: string;
          examTitle: string;
          examType: string;
          weightageInExam: number;
          performance: number;
          marksObtained: number;
          marksPossible: number;
        }>;
        totalMarksObtained: number;
        totalMarksPossible: number;
        totalPerformance: number;
        totalWeightage: number;
        examCount: number;
      }
    >();

    for (const tp of topicPerformances) {
      const topicName = tp.topicName;
      const exam = tp.examId as any;

      // Log exam details for debugging
      console.log(`[aggregateStudentTopicStatistics] Processing exam:`, {
        examId: exam?._id,
        examTitle: exam?.examTitle,
        examType: exam?.examType,
        filterExamType: examType,
      });

      // Filter by examType if provided
      if (examType && exam?.examType !== examType) {
        console.log(`[aggregateStudentTopicStatistics] Skipping exam because examType doesn't match: ${exam?.examType} !== ${examType}`);
        continue; // Skip this exam if it doesn't match the filter
      }

      if (!topicMap.has(topicName)) {
        topicMap.set(topicName, {
          topicName,
          exams: [],
          totalMarksObtained: 0,
          totalMarksPossible: 0,
          totalPerformance: 0,
          totalWeightage: 0,
          examCount: 0,
        });
      }

      const topicData = topicMap.get(topicName)!;

      // Get examId as string - handle both populated and non-populated cases
      let examIdStr: string;
      if (typeof tp.examId === "string") {
        examIdStr = tp.examId;
      } else if (tp.examId instanceof mongoose.Types.ObjectId) {
        examIdStr = tp.examId.toString();
      } else if (exam && exam._id) {
        examIdStr = exam._id.toString ? exam._id.toString() : String(exam._id);
      } else if (exam && exam.id) {
        examIdStr = typeof exam.id === "string" ? exam.id : exam.id.toString();
      } else {
        const doc = tp as any;
        examIdStr =
          doc._doc?.examId?.toString() ||
          doc.examId?.toString() ||
          String(tp.examId);
      }

      topicData.exams.push({
        examId: examIdStr,
        examTitle: exam?.examTitle || "Unknown Exam",
        examType: exam?.examType || "Official", // Include examType in response
        weightageInExam: tp.weightageInExam,
        performance: tp.performance,
        marksObtained: tp.marksObtained,
        marksPossible: tp.marksPossible,
      });
      topicData.totalMarksObtained += tp.marksObtained;
      topicData.totalMarksPossible += tp.marksPossible;
      topicData.totalPerformance += tp.performance * tp.weightageInExam;
      topicData.totalWeightage += tp.weightageInExam;
      topicData.examCount += 1;
    }

    // Calculate aggregated statistics
    const result: Array<{
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

    for (const [topicName, data] of topicMap.entries()) {
      const averagePerformance =
        data.totalWeightage > 0
          ? data.totalPerformance / data.totalWeightage
          : 0;

      result.push({
        topicName: data.topicName,
        totalExams: data.examCount,
        averagePerformance: Math.round(averagePerformance * 100) / 100,
        totalMarksObtained: data.totalMarksObtained,
        totalMarksPossible: data.totalMarksPossible,
        exams: data.exams,
      });
    }

    console.log(`[aggregateStudentTopicStatistics] Returning ${result.length} topics with examType: ${examType || 'all'}`);
    return result.sort((a, b) => a.topicName.localeCompare(b.topicName));
  } catch (error: any) {
    console.error("Error aggregating student topic statistics:", error);
    throw error;
  }
};

// ...existing code...

// Delete student topic performance by exam (useful when exam is deleted)
export const deleteStudentTopicPerformanceByExam = async (
  examId: string
): Promise<void> => {
  try {
    await StudentTopicPerformance.deleteMany({
      examId: new mongoose.Types.ObjectId(examId),
    });
  } catch (error: any) {
    console.error(
      "Error deleting student topic performance by exam:",
      error
    );
    throw error;
  }
};


import mongoose from "mongoose";
import {
  ClassTopicPerformance,
  IClassTopicPerformance,
} from "../models/classTopicPerformance.schema";
import * as examRepository from "./exam.repository";

/**
 * ClassTopicPerformance Repository - Data access layer for topic performance aggregation
 */

// Upsert topic performance (update if exists, create if not)
export const upsertTopicPerformance = async (data: {
  classId: string | mongoose.Types.ObjectId;
  subjectId: string | mongoose.Types.ObjectId;
  examId: string | mongoose.Types.ObjectId;
  tenantId: string | mongoose.Types.ObjectId;
  topicName: string;
  weightageInExam: number;
  totalMarks: number;
  totalStudents: number;
  averagePerformance: number;
  totalMarksObtained: number;
  totalMarksPossible: number;
}): Promise<IClassTopicPerformance> => {
  try {
    // Validate and convert IDs to ObjectId
    if (!data.classId || !data.subjectId || !data.examId || !data.tenantId) {
      throw new Error(
        "Missing required IDs: classId, subjectId, examId, or tenantId"
      );
    }

    // Helper function to safely convert to string
    const toIdString = (
      id: string | mongoose.Types.ObjectId | any,
      fieldName: string
    ): string => {
      console.log(`[toIdString] Converting ${fieldName}:`, {
        type: typeof id,
        isString: typeof id === "string",
        isObjectId: id instanceof mongoose.Types.ObjectId,
        hasToString: id && typeof id.toString === "function",
        value: id,
        stringValue: String(id),
      });

      if (typeof id === "string") {
        console.log(`[toIdString] ${fieldName} is already a string:`, id);
        return id;
      }

      if (id instanceof mongoose.Types.ObjectId) {
        const str = id.toString();
        console.log(
          `[toIdString] ${fieldName} is ObjectId, converted to:`,
          str
        );
        return str;
      }

      // Check if it's an ObjectId-like object (has toString method)
      if (id && typeof id.toString === "function") {
        const str = id.toString();
        console.log(`[toIdString] ${fieldName} has toString(), result:`, str);

        // If toString returns a valid ObjectId format, use it
        if (/^[0-9a-fA-F]{24}$/.test(str)) {
          console.log(
            `[toIdString] ${fieldName} toString() returned valid ObjectId format`
          );
          return str;
        }

        // If toString returns [object Object], try to access _id or id property
        if (str === "[object Object]") {
          console.log(
            `[toIdString] ${fieldName} toString() returned [object Object], checking for _id or id property`
          );
          if (id._id) {
            console.log(`[toIdString] ${fieldName} has _id property:`, id._id);
            return toIdString(id._id, `${fieldName}._id`);
          }
          if (id.id) {
            console.log(`[toIdString] ${fieldName} has id property:`, id.id);
            return toIdString(id.id, `${fieldName}.id`);
          }
          // Try to stringify and extract
          try {
            const json = JSON.stringify(id);
            console.log(`[toIdString] ${fieldName} JSON stringified:`, json);
            // If it's a simple object with a value, try to extract it
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === "object") {
              // Try common ObjectId field names
              if (parsed.$oid) return parsed.$oid;
              if (parsed.oid) return parsed.oid;
              if (parsed._id) return toIdString(parsed._id, `${fieldName}._id`);
              if (parsed.id) return toIdString(parsed.id, `${fieldName}.id`);
            }
          } catch (e) {
            console.log(
              `[toIdString] Failed to JSON stringify ${fieldName}:`,
              e
            );
          }
        }
      }

      // Last resort: try to get the string representation
      if (id && id._id) {
        console.log(`[toIdString] ${fieldName} has _id property, recursing`);
        return toIdString(id._id, `${fieldName}._id`);
      }

      console.error(`[toIdString] Cannot convert ${fieldName} to string:`, {
        type: typeof id,
        value: id,
        stringValue: String(id),
        keys: id && typeof id === "object" ? Object.keys(id) : "N/A",
      });
      throw new Error(
        `Cannot convert ${fieldName} to string: ${JSON.stringify(id)}`
      );
    };

    console.log("[upsertTopicPerformance] Received data:", {
      classId: data.classId,
      subjectId: data.subjectId,
      examId: data.examId,
      tenantId: data.tenantId,
      classIdType: typeof data.classId,
      subjectIdType: typeof data.subjectId,
    });

    // Convert to string first, handling both string and ObjectId instances
    const classIdStr = toIdString(data.classId, "classId");
    const subjectIdStr = toIdString(data.subjectId, "subjectId");
    const examIdStr = toIdString(data.examId, "examId");
    const tenantIdStr = toIdString(data.tenantId, "tenantId");

    console.log("[upsertTopicPerformance] Converted IDs:", {
      classIdStr,
      subjectIdStr,
      examIdStr,
      tenantIdStr,
    });

    if (!classIdStr || !subjectIdStr || !examIdStr || !tenantIdStr) {
      throw new Error(
        `Invalid IDs provided: classId=${classIdStr}, subjectId=${subjectIdStr}, examId=${examIdStr}, tenantId=${tenantIdStr}`
      );
    }

    // Validate ObjectId format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (
      !objectIdRegex.test(classIdStr) ||
      !objectIdRegex.test(subjectIdStr) ||
      !objectIdRegex.test(examIdStr) ||
      !objectIdRegex.test(tenantIdStr)
    ) {
      throw new Error(
        `Invalid ObjectId format: classId=${classIdStr}, subjectId=${subjectIdStr}, examId=${examIdStr}, tenantId=${tenantIdStr}`
      );
    }

    const classIdObj = new mongoose.Types.ObjectId(classIdStr);
    const subjectIdObj = new mongoose.Types.ObjectId(subjectIdStr);
    const examIdObj = new mongoose.Types.ObjectId(examIdStr);
    const tenantIdObj = new mongoose.Types.ObjectId(tenantIdStr);

    // Find existing record with case-insensitive topic name matching
    const existing = await findTopicPerformanceByTopicName(
      classIdStr,
      subjectIdStr,
      examIdStr,
      data.topicName
    );

    // Prepare update data - use provided values (function recalculates from all attempts)
    const updateData: any = {
      classId: classIdObj,
      subjectId: subjectIdObj,
      examId: examIdObj,
      tenantId: tenantIdObj,
      topicName: existing ? existing.topicName : data.topicName, // Preserve existing topic name casing if found
      weightageInExam: data.weightageInExam,
      totalMarks: data.totalMarks,
      totalMarksObtained: data.totalMarksObtained,
      totalMarksPossible: data.totalMarksPossible,
      totalStudents: data.totalStudents,
      averagePerformance: data.averagePerformance,
      lastUpdated: new Date(),
    };

    if (existing) {
      console.log(`[upsertTopicPerformance] Updating existing topic "${existing.topicName}" (case-insensitive match with "${data.topicName}")`);
    } else {
      console.log(`[upsertTopicPerformance] Creating new topic "${data.topicName}"`);
    }

    // Use the existing _id if found, otherwise use case-insensitive query
    const query = existing
      ? { _id: existing._id }
      : {
          classId: classIdObj,
          subjectId: subjectIdObj,
          examId: examIdObj,
          topicName: { $regex: new RegExp(`^${data.topicName}$`, "i") },
        };

    return await ClassTopicPerformance.findOneAndUpdate(
      query,
      updateData,
      {
        upsert: true,
        new: true,
      }
    );
  } catch (error: any) {
    console.error("Error upserting topic performance:", error);
    console.error("Data received:", {
      classId: data.classId,
      subjectId: data.subjectId,
      examId: data.examId,
      tenantId: data.tenantId,
      topicName: data.topicName,
    });
    throw error;
  }
};

// Find topic performance by class, subject, and exam
export const findTopicPerformanceByExam = async (
  classId: string,
  subjectId: string,
  examId: string
): Promise<IClassTopicPerformance[]> => {
  try {
    return await ClassTopicPerformance.find({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      examId: new mongoose.Types.ObjectId(examId),
    }).sort({ topicName: 1 });
  } catch (error: any) {
    console.error("Error finding topic performance by exam:", error);
    throw error;
  }
};

// Find topic performance by topic name (case-insensitive)
export const findTopicPerformanceByTopicName = async (
  classId: string,
  subjectId: string,
  examId: string,
  topicName: string
): Promise<IClassTopicPerformance | null> => {
  try {
    const classIdObj = new mongoose.Types.ObjectId(classId);
    const subjectIdObj = new mongoose.Types.ObjectId(subjectId);
    const examIdObj = new mongoose.Types.ObjectId(examId);
    
    // Find with case-insensitive topic name matching
    const result = await ClassTopicPerformance.findOne({
      classId: classIdObj,
      subjectId: subjectIdObj,
      examId: examIdObj,
      topicName: { $regex: new RegExp(`^${topicName}$`, "i") },
    });
    
    return result;
  } catch (error: any) {
    console.error("Error finding topic performance by topic name:", error);
    throw error;
  }
};

// Find topic performance by class and subject (across all exams)
export const findTopicPerformanceByClassAndSubject = async (
  classId: string,
  subjectId: string,
  tenantId: string
): Promise<IClassTopicPerformance[]> => {
  try {
    return await ClassTopicPerformance.find({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).sort({ topicName: 1, examId: 1 });
  } catch (error: any) {
    console.error(
      "Error finding topic performance by class and subject:",
      error
    );
    throw error;
  }
};

// Aggregate topic statistics by class and subject
export const aggregateTopicStatistics = async (
  classId: string,
  subjectId: string,
  tenantId: string
): Promise<
  Array<{
    topicName: string;
    totalExams: number;
    averagePerformance: number;
    totalStudents: number;
    weightageAverage: number;
    exams: Array<{
      examId: string;
      examTitle: string;
      weightageInExam: number;
      averagePerformance: number;
      totalStudents: number;
      createdOn: Date | string;
    }>;
  }>
> => {
  try {
    // Get all exams for this class and subject (similar to getMyClassDetail)
    const subjectExams = await examRepository.findExams({
      tenantId,
      classId,
      subjectId,
      pageNo: 1,
      pageSize: 1000, // Get all exams
    } as any);

    // Create a map of all exams for quick lookup and preserve order
    const allExamsMap = new Map<string, { examId: string; examTitle: string; createdOn: Date | string }>();
    const allExamsOrdered: Array<{ examId: string; examTitle: string; createdOn: Date | string }> = [];
    subjectExams.forEach((exam: any) => {
      const examId = exam._id ? exam._id.toString() : exam.id || exam._id;
      const examInfo = {
        examId: examId,
        examTitle: exam.examTitle || "Unknown Exam",
        createdOn: exam.createdAt || exam.createdOn || new Date(),
      };
      allExamsMap.set(examId, examInfo);
      allExamsOrdered.push(examInfo);
    });

    // First, get all topic performance records for this class/subject
    const topicPerformances = await ClassTopicPerformance.find({
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).populate("examId", "examTitle");

    // Group by topic name
    const topicMap = new Map<
      string,
      {
        topicName: string;
        examDataMap: Map<
          string,
          {
            examId: string;
            examTitle: string;
            weightageInExam: number;
            averagePerformance: number;
            totalStudents: number;
            createdOn: Date | string;
          }
        >;
        totalStudents: Set<string>;
        totalPerformance: number;
        totalWeightage: number;
        examCount: number;
      }
    >();

    for (const tp of topicPerformances) {
      const topicName = tp.topicName;
      const exam = tp.examId as any;

      // Get examId as string - handle both populated and non-populated cases
      let examIdStr: string;
      if (typeof tp.examId === "string") {
        examIdStr = tp.examId;
      } else if (tp.examId instanceof mongoose.Types.ObjectId) {
        examIdStr = tp.examId.toString();
      } else if (exam && exam._id) {
        // Populated object - get the _id
        examIdStr = exam._id.toString ? exam._id.toString() : String(exam._id);
      } else if (exam && exam.id) {
        // Populated object with id property
        examIdStr = typeof exam.id === "string" ? exam.id : exam.id.toString();
      } else {
        // Fallback: try to get from the document's original value
        const doc = tp as any;
        examIdStr =
          doc._doc?.examId?.toString() ||
          doc.examId?.toString() ||
          String(tp.examId);
      }

      if (!topicMap.has(topicName)) {
        topicMap.set(topicName, {
          topicName,
          examDataMap: new Map(),
          totalStudents: new Set(),
          totalPerformance: 0,
          totalWeightage: 0,
          examCount: 0,
        });
      }

      const topicData = topicMap.get(topicName)!;
      
      // Get createdAt from allExamsMap (since we already have all exams with their dates)
      const examInfo = allExamsMap.get(examIdStr);
      const examCreatedAt = examInfo?.createdOn || exam?.createdAt || (exam?._doc?.createdAt) || new Date();
      
      // Store exam data in map
      topicData.examDataMap.set(examIdStr, {
        examId: examIdStr,
        examTitle: exam?.examTitle || examInfo?.examTitle || "Unknown Exam",
        weightageInExam: tp.weightageInExam,
        averagePerformance: tp.averagePerformance,
        totalStudents: tp.totalStudents,
        createdOn: examCreatedAt,
      });
      
      topicData.totalPerformance += tp.averagePerformance * tp.weightageInExam;
      topicData.totalWeightage += tp.weightageInExam;
      topicData.examCount += 1;
    }

    // Calculate aggregated statistics and ensure all exams are included
    const result: Array<{
      topicName: string;
      totalExams: number;
      averagePerformance: number;
      totalStudents: number;
      weightageAverage: number;
      exams: Array<{
        examId: string;
        examTitle: string;
        weightageInExam: number;
        averagePerformance: number;
        totalStudents: number;
        createdOn: Date | string;
      }>;
    }> = [];

    for (const [topicName, data] of topicMap.entries()) {
      // Build exams array - include all exams, with defaults for exams without topic data
      const exams: Array<{
        examId: string;
        examTitle: string;
        weightageInExam: number;
        averagePerformance: number;
        totalStudents: number;
        createdOn: Date | string;
      }> = [];

      // Add all exams in the same order as subjectExams (most recent first),
      // using topic data if available, otherwise defaults
      for (const examInfo of allExamsOrdered) {
        const topicExamData = data.examDataMap.get(examInfo.examId);
        if (topicExamData) {
          // Topic has data for this exam
          exams.push(topicExamData);
        } else {
          // Topic doesn't have data for this exam - add with defaults
          exams.push({
            examId: examInfo.examId,
            examTitle: examInfo.examTitle,
            weightageInExam: 0,
            averagePerformance: 0,
            totalStudents: 0,
            createdOn: examInfo.createdOn,
          });
        }
      }

      const averagePerformance =
        data.totalWeightage > 0
          ? data.totalPerformance / data.totalWeightage
          : 0;
      const weightageAverage =
        data.examCount > 0 ? data.totalWeightage / data.examCount : 0;
      const totalStudents = exams.reduce(
        (sum, exam) => sum + exam.totalStudents,
        0
      );

      result.push({
        topicName: data.topicName,
        totalExams: data.examCount, // Number of exams where this topic appears
        averagePerformance: Math.round(averagePerformance * 100) / 100,
        totalStudents,
        weightageAverage: Math.round(weightageAverage * 100) / 100,
        exams: exams, // Include all exams, with defaults for exams without topic data
      });
    }

    return result.sort((a, b) => a.topicName.localeCompare(b.topicName));
  } catch (error: any) {
    console.error("Error aggregating topic statistics:", error);
    throw error;
  }
};

// Delete topic performance by exam (useful when exam is deleted)
export const deleteTopicPerformanceByExam = async (
  examId: string
): Promise<void> => {
  try {
    await ClassTopicPerformance.deleteMany({
      examId: new mongoose.Types.ObjectId(examId),
    });
  } catch (error: any) {
    console.error("Error deleting topic performance by exam:", error);
    throw error;
  }
};

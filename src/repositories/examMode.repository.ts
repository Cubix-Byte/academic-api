import { ExamMode, IExamMode, ExamStudent, ExamAttempt } from "../models";
import {
  CreateExamModeRequest,
  UpdateExamModeRequest,
  GetAllExamModesRequest,
  ExamModeStatistics,
} from "../types/examMode.types";
import { SortOrder } from "mongoose";
import mongoose from "mongoose";

/**
 * ExamMode Repository - Data access layer for ExamMode management
 */

// Create new exam mode
export const createExamMode = async (
  data: CreateExamModeRequest & { tenantId: string; createdBy: string }
): Promise<IExamMode> => {
  try {
    const examMode = new ExamMode(data);
    return await examMode.save();
  } catch (error: any) {
    console.error("Error creating exam mode:", error);
    throw error;
  }
};

// Find exam mode by ID
export const findExamModeById = async (
  id: string
): Promise<IExamMode | null> => {
  try {
    return await ExamMode.findOne({ _id: id, isDeleted: false });
  } catch (error: any) {
    console.error("Error finding exam mode by ID:", error);
    throw error;
  }
};

// Find exam mode by name (globally unique - for name uniqueness checks)
export const findExamModeByName = async (
  name: string
): Promise<IExamMode | null> => {
  try {
    return await ExamMode.findOne({
      name: name,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding exam mode by name:", error);
    throw error;
  }
};

// Find exam mode by name and tenant
export const findExamModeByNameAndTenant = async (
  name: string,
  tenantId: string
): Promise<IExamMode | null> => {
  try {
    return await ExamMode.findOne({
      name: name,
      tenantId: tenantId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding exam mode by name and tenant:", error);
    throw error;
  }
};

// Find all exam modes with filters
export const findExamModes = async (
  params: GetAllExamModesRequest
): Promise<(IExamMode & { examCount: number; examStatusCounts: any; gradingTypeStatusCounts: any })[]> => {
  try {
    const { pageNo = 1, pageSize = 10, search, isActive, tenantId, teacherId, batchId, classId, studentId } = params;

    // Build match query for exam modes
    const matchQuery: any = { isDeleted: false };

    // Handle tenantId filtering with backward compatibility
    // Exam modes can exist without tenantId (for backward compatibility)
    // So we match either the specific tenantId OR null/undefined tenantId
    if (tenantId) {
      const tenantObjectId = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;
      matchQuery.$or = [
        { tenantId: tenantObjectId },
        { tenantId: null },
        { tenantId: { $exists: false } },
      ];
    }

    if (isActive !== undefined) {
      matchQuery.isActive = isActive;
    }

    if (search) {
      // If we already have $or for tenantId, we need to combine with search
      if (matchQuery.$or) {
        matchQuery.$and = [
          { $or: matchQuery.$or },
          {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          },
        ];
        delete matchQuery.$or;
      } else {
        matchQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }
    }

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    // Build exam lookup match conditions
    // We need $expr for examModeId comparison with variable $$modeId
    const examMatchExprConditions: any[] = [
      { $eq: ["$examModeId", "$$modeId"] },
      { $eq: ["$isDeleted", false] },
    ];

    // Build the $match object for the lookup pipeline
    const examLookupMatch: any = {
      $expr: {
        $and: examMatchExprConditions,
      },
    };

    // Add tenantId filter for exams if tenantId is provided
    // Add as regular field match (MongoDB will combine with $expr)
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      examLookupMatch.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    // Add teacherId filter for exams if teacherId is provided (for TEACHER role)
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      examLookupMatch.teacherId = new mongoose.Types.ObjectId(teacherId);
    }

    // Add classId filter for exams if classId is provided (e.g. student results by class)
    // When classId is present (student context), only include Released exams — exclude Published, Draft, etc.
    // This aligns with student graded-exams / KPIs APIs which only show Released exams.
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      examLookupMatch.classId = new mongoose.Types.ObjectId(classId);
      examLookupMatch.examStatus = "Released";
    }

    // Add batchId filter for exams if batchId is provided (and classId not already set)
    // We need to get all classes in the batch, then filter exams by those classIds
    let batchClassIds: mongoose.Types.ObjectId[] = [];
    if (!examLookupMatch.classId && batchId && mongoose.Types.ObjectId.isValid(batchId)) {
      const { Class } = await import("../models");
      const classesInBatch = await Class.find({
        batchId: new mongoose.Types.ObjectId(batchId),
        isDeleted: false,
      })
        .select("_id")
        .lean();

      batchClassIds = classesInBatch.map((cls: any) => cls._id);

      // If batchId is provided but no classes found, add a condition that will never match
      // This ensures we return exam modes with 0 counts
      if (batchClassIds.length === 0) {
        examLookupMatch.classId = new mongoose.Types.ObjectId("000000000000000000000000"); // Non-existent ID
      } else {
        examLookupMatch.classId = { $in: batchClassIds };
      }
    }

    // Build aggregation pipeline with $lookup to count exams and group by status
    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "exams",
          let: { modeId: "$_id" },
          pipeline: [
            {
              $match: examLookupMatch,
            },
            {
              $group: {
                _id: "$examStatus",
                count: { $sum: 1 },
              },
            },
          ],
          as: "examStatusGroups",
        },
      },
      {
        $lookup: {
          from: "exams",
          let: { modeId: "$_id" },
          pipeline: [
            {
              $match: {
                $and: [
                  examLookupMatch,
                  { gradingTypeStatus: { $exists: true, $ne: null } },
                ],
              },
            },
            {
              $group: {
                _id: "$gradingTypeStatus",
                count: { $sum: 1 },
              },
            },
          ],
          as: "gradingTypeStatusGroups",
        },
      },
      {
        $lookup: {
          from: "exams",
          let: { modeId: "$_id" },
          pipeline: [
            {
              $match: examLookupMatch,
            },
          ],
          as: "exams",
        },
      },
      {
        $addFields: {
          examCount: { $size: "$exams" },
        },
      },
      {
        $project: {
          exams: 0, // Remove the exams array
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
    ];

    // Execute aggregation
    const examModes = await ExamMode.aggregate(pipeline);

    // Process results to build examStatusCounts and gradingTypeStatusCounts objects
    let processedExamModes = examModes.map((mode: any) => {
      // Initialize all exam status counts to 0
      const statusCounts: any = {
        Draft: 0,
        Unpublished: 0,
        Published: 0,
        Released: 0,
        "In Progress": 0,
        Completed: 0,
        Cancelled: 0,
      };

      // Populate counts from examStatusGroups
      if (mode.examStatusGroups && Array.isArray(mode.examStatusGroups)) {
        mode.examStatusGroups.forEach((group: any) => {
          if (group._id && statusCounts.hasOwnProperty(group._id)) {
            statusCounts[group._id] = group.count || 0;
          }
        });
      }

      // Initialize all grading type status counts to 0
      const gradingTypeStatusCounts: any = {
        "In Progress": 0,
        "Waiting for Grading": 0,
        "Completed": 0,
      };

      // Populate counts from gradingTypeStatusGroups
      if (mode.gradingTypeStatusGroups && Array.isArray(mode.gradingTypeStatusGroups)) {
        mode.gradingTypeStatusGroups.forEach((group: any) => {
          if (group._id && gradingTypeStatusCounts.hasOwnProperty(group._id)) {
            gradingTypeStatusCounts[group._id] = group.count || 0;
          }
        });
      }

      return {
        ...mode,
        examStatusCounts: statusCounts,
        gradingTypeStatusCounts: gradingTypeStatusCounts,
      };
    });

    // When student context (classId + studentId): add passCount and failCount per mode (only Released exams in that class)
    if (classId && studentId && mongoose.Types.ObjectId.isValid(classId) && mongoose.Types.ObjectId.isValid(studentId)) {
      const studentIdObj = new mongoose.Types.ObjectId(studentId);
      const classIdObj = new mongoose.Types.ObjectId(classId);
      const examAttemptsCollection = ExamAttempt.collection.name;

      const passFailAgg = await ExamStudent.aggregate([
        {
          $match: {
            studentId: studentIdObj,
            classId: classIdObj,
            status: "Completed",
            gradingStatus: "Completed",
            isActive: true,
          },
        },
        {
          $lookup: {
            from: "exams",
            localField: "examId",
            foreignField: "_id",
            as: "examData",
            pipeline: [
              {
                $match: {
                  isDeleted: false,
                  examStatus: "Released",
                  classId: classIdObj,
                },
              },
              { $project: { examModeId: 1 } },
            ],
          },
        },
        { $unwind: { path: "$examData", preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: examAttemptsCollection,
            let: { examId: "$examId", studentId: "$studentId" },
            pipeline: [
              {
                $match: {
                  $and: [
                    {
                      $expr: {
                        $and: [
                          { $eq: ["$examId", "$$examId"] },
                          { $eq: ["$studentId", "$$studentId"] },
                        ],
                      },
                    },
                    { result: { $in: ["Pass", "Fail"] } },
                    { $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] },
                  ],
                },
              },
              { $sort: { attemptNumber: -1 } },
              { $limit: 1 },
              { $project: { result: 1 } },
            ],
            as: "attempt",
          },
        },
        { $unwind: { path: "$attempt", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$examData.examModeId",
            passCount: { $sum: { $cond: [{ $eq: ["$attempt.result", "Pass"] }, 1, 0] } },
            failCount: { $sum: { $cond: [{ $eq: ["$attempt.result", "Fail"] }, 1, 0] } },
          },
        },
      ]);

      const passFailByModeId = new Map<string, { passCount: number; failCount: number }>();
      passFailAgg.forEach((row: any) => {
        if (row._id) {
          passFailByModeId.set(row._id.toString(), {
            passCount: row.passCount ?? 0,
            failCount: row.failCount ?? 0,
          });
        }
      });

      processedExamModes = processedExamModes.map((mode: any) => {
        const counts = passFailByModeId.get(mode._id.toString());
        return {
          ...mode,
          passCount: counts?.passCount ?? 0,
          failCount: counts?.failCount ?? 0,
        };
      });
    }

    return processedExamModes as unknown as (IExamMode & { examCount: number; examStatusCounts: any; gradingTypeStatusCounts: any; passCount?: number; failCount?: number })[];
  } catch (error: any) {
    console.error("Error finding exam modes:", error);
    throw error;
  }
};

// Count exam modes with filters
export const countExamModes = async (
  params: GetAllExamModesRequest
): Promise<number> => {
  try {
    const { search, isActive, tenantId } = params;

    // Build query
    const query: any = { isDeleted: false };

    // Handle tenantId filtering with backward compatibility
    // Exam modes can exist without tenantId (for backward compatibility)
    // So we match either the specific tenantId OR null/undefined tenantId
    if (tenantId) {
      query.$or = [
        { tenantId: tenantId },
        { tenantId: null },
        { tenantId: { $exists: false } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    if (search) {
      // If we already have $or for tenantId, we need to combine with search
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          },
        ];
        delete query.$or;
      } else {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }
    }

    return await ExamMode.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting exam modes:", error);
    throw error;
  }
};

// Update exam mode by ID
export const updateExamModeById = async (
  id: string,
  data: UpdateExamModeRequest
): Promise<IExamMode | null> => {
  try {
    return await ExamMode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  } catch (error: any) {
    console.error("Error updating exam mode:", error);
    throw error;
  }
};

// Soft delete exam mode by ID
export const softDeleteExamModeById = async (
  id: string
): Promise<IExamMode | null> => {
  try {
    return await ExamMode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error soft deleting exam mode:", error);
    throw error;
  }
};

// Get active exam modes for dropdown (DDL)
export const getActiveExamModesForDDL = async (
  tenantId?: string
): Promise<Array<{ _id: string; name: string }>> => {
  try {
    const query: any = {
      isActive: true,
      isDeleted: false,
    };

    // Handle tenantId filtering with backward compatibility
    // Exam modes can exist without tenantId (for backward compatibility)
    // So we match either the specific tenantId OR null/undefined tenantId
    if (tenantId) {
      query.$or = [
        { tenantId: tenantId },
        { tenantId: null },
        { tenantId: { $exists: false } },
      ];
    }

    const examModes = await ExamMode.find(query, { _id: 1, name: 1 })
      .sort({ name: 1 })
      .lean();

    return examModes as unknown as Array<{ _id: string; name: string }>;
  } catch (error: any) {
    console.error("Error getting active exam modes for DDL:", error);
    throw error;
  }
};

// Get exam mode statistics
export const getExamModeStatistics = async (
  tenantId?: string
): Promise<ExamModeStatistics> => {
  try {
    const matchQuery: any = { isDeleted: false };

    if (tenantId) {
      matchQuery.tenantId = tenantId;
    }

    // Get basic counts
    const total = await ExamMode.countDocuments(matchQuery);
    const active = await ExamMode.countDocuments({
      ...matchQuery,
      isActive: true,
    });
    const inactive = await ExamMode.countDocuments({
      ...matchQuery,
      isActive: false,
    });

    // Get recent exam modes (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentExamModes = await ExamMode.countDocuments({
      ...matchQuery,
      createdAt: { $gte: thirtyDaysAgo },
    });

    return {
      total,
      active,
      inactive,
      byStatus: [
        { status: "active", count: active },
        { status: "inactive", count: inactive },
      ],
      recentExamModes,
    };
  } catch (error: any) {
    console.error("Error getting exam mode statistics:", error);
    throw error;
  }
};

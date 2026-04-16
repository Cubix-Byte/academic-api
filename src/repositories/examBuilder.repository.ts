import { ExamBuilder, IExamBuilder } from "../models/examBuilder.schema";
import {
  CreateExamBuilderRequest,
  UpdateExamBuilderRequest,
  GetAllExamBuildersRequest,
} from "../types/examBuilder.types";
import mongoose from "mongoose";

/**
 * ExamBuilder Repository - Data access layer for ExamBuilder management
 */

// Centralized helper to enforce tenant scoping and build filters consistently
function buildExamBuilderQuery(params: GetAllExamBuildersRequest) {
  const {
    tenantId,
    createdBy,
    status,
    classId,
    subjectId,
    batchId,
    contentType,
    search,
  } = params as any;

  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const query: any = { isDeleted: false, tenantId };

  if (createdBy) query.createdBy = createdBy;
  if (status && status !== "All") query.status = status;
  if (classId) query.classId = classId;
  if (subjectId) query.subjectId = subjectId;
  if (batchId) query.batchId = batchId;
  if (contentType) query.contentType = contentType;
  if (search) {
    query.$or = [
      { contentTitle: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  return query;
}

// Create new exam builder
export const createExamBuilder = async (
  data: CreateExamBuilderRequest & { tenantId: string; createdBy: string },
  session?: mongoose.ClientSession
): Promise<IExamBuilder> => {
  try {
    const examBuilder = new ExamBuilder(data);
    return await examBuilder.save({ session });
  } catch (error: any) {
    console.error("Error creating exam builder:", error);
    throw error;
  }
};

// Find exam builder by ID
export const findExamBuilderById = async (
  id: string,
  session?: mongoose.ClientSession
): Promise<IExamBuilder | null> => {
  try {
    const query = ExamBuilder.findOne({ _id: id, isDeleted: false })
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName");

    if (session) {
      query.session(session);
    }

    const examBuilder = await query.lean();
    return examBuilder as IExamBuilder | null;
  } catch (error: any) {
    console.error("Error finding exam builder by ID:", error);
    throw error;
  }
};

// Find all exam builders with filters
export const findExamBuilders = async (
  params: GetAllExamBuildersRequest
): Promise<IExamBuilder[]> => {
  try {
    const {
      pageNo = 1,
      pageSize = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params as any;
    const query = buildExamBuilderQuery(params);

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with population - all fields including contentType are included by default
    const examBuilders = await ExamBuilder.find(query)
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName")
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean();

    return examBuilders as unknown as IExamBuilder[];
  } catch (error: any) {
    console.error("Error finding exam builders:", error);
    throw error;
  }
};

// Count exam builders with filters
export const countExamBuilders = async (
  params: GetAllExamBuildersRequest
): Promise<number> => {
  try {
    const query = buildExamBuilderQuery(params);
    return await ExamBuilder.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting exam builders:", error);
    throw error;
  }
};

// Update exam builder by ID
export const updateExamBuilderById = async (
  id: string,
  data: UpdateExamBuilderRequest,
  session?: mongoose.ClientSession
): Promise<IExamBuilder | null> => {
  try {
    const options: any = { new: true, runValidators: true };
    if (session) {
      options.session = session;
    }
    return await ExamBuilder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      options
    )
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName");
  } catch (error: any) {
    console.error("Error updating exam builder:", error);
    throw error;
  }
};

// Soft delete exam builder by ID
export const softDeleteExamBuilderById = async (
  id: string
): Promise<IExamBuilder | null> => {
  try {
    return await ExamBuilder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error soft deleting exam builder:", error);
    throw error;
  }
};

// Get exam builder statistics
export const getExamBuilderStatistics = async (
  tenantId: string,
  createdBy?: string
): Promise<{
  total: number;
  recent: number;
  draft: number;
  byContentType: {
    Syllabus: number;
    "Lesson Plan": number;
    "Study Material": number;
    Worksheet: number;
  };
}> => {
  try {
    const baseQuery: any = { isDeleted: false, tenantId };
    if (createdBy) {
      baseQuery.createdBy = createdBy;
    }

    const [
      total,
      recent,
      draft,
      syllabus,
      lessonPlan,
      studyMaterial,
      worksheet,
    ] = await Promise.all([
      ExamBuilder.countDocuments(baseQuery),
      ExamBuilder.countDocuments({ ...baseQuery, status: "Recent" }),
      ExamBuilder.countDocuments({ ...baseQuery, status: "Draft" }),
      ExamBuilder.countDocuments({
        ...baseQuery,
        contentType: "Syllabus",
      }),
      ExamBuilder.countDocuments({ ...baseQuery, contentType: "Lesson Plan" }),
      ExamBuilder.countDocuments({
        ...baseQuery,
        contentType: "Study Material",
      }),
      ExamBuilder.countDocuments({ ...baseQuery, contentType: "Worksheet" }),
    ]);

    return {
      total,
      recent,
      draft,
      byContentType: {
        Syllabus: syllabus,
        "Lesson Plan": lessonPlan,
        "Study Material": studyMaterial,
        Worksheet: worksheet,
      },
    };
  } catch (error: any) {
    console.error("Error getting exam builder statistics:", error);
    throw error;
  }
};

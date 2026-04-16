import { ContentBuilder, IContentBuilder } from "../models/contentBuilder.schema";
import {
  CreateContentBuilderRequest,
  UpdateContentBuilderRequest,
  GetAllContentBuildersRequest,
} from "../types/contentBuilder.types";
import mongoose from "mongoose";

/**
 * ContentBuilder Repository - Data access layer for ContentBuilder management
 */

// Centralized helper to enforce tenant scoping and build filters consistently
function buildContentBuilderQuery(params: GetAllContentBuildersRequest) {
  const {
    tenantId,
    teacherId,
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

  if (teacherId) query.teacherId = teacherId;
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

// Create new content builder
export const createContentBuilder = async (
  data: CreateContentBuilderRequest & { tenantId: string; teacherId: string; createdBy: string },
  session?: mongoose.ClientSession
): Promise<IContentBuilder> => {
  try {
    const contentBuilder = new ContentBuilder(data);
    return await contentBuilder.save({ session });
  } catch (error: any) {
    console.error("Error creating content builder:", error);
    throw error;
  }
};

// Find content builder by ID
export const findContentBuilderById = async (
  id: string,
  session?: mongoose.ClientSession
): Promise<IContentBuilder | null> => {
  try {
    const query = ContentBuilder.findOne({ _id: id, isDeleted: false })
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName");

    if (session) {
      query.session(session);
    }

    const contentBuilder = await query.lean();
    return contentBuilder as IContentBuilder | null;
  } catch (error: any) {
    console.error("Error finding content builder by ID:", error);
    throw error;
  }
};

// Find all content builders with filters
export const findContentBuilders = async (
  params: GetAllContentBuildersRequest
): Promise<IContentBuilder[]> => {
  try {
    const {
      pageNo = 1,
      pageSize = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params as any;
    const query = buildContentBuilderQuery(params);

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    // Build sort object
    const sort: any = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with population
    const contentBuilders = await ContentBuilder.find(query)
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName")
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean();

    return contentBuilders as unknown as IContentBuilder[];
  } catch (error: any) {
    console.error("Error finding content builders:", error);
    throw error;
  }
};

// Count content builders with filters
export const countContentBuilders = async (
  params: GetAllContentBuildersRequest
): Promise<number> => {
  try {
    const query = buildContentBuilderQuery(params);
    return await ContentBuilder.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting content builders:", error);
    throw error;
  }
};

// Update content builder by ID
export const updateContentBuilderById = async (
  id: string,
  data: UpdateContentBuilderRequest,
  session?: mongoose.ClientSession
): Promise<IContentBuilder | null> => {
  try {
    const options: any = { new: true, runValidators: true };
    if (session) {
      options.session = session;
    }
    return await ContentBuilder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      options
    )
      .populate("classId", "name grade section academicYear")
      .populate("subjectId", "name")
      .populate("batchId", "batchName");
  } catch (error: any) {
    console.error("Error updating content builder:", error);
    throw error;
  }
};

// Soft delete content builder by ID
export const softDeleteContentBuilderById = async (
  id: string
): Promise<IContentBuilder | null> => {
  try {
    return await ContentBuilder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error soft deleting content builder:", error);
    throw error;
  }
};

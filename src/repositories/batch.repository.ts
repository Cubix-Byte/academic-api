import { Batch, IBatch } from "../models";
import {
  CreateBatchRequest,
  UpdateBatchRequest,
  GetAllBatchesRequest,
  BatchStatistics,
} from "../types/batch.types";
import { SortOrder } from "mongoose";

/**
 * Batch Repository - Data access layer for Batch management
 */

// Create new batch
export const createBatch = async (
  data: CreateBatchRequest
): Promise<IBatch> => {
  try {
    const batch = new Batch(data);
    return await batch.save();
  } catch (error: any) {
    console.error("Error creating batch:", error);
    throw error;
  }
};

// Find batch by ID
export const findBatchById = async (id: string): Promise<IBatch | null> => {
  try {
    return await Batch.findOne({ _id: id, isDeleted: false });
  } catch (error: any) {
    console.error("Error finding batch by ID:", error);
    throw error;
  }
};

// Find batch by name and tenant
export const findBatchByNameAndTenant = async (
  batchName: string,
  tenantId: string
): Promise<IBatch | null> => {
  try {
    return await Batch.findOne({
      batchName: batchName,
      tenantId: tenantId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding batch by name and tenant:", error);
    throw error;
  }
};

// Find all batches with filters
export const findBatches = async (params: {
  pageNo?: number;
  pageSize?: number;
  query?: Record<string, any>;
  sort?: Record<string, SortOrder>;
  tenantId: string;
}): Promise<IBatch[]> => {
  try {
    const {
      pageNo = 1,
      pageSize = 10,
      query: filterQuery = {},
      sort: sortQuery = {},
      tenantId,
    } = params;

    // Build base query with tenant and soft delete check
    const query: any = {
      isDeleted: false,
      tenantId,
    };

    // Merge with filter query from buildQuery helper
    Object.assign(query, filterQuery);

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    // Determine sort order - use provided sort or default to createdAt desc
    const sort: Record<string, SortOrder> =
      Object.keys(sortQuery).length > 0
        ? sortQuery!
        : ({ createdAt: -1 } as Record<string, SortOrder>);

    // Execute query
    const batches = await Batch.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean();

    return batches as unknown as IBatch[];
  } catch (error: any) {
    console.error("Error finding batches:", error);
    throw error;
  }
};

// Count batches with filters
export const countBatches = async (params: {
  query?: Record<string, any>;
  tenantId: string;
}): Promise<number> => {
  try {
    const { query: filterQuery = {}, tenantId } = params;

    // Build base query with tenant and soft delete check
    const query: any = {
      isDeleted: false,
      tenantId,
    };

    // Merge with filter query from buildQuery helper
    Object.assign(query, filterQuery);

    return await Batch.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting batches:", error);
    throw error;
  }
};

// Update batch by ID
export const updateBatchById = async (
  id: string,
  data: UpdateBatchRequest
): Promise<IBatch | null> => {
  try {
    return await Batch.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  } catch (error: any) {
    console.error("Error updating batch:", error);
    throw error;
  }
};

// Soft delete batch by ID
export const softDeleteBatchById = async (
  id: string
): Promise<IBatch | null> => {
  try {
    return await Batch.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error soft deleting batch:", error);
    throw error;
  }
};

// Get active batches for dropdown (DDL)
export const getActiveBatchesForDDL = async (
  tenantId: string
): Promise<Array<{ _id: string; batchName: string }>> => {
  try {
    const batches = await Batch.find(
      {
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      },
      { _id: 1, batchName: 1 }
    )
      .sort({ batchName: 1 as SortOrder })
      .lean();

    return batches as unknown as Array<{ _id: string; batchName: string }>;
  } catch (error: any) {
    console.error("Error getting active batches for DDL:", error);
    throw error;
  }
};

// Get active batches for dropdown (DDL) filtered by teacher's assigned classes
export const getActiveBatchesForDDLByTeacher = async (
  tenantId: string,
  teacherId: string
): Promise<Array<{ _id: string; batchName: string }>> => {
  try {
    // Import TeacherAssignClasses and Class models
    const { TeacherAssignClasses } = await import("../models");
    const { Class } = await import("../models");
    const mongoose = await import("mongoose");

    // Get teacher's assigned classes sorted by most recent assignment first
    const assignments = await TeacherAssignClasses.find({
      teacherId: new mongoose.Types.ObjectId(teacherId),
      tenantId: tenantId,
      isActive: true,
      isDeleted: false,
    })
      .populate({
        path: "classId",
        select: "batchId",
        match: { isDeleted: false },
      })
      .select("classId assignedAt")
      .sort({ assignedAt: -1 }) // Sort by most recent assignment first
      .lean();

    // Extract unique batchIds while preserving order (most recently assigned first)
    // Use Map to track the most recent assignedAt date for each batch
    const batchIdMap = new Map<string, Date>();
    assignments.forEach((assignment: any) => {
      const classData = assignment.classId;
      if (classData && classData.batchId) {
        const batchId = (classData.batchId._id || classData.batchId).toString();
        if (batchId) {
          const assignedAt = assignment.assignedAt 
            ? new Date(assignment.assignedAt) 
            : new Date(0); // Use epoch if no assignedAt
          
          // Keep the most recent assignedAt date for each batch
          if (!batchIdMap.has(batchId) || assignedAt > batchIdMap.get(batchId)!) {
            batchIdMap.set(batchId, assignedAt);
          }
        }
      }
    });

    // If no batches found, return empty array
    if (batchIdMap.size === 0) {
      return [];
    }

    // Sort batchIds by most recent assignedAt date (descending)
    const sortedBatchIds = Array.from(batchIdMap.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime()) // Sort by date descending
      .map(([batchId]) => new mongoose.Types.ObjectId(batchId));

    // Get batches that match the teacher's assigned class batches
    const batches = await Batch.find(
      {
        _id: { $in: sortedBatchIds },
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      },
      { _id: 1, batchName: 1 }
    )
      .lean();

    // Sort the batches to match the order of sortedBatchIds
    const batchMap = new Map(
      batches.map((batch: any) => [batch._id.toString(), batch])
    );

    const orderedBatches = sortedBatchIds
      .map((id) => batchMap.get(id.toString()))
      .filter((batch) => batch !== undefined) as Array<{
      _id: string;
      batchName: string;
    }>;

    return orderedBatches;
  } catch (error: any) {
    console.error("Error getting active batches for DDL by teacher:", error);
    throw error;
  }
};

// Get batch statistics
export const getBatchStatistics = async (
  tenantId?: string
): Promise<BatchStatistics> => {
  try {
    const matchQuery: any = { isDeleted: false };

    if (tenantId) {
      matchQuery.tenantId = tenantId;
    }

    // Get basic counts
    const total = await Batch.countDocuments(matchQuery);
    const active = await Batch.countDocuments({
      ...matchQuery,
      isActive: true,
    });
    const inactive = await Batch.countDocuments({
      ...matchQuery,
      isActive: false,
    });

    // Get recent batches (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBatches = await Batch.countDocuments({
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
      recentBatches,
    };
  } catch (error: any) {
    console.error("Error getting batch statistics:", error);
    throw error;
  }
};

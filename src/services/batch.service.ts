import * as batchRepository from "../repositories/batch.repository";
import {
    CreateBatchRequest,
    UpdateBatchRequest,
    BatchDDLResponse, BatchStatistics } from "@/types/batch.types";
import { SortOrder } from "mongoose";

/**
 * Batch Service - Business logic for batch management
 */

// Create new batch
export const createBatch = async (data: CreateBatchRequest, tenantId: string) => {
  try {
    // Map request fields to database schema fields
    const batchName = data.batchName || data.name;
    if (!batchName) {
      throw new Error('Batch name is required');
    }

    // Check if batch name already exists for this tenant
    const existingBatch = await batchRepository.findBatchByNameAndTenant(batchName, tenantId);
    if (existingBatch) {
      throw new Error('BATCH_NAME_EXISTS');
    }

    // Map date fields
    const startFrom = data.startFrom || data.startDate;
    const endTill = data.endTill;

    // Prepare batch data for database
    const batchData = {
      batchName: batchName,
      description: data.description,
      totalClasses: 0, // Default to 0 if not provided
      startFrom: startFrom ? new Date(startFrom) : undefined,
      endTill: endTill ? new Date(endTill) : undefined,
      isActive: data.isActive !== undefined ? data.isActive : true, // Default to true
      tenantId: tenantId
    };

    console.log('📝 Creating batch with data:', JSON.stringify(batchData, null, 2));
    
    const batch = await batchRepository.createBatch(batchData);
    console.log('✅ Batch created successfully:', batch._id);
    
    return batch;
  } catch (error) {
    console.error('Create batch error:', error);
    throw error;
  }
};

// Get batch by ID
export const getBatchById = async (id: string) => {
  const batch = await batchRepository.findBatchById(id);
  if (!batch) {
    throw new Error("BATCH_NOT_FOUND");
  }
  return batch;
};

// Update batch
export const updateBatch = async (id: string, data: UpdateBatchRequest, tenantId: string) => {
  const batch = await batchRepository.findBatchById(id);
  if (!batch) {
    throw new Error("BATCH_NOT_FOUND");
  }

  // Check if batch name already exists for this tenant (if batchName is being updated)
  if (data.batchName && data.batchName !== batch.batchName) {
    const existingBatch = await batchRepository.findBatchByNameAndTenant(data.batchName, tenantId);
    if (existingBatch) {
      throw new Error('BATCH_NAME_EXISTS');
    }
  }

  // Update batch record
  const updatedBatch = await batchRepository.updateBatchById(id, data);
  if (!updatedBatch) {
    throw new Error("BATCH_NOT_FOUND");
  }
  return updatedBatch;
};

// Delete batch
export const deleteBatch = async (id: string) => {
  const batch = await batchRepository.findBatchById(id);
  if (!batch) {
    throw new Error("BATCH_NOT_FOUND");
  }

  // Soft delete batch record
  const deletedBatch = await batchRepository.softDeleteBatchById(id);
  return deletedBatch;
};

// Get all batches
export const getAllBatches = async (params: {
  pageNo?: number;
  pageSize?: number;
  query?: Record<string, any>;
  sort?: Record<string, SortOrder>;
  tenantId: string;
}) => {
  const batches = await batchRepository.findBatches(params);
  const total = await batchRepository.countBatches(params);

  return {
    batches,
    pagination: {
      total,
      pageNo: params.pageNo || 1,
      pageSize: params.pageSize || 10,
      totalPages: Math.ceil(total / (params.pageSize || 10)),
    },
  };
};

// Get batches dropdown list (DDL)
export const getBatchesDDL = async (
  tenantId: string,
  teacherId?: string
): Promise<BatchDDLResponse> => {
  try {
    let batches;
    
    // If teacherId is provided, filter batches by teacher's assigned classes
    if (teacherId) {
      batches = await batchRepository.getActiveBatchesForDDLByTeacher(
        tenantId,
        teacherId
      );
    } else {
      // Otherwise, get all active batches for the tenant
      batches = await batchRepository.getActiveBatchesForDDL(tenantId);
    }
    
    const batchDDLItems = batches.map(batch => ({
      id: batch._id.toString(),
      batchName: batch.batchName
    }));

    return {
      batches: batchDDLItems
    };
  } catch (error) {
    console.error('Error getting batches DDL:', error);
    throw error;
  }
};

// Get batch statistics (simplified - total, active, and inactive)
export const getBatchStats = async (tenantId?: string): Promise<{ total: number; active: number; inactive: number }> => {
  try {
    const stats = await batchRepository.getBatchStatistics(tenantId);
    return {
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive
    };
  } catch (error) {
    console.error('Error getting batch stats:', error);
    throw error;
  }
};

// Get batch statistics (detailed)
export const getBatchStatistics = async (tenantId?: string): Promise<BatchStatistics> => {
  try {
    return await batchRepository.getBatchStatistics(tenantId);
  } catch (error) {
    console.error('Error getting batch statistics:', error);
    throw error;
  }
};

// Search batches (deprecated - use getAllBatches with filters instead)
export const searchBatches = async (searchTerm: string, tenantId: string, params: {
  pageNo?: number;
  pageSize?: number;
  isActive?: boolean;
}) => {
  // Build search query using regex for batchName
  const query = {
    batchName: { $regex: searchTerm, $options: 'i' }
  };

  // Add isActive filter if provided
  if (params.isActive !== undefined) {
    Object.assign(query, { isActive: params.isActive });
  }

  return await getAllBatches({
    pageNo: params.pageNo,
    pageSize: params.pageSize,
    query,
    sort: {},
    tenantId
  });
};

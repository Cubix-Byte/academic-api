import { IBatch } from '../models/batch.schema';

/**
 * Batch Types - Request and Response interfaces for Batch management
 */

// Create Batch Request
export interface CreateBatchRequest {
  // Support both field names for flexibility
  name?: string;
  batchName?: string;
  description?: string;
  startDate?: string;
  startFrom?: string | Date;
  endTill?: string | Date;
  isActive?: boolean;
  tenantId?: string;
}

// Update Batch Request
export interface UpdateBatchRequest {
  batchName?: string;
  description?: string;
  totalClasses?: number;
  startFrom?: Date | string;
  endTill?: Date | string;
  isActive?: boolean;
}

// Batch Response
export interface BatchResponse extends IBatch {
  // Additional response fields if needed
}

// Batch Dropdown List Item (for DDL endpoint)
export interface BatchDDLItem {
  id: string;
  batchName: string;
}

// Batch Dropdown List Response
export interface BatchDDLResponse {
  batches: BatchDDLItem[];
}

// Get All Batches Request
export interface GetAllBatchesRequest {
  pageNo?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  startFrom?: string | Date;
  endTill?: string | Date;
  tenantId?: string;
}

// Get All Batches Response
export interface GetAllBatchesResponse {
  batches: BatchResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Batch Statistics
export interface BatchStatistics {
  total: number;
  active: number;
  inactive: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  recentBatches: number;
}

import { Request, Response, NextFunction } from "express";
import * as batchService from "../../services/batch.service";
import {
  CreateBatchRequest,
  UpdateBatchRequest,
} from "@/types/batch.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";

/**
 * Batch Controller - HTTP request handlers for batch management
 */

// Create new batch
export const createBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateBatchRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const batch = await batchService.createBatch(data, tenantId);
    return sendSuccessResponse(res, "Batch created successfully", batch);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "BATCH_NAME_EXISTS") {
      return sendErrorResponse(
        res,
        "Batch name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Get all batches
export const getAllBatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Build query and sort from query parameters
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query, sort } = queryResult;

    // Prepare query parameters with proper types
    const params = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      query: query || {},
      sort: sort || { createdAt: -1 },
      tenantId: tenantId as string,
    };

    // Handle search parameter if provided
    if (req.query.search) {
      params.query = {
        ...params.query,
        $or: [
          { batchName: { $regex: req.query.search, $options: "i" } },
          { name: { $regex: req.query.search, $options: "i" } },
        ],
      };
    }

    const result = await batchService.getAllBatches(params);
    return sendSuccessResponse(res, "Batches retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

// Get batch by ID
export const getBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Batch ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const batch = await batchService.getBatchById(id);
    return sendSuccessResponse(res, "Batch retrieved successfully", batch);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "BATCH_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Batch not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update batch
export const updateBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateBatchRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Batch ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const batch = await batchService.updateBatch(id, data, tenantId);
    return sendSuccessResponse(res, "Batch updated successfully", batch);
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "BATCH_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Batch not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "BATCH_NAME_EXISTS") {
      return sendErrorResponse(
        res,
        "Batch name already exists",
        HttpStatusCodes.CONFLICT
      );
    }
    next(error);
  }
};

// Delete batch
export const deleteBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendErrorResponse(
        res,
        "Batch ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const batch = await batchService.deleteBatch(id);
    return sendSuccessResponse(res, "Batch deleted successfully", batch || {});
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "BATCH_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Batch not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get batches dropdown list (DDL) - Main endpoint requested
export const getBatchesDDL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const teacherId = req.query.teacherId as string | undefined;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await batchService.getBatchesDDL(tenantId, teacherId);
    return sendSuccessResponse(
      res,
      "Batches dropdown list retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Search batches
export const searchBatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, query } = req.query;
    const tenantId = req.user?.tenantId;

    // Support both 'search' and 'query' parameters for flexibility
    const searchTerm = search || query;

    if (!searchTerm) {
      return sendErrorResponse(
        res,
        'Search term is required (use "search" or "query" parameter)',
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Get pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // Get filter and sort from query parameters
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return; // Error response already handled

    const { query: filterQuery, sort } = queryResult;

    // Build the query with search term and any additional filters
    const searchQuery = {
      ...(filterQuery || {}),
      $and: [
        {
          $or: [
            { batchName: { $regex: searchTerm, $options: "i" } },
            { name: { $regex: searchTerm, $options: "i" } },
            { description: { $regex: searchTerm, $options: "i" } },
          ],
        },
        ...(req.query.isActive !== undefined
          ? [{ isActive: req.query.isActive === "true" }]
          : []),
      ],
    };

    const params = {
      pageNo,
      pageSize,
      query: searchQuery,
      sort: sort || { createdAt: -1 },
      tenantId,
    };

    const result = await batchService.getAllBatches(params);
    return sendSuccessResponse(
      res,
      "Batches search completed successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get batch statistics (simplified - total and active only)
export const getBatchStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    const result = await batchService.getBatchStats(tenantId);
    return sendSuccessResponse(
      res,
      "Batch statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get batch statistics (detailed)
export const getBatchStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    const result = await batchService.getBatchStatistics(tenantId);
    return sendSuccessResponse(
      res,
      "Batch statistics retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

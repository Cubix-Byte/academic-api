import { Request, Response, NextFunction } from "express";
import * as partnerService from "../../services/partner.service";
import * as tenantService from "../../services/tenant.service";
import {
  sendErrorResponse,
  sendSuccessResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";
import { defaultPageLimit } from "shared-lib";
import mongoose from "mongoose";

/**
 * Partner Controller - Handles partner-related API endpoints
 */

// Get partner tenants
export const getPartnerTenants = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const pageNo = Number(req.query.pageNo) || 1;
    const pageSize = Number(req.query.pageSize) || defaultPageLimit;

    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return;

    const { query, sort } = queryResult;

    // Force filtering by partnerId
    const finalQuery = {
      ...query,
      partnerId: id,
    };

    const result = await tenantService.getTenants({
      pageNo,
      pageSize,
      filters: finalQuery,
      sort,
    });

    return sendSuccessResponse(
      res,
      "Partner tenants retrieved successfully",
      result
    );
  } catch (error: any) {
    console.error("Get partner tenants controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Create partner
export const createPartner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = {
      ...req.body,
      createdBy: req.user?.userName || req.user?.id || "system",
      updatedBy: req.user?.userName || req.user?.id || "system",
    };
    const result = await partnerService.createPartner(data);
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create partner controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get all partners
export const getAllPartners = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const pageNo = Number(req.query.pageNo) || 1;
    const pageSize = Number(req.query.pageSize) || defaultPageLimit;

    // Use shared property buildQueryFromRequest
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) return;

    const { query, sort } = queryResult;

    // Handle search parameter if provided
    let finalQuery = query || {};
    if (req.query.search) {
      finalQuery = {
        ...finalQuery,
        $or: [
          { companyName: { $regex: req.query.search, $options: "i" } },
          { supportEmail: { $regex: req.query.search, $options: "i" } },
          { partnersField: { $regex: req.query.search, $options: "i" } },
        ],
      };
    }

    const result = await partnerService.getAllPartners(
      pageNo,
      pageSize,
      finalQuery,
      sort
    );
    return sendSuccessResponse(res, "Partners retrieved successfully", result);
  } catch (error: any) {
    console.error("Get all partners controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get partner by ID
export const getPartnerById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await partnerService.getPartnerById(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get partner by ID controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update partner
export const updatePartner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data = {
      ...req.body,
      updatedBy: req.user?.userName || req.user?.id || "system",
    };
    const result = await partnerService.updatePartner(id, data);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update partner controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete partner
export const deletePartner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await partnerService.deletePartner(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete partner controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get partner statistics
export const getPartnerStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await partnerService.getPartnerStatistics();
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get partner statistics controller error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

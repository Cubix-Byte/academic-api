import { Request, Response, NextFunction } from "express";
import * as credentialTemplateService from "../../services/credentialTemplate.service";
import {
  CreateCredentialTemplateRequest,
  UpdateCredentialTemplateRequest,
} from "@/types/credentialTemplate.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
  defaultPageLimit,
} from "shared-lib";

/**
 * Credential Template Controller
 */

// Create credential template
export const createCredentialTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreateCredentialTemplateRequest = req.body;
    const createdBy = req.user?.id;
    const tenantId = req.user?.tenantId;

    // Debug logging
    console.log(
      "📝 [CREDENTIAL TEMPLATE] Request body:",
      JSON.stringify(data, null, 2)
    );
    console.log("📝 [CREDENTIAL TEMPLATE] Created by:", createdBy);
    console.log("📝 [CREDENTIAL TEMPLATE] Tenant ID:", tenantId);

    if (!createdBy || !tenantId) {
      return sendErrorResponse(
        res,
        "User ID and Tenant ID are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Validate required fields
    if (!data.meritBadge) {
      return sendErrorResponse(
        res,
        "meritBadge is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (!data.credentialType) {
      return sendErrorResponse(
        res,
        "credentialType is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (!data.validationPeriod) {
      return sendErrorResponse(
        res,
        "validationPeriod is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (!data.issuingCriteria) {
      return sendErrorResponse(
        res,
        "issuingCriteria is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (!data.credentialInfo) {
      return sendErrorResponse(
        res,
        "credentialInfo is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    res.status(201);
    const result = await credentialTemplateService.createCredentialTemplate(
      data,
      createdBy,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Credential template created successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    // Handle validation errors
    if (errorMessage.includes("validation failed")) {
      return sendErrorResponse(res, errorMessage, HttpStatusCodes.BAD_REQUEST);
    }
    next(error);
  }
};

// Get credential templates
export const getCredentialTemplates = async (
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

    // Build query and sort from request using generic filter pattern
    const queryResult = buildQueryFromRequest(req, res);
    if (!queryResult) {
      return; // Error response already sent by buildQueryFromRequest
    }

    const { query: filters, sort } = queryResult;

    // Extract pagination parameters
    const pageNo = parseInt(req.query.pageNo as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || defaultPageLimit;

    const params = {
      tenantId,
      pageNo,
      pageSize,
      filters,
      sort:
        Object.keys(sort).length > 0
          ? sort
          : ({ createdAt: -1 } as Record<string, 1 | -1>),
    };

    const result = await credentialTemplateService.getCredentialTemplates(
      params
    );
    return sendSuccessResponse(
      res,
      "Credential templates retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get credential template by ID
export const getCredentialTemplateById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await credentialTemplateService.getCredentialTemplateById(
      id,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Credential template retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Update credential template
export const updateCredentialTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const data: UpdateCredentialTemplateRequest = {
      ...req.body,
      credentialTemplateId: id,
    };
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await credentialTemplateService.updateCredentialTemplate(
      data,
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Credential template updated successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Delete credential template
export const deleteCredentialTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await credentialTemplateService.deleteCredentialTemplate(id, tenantId);
    return sendSuccessResponse(
      res,
      "Credential template deleted successfully",
      { id }
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

// Get credential repository
export const getCredentialRepository = async (
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

    const result = await credentialTemplateService.getCredentialRepository(
      tenantId
    );
    return sendSuccessResponse(
      res,
      "Credential repository retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

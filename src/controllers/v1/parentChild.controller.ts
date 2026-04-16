import { Request, Response, NextFunction } from "express";
import * as parentChildService from "../../services/parentChild.service";
import {
  HttpStatusCodes,
  sendErrorResponse,
} from "shared-lib";

// Create parent-child relationship
export const createParentChildRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { parentId, childId, relationship, isPrimary, notes } = req.body;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;

    if (!tenantId || !tenantName) {
      return sendErrorResponse(
        res,
        "Tenant ID and tenant name are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!parentId || !childId || !relationship) {
      return sendErrorResponse(
        res,
        "Parent ID, Child ID, and relationship are required",
        400
      );
    }

    const result = await parentChildService.createParentChildRelationship(
      parentId,
      childId,
      relationship,
      tenantId,
      tenantName,
      isPrimary || false,
      notes
    );
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Create parent-child relationship error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get children by parent ID
export const getChildrenByParentId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { parentId } = req.params;
    const result = await parentChildService.getChildrenByParentId(parentId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get children by parent ID error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get parents by child ID
export const getParentsByChildId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const result = await parentChildService.getParentsByChildId(childId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get parents by child ID error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Update parent-child relationship
export const updateParentChildRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const result = await parentChildService.updateParentChildRelationship(
      id,
      updateData
    );
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Update parent-child relationship error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Delete parent-child relationship
export const deleteParentChildRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await parentChildService.deleteParentChildRelationship(id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Delete parent-child relationship error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Set primary parent for a child
export const setPrimaryParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId, parentId } = req.body;

    if (!childId || !parentId) {
      return sendErrorResponse(res, "Child ID and Parent ID are required", 400);
    }

    const result = await parentChildService.setPrimaryParent(childId, parentId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Set primary parent error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get parent-child relationship statistics
export const getParentChildStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;
    const result = await parentChildService.getParentChildStatistics(tenantId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Get parent-child statistics error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

// Get child's subjects with assigned teachers
export const getChildSubjectsWithTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { childId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!childId) {
      return sendErrorResponse(res, "Child ID is required", 400);
    }

    console.log(
      "Fetching subjects and teachers for child ID:",
      childId,
      "Tenant ID:",
      tenantId
    );

    const result = await parentChildService.getChildSubjectsWithTeachers(
      childId,
      tenantId
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Get child subjects with teachers error:", error);
    sendErrorResponse(res, error.message, 500);
  }
};

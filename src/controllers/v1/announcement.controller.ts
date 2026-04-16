import { Request, Response, NextFunction } from "express";
import * as announcementService from "../../services/announcement.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Announcement Controller - HTTP handlers for announcement management
 */

// POST /api/v1/announcements - Create new announcement (admin only)
export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tenantId = req.user?.tenantId;
    const createdBy = req.user?.id;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    if (!createdBy) {
      return sendErrorResponse(
        res,
        "User ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const {
      title,
      message,
      category,
      targetAudience,
      startDate,
      endDate,
      isActive,
    } = req.body;

    if (!title || !message || !targetAudience || !startDate || !endDate) {
      return sendErrorResponse(
        res,
        "title, message, targetAudience, startDate and endDate are required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    if (!Array.isArray(targetAudience) || targetAudience.length === 0) {
      return sendErrorResponse(
        res,
        "targetAudience must be a non-empty array",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const announcement = await announcementService.createAnnouncement(
      {
        title,
        message,
        category,
        targetAudience,
        startDate,
        endDate,
        isActive,
      },
      tenantId,
      createdBy,
    );

    res.status(201);
    return sendSuccessResponse(
      res,
      "Announcement created successfully",
      announcement,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/announcements - Get all announcements for tenant (admin)
export const getAllAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const params = {
      tenantId,
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      search: req.query.search as string,
      isActive:
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined,
    };

    const result = await announcementService.getAllAnnouncements(params);
    return sendSuccessResponse(
      res,
      "Announcements retrieved successfully",
      result,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/announcements/active - Get active announcements for current user's role (banner)
export const getActiveAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const tenantId = req.user?.tenantId;
    const role = (req.user as any)?.roleName ?? (req.user as any)?.role ?? "";

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const announcements = await announcementService.getActiveAnnouncements(
      tenantId,
      role,
    );
    return sendSuccessResponse(
      res,
      "Active announcements retrieved successfully",
      announcements,
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/announcements/:id - Get single announcement
export const getAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return sendErrorResponse(
        res,
        "Announcement ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const announcement = await announcementService.getAnnouncementById(id);
    return sendSuccessResponse(
      res,
      "Announcement retrieved successfully",
      announcement,
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ANNOUNCEMENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Announcement not found",
        HttpStatusCodes.NOT_FOUND,
      );
    }
    next(error);
  }
};

// PUT /api/v1/announcements/:id - Update announcement
export const updateAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Announcement ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    const announcement = await announcementService.updateAnnouncement(
      id,
      req.body,
      tenantId,
    );
    return sendSuccessResponse(
      res,
      "Announcement updated successfully",
      announcement,
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ANNOUNCEMENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Announcement not found",
        HttpStatusCodes.NOT_FOUND,
      );
    }
    next(error);
  }
};

// DELETE /api/v1/announcements/:id - Soft-delete announcement
export const deleteAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!id) {
      return sendErrorResponse(
        res,
        "Announcement ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }
    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST,
      );
    }

    await announcementService.deleteAnnouncement(id, tenantId);
    return sendSuccessResponse(res, "Announcement deleted successfully", {});
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "ANNOUNCEMENT_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Announcement not found",
        HttpStatusCodes.NOT_FOUND,
      );
    }
    next(error);
  }
};

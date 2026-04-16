import { Router } from "express";
import * as announcementController from "../../controllers/v1/announcement.controller";

const router = Router();

/**
 * Announcement Routes - API endpoints for announcement management
 */

// GET /api/v1/announcements/active - Get active announcements for current user role (banner)
// Must be declared before /:id to avoid route conflicts
router.get("/active", announcementController.getActiveAnnouncements);

// POST /api/v1/announcements - Create new announcement
router.post("/", announcementController.createAnnouncement);

// GET /api/v1/announcements - Get all announcements (admin list with pagination)
router.get("/", announcementController.getAllAnnouncements);

// GET /api/v1/announcements/:id - Get single announcement by ID
router.get("/:id", announcementController.getAnnouncement);

// PUT /api/v1/announcements/:id - Update announcement
router.put("/:id", announcementController.updateAnnouncement);

// DELETE /api/v1/announcements/:id - Soft-delete announcement
router.delete("/:id", announcementController.deleteAnnouncement);

export default router;

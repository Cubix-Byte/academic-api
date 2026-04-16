import { Router } from "express";
import * as notificationController from "../../controllers/v1/notification.controller";
import { ROUTES } from "../../utils/constants/routes";

/**
 * Notification Routes
 * Handles all notification-related endpoints
 */
const router = Router();

/**
 * Test endpoint for sending notifications
 * POST /academy/api/v1/notifications/test
 */
router.post(
  ROUTES.NOTIFICATIONS.SUBROUTES.TEST,
  notificationController.testSendNotifications
);

export default router;


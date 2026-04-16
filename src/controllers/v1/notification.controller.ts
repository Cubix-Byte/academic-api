import { Request, Response, NextFunction } from "express";
import { sendNotifications, INotificationRequest } from "../../services/notification.service";
import {
  sendErrorResponse,
  sendSuccessResponse,
  HttpStatusCodes,
} from "../../utils/shared-lib-imports";

/**
 * Notification Controller
 * Handles HTTP requests for notification operations
 */

/**
 * Test endpoint for sending notifications
 * POST /academy/api/v1/notifications/test
 */
export const testSendNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notifications } = req.body as { notifications: INotificationRequest[] };

    // Validate input
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      sendErrorResponse(
        res,
        "Notifications array is required and cannot be empty",
        HttpStatusCodes.BAD_REQUEST
      );
      return;
    }

    // Call notification service
    const result = await sendNotifications(notifications);

    // Return success response
    sendSuccessResponse(
      res,
      `Successfully sent ${notifications.length} notification(s)`,
      result
    );
  } catch (error: any) {
    console.error("Test send notifications error:", error);
    sendErrorResponse(
      res,
      error.message || "Failed to send notifications",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};


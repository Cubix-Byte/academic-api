import { z } from "zod";

/**
 * Notification Request Validators
 * Zod schemas for validating notification requests
 */

/**
 * Single Notification Request Schema
 */
export const notificationRequestSchema = z.object({
  receiverId: z.string().min(1, "Receiver ID is required"),
  title: z.string().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
  content: z.string().min(1, "Content is required"),
  senderId: z.string().optional(),
  senderRole: z.string().optional(),
  receiverRole: z.string().optional(),
  tenantId: z.string().min(1, "Tenant ID is required"),
  meta: z
    .object({
      entityId: z.string().optional(),
      entityType: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Bulk Notification Request Schema
 */
export const bulkNotificationRequestSchema = z.object({
  notifications: z
    .array(notificationRequestSchema)
    .min(1, "At least one notification is required")
    .max(100, "Cannot send more than 100 notifications at once"),
});

/**
 * Type inference from schema
 */
export type NotificationRequest = z.infer<typeof notificationRequestSchema>;
export type BulkNotificationRequest = z.infer<typeof bulkNotificationRequestSchema>;


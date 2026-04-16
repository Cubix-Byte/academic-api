import axios from "axios";
import { bulkNotificationRequestSchema, NotificationRequest } from "../utils/requestValidators/notification.validator";

/**
 * Notification API Integration Service
 * Handles communication with notifications-api for sending web notifications and emails
 */

// Notifications API configuration
const BASE_URL = process.env.BASE_URL;
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY;

// Axios instance for notifications-api communication
const notificationsApiClient = axios.create({
  baseURL: `${BASE_URL}/notifications/api/v1/internal`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": INTERNAL_API_KEY,
  },
});

/**
 * Notification Request Interface (exported for convenience)
 */
export type INotificationRequest = NotificationRequest;

/**
 * Extract detailed error message from axios error
 */
const extractErrorMessage = (
  error: any,
  operation: string,
  url?: string
): string => {
  let errorMessage = "Unknown error";

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data = error.response.data;

    errorMessage = `HTTP ${status} ${statusText}`;
    if (data?.message) {
      errorMessage += `: ${data.message}`;
    } else if (data?.error) {
      errorMessage += `: ${data.error}`;
    } else if (typeof data === "string") {
      errorMessage += `: ${data}`;
    } else if (data) {
      errorMessage += `: ${JSON.stringify(data)}`;
    }
  } else if (error.request) {
    // The request was made but no response was received
    const baseUrl = url || `${BASE_URL}/notifications/api/v1/internal`;
    errorMessage = `No response received from notifications-api. URL: ${baseUrl}`;
    if (error.code === "ECONNREFUSED") {
      errorMessage = `Connection refused. Notifications API might be down at ${BASE_URL}`;
    } else if (error.code === "ETIMEDOUT") {
      errorMessage = `Request timeout connecting to notifications-api at ${BASE_URL}`;
    } else if (error.code) {
      errorMessage = `Network error (${error.code}): ${error.message}`;
    }
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message || "Unknown error";
  }

  console.error(`Detailed error for ${operation}:`, {
    message: errorMessage,
    operation,
    url: url || `${BASE_URL}/notifications/api/v1/internal`,
    hasApiKey: !!INTERNAL_API_KEY,
    errorCode: error.code,
    status: error.response?.status,
    responseData: error.response?.data,
  });

  return errorMessage;
};

/**
 * Send notifications (single or bulk)
 * Always sends as bulk request to notifications-api
 * 
 * @param notifications - Array of notification requests (even single notification should be in array)
 * @returns Promise with response data from notifications-api
 */
export const sendNotifications = async (
  notifications: INotificationRequest[]
): Promise<any> => {
  try {
    console.log(`📨 sendNotifications called with ${notifications.length} notification(s)`);
    console.log("🔍 Input notifications:", JSON.stringify(notifications, null, 2));
    
    // Validate using Zod schema
    const validatedData = bulkNotificationRequestSchema.parse({
      notifications,
    });
    console.log("✅ Validation passed");

    // Prepare request body for bulk notification endpoint
    const requestBody = {
      notifications: validatedData.notifications.map((notif) => ({
        receiverId: notif.receiverId,
        title: notif.title,
        content: notif.content,
        senderId: notif.senderId,
        senderRole: notif.senderRole,
        receiverRole: notif.receiverRole,
        meta: notif.meta,
        tenantId: notif.tenantId,
      })),
    };

    console.log("🌐 Calling notifications-api at:", `${BASE_URL}/notifications/api/v1/internal/send-bulk-notification`);
    console.log("📦 Request body:", JSON.stringify(requestBody, null, 2));
    console.log("🔑 API Key present:", !!INTERNAL_API_KEY);
    
    // Call notifications-api bulk endpoint
    const response = await notificationsApiClient.post(
      "/send-bulk-notification",
      requestBody
    );

    console.log("✅ Notifications API response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === "ZodError") {
      const validationErrors = error.errors
        .map((err: any) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      throw new Error(`Validation failed: ${validationErrors}`);
    }

    const errorMessage = extractErrorMessage(
      error,
      "sendNotifications",
      "/send-bulk-notification"
    );
    throw new Error(`Failed to send notifications: ${errorMessage}`);
  }
};

/**
 * Send email using template
 * 
 * @param recipientEmail - Email address of the recipient
 * @param templateName - Name of the template to use
 * @param templateParams - Parameters for template rendering
 * @param tenantId - Tenant ID
 * @param receiverId - Optional receiver ID
 * @returns Promise with response data from notifications-api
 */
export const sendEmailWithTemplate = async (
  recipientEmail: string,
  templateName: string,
  templateParams: Record<string, any>,
  tenantId: string,
  receiverId?: string
): Promise<any> => {
  try {
    // Debug: Log API key being used (first 10 chars only for security)
    console.log("🔑 DEBUG - API Key being sent:", INTERNAL_API_KEY ? `${INTERNAL_API_KEY.substring(0, 10)}...` : "NOT SET");
    console.log("🔑 DEBUG - BASE_URL:", BASE_URL);
    console.log("🔑 DEBUG - Full URL:", `${BASE_URL}/notifications/api/v1/internal/send-email-with-template`);

    const requestBody = {
      templateName,
      recipientEmail,
      templateParams,
      tenantId,
      receiverId,
    };

    // Call notifications-api email with template endpoint
    const response = await notificationsApiClient.post(
      "/send-email-with-template",
      requestBody
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "sendEmailWithTemplate",
      "/send-email-with-template"
    );
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

/**
 * Send bulk emails using template
 * 
 * @param emails - Array of email data with template info
 * @param tenantId - Tenant ID
 * @returns Promise with response data from notifications-api
 */
export const sendBulkEmailsWithTemplate = async (
  emails: Array<{
    recipientEmail: string;
    templateName: string;
    templateParams: Record<string, any>;
    receiverId?: string;
  }>,
  tenantId: string
): Promise<any> => {
  try {
    if (!emails || emails.length === 0) {
      throw new Error("At least one email is required");
    }

    // Validate max 100 emails per request (notifications-api limit)
    if (emails.length > 100) {
      throw new Error("Cannot send more than 100 emails at once");
    }

    // Render templates and prepare email data
    // Add tenantId to each email object (notifications-api controller checks data.emails[0]?.tenantId)
    const renderedEmails = emails.map((email) => {
      const rendered = renderAccountCreatedTemplate(email.templateParams);
      
      return {
        recipientEmail: email.recipientEmail,
        subject: rendered.subject,
        body: rendered.body,
        templateName: email.templateName,
        templateParams: email.templateParams,
        receiverId: email.receiverId,
        tenantId: tenantId, // Add tenantId from JWT token (extracted from request headers)
      };
    });

    const requestBody = {
      emails: renderedEmails,
    };

    // Call notifications-api bulk email endpoint
    const response = await notificationsApiClient.post(
      "/send-bulk-email",
      requestBody
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "sendBulkEmailsWithTemplate",
      "/send-bulk-email"
    );
    throw new Error(`Failed to send bulk emails: ${errorMessage}`);
  }
};

/**
 * Get role-based features
 */
const getRoleFeatures = (role: string): string[] => {
  const roleLower = role.toLowerCase();
  
  if (roleLower === "teacher") {
    return [
      "Create and manage assignments for your classes",
      "Evaluate student submissions and assign grades",
      "Track student performance and academic progress"
    ];
  } else if (roleLower === "parent") {
    return [
      "View your child's academic performance and grades",
      "Track assignments and exam progress",
      "Stay informed about your child's school activities"
    ];
  } else if (roleLower === "student") {
    return [
      "View and submit assignments online",
      "Attempt exams and track your results",
      "Check grades and academic performance"
    ];
  }
  
  return [];
};

/**
 * Render account-created email template
 * This is a simplified version that matches the notifications-api template
 */
const renderAccountCreatedTemplate = (
  params: Record<string, any>
): { subject: string; body: string } => {
  // Import generateLoginUrl helper
  const { generateLoginUrl } = require("../utils/email.helper");
  
  const {
    title = "Welcome onboard",
    userName = "",
    role = "Teacher",
    email = "",
    password = "",
    loginUrl: providedLoginUrl,
    tenantName = "Brighton AI Education",
    partnerName = "Brighton AI",
    features = null, // Can be passed explicitly, or will be auto-generated from role
  } = params;
  
  // Generate login URL if not provided, using tenantName
  const loginUrl = generateLoginUrl(tenantName);

  // Get features based on role if not provided
  const roleFeatures = features || getRoleFeatures(role);

  // Simple template variable replacement
  const replaceVars = (template: string): string => {
    let result = template
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{userName\}\}/g, userName)
      .replace(/\{\{role\}\}/g, role)
      .replace(/\{\{email\}\}/g, email)
      .replace(/\{\{password\}\}/g, password)
      .replace(/\{\{loginUrl\}\}/g, loginUrl)
      .replace(/\{\{tenantName\}\}/g, tenantName)
      .replace(/\{\{partnerName\}\}/g, partnerName);

    // Handle features section (Handlebars-like syntax)
    // Process {{#each features}} blocks first
    const eachRegex = /\{\{#each\s+features\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (match, content) => {
      if (roleFeatures && roleFeatures.length > 0) {
        return roleFeatures
          .map((feature: string) => {
            // Replace {{this}} with the current feature
            return content.replace(/\{\{this\}\}/g, feature);
          })
          .join("");
      }
      return ""; // Return empty if no features
    });

    // Then process {{#if features}} blocks
    const ifRegex = /\{\{#if\s+features\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(ifRegex, (match, content) => {
      if (roleFeatures && roleFeatures.length > 0) {
        return content; // Return content if features exist
      }
      return ""; // Return empty if no features
    });

    return result;
  };

  const subject = title;

  const body = replaceVars(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background-color: #f4f4f4;
      padding: 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: #10514e;
      color: #ffffff;
      padding: 30px 20px;
      text-align: center;
    }
    .email-header h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .email-body {
      padding: 40px 30px;
      color: #333333;
    }
    .email-body h2 {
      font-size: 20px;
      margin-bottom: 15px;
    }
    .email-body p {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 15px;
      color: #666666;
    }
    .role-badge {
      display: inline-block;
      background-color: #667eea;
      color: #ffffff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .credentials-box {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 25px;
      margin: 25px 0;
    }
    .credential-item {
      margin-bottom: 15px;
    }
    .credential-label {
      font-size: 13px;
      color: #999999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .credential-value {
      font-size: 16px;
      font-weight: 600;
      color: #333333;
      word-break: break-all;
    }
    .login-button {
      display: inline-block;
      margin-top: 20px;
      background-color: #10514e;
      color: #ffffff !important;
      padding: 12px 25px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 500;
    }
    .warning-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-top: 25px;
      border-radius: 4px;
    }
    .warning-box p {
      font-size: 14px;
      color: #856404;
      margin: 0;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .email-footer p {
      font-size: 12px;
      color: #999999;
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${tenantName}</h1>
      <p>${title} 🎉</p>
    </div>
    <div class="email-body">
      <h2>Congratulations ${userName}! 🎉</h2>
      <p>
        Your account has been successfully created as a
        <strong>${role}</strong>.
      </p>
      <!-- ✅ FEATURES SECTION -->
      {{#if features}}
        <p><strong>Features available to you:</strong></p>
        <ul style="padding-left: 20px; margin-bottom: 15px; color: #666666;">
          {{#each features}}
            <li style="margin-bottom: 8px;">{{this}}</li>
          {{/each}}
        </ul>
      {{/if}}
      <!-- ✅ END FEATURES SECTION -->
      <p>Please use the following credentials to log in:</p>
      <div class="credentials-box">
        <div class="credential-item">
          <div class="credential-label">Email</div>
          <div class="credential-value">${email}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Password</div>
          <div class="credential-value">${password}</div>
        </div>
        <div class="credential-item">
          <div class="credential-label">Login URL</div>
          <div class="credential-value">${loginUrl}</div>
        </div>
        <a href="${loginUrl}" class="login-button">Login to Your Account</a>
      </div>
      <div class="warning-box">
        <p>
          <strong>🔐 Security Tip:</strong>
          Please change your password after your first login.
        </p>
      </div>
    </div>
    <div class="email-footer">
      <p>This is an automated email. Please do not reply.</p>
      <p>&copy; 2026 ${partnerName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `);

  return { subject, body };
};

/**
 * Health check for notifications-api
 */
export const healthCheck = async (): Promise<any> => {
  try {
    const response = await notificationsApiClient.get("/health");
    return response.data;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "healthCheck",
      "/health"
    );
    throw new Error(`Notifications API health check failed: ${errorMessage}`);
  }
};


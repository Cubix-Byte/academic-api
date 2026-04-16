import mongoose from "mongoose";
import * as notificationService from "../services/notification.service";
import { generateRandomPassword } from "./password.helper";
import { UserApiIntegrationService } from "../services/userApiIntegration.service";
import * as tenantRepository from "../repositories/tenant.repository";

export async function getRoleDisplayNameForTenant(params: {
  tenantId: string;
  role: "Student" | "Teacher" | "Parent" | "PRIMARYADMIN";
}): Promise<string> {
  const { tenantId, role } = params;
  try {
    const tenant: any = await tenantRepository.findTenantById(tenantId);
    const perms: any[] = Array.isArray(tenant?.permissions) ? tenant.permissions : [];
    const permissionType =
      role === "PRIMARYADMIN"
        ? 1
        : role === "Teacher"
          ? 2
          : role === "Student"
            ? 3
            : 4;
    const matched = perms.find((p) => Number(p?.type) === permissionType);
    if (matched?.displayName && String(matched.displayName).trim().length > 0) {
      return String(matched.displayName).trim();
    }
  } catch {
    // Non-blocking: fall back below
  }
  return role;
}

/**
 * Generate login URL based on environment and tenant name
 * @param tenantName - Tenant name (e.g., "nbhs", "school1")
 * @returns Login URL string
 */
export function generateLoginUrl(tenantName?: string): string {
  // If LOGIN_URL is explicitly set in environment, use it
  // if (process.env.LOGIN_URL) {
  //   return process.env.LOGIN_URL;
  // }

  // For development environment, use localhost
  // if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
  //   return "http://localhost:3000/auth/login";
  // }

  // Construct URL with tenant name based on environment
  if (tenantName) {
    // Sanitize tenant name (remove spaces, special chars, convert to lowercase)
    const sanitizedTenantName = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    
    // Check environment to determine domain
    // Development: https://{{tenantName}}.dev.cognify.education/auth/login
    // Production: https://{{tenantName}}.cognify.education/auth/login
    const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "staging" || !process.env.NODE_ENV;
    const domain = isDevelopment 
      ? `${sanitizedTenantName}.dev.cognify.education`
      : `${sanitizedTenantName}.cognify.education`;
    
    return `https://${domain}/auth/login`;
  }

  // Fallback to localhost if no tenant name provided
  return "http://localhost:3000/auth/login";
}

/**
 * Get partner name from database
 * Flow: tenantId -> query tenants collection -> get partnerId -> query partners collection -> get companyName
 */
async function getPartnerNameFromDatabase(
  tenantId: string,
  fallbackName: string = "Brighton AI"
): Promise<string> {
  try {
    const tenantsCollection = mongoose.connection.db?.collection("tenants");
    if (tenantsCollection) {
      const tenantDoc = await tenantsCollection.findOne({
        _id: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
        isDeleted: false,
      });

      const partnerId = tenantDoc?.partnerId;

      if (partnerId) {
        const partnersCollection = mongoose.connection.db?.collection("partners");
        if (partnersCollection) {
          const partnerDoc = await partnersCollection.findOne({
            _id: new mongoose.Types.ObjectId(partnerId),
            isActive: true,
            isDeleted: false,
          });

          if (partnerDoc?.companyName) {
            return partnerDoc.companyName;
          }
        }
      }
    }
  } catch (error: any) {
    console.warn(
      "⚠️ Could not fetch partner data from database, using fallback:",
      error.message
    );
  }

  return fallbackName;
}

/**
 * Send welcome email to user
 * @param email - Recipient email
 * @param firstName - User first name
 * @param lastName - User last name
 * @param role - Role type: "Student" | "Teacher" | "Parent" | "PRIMARYADMIN"
 * @param tenantId - Tenant ID
 * @param tenantName - Tenant name
 * @param userId - User ID (optional)
 * @param password - Password to use in email (optional, will generate random if not provided and userId is provided)
 * @returns Promise<void>
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  lastName: string,
  role: "Student" | "Teacher" | "Parent" | "PRIMARYADMIN",
  tenantId: string,
  tenantName?: string,
  userId?: string,
  password?: string
): Promise<void> {
  try {
    const roleKey = role;
    const loginUrl = generateLoginUrl(tenantName);
    const userName = `${firstName} ${lastName}`;
    const finalTenantName = tenantName || "Brighton AI Education";

    // Get partner name from database
    const partnerName = await getPartnerNameFromDatabase(tenantId, finalTenantName);

    // Role-specific features
    const features =
      roleKey === "Student"
        ? [
            "View and submit assignments online",
            "Attempt exams and track your results",
            "Check grades and academic performance",
          ]
        : roleKey === "Teacher"
          ? [
              "Create and manage assignments for your classes",
              "Evaluate student submissions and assign grades",
              "Track student performance and academic progress",
            ]
          : roleKey === "PRIMARYADMIN"
            ? [
                "Manage all schools, users, and roles across the platform",
                "Monitor academic performance and analytics for all schools",
                "Configure system settings and oversee platform operations",
              ]
            : [
                "View your child's academic performance and grades",
                "Track assignments and exam progress",
                "Stay informed about your child's school activities",
              ];

    const roleDisplayName = await getRoleDisplayNameForTenant({
      tenantId,
      role: roleKey,
    });

    // Use provided password or generate random password
    let emailPassword = password;
    
    // If password not provided and userId is provided, generate random password and update user
    if (!emailPassword && userId) {
      emailPassword = generateRandomPassword();
      try {
        console.log(`🔐 Updating password for userId: ${userId}, email: ${email}`);
        await UserApiIntegrationService.updateUser(userId, {
          password: emailPassword,
        });
        console.log(`✅ User password updated in user-api for userId: ${userId}`);
      } catch (updateError: any) {
        console.error(`⚠️ Failed to update user password in user-api:`, updateError.message);
        console.error(`⚠️ Update error details:`, updateError);
        // Continue to send email even if password update fails
      }
    } else if (!emailPassword) {
      // If no password provided and no userId, generate random password for display only
      emailPassword = generateRandomPassword();
      console.warn(`⚠️ No password provided and no userId, using generated password for email display only: ${email}`);
    }

    const templateParams = {
      title: "Welcome onboard",
      userName: userName,
      role: roleDisplayName,
      email: email,
      password: emailPassword,
      loginUrl: loginUrl,
      tenantName: finalTenantName,
      partnerName: partnerName,
      features: features,
    };

    console.log(`📧 Sending welcome email to ${roleKey.toLowerCase()}:`, email);

    // Send email asynchronously
    await notificationService.sendEmailWithTemplate(
      email,
      "account-created",
      templateParams,
      tenantId,
      userId
    );

    console.log(`✅ Welcome email sent successfully to ${email}`);
  } catch (error: any) {
    console.error(`⚠️ Failed to send welcome email to ${email}:`, error.message);
    throw error;
  }
}


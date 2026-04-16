import mongoose from "mongoose";
import * as adminRepository from "../repositories/admin.repository";
import * as tenantRepository from "../repositories/tenant.repository";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { sendWelcomeEmail } from "../utils/email.helper";
import * as notificationService from "./notification.service";

/**
 * Admin Service
 * Business logic for Admin management
 */

export const getAllAdmins = async () => {
    return await adminRepository.getAllAdmins();
};

/**
 * Internal method to create admin record (used by tenant service)
 */
export const createAdminRecord = async (adminData: any) => {
    return await adminRepository.createAdmin(adminData);
};

/**
 * Create a new admin (academicAdmin, coordinateAdmin, gradingAdmin, financeAdmin, teacherAdmin, or studentAdmin)
 * Only PRIMARYADMIN can create additional admins
 */
export const createAdmin = async (
    adminData: {
        firstName: string;
        lastName: string;
        username: string;
        email: string;
        password: string;
        phoneNumber?: string;
        address?: string;
        role: "ACADEMICADMIN" | "COORDINATEADMIN" | "GRADINGADMIN" | "FINANCEADMIN" | "TEACHERADMIN" | "STUDENTADMIN";
    },
    tenantId: string,
    createdById?: string,
    createdByRole?: string
) => {
    // Validate role
    const validAdminRoles = ["ACADEMICADMIN", "COORDINATEADMIN", "GRADINGADMIN", "FINANCEADMIN", "TEACHERADMIN", "STUDENTADMIN"];
    if (!validAdminRoles.includes(adminData.role)) {
        throw new Error(`Role must be one of: ${validAdminRoles.join(", ")}`);
    }

    // Check if email or username already exists in this tenant
    const userExists = await UserApiIntegrationService.checkUserExists(
        adminData.email,
        adminData.username,
        tenantId
    );

    if (userExists.exists) {
        throw new Error("Admin with this email or username already exists in this tenant");
    }

    // Validate tenantId
    if (!tenantId) {
        throw new Error("Tenant ID is required");
    }

    // Convert tenantId string to ObjectId (same pattern as teacher/student services)
    const tenantObjectId = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : null;

    if (!tenantObjectId) {
        throw new Error("Invalid tenant ID format");
    }

    // Get tenant to get tenantName (optional - only for tenantName)
    let tenantName: string | undefined;
    try {
        const tenant = await tenantRepository.findTenantById(tenantId);
        tenantName = tenant?.tenantName;
    } catch (error) {
        console.warn("Failed to fetch tenant name, continuing without it:", error);
    }

    // Generate shared ID for admin and user (same entity)
    const sharedAdminUserId = new mongoose.Types.ObjectId();

    // Create admin in academic-api
    const admin = await adminRepository.createAdmin({
        _id: sharedAdminUserId,
        username: adminData.username,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email,
        password: adminData.password, // Stored for reference
        phoneNumber: adminData.phoneNumber,
        address: adminData.address,
        tenantId: tenantObjectId,
        createdBy: "academic-api",
    });

    // Create admin user in user-api with same shared ID
    try {
        const adminUserData = {
            _id: sharedAdminUserId.toString(),
            username: adminData.username.toLowerCase(),
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email,
            password: adminData.password,
            phoneNumber: adminData.phoneNumber,
            tenantId: tenantObjectId.toString(),
            tenantName: tenantName || "",
            userType: "admin",
            roleName: adminData.role, // ACADEMICADMIN, COORDINATEADMIN, GRADINGADMIN, FINANCEADMIN, TEACHERADMIN, or STUDENTADMIN
            userAccessType: "private",
            isEmailVerified: false,
            isActive: true,
            createdBy: "academic-api",
        };

        await UserApiIntegrationService.createUser(adminUserData);
    } catch (error: any) {
        // If user creation fails, delete the admin record we just created
        const Admin = (await import("../models/admin.schema")).default;
        await Admin.findOneAndUpdate(
            { _id: admin._id },
            { $set: { isDeleted: true } }
        );

        if (
            error.message?.includes("USERNAME_EXISTS") ||
            error.message?.includes("EMAIL_EXISTS") ||
            error.message?.includes("Duplicate key error") ||
            error.response?.status === 409
        ) {
            throw new Error(
                `User with email ${adminData.email} or username ${adminData.username} already exists`
            );
        }
        throw new Error(`Failed to create admin user in user-api: ${error.message}`);
    }

    // ===== SEND NOTIFICATIONS =====
    // 1) Notify PRIMARYADMIN (superadmin) who created the admin
    // 2) Welcome notification to the newly created admin
    try {
        const tenantIdString = tenantObjectId.toString();
        const newAdminUserIdString = sharedAdminUserId.toString();

        const createdByIdString = createdById
            ? (typeof createdById === "string" ? createdById : String(createdById))
            : undefined;

        const superAdminRole = createdByRole || "PRIMARYADMIN";
        const newAdminName = `${adminData.firstName} ${adminData.lastName}`.trim();

        const notifications: notificationService.INotificationRequest[] = [];

        // Notify superadmin (creator)
        if (
            createdByIdString &&
            mongoose.Types.ObjectId.isValid(createdByIdString) &&
            mongoose.Types.ObjectId.isValid(tenantIdString)
        ) {
            notifications.push({
                receiverId: createdByIdString,
                receiverRole: superAdminRole,
                title: "Admin Created Successfully",
                content: `You have successfully created a new admin account for ${newAdminName} (${adminData.email}) with role ${adminData.role}.`,
                senderId: newAdminUserIdString, // valid ObjectId (shared user/admin id)
                senderRole: adminData.role,
                tenantId: tenantIdString,
                meta: {
                    entityId: admin._id.toString(),
                    entityType: "Admin",
                    adminId: admin._id.toString(),
                    adminName: newAdminName,
                    adminEmail: adminData.email,
                    adminRole: adminData.role,
                },
            });
        }

        // Welcome new admin
        notifications.push({
            receiverId: newAdminUserIdString,
            receiverRole: adminData.role,
            title: "Welcome to the Platform!",
            content: `Welcome ${newAdminName}! Your admin account has been successfully created. You can now log in and start managing your tenant.`,
            senderId:
                createdByIdString && mongoose.Types.ObjectId.isValid(createdByIdString)
                    ? createdByIdString
                    : undefined,
            senderRole:
                createdByIdString && mongoose.Types.ObjectId.isValid(createdByIdString)
                    ? superAdminRole
                    : "SYSTEM",
            tenantId: tenantIdString,
            meta: {
                entityId: admin._id.toString(),
                entityType: "Admin",
                adminId: admin._id.toString(),
                adminName: newAdminName,
                adminEmail: adminData.email,
                adminRole: adminData.role,
            },
        });

        if (notifications.length > 0) {
            notificationService
                .sendNotifications(notifications)
                .then(() => {
                    console.log(
                        `✅ Sent ${notifications.length} notification(s) for admin creation`
                    );
                })
                .catch((err: any) => {
                    console.error(
                        "⚠️ Failed to send admin creation notifications:",
                        err.message
                    );
                });
        }
    } catch (notificationError: any) {
        console.error(
            "⚠️ Error preparing admin creation notifications:",
            notificationError.message
        );
    }

    return admin;
};

export const getAdminByTenantId = async (tenantId: string) => {
    const admin = await adminRepository.findAdminByTenantId(tenantId);
    if (!admin) {
        throw new Error("Admin not found for this tenant");
    }
    return admin;
};

export const getAdminsByTenantIds = async (tenantIds: string[]) => {
    return await adminRepository.findAdminsByTenantIds(tenantIds);
};

export const getAdminByEmail = async (email: string) => {
    return await adminRepository.findAdminByEmail(email);
};

export const updateAdmin = async (tenantId: string, updateData: any) => {
    const admin = await adminRepository.updateAdmin(tenantId, updateData);
    if (!admin) {
        throw new Error("Admin not found or failed to update");
    }
    return admin;
};

export const deleteAdmin = async (tenantId: string) => {
    const admin = await adminRepository.deleteAdmin(tenantId);
    if (!admin) {
        throw new Error("Admin not found or failed to delete");
    }
    return admin;
};

/**
 * Get tenant context by admin ID
 * Returns the tenantId for the given admin ID
 */
export const getAdminTenantContext = async (adminId: string) => {
    const admin = await adminRepository.findAdminById(adminId);
    if (!admin) {
        throw new Error("Admin not found");
    }

    // Return tenant context
    return {
        tenantId: admin.tenantId?.toString() || admin.tenantId,
        adminId: admin._id?.toString() || admin.id,
    };
};

/**
 * Resend welcome email to PRIMARYADMIN (tenant primary admin)
 * Flow matches student/teacher/parent resend: lookup record, validate email, then sendWelcomeEmail.
 * NOTE: sendWelcomeEmail will generate a new random password and attempt to update it in user-api (because we don't pass a password here).
 */
export const resendPrimaryAdminEmail = async (adminId: string) => {
    try {
        const admin = await adminRepository.findAdminById(adminId);
        if (!admin) {
            throw new Error("Admin not found");
        }

        if (!(admin as any).email) {
            throw new Error("Admin does not have an email address");
        }

        const tenantId =
            (admin as any).tenantId?.toString?.() || (admin as any).tenantId;
        if (!tenantId) {
            throw new Error("Admin tenant ID is missing");
        }

        // Fetch tenantName for correct login URL subdomain construction
        let tenantName: string | undefined;
        try {
            const tenant = await tenantRepository.findTenantById(tenantId);
            tenantName = (tenant as any)?.tenantName;
        } catch {
            tenantName = undefined;
        }

        await sendWelcomeEmail(
            (admin as any).email,
            (admin as any).firstName,
            (admin as any).lastName,
            "PRIMARYADMIN",
            tenantId,
            tenantName,
            (admin as any)._id?.toString?.() || (admin as any).id || adminId
        );

        return {
            success: true,
            message: "Welcome email sent successfully",
        };
    } catch (error: any) {
        console.error("Resend PRIMARYADMIN email error:", error);
        throw new Error(`Failed to resend email: ${error.message}`);
    }
};

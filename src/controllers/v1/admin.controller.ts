import { Request, Response } from "express";
import * as adminService from "../../services/admin.service";
import {
    sendSuccessResponse,
    sendErrorResponse,
    HttpStatusCodes,
} from "../../utils/shared-lib-imports";

/**
 * Admin Controller
 * Handles HTTP requests for Admin operations
 */

export const getAllAdmins = async (req: Request, res: Response) => {
    try {
        const admins = await adminService.getAllAdmins();
        return sendSuccessResponse(res, "Admins retrieved successfully", admins);
    } catch (error: any) {
        console.error("Get all admins error:", error);
        return sendErrorResponse(res, error.message, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
};

export const getAdminByTenantId = async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        const admin = await adminService.getAdminByTenantId(tenantId);
        return sendSuccessResponse(res, "Admin retrieved successfully", admin);
    } catch (error: any) {
        console.error("Get admin by tenant ID error:", error);
        const statusCode = error.message === "Admin not found for this tenant"
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const updateAdmin = async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        const admin = await adminService.updateAdmin(tenantId, req.body);
        return sendSuccessResponse(res, "Admin updated successfully", admin);
    } catch (error: any) {
        console.error("Update admin error:", error);
        const statusCode = error.message.includes("not found")
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const deleteAdmin = async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        await adminService.deleteAdmin(tenantId);
        return sendSuccessResponse(res, "Admin deleted successfully");
    } catch (error: any) {
        console.error("Delete admin error:", error);
        const statusCode = error.message.includes("not found")
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const createAdmin = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const tenantId = req.user?.tenantId;

        if (!userId) {
            return sendErrorResponse(
                res,
                "User ID is required",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        if (!tenantId) {
            return sendErrorResponse(
                res,
                "Tenant ID is required",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        // Verify user is PRIMARYADMIN
        if (req.user?.roleName !== "PRIMARYADMIN") {
            return sendErrorResponse(
                res,
                "Only primary admin can create additional admins",
                HttpStatusCodes.FORBIDDEN
            );
        }

        // Validate required fields
        const { firstName, lastName, username, email, password, phoneNumber, address, role } = req.body;
        if (!firstName || !lastName || !username || !email || !password || !role) {
            return sendErrorResponse(
                res,
                "First name, last name, username, email, password, and role are required",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        // Validate role
        const validAdminRoles = ["ACADEMICADMIN", "COORDINATEADMIN", "GRADINGADMIN", "FINANCEADMIN", "TEACHERADMIN", "STUDENTADMIN"];
        if (!validAdminRoles.includes(role)) {
            return sendErrorResponse(
                res,
                `Role must be one of: ${validAdminRoles.join(", ")}`,
                HttpStatusCodes.BAD_REQUEST
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendErrorResponse(
                res,
                "Invalid email format",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        // Validate password length
        if (password.length < 6) {
            return sendErrorResponse(
                res,
                "Password must be at least 6 characters long",
                HttpStatusCodes.BAD_REQUEST
            );
        }

        const adminData = {
            firstName,
            lastName,
            username,
            email,
            password,
            phoneNumber,
            address,
            role,
        };

        const createdById = req.user?.id || req.user?.userId;
        const createdByRole = req.user?.roleName || req.user?.role || "PRIMARYADMIN";

        const admin = await adminService.createAdmin(
            adminData,
            tenantId,
            createdById,
            createdByRole
        );
        return sendSuccessResponse(res, "Admin created successfully", admin);
    } catch (error: any) {
        console.error("Create admin error:", error);
        const statusCode = error.message.includes("already exists")
            ? HttpStatusCodes.CONFLICT
            : error.message.includes("Only primary admin")
            ? HttpStatusCodes.FORBIDDEN
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

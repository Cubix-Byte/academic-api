import { Request, Response } from "express";
import * as tenantService from "../../services/tenant.service";
import * as gradingSystemRepository from "../../repositories/gradingSystem.repository";
import {
    sendSuccessResponse,
    sendErrorResponse,
    HttpStatusCodes,
    buildQueryFromRequest,
} from "../../utils/shared-lib-imports";

/**
 * Tenant Controller
 * Handles HTTP requests for Tenant operations
 */

// Map permission type to name
const getPermissionNameFromType = (type: number): string => {
    const typeToName: Record<number, string> = {
        1: "Admin",
        2: "Teacher",
        3: "Student",
        4: "Parent",
    };
    return typeToName[type] || "";
};

export const createTenant = async (req: Request, res: Response) => {
    try {
        const authToken = req.headers.authorization;
        // Get superadmin ID and role who created the tenant (if available)
        const createdById = req.user?.id; // Superadmin who created the tenant
        const createdByRole = req.user?.roleName || req.user?.role || "SUPERADMIN"; // Role of the user creating the tenant
        
        const tenant = await tenantService.createTenant(
            req.body, 
            authToken,
            createdById,
            createdByRole
        );
        return sendSuccessResponse(res, "Tenant created successfully", tenant);
    } catch (error: any) {
        console.error("Create tenant error:", error);
        return sendErrorResponse(
            res,
            error.message || "Failed to create tenant",
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

export const getAllTenants = async (req: Request, res: Response) => {
    try {
        const queryResult = buildQueryFromRequest(req, res);
        if (!queryResult) return;

        const { query, sort } = queryResult;

        // Remove pagination params from query filters to prevent countDocuments issues
        delete query.pageNo;
        delete query.pageSize;
        delete query.page;
        delete query.limit;

        const pageNo = Number(req.query.pageNo) || 1;
        const pageSize = Number(req.query.pageSize) || 10;

        const result = await tenantService.getTenants({
            pageNo,
            pageSize,
            filters: query,
            sort,
        });

        // Add name field to permissions for each tenant in the result
        if (result.tenants && Array.isArray(result.tenants)) {
            result.tenants = result.tenants.map((tenant: any) => {
                const tenantObj = (tenant as any).toObject ? (tenant as any).toObject() : { ...tenant };
                if (tenantObj.permissions && Array.isArray(tenantObj.permissions)) {
                    tenantObj.permissions = tenantObj.permissions.map((perm: any) => ({
                        ...perm,
                        name: perm.name || getPermissionNameFromType(perm.type),
                    }));
                }
                return tenantObj;
            });
        }

        return sendSuccessResponse(res, "Tenants retrieved successfully", result);
    } catch (error: any) {
        console.error("Get all tenants error:", error);
        return sendErrorResponse(
            res,
            error.message || "Failed to retrieve tenants",
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

export const getTenantById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const tenant = await tenantService.getTenantById(id);

        // Convert to object for response
        const tenantResponse = (tenant as any).toObject ? (tenant as any).toObject() : { ...tenant };

        // Add name field to permissions based on type if not already present
        if (tenantResponse.permissions && Array.isArray(tenantResponse.permissions)) {
            tenantResponse.permissions = tenantResponse.permissions.map((perm: any) => ({
                ...perm,
                name: perm.name || getPermissionNameFromType(perm.type),
            }));
        }

        return sendSuccessResponse(res, "Tenant retrieved successfully", tenantResponse);
    } catch (error: any) {
        console.error("Get tenant by ID error:", error);
        const statusCode = error.message === "Tenant not found"
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const getTenantByName = async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const tenant = await tenantService.getTenantByTenantName(name);

        // Convert to object for response
        const tenantResponse = (tenant as any).toObject ? (tenant as any).toObject() : { ...tenant };

        // Add name field to permissions based on type if not already present
        if (tenantResponse.permissions && Array.isArray(tenantResponse.permissions)) {
            tenantResponse.permissions = tenantResponse.permissions.map((perm: any) => ({
                ...perm,
                name: perm.name || getPermissionNameFromType(perm.type),
            }));
        }

        // Append gradeRanges from grading system (by tenantId) for this tenant
        const tenantId = tenantResponse._id?.toString?.() || tenantResponse.id;
        if (tenantId) {
            const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(tenantId);
            tenantResponse.gradingGradeRanges = gradingSystem?.gradeRanges ?? [];
        } else {
            tenantResponse.gradingGradeRanges = [];
        }

        return sendSuccessResponse(res, "Tenant retrieved successfully", tenantResponse);
    } catch (error: any) {
        console.error("Get tenant by name error:", error);
        const statusCode = error.message === "Tenant not found"
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const updateTenant = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authToken = req.headers.authorization;
        // Get superadmin ID and role who updated the tenant (if available)
        const updatedById = req.user?.id; // Superadmin who updated the tenant
        const updatedByRole = req.user?.roleName || req.user?.role || "SUPERADMIN"; // Role of the user updating the tenant
        
        const tenant = await tenantService.updateTenant(
            id, 
            req.body, 
            authToken,
            updatedById,
            updatedByRole
        );
        return sendSuccessResponse(res, "Tenant updated successfully", tenant);
    } catch (error: any) {
        console.error("Update tenant error:", error);
        const statusCode = error.message.includes("not found")
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const deleteTenant = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await tenantService.deleteTenant(id);
        return sendSuccessResponse(res, "Tenant deleted successfully");
    } catch (error: any) {
        console.error("Delete tenant error:", error);
        const statusCode = error.message.includes("not found")
            ? HttpStatusCodes.NOT_FOUND
            : HttpStatusCodes.INTERNAL_SERVER_ERROR;
        return sendErrorResponse(res, error.message, statusCode);
    }
};

export const getTenantsDDL = async (req: Request, res: Response) => {
    try {
        const tenants = await tenantService.getTenantsDDL();
        return sendSuccessResponse(res, "Tenant DDL retrieved successfully", tenants);
    } catch (error: any) {
        console.error("Get tenant DDL error:", error);
        return sendErrorResponse(
            res,
            error.message || "Failed to retrieve tenant DDL",
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

export const getTenantStats = async (req: Request, res: Response) => {
    try {
        const stats = await tenantService.getTenantStats();
        return sendSuccessResponse(res, "Tenant stats retrieved successfully", stats);
    } catch (error: any) {
        console.error("Get tenant stats error:", error);
        return sendErrorResponse(
            res,
            error.message || "Failed to retrieve tenant statistics",
            HttpStatusCodes.INTERNAL_SERVER_ERROR
        );
    }
};

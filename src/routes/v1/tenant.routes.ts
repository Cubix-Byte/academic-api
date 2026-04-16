import { Router } from "express";
import * as tenantController from "../../controllers/v1/tenant.controller";
import { ROUTES } from "../../utils/constants/routes";

const router = Router();

/**
 * Tenant Routes
 * Version: v1
 */

// Get all tenants (listing with filters)
router.get("/", tenantController.getAllTenants);

// Get tenant DDL (dropdown list)
router.get("/ddl", tenantController.getTenantsDDL);

// Get tenant statistics
router.get("/stats", tenantController.getTenantStats);

// Get tenant by ID
router.get("/:id", tenantController.getTenantById);

// Get tenant by name
router.get(ROUTES.TENANTS.SUBROUTES.NAME, tenantController.getTenantByName);

// Create new tenant
router.post("/", tenantController.createTenant);

// Update tenant
router.put("/:id", tenantController.updateTenant);

// Delete tenant (soft delete)
router.delete("/:id", tenantController.deleteTenant);

export default router;

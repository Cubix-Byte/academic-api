import { Router } from "express";
import * as adminController from "../../controllers/v1/admin.controller";

const router = Router();

/**
 * Admin Routes
 * @route GET /api/v1/admins - Get all admins
 * @route POST /api/v1/admins - Create new admin (primary admin only)
 * @route GET /api/v1/admins/tenant/:tenantId - Get admin by tenant ID
 * @route PUT /api/v1/admins/tenant/:tenantId - Update admin by tenant ID
 * @route DELETE /api/v1/admins/tenant/:tenantId - Delete admin by tenant ID
 */

// Root route - must come before parameterized routes
router.get("/", adminController.getAllAdmins);
router.post("/", adminController.createAdmin);

router.get("/tenant/:tenantId", adminController.getAdminByTenantId);
router.put("/tenant/:tenantId", adminController.updateAdmin);
router.delete("/tenant/:tenantId", adminController.deleteAdmin);

export default router;

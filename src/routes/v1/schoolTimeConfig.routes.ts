import { Router } from "express";
import { TenantTimetableConfigController } from "../../controllers/v1/schoolTimeConfig.controller";
import { validate } from "../../middlewares/validation.middleware";
import { createOrUpdateSchoolTimeConfigSchema } from "../../utils/requestValidators/schoolTimeConfig.validator";

const router = Router();

// Get the school time config for the current tenant
router.get("/get-school-time-configs", TenantTimetableConfigController.getConfig);

// Create the school time config for the current tenant
router.post("/create-school-time-configs", validate(createOrUpdateSchoolTimeConfigSchema), TenantTimetableConfigController.createTimeTableConfig);

// Update the school time config for the current tenant
router.put("/update-school-time-configs", validate(createOrUpdateSchoolTimeConfigSchema), TenantTimetableConfigController.updateTimeTableConfig);

// Delete the school time config
router.delete("/delete-school-time-configs", TenantTimetableConfigController.deleteConfig);

export default router;

import { Router } from "express";
import * as partnerController from "../../controllers/v1/partner.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createPartnerSchema,
  updatePartnerSchema,
  getPartnerSchema,
  deletePartnerSchema,
} from "../../utils/requestValidators/partner.validator";

const router = Router();

// Create partner
router.post(
  "/",
  validate(createPartnerSchema),
  partnerController.createPartner
);

// Get all partners
router.get("/", partnerController.getAllPartners);

// Get partner statistics
router.get("/stats", partnerController.getPartnerStatistics);

// Get partner by ID
router.get(
  "/:id",
  validate(getPartnerSchema),
  partnerController.getPartnerById
);

// Get partner tenants
router.get("/:id/tenants", partnerController.getPartnerTenants);

// Update partner
router.put(
  "/:id",
  validate(updatePartnerSchema),
  partnerController.updatePartner
);

// Delete partner (soft delete)
router.delete(
  "/:id",
  validate(deletePartnerSchema),
  partnerController.deletePartner
);

// Get tenants for a partner
router.get("/:id/tenants", partnerController.getPartnerTenants);

export default router;

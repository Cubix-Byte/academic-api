import { Router } from "express";
import * as contentBuilderController from "../../controllers/v1/contentBuilder.controller";
import { validate } from "../../middlewares/validation.middleware";
import {
  createContentBuilderSchema,
  updateContentBuilderSchema,
  getContentBuilderSchema,
  listContentBuildersSchema,
  deleteContentBuilderSchema,
} from "../../utils/requestValidators/contentBuilder.validator";

const router = Router();

/**
 * ContentBuilder Routes - API endpoints for content builder management
 */

// POST /api/v1/content-builders - Create new content builder
router.post(
  "/",
  validate(createContentBuilderSchema),
  contentBuilderController.createContentBuilder
);

// GET /api/v1/content-builders - Get all content builders with pagination and filters
router.get(
  "/",
  validate(listContentBuildersSchema),
  contentBuilderController.getAllContentBuilders
);

// GET /api/v1/content-builders/:id - Get content builder by ID
router.get(
  "/:id",
  validate(getContentBuilderSchema),
  contentBuilderController.getContentBuilder
);

// PUT /api/v1/content-builders/:id - Update content builder
router.put(
  "/:id",
  validate(updateContentBuilderSchema),
  contentBuilderController.updateContentBuilder
);

// DELETE /api/v1/content-builders/:id - Delete content builder
router.delete(
  "/:id",
  validate(deleteContentBuilderSchema),
  contentBuilderController.deleteContentBuilder
);

export default router;

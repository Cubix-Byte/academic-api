import { Router } from "express";
import * as imageController from "../../controllers/v1/image.controller";
import { ROUTES } from "../../utils/constants/routes";

const router = Router();

/**
 * Image Routes
 * Version: v1
 */

// Download image from URL and send as response
router.get(ROUTES.IMAGES.SUBROUTES.DOWNLOAD, imageController.downloadImage);

export default router;

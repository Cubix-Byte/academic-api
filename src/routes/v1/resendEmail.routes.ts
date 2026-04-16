import { Router } from "express";
import * as resendEmailController from "../../controllers/v1/resendEmail.controller";

const router = Router();

/**
 * Unified Resend Email Routes
 * Single endpoint for resending welcome emails to students, teachers, and parents
 */

// Resend welcome email (unified endpoint)
router.post("/", resendEmailController.resendEmail);

export default router;


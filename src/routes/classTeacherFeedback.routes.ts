import { Router } from "express";
import { ClassTeacherFeedbackController } from "../controllers/v1/classTeacherFeedback.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createOrUpdateFeedbackSchema,
  getFeedbackSchema,
  getStudentAllFeedbackSchema,
  getTeacherFeedbackSchema,
  deleteFeedbackSchema,
  getBulkFeedbackSchema,
} from "../utils/requestValidators/classTeacherFeedback.validator";

/**
 * ClassTeacherFeedback Routes
 * Defines all class teacher feedback related API endpoints
 * Uses global authentication middleware for access control
 */
const router = Router();
const feedbackController = new ClassTeacherFeedbackController();

// Create or update feedback
router.post(
  "/",
  validate(createOrUpdateFeedbackSchema),
  feedbackController.createOrUpdateFeedback
);

// Get feedback by teacher (must come before /:classId routes)
router.get(
  "/my-feedback",
  validate(getTeacherFeedbackSchema),
  feedbackController.getTeacherFeedback
);

// Get bulk feedback for multiple students in a class
router.post(
  "/bulk",
  validate(getBulkFeedbackSchema),
  feedbackController.getBulkFeedback
);

// Get all feedback for a student across classes (must come before /:classId/:studentId)
router.get(
  "/student/:studentId",
  validate(getStudentAllFeedbackSchema),
  feedbackController.getStudentAllFeedback
);

// Get feedback for specific student in a class
router.get(
  "/:classId/:studentId",
  validate(getFeedbackSchema),
  feedbackController.getFeedback
);

// Delete feedback
router.delete(
  "/:classId/:studentId",
  validate(deleteFeedbackSchema),
  feedbackController.deleteFeedback
);

export default router;

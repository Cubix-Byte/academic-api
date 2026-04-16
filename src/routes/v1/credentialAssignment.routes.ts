import { Router } from "express";
import * as credentialAssignmentController from "../../controllers/v1/credentialAssignment.controller";

const router = Router();

/**
 * Credential Assignment Routes
 */

// GET /api/v1/credentials/class/:classId/teachers - Get teachers by class for credential assignment (minimal data)
router.get(
  "/class/:classId/teachers",
  credentialAssignmentController.getTeachersByClassForCredentialAssignment
);

// POST /api/v1/credentials/:credentialId/assign-teachers - Assign credential to teachers
router.post(
  "/:credentialId/assign-teachers",
  credentialAssignmentController.assignCredentialToTeachers
);

// GET /api/v1/credentials/assignments - Get teacher credential assignments
router.get(
  "/assignments",
  credentialAssignmentController.getTeacherCredentialAssignments
);

// GET /api/v1/credentials/:credentialId/assignments-details - Get credential assignments details (teachers + students)
router.get(
  "/:credentialId/assignments-details",
  credentialAssignmentController.getCredentialAssignmentsDetails
);

export default router;

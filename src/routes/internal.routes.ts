import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import {
  sendErrorResponse,
  sendSuccessResponse,
  HttpStatusCodes,
} from "../utils/shared-lib-imports";
import { ROUTES } from "../utils/constants/routes";
import * as examService from "../services/exam.service";
import * as tenantService from "../services/tenant.service";
import * as adminService from "../services/admin.service";
import { ContentLibraryService } from "../services/contentLibrary.service";
import * as studentWalletService from "../services/studentWallet.service";
import * as parentChildRepository from "../repositories/parentChild.repository";
import * as parentRepository from "../repositories/parent.repository";
import * as studentRepository from "../repositories/student.repository";


/**
 * Internal API Routes
 *
 * Routes for microservice-to-microservice communication
 * Requires x-api-key header for authentication
 */
const router = Router();
import { ClassService } from "../services/class.service";
const contentLibraryService = new ContentLibraryService();
const classService = new ClassService();

// Health check for internal services
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.HEALTH,
  (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "academy-api",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  }
);

// Get class by ID (internal)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_CLASS_BY_ID,
  (req: Request, res: Response) => {
    // TODO: Implement get class by ID for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Get classes by IDs (internal)
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_CLASSES_BY_IDS,
  (req: Request, res: Response) => {
    // TODO: Implement get classes by IDs for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Get subject by ID (internal)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_SUBJECT_BY_ID,
  (req: Request, res: Response) => {
    // TODO: Implement get subject by ID for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Get subjects by IDs (internal)
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_SUBJECTS_BY_IDS,
  (req: Request, res: Response) => {
    // TODO: Implement get subjects by IDs for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Validate class (internal)
router.get("/validate-class/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Simple validation - check if ID is valid ObjectId format
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);
    res.json({
      valid: isValid,
      id: id,
      message: isValid ? "Valid class ID" : "Invalid class ID format",
    });
  } catch (error) {
    sendErrorResponse(
      res,
      "Validation error",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// Validate subject (internal)
router.get("/validate-subject/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Simple validation - check if ID is valid ObjectId format
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);
    res.json({
      valid: isValid,
      id: id,
      message: isValid ? "Valid subject ID" : "Invalid subject ID format",
    });
  } catch (error) {
    sendErrorResponse(
      res,
      "Validation error",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// Validate batch (internal)
router.get("/validate-batch/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Simple validation - check if ID is valid ObjectId format
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);
    res.json({
      valid: isValid,
      id: id,
      message: isValid ? "Valid batch ID" : "Invalid batch ID format",
    });
  } catch (error) {
    sendErrorResponse(
      res,
      "Validation error",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// Validate student (internal)
router.get("/validate-student/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Simple validation - check if ID is valid ObjectId format
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);
    res.json({
      valid: isValid,
      id: id,
      message: isValid ? "Valid student ID" : "Invalid student ID format",
    });
  } catch (error) {
    sendErrorResponse(
      res,
      "Validation error",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// Get student classes with subjects (internal)
router.get("/student/:id/classes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers["x-tenant-id"] as string; // Expect tenant ID in header from internal call

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID required in x-tenant-id header",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Use the existing service method that fetches class details for a student
    const result = await classService.getMyStudentClassesWithSubjects(
      id,
      tenantId
    );

    // If no classes found or empty array, return success with empty array or appropriate message
    // The service returns [] if not found/no class, so we typically return that directly
    // But for login response integration, we often want a single class object if the student is in only one class (typical case)

    // The service returns ClassResponse[]-like structure.
    // Let's return the array as is.

    sendSuccessResponse(res, "Student classes retrieved successfully", result);
  } catch (error: any) {
    // Check if error is "Student not found" etc
    const code =
      error instanceof Error && error.message.includes("not found")
        ? HttpStatusCodes.NOT_FOUND
        : HttpStatusCodes.INTERNAL_SERVER_ERROR;

    sendErrorResponse(
      res,
      error.message || "Failed to get student classes",
      code
    );
  }
});

// Validate teacher (internal)
router.get("/validate-teacher/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Simple validation - check if ID is valid ObjectId format
    const isValid = /^[0-9a-fA-F]{24}$/.test(id);
    res.json({
      valid: isValid,
      id: id,
      message: isValid ? "Valid teacher ID" : "Invalid teacher ID format",
    });
  } catch (error) {
    sendErrorResponse(
      res,
      "Validation error",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

// Sync class data (internal)
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.SYNC_CLASS_DATA,
  (req: Request, res: Response) => {
    // TODO: Implement class data sync for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Sync subject data (internal)
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.SYNC_SUBJECT_DATA,
  (req: Request, res: Response) => {
    // TODO: Implement subject data sync for internal API
    sendErrorResponse(
      res,
      "Not implemented yet",
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    );
  }
);

// Update embedded status for content library content
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.UPDATE_EMBEDDED_STATUS,
  async (req: Request, res: Response) => {
    try {
      const { fileId, isEmbedded } = req.body;

      if (!fileId) {
        return sendErrorResponse(
          res,
          "fileId is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (typeof isEmbedded !== "boolean") {
        return sendErrorResponse(
          res,
          "isEmbedded must be a boolean",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const result =
        await contentLibraryService.updateEmbeddedStatusByContentId(
          fileId,
          isEmbedded
        );

      sendSuccessResponse(res, "Embedded status updated successfully", result);
    } catch (error: any) {
      const code =
        error instanceof Error && error.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        error instanceof Error
          ? error.message
          : "Failed to update embedded status",
        code
      );
    }
  }
);

// Scheduled exam notifications - called by Lambda
// Sends reminders to students (upcoming/expiring exams) and teachers (grading needed)
router.post(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.SEND_EXAM_NOTIFICATIONS,
  async (req: Request, res: Response) => {
    try {
      const { from, intervalMinutes: reqInterval } = req.body;
      const fromDate = from ? new Date(from) : new Date();

      const intervalMinutes =
        reqInterval ||
        parseInt(process.env.NOTIFICATION_INTERVAL_MINUTES || "60", 10);

      // look-ahead = upcoming events, look-back = just happened
      const lookAheadStart = new Date(fromDate);
      const lookAheadEnd = new Date(
        fromDate.getTime() + intervalMinutes * 60 * 1000
      );
      const lookBackStart = new Date(
        fromDate.getTime() - intervalMinutes * 60 * 1000
      );
      const lookBackEnd = new Date(fromDate);

      const result = await examService.sendExamNotifications(
        { start: lookAheadStart, end: lookAheadEnd },
        { start: lookBackStart, end: lookBackEnd }
      );

      sendSuccessResponse(res, "Exam notifications processed", {
        timeWindow: {
          from: fromDate.toISOString(),
          intervalMinutes,
          lookAhead: {
            start: lookAheadStart.toISOString(),
            end: lookAheadEnd.toISOString(),
          },
          lookBack: {
            start: lookBackStart.toISOString(),
            end: lookBackEnd.toISOString(),
          },
        },
        students: {
          upcomingExams: result.students.upcomingExams,
          expiringExams: result.students.expiringExams,
        },
        teachers: {
          upcomingGrading: result.teachers.upcomingGrading,
          readyForGrading: result.teachers.readyForGrading,
        },
        totals: {
          processedCount: result.totals.processedCount,
          notifiedCount: result.totals.notifiedCount,
          errorsCount: result.totals.errorsCount,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error in send-exam-notifications endpoint:", error);
      sendErrorResponse(
        res,
        `Failed to send exam notifications: ${error.message}`,
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get tenant by name (internal)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_TENANT_BY_NAME,
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const tenant = await tenantService.getTenantByTenantName(name);

      if (!tenant) {
        return sendErrorResponse(res, "Tenant not found", HttpStatusCodes.NOT_FOUND);
      }

      // Convert to object for response
      const tenantResponse = (tenant as any).toObject ? (tenant as any).toObject() : { ...tenant };

      sendSuccessResponse(res, "Tenant retrieved successfully", tenantResponse);
    } catch (error: any) {
      sendErrorResponse(
        res,
        error.message || "Failed to get tenant",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get tenant by ID (internal)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_TENANT_BY_ID,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;

      if (!tenantId) {
        return sendErrorResponse(
          res,
          "Tenant ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        return sendErrorResponse(
          res,
          "Invalid Tenant ID format",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const tenant = await tenantService.getTenantById(tenantId);

      if (!tenant) {
        return sendErrorResponse(res, "Tenant not found", HttpStatusCodes.NOT_FOUND);
      }

      // Convert to object for response
      const tenantResponse = (tenant as any).toObject ? (tenant as any).toObject() : { ...tenant };

      sendSuccessResponse(res, "Tenant retrieved successfully", tenantResponse);
    } catch (error: any) {
      sendErrorResponse(
        res,
        error.message || "Failed to get tenant",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get tenant context by admin id (internal)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_ADMIN_TENANT_CONTEXT,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantContext = await adminService.getAdminTenantContext(id);
      sendSuccessResponse(res, "Tenant context retrieved successfully", tenantContext);
    } catch (error: any) {
      sendErrorResponse(
        res,
        error.message || "Failed to get tenant context",
        error.message === "Admin not found" ? HttpStatusCodes.NOT_FOUND : HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// ============================================================================
// COMMENTED OUT: Add credits to student wallet - now handled in Monetization-API
// Wallet data is now stored in monetization-api database
// Credits are added directly in monetization-api after payment confirmation
// ============================================================================
// Add credits to student wallet (internal - called by Monetization-API)
// router.post(
//   ROUTES.INTERNAL_ROUTES.SUBROUTES.ADD_STUDENT_WALLET_CREDITS,
//   async (req: Request, res: Response) => {
//     try {
//       const { studentId } = req.params;
//       const { amount, purchaseTransactionId, parentId, tenantId, tenantName } = req.body;
//
//       if (!studentId) {
//         return sendErrorResponse(
//           res,
//           "Student ID is required",
//           HttpStatusCodes.BAD_REQUEST
//         );
//       }
//
//       if (!amount || amount < 1) {
//         return sendErrorResponse(
//           res,
//           "Amount must be at least 1",
//           HttpStatusCodes.BAD_REQUEST
//         );
//       }
//
//       if (!tenantId || !tenantName) {
//         return sendErrorResponse(
//           res,
//           "Tenant ID and Tenant Name are required",
//           HttpStatusCodes.BAD_REQUEST
//         );
//       }
//
//       const wallet = await studentWalletService.addCredits(
//         studentId,
//         amount,
//         purchaseTransactionId,
//         parentId,
//         tenantId,
//         tenantName
//       );
//
//       sendSuccessResponse(res, "Credits added successfully", {
//         studentId: wallet.studentId,
//         balance: wallet.balance,
//         totalCreditsPurchased: wallet.totalCreditsPurchased,
//       });
//     } catch (error: any) {
//       console.error("Add credits error:", error);
//       sendErrorResponse(
//         res,
//         error.message || "Failed to add credits",
//         HttpStatusCodes.INTERNAL_SERVER_ERROR
//       );
//     }
//   }
// );

// Validate parent-student relationship (internal - called by Monetization-API)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.VALIDATE_PARENT_STUDENT,
  async (req: Request, res: Response) => {
    try {
      const { parentId, studentId } = req.params;

      if (!parentId || !studentId) {
        return sendErrorResponse(
          res,
          "Parent ID and Student ID are required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      console.log(`[Internal API] Validating parent-student relationship: parentId=${parentId}, studentId=${studentId}`);

      // Check if IDs are valid ObjectIds first
      if (!mongoose.Types.ObjectId.isValid(parentId) || !mongoose.Types.ObjectId.isValid(studentId)) {
        console.log(`[Internal API] Invalid ObjectId format: parentId=${parentId}, studentId=${studentId}`);
        return sendSuccessResponse(res, "Invalid ID format", {
          valid: false,
          parentId,
          studentId,
        });
      }

      const relationship = await parentChildRepository.findParentChildRelationship(
        parentId,
        studentId
      );

      // findParentChildRelationship already filters by isActive: true and isDeleted: false
      // So if relationship is found, it's valid
      const valid = relationship !== null;

      console.log(`[Internal API] Validation result:`, {
        valid,
        relationshipFound: !!relationship,
        parentId,
        studentId,
      });

      sendSuccessResponse(res, valid ? "Relationship validated" : "Relationship not found", {
        valid,
        parentId,
        studentId,
      });
    } catch (error: any) {
      console.error("Validate parent-student relationship error:", error);
      sendErrorResponse(
        res,
        error.message || "Failed to validate relationship",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get parent by userId (internal - called by Monetization-API)
router.get(
  ROUTES.INTERNAL_ROUTES.SUBROUTES.GET_PARENT_BY_USER_ID,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return sendErrorResponse(
          res,
          "User ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return sendErrorResponse(
          res,
          "Invalid User ID format",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      console.log(`[Internal API] Finding parent by userId: ${userId}`);

      const parent = await parentRepository.findParentByUserId(userId);

      if (!parent) {
        return sendErrorResponse(
          res,
          "Parent not found for this user",
          HttpStatusCodes.NOT_FOUND
        );
      }

      const parentId = parent._id ? parent._id.toString() : null;

      console.log(`[Internal API] Parent found: parentId=${parentId}, userId=${userId}`);

      sendSuccessResponse(res, "Parent found", {
        parentId,
        userId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        tenantId: parent.tenantId,
      });
    } catch (error: any) {
      console.error("Get parent by userId error:", error);
      sendErrorResponse(
        res,
        error.message || "Failed to get parent by userId",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get student by ID (internal - called by Monetization-API)
router.get(
  "/students/:studentId",
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return sendErrorResponse(
          res,
          "Student ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return sendErrorResponse(
          res,
          "Invalid Student ID format",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      console.log(`[Internal API] Finding student by studentId: ${studentId}`);

      const student = await studentRepository.findStudentById(studentId);

      if (!student) {
        return sendErrorResponse(
          res,
          "Student not found",
          HttpStatusCodes.NOT_FOUND
        );
      }

      sendSuccessResponse(res, "Student retrieved successfully", {
        studentId: student._id ? student._id.toString() : studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        tenantId: student.tenantId ? student.tenantId.toString() : null,
      });
    } catch (error: any) {
      console.error("Get student by ID error:", error);
      sendErrorResponse(
        res,
        error.message || "Failed to get student by ID",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

// Get parent by ID (internal - called by Monetization-API)
router.get(
  "/parents/:parentId",
  async (req: Request, res: Response) => {
    try {
      const { parentId } = req.params;

      if (!parentId) {
        return sendErrorResponse(
          res,
          "Parent ID is required",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        return sendErrorResponse(
          res,
          "Invalid Parent ID format",
          HttpStatusCodes.BAD_REQUEST
        );
      }

      console.log(`[Internal API] Finding parent by parentId: ${parentId}`);

      const parent = await parentRepository.findParentById(parentId);

      if (!parent) {
        return sendErrorResponse(
          res,
          "Parent not found",
          HttpStatusCodes.NOT_FOUND
        );
      }

      sendSuccessResponse(res, "Parent retrieved successfully", {
        parentId: parent._id ? parent._id.toString() : parentId,
        firstName: parent.firstName,
        lastName: parent.lastName,
        email: parent.email,
        tenantId: parent.tenantId ? parent.tenantId.toString() : null,
      });
    } catch (error: any) {
      console.error("Get parent by ID error:", error);
      sendErrorResponse(
        res,
        error.message || "Failed to get parent by ID",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export default router;

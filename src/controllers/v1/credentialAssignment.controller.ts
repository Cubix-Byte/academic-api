import { Request, Response, NextFunction } from "express";
import * as credentialAssignmentService from "../../services/credentialAssignment.service";
import {
  AssignCredentialToTeachersRequest,
  GetTeacherCredentialAssignmentsRequest,
  GetCredentialAssignmentsDetailsRequest,
} from "@/types/credentialAssignment.types";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "shared-lib";

/**
 * Credential Assignment Controller
 */

// Assign credential to teachers
export const assignCredentialToTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credentialId } = req.params;
    const data: AssignCredentialToTeachersRequest = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (
      !data.teacherIds ||
      !Array.isArray(data.teacherIds) ||
      data.teacherIds.length === 0
    ) {
      return sendErrorResponse(
        res,
        "Teacher IDs array is required and must not be empty",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!data.startDate || !data.endDate) {
      return sendErrorResponse(
        res,
        "Start date and end date are required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    // Get admin ID and role who assigned the credential
    const assignedById = req.user?.id; // Admin who assigned the credential
    const assignedByRole = req.user?.roleName || req.user?.role || "ADMIN"; // Role of the user assigning the credential

    res.status(201);
    const result = await credentialAssignmentService.assignCredentialToTeachers(
      credentialId,
      data,
      tenantId,
      assignedById,
      assignedByRole
    );
    return sendSuccessResponse(
      res,
      "Credential assigned to teachers successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (errorMessage === "TEACHER_ALREADY_ASSIGNED_FOR_CREDENTIAL") {
      return sendErrorResponse(
        res,
        "One or more selected teachers already have an active assignment for this credential",
        HttpStatusCodes.BAD_REQUEST
      );
    }
    next(error);
  }
};

// Get teacher credential assignments
export const getTeacherCredentialAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetTeacherCredentialAssignmentsRequest & {
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      teacherId: req.query.teacherId as string,
      credentialTemplateId: req.query.credentialTemplateId as string,
      isActive:
        req.query.isActive === "true"
          ? true
          : req.query.isActive === "false"
          ? false
          : undefined,
      tenantId,
    };

    const result =
      await credentialAssignmentService.getTeacherCredentialAssignments(params);
    return sendSuccessResponse(
      res,
      "Teacher credential assignments retrieved successfully",
      result
    );
  } catch (error) {
    next(error);
  }
};

// Get teachers by class for credential assignment (minimal data only).
// Query: credentialId, credentialCategory — when both present, excludes teachers already assigned for this credential+class+category.
export const getTeachersByClassForCredentialAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { classId } = req.params;
    const credentialId = req.query.credentialId as string | undefined;
    const credentialCategory = req.query.credentialCategory as string | undefined;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!classId) {
      return sendErrorResponse(
        res,
        "Class ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const teachers =
      await credentialAssignmentService.getTeachersByClassForCredentialAssignment(
        classId,
        tenantId,
        credentialId,
        credentialCategory
      );
    return sendSuccessResponse(
      res,
      "Teachers retrieved successfully",
      teachers
    );
  } catch (error) {
    next(error);
  }
};

// Get credential assignments details
export const getCredentialAssignmentsDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credentialId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return sendErrorResponse(
        res,
        "Tenant ID is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const params: GetCredentialAssignmentsDetailsRequest & {
      tenantId: string;
    } = {
      pageNo: parseInt(req.query.pageNo as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      tenantId,
      teacherId: req.query.teacherId as string | undefined,
    };

    const result =
      await credentialAssignmentService.getCredentialAssignmentsDetails(
        credentialId,
        params
      );
    return sendSuccessResponse(
      res,
      "Credential assignments details retrieved successfully",
      result
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage === "CREDENTIAL_TEMPLATE_NOT_FOUND") {
      return sendErrorResponse(
        res,
        "Credential template not found",
        HttpStatusCodes.NOT_FOUND
      );
    }
    next(error);
  }
};

import { Request, Response, NextFunction } from "express";
import { sendSuccessResponse, sendErrorResponse, HttpStatusCodes } from "shared-lib";
import * as resendEmailService from "../../services/resendEmail.service";

/**
 * Unified Resend Email Controller
 * Handles resending welcome emails for students, teachers, and parents
 */

// Resend welcome email (unified endpoint)
export const resendEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, _id } = req.body;

    if (!type) {
      return sendErrorResponse(
        res,
        "Type is required. Must be one of: student, teacher, parent, primary-admin",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!_id) {
      return sendErrorResponse(
        res,
        "_id is required",
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const result = await resendEmailService.resendEmail({ type, _id });

    return sendSuccessResponse(
      res,
      result.message || "Welcome email sent successfully",
      result
    );
  } catch (error: any) {
    next(error);
  }
};


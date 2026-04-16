import { Request, Response, NextFunction } from "express";
import {
  sendErrorResponse,
  HttpStatusCodes as SERVER_STATUS_CODES,
} from "../utils/shared-lib-imports";
import { isWriteConflictError } from "../utils/retry.util";

const INTERNAL_SERVER_ERROR = "Internal server error occurred";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error:", error);

  // Handle MongoDB write conflict errors specifically
  if (isWriteConflictError(error)) {
    sendErrorResponse(
      res,
      "Database write conflict - please retry your request",
      SERVER_STATUS_CODES.CONFLICT,
      {
        details: error.message,
        retryable: true,
        suggestion:
          "The operation encountered a write conflict. Please retry your request in a moment.",
      }
    );
    return;
  }

  // MongoDB/Mongoose specific errors
  if (error.name === "MongoError" || error.name === "MongoServerError") {
    sendErrorResponse(
      res,
      "Database error",
      SERVER_STATUS_CODES.INTERNAL_SERVER_ERROR,
      { details: error.message }
    );
    return;
  }

  if (error.name === "ValidationError") {
    sendErrorResponse(
      res,
      "Validation error",
      SERVER_STATUS_CODES.BAD_REQUEST,
      { details: error.message }
    );
    return;
  }

  if (error.name === "CastError") {
    sendErrorResponse(
      res,
      "Invalid ID format",
      SERVER_STATUS_CODES.BAD_REQUEST,
      { details: error.message }
    );
    return;
  }

  // Handle duplicate key error
  if ((error as any).code === 11000) {
    sendErrorResponse(res, "Duplicate entry", SERVER_STATUS_CODES.CONFLICT, {
      details: error.message,
    });
    return;
  }

  sendErrorResponse(
    res,
    INTERNAL_SERVER_ERROR,
    SERVER_STATUS_CODES.INTERNAL_SERVER_ERROR,
    { details: "Something went wrong" }
  );
};

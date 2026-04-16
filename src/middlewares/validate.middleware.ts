import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, z } from 'zod';

// Middleware for validating request data using Zod schemas
// Validates body, query, and params against provided schema
export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request data against schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,  
      });
      return next(); // Continue to next middleware if validation passes
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors for client response
        const errorMessages = error.issues.map((issue: any) => {
          return {
            field: issue.path.join('.'),
            message: issue.message,
          };
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages,
        });
      }

      // Handle unexpected errors during validation
      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
      });
    }
  };
};

// Middleware for validating request body only
export const validateBody = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      req.body = await schema.parseAsync(req.body);
      return next(); // Continue to next middleware if validation passes
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors for client response
        const errorMessages = error.issues.map((issue: any) => {
          return {
            field: issue.path.join('.'),
            message: issue.message,
          };
        });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages,
        });
      }

      // Handle unexpected errors during validation
      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
      });
    }
  };
};


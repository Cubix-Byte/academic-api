import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware for request data using Zod schemas
 * Supports validation of body, query, and params
 */

// Main validation function that can handle different validation types
export const validateRequest = (schema: ZodSchema, validationType: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate;
      
      // Select the appropriate data source based on validation type
      switch (validationType) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      // Validate the selected data against schema
      const validatedData = await schema.parseAsync(dataToValidate);
      
      // Replace the original data with validated data
      switch (validationType) {
        case 'body':
          req.body = validatedData;
          break;
        case 'query':
          req.query = validatedData;
          break;
        case 'params':
          req.params = validatedData;
          break;
      }

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

// Convenience function for body validation (default behavior)
export const validateBody = (schema: ZodSchema) => {
  return validateRequest(schema, 'body');
};

// Convenience function for query validation
export const validateQuery = (schema: ZodSchema) => {
  return validateRequest(schema, 'query');
};

// Convenience function for params validation
export const validateParams = (schema: ZodSchema) => {
  return validateRequest(schema, 'params');
};

// Legacy validate function for backward compatibility
export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request data against schema (legacy behavior - validates all)
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

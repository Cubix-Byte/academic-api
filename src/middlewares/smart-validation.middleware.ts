import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { examValidationSchemas } from '../utils/requestValidators/exam.validator';

/**
 * Smart validation middleware that detects nested data and uses appropriate schema
 */
export const smartExamValidation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    
    // Check if request has nested data
    const hasNestedData = data.exam_questions || data.exam_students || data.exam_contents || 
                         data.exam_ai_prompt_history || data.exam_settings;
    
    // Use appropriate schema based on whether nested data is present
    const schema = hasNestedData ? 
      examValidationSchemas.createExamWithNestedData : 
      examValidationSchemas.createExam;
    
    // Validate the request body
    const validatedData = schema.parse(data);
    
    // Replace req.body with validated data
    req.body = validatedData;
    
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    
    next(error);
  }
};

/**
 * Smart update validation middleware
 */
export const smartExamUpdateValidation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body;
    
    // Check if request has nested data
    const hasNestedData = data.exam_questions || data.exam_students || data.exam_contents || 
                         data.exam_ai_prompt_history || data.exam_settings;
    
    // Use appropriate schema based on whether nested data is present
    const schema = hasNestedData ? 
      examValidationSchemas.updateExamWithNestedData : 
      examValidationSchemas.updateExam;
    
    // Validate the request body
    const validatedData = schema.parse(data);
    
    // Replace req.body with validated data
    req.body = validatedData;
    
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    
    next(error);
  }
};


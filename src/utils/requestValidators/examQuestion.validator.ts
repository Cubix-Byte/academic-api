import { z } from 'zod';

/**
 * ExamQuestion Validation Schemas
 * Zod schemas for validating exam question-related requests
 */

// Question Option Schema
const questionOptionSchema = z.object({
  optionId: z.string()
    .min(1, 'Option ID is required')
    .max(5, 'Option ID must be at most 5 characters'),
  optionText: z.string()
    .min(1, 'Option text is required')
    .max(500, 'Option text must be less than 500 characters'),
  isCorrect: z.boolean(),
  optionContent: z.array(z.string()).optional()
});

// Create Exam Question Request Schema
export const createExamQuestionSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId'),
  questionNumber: z.number()
    .int('Question number must be an integer')
    .min(1, 'Question number must be at least 1'),
  questionType: z.enum(['MCQs', 'Fill in the Blanks', 'True/False', 'Short Answers', 'Long Answers'], {
    errorMap: () => ({ message: 'Invalid question type' })
  }),
  questionGenerateType: z.enum([
    'Manually',
    'Question Bank',
    'External Library',
    'AI Generated',
    'AI Generated but modified by teacher'
  ], {
    errorMap: () => ({ message: 'Invalid question generate type' })
  }),
  questionText: z.string()
    .min(1, 'Question text is required')
    .max(2000, 'Question text must be less than 2000 characters'),
  questionContent: z.array(z.string()).optional(),
  marks: z.number()
    .int('Marks must be an integer')
    .min(1, 'Marks must be at least 1')
    .max(100, 'Marks must be at most 100'),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.union([
    z.string(),
    z.array(z.string())
  ]),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], {
    errorMap: () => ({ message: 'Difficulty must be Easy, Medium, or Hard' })
  }),
  subjectId: z.string()
    .min(1, 'Subject ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Subject ID must be a valid MongoDB ObjectId'),
  classId: z.string()
    .min(1, 'Class ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Class ID must be a valid MongoDB ObjectId')
}).refine((data) => {
  // MCQs must have options
  if (data.questionType === 'MCQs' && (!data.options || data.options.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'MCQs must have at least one option',
  path: ['options']
}).refine((data) => {
  // MCQs must have at least one correct option
  if (data.questionType === 'MCQs' && data.options) {
    const hasCorrectOption = data.options.some(opt => opt.isCorrect);
    return hasCorrectOption;
  }
  return true;
}, {
  message: 'MCQs must have at least one correct option',
  path: ['options']
});

// Update Exam Question Request Schema
export const updateExamQuestionSchema = z.object({
  questionNumber: z.number()
    .int('Question number must be an integer')
    .min(1, 'Question number must be at least 1')
    .optional(),
  questionType: z.enum(['MCQs', 'Fill in the Blanks', 'True/False', 'Short Answers', 'Long Answers']).optional(),
  questionGenerateType: z.enum([
    'Manually',
    'Question Bank',
    'External Library',
    'AI Generated',
    'AI Generated but modified by teacher'
  ]).optional(),
  questionText: z.string()
    .min(1, 'Question text is required')
    .max(2000, 'Question text must be less than 2000 characters')
    .optional(),
  questionContent: z.array(z.string()).optional(),
  marks: z.number()
    .int('Marks must be an integer')
    .min(1, 'Marks must be at least 1')
    .max(100, 'Marks must be at most 100')
    .optional(),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  isActive: z.boolean().optional()
});

// Get All Exam Questions Query Schema
export const getAllExamQuestionsSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId'),
  questionType: z.enum(['MCQs', 'Fill in the Blanks', 'True/False', 'Short Answers', 'Long Answers']).optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  isActive: z.string()
    .regex(/^(true|false)$/, 'isActive must be true or false')
    .transform((val) => val === 'true')
    .optional()
});

// Question ID Parameter Schema
export const questionIdSchema = z.object({
  id: z.string()
    .min(1, 'Question ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Question ID must be a valid MongoDB ObjectId')
});

// Single Question Schema for Bulk Create (without examId)
const singleQuestionSchema = z.object({
  questionNumber: z.number()
    .int('Question number must be an integer')
    .positive('Question number must be positive')
    .optional(),
  questionType: z.enum(['MCQs', 'Fill in the Blanks', 'True/False', 'Short Answers', 'Long Answers']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Very Hard']),
  questionText: z.string().min(1, 'Question text is required'),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  marks: z.number().positive('Marks must be positive'),
  negativeMarks: z.number().min(0, 'Negative marks cannot be negative').optional(),
  explanation: z.string().optional(),
  hints: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  classId: z.string()
    .min(1, 'Class ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Class ID must be a valid MongoDB ObjectId')
}).refine(
  (data) => {
    if (data.questionType === 'MCQs') {
      return data.options && data.options.length >= 2 && data.options.length <= 10;
    }
    return true;
  },
  { message: 'MCQs must have between 2 and 10 options', path: ['options'] }
).refine(
  (data) => {
    if (data.questionType === 'MCQs') {
      if (Array.isArray(data.correctAnswer)) {
        return data.options && data.correctAnswer.every(ans => data.options!.includes(ans));
      }
      return data.options && data.options.includes(data.correctAnswer as string);
    }
    return true;
  },
  { message: 'Correct answer must be one of the options for MCQs', path: ['correctAnswer'] }
);

// Bulk Create Questions Schema
export const bulkCreateQuestionsSchema = z.object({
  examId: z.string()
    .min(1, 'Exam ID is required')
    .regex(/^[0-9a-fA-F]{24}$/, 'Exam ID must be a valid MongoDB ObjectId'),
  questions: z.array(singleQuestionSchema)
    .min(1, 'At least one question is required')
    .max(200, 'Cannot create more than 200 questions at once')
});

// Reorder Questions Schema
export const reorderQuestionsSchema = z.object({
  questionOrders: z.array(z.object({
    questionId: z.string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Question ID must be a valid MongoDB ObjectId'),
    newQuestionNumber: z.number()
      .int('Question number must be an integer')
      .min(1, 'Question number must be at least 1')
  }))
    .min(1, 'At least one question order is required')
});

// Export all schemas
export const examQuestionValidationSchemas = {
  createExamQuestion: createExamQuestionSchema,
  updateExamQuestion: updateExamQuestionSchema,
  getAllExamQuestions: getAllExamQuestionsSchema,
  questionId: questionIdSchema,
  bulkCreateQuestions: bulkCreateQuestionsSchema,
  reorderQuestions: reorderQuestionsSchema
};


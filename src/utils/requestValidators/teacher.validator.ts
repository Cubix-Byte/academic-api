import { z } from "zod";
import { objectIdSchema, optionalObjectIdSchema, optionalObjectIdArraySchema } from './objectId.validator';

/**
 * Teacher validation schemas using Zod
 * Validates request data for teacher-related endpoints
 */

// Base teacher schema
const baseTeacherSchema = z.object({
  // Personal Information
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name cannot exceed 50 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name cannot exceed 50 characters"),
  email: z.string().email("Invalid email format"),
  phoneNumber: z
    .string()
    .regex(/^[\+]?[0-9\-\s]{10,20}$/, "Invalid phone number format"),
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address cannot exceed 500 characters"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),

  // Academic Information
  joiningDate: z.string().datetime("Invalid joining date format"),
  qualification: z
    .string()
    .max(200, "Qualification cannot exceed 200 characters")
    .optional(),
  specialization: z
    .string()
    .max(100, "Specialization cannot exceed 100 characters")
    .optional(),
  experience: z
    .number()
    .min(0, "Experience cannot be negative")
    .max(50, "Experience cannot exceed 50 years")
    .optional(),

  // Contact Information
  emergencyContact: z
    .string()
    .max(100, "Emergency contact cannot exceed 100 characters")
    .optional(),
  emergencyPhone: z
    .string()
    .regex(/^[\+]?[0-9\-\s]{10,20}$/, "Invalid emergency phone number format")
    .optional(),

  // Academic Information
  department: z
    .string()
    .max(100, "Department cannot exceed 100 characters")
    .optional(),
  designation: z
    .string()
    .max(100, "Designation cannot exceed 100 characters")
    .optional(),
  salary: z.number().min(0, "Salary cannot be negative").optional(),

  // Class and Subject Assignments
  assignedClasses: optionalObjectIdArraySchema,
  assignedSubjects: optionalObjectIdArraySchema,

  // Documents
  documents: z
    .array(
      z.object({
        name: z.string().min(1, "Document name is required"),
        type: z.enum(["degree", "certificate", "diploma", "other"]),
        url: z.string().url("Invalid document URL"),
        uploadedAt: z.string().datetime().optional(),
      })
    )
    .optional(),

  // Status
  status: z.enum(["active", "inactive", "suspended"]).optional(),

  // Password for user account
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password cannot exceed 50 characters"),

  // Demo password
  demoPassword: z
    .string()
    .min(6, "Demo password must be at least 6 characters")
    .optional(),

  // Additional Information
  bio: z.string().max(1000, "Bio cannot exceed 1000 characters").optional(),
  achievements: z
    .array(z.string().max(200, "Achievement cannot exceed 200 characters"))
    .optional(),
  certifications: z
    .array(z.string().max(200, "Certification cannot exceed 200 characters"))
    .optional(),

  // Tenant Information (now provided by authenticated user)
  tenantId: z.string().min(1, "Tenant ID is required").optional(),
  tenantName: z.string().min(1, "Tenant name is required").optional(),
});

// Create teacher schema
export const createTeacherSchema = z.object({
  body: baseTeacherSchema,
});

// Update teacher schema (all fields optional except ID)
export const updateTeacherSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: baseTeacherSchema.partial(),
});

// Get teacher schema (ID validation)
export const getTeacherSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Delete teacher schema (ID validation)
export const deleteTeacherSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Assign classes schema
export const assignClassesSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    assignments: z
      .array(
        z.object({
          classId: objectIdSchema,
          subjectId: objectIdSchema,
        })
      )
      .min(0, "At least one assignment is required"),
  }),
});

// Assign subjects schema
export const assignSubjectsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    subjectIds: z
      .array(objectIdSchema)
      .min(1, "At least one subject ID is required"),
  }),
});

// Get teachers by class schema
export const getTeachersByClassSchema = z.object({
  classId: objectIdSchema,
});

// Get teachers by subject schema
export const getTeachersBySubjectSchema = z.object({
  subjectId: objectIdSchema,
});

// Bulk create teachers schema
export const bulkCreateTeachersSchema = z.object({
  teachers: z
    .array(baseTeacherSchema)
    .min(1, "At least one teacher is required"),
});

// Sync teacher data schema
export const syncTeacherDataSchema = z.object({
  id: objectIdSchema,
  data: z.record(z.any()),
});

// Query parameters schema for get all teachers
export const getAllTeachersQuerySchema = z.object({
  pageNo: z.string().regex(/^\d+$/).transform(Number).optional(),
  pageSize: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  department: z.string().optional(),
  tenantId: z.string().optional(),
});

// Statistics query schema
export const teacherStatisticsQuerySchema = z.object({
  tenantId: z.string().optional(),
});

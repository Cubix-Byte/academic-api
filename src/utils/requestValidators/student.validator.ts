import { z } from "zod";
import { objectIdSchema, optionalObjectIdSchema } from './objectId.validator';
import { ATTENDANCE_STATUS_ARRAY } from "../constants/attendance.constants";

// Base student schema for validation
const baseStudentSchema = z.object({
  // User data (for creating user in user-api)
  username: z.string().min(1, "Username is required").optional(),
  email: z.string().email("Please enter a valid email").optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(50, "Password cannot exceed 50 characters"),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phone: z.string().optional(),
  tenantId: z.string().optional(),
  tenantName: z.string().optional(),
  demoPassword: z
    .string()
    .min(6, "Demo password must be at least 6 characters")
    .optional(),
  userAccessType: z.string().optional(),
  isEmailVerified: z.boolean().optional(),
  userType: z.string().optional(),
  roleName: z.string().optional(),

  // Student-specific fields
  studentId: z.string().optional(),
  rollNumber: z.string().optional(),
  admissionDate: z.string().optional(),
  address: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  spouseNumber: z.string().optional(),
  classId: optionalObjectIdSchema,
  className: z.string().optional(),
  currentGrade: z.string().optional(),
  section: z.string().optional(),
  academicYear: z.string().optional(),
  status: z.enum(["active", "inactive", "suspended", "graduated"]).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  previousSchool: z.string().optional(),
  previousGrade: z.string().optional(),
  transferCertificate: z.string().optional(),
  birthCertificate: z.string().optional(),
  feeStructure: z.string().optional(),
  scholarship: z.string().optional(),
  paymentStatus: z.enum(["paid", "pending", "overdue"]).optional(),
  bloodGroup: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  transportRequired: z.boolean().optional(),
  transportRoute: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  disciplinaryActions: z.array(z.string()).optional(),
});

// Create student validation schema
export const createStudentSchema = z.object({
  body: baseStudentSchema,
});

// Update student validation schema
export const updateStudentSchema = z.object({
  body: baseStudentSchema.partial(),
});

// Bulk create students validation schema
export const bulkCreateStudentsSchema = z.object({
  body: z.object({
    students: z.array(baseStudentSchema),
  }),
});

// Student query parameters validation schema
export const studentQuerySchema = z.object({
  query: z.object({
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    classId: optionalObjectIdSchema,
    academicYear: z.string().optional(),
    tenantId: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

// Student ID parameter validation schema
export const studentIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Student ID is required"),
  }),
});

// Student assignment validation schema
export const assignStudentSchema = z.object({
  body: z.object({
    classId: objectIdSchema,
    section: z.string().optional(),
  }),
});

// Student enrollment validation schema
export const enrollStudentSchema = z.object({
  body: z.object({
    subjects: z.array(z.string()).min(1, "At least one subject is required"),
    academicYear: z.string().min(1, "Academic year is required"),
  }),
});

// Student document upload validation schema
export const uploadDocumentSchema = z.object({
  body: z.object({
    documentType: z.string().min(1, "Document type is required"),
    documentName: z.string().min(1, "Document name is required"),
    documentUrl: z.string().url("Please enter a valid document URL"),
    remarks: z.string().optional(),
  }),
});

// Student attendance validation schema
export const markAttendanceSchema = z.object({
  body: z.object({
    date: z.string().min(1, "Date is required"),
    status: z.enum(ATTENDANCE_STATUS_ARRAY as unknown as [string, ...string[]]),
    remarks: z.string().optional(),
  }),
});

// Student performance validation schema
export const addPerformanceSchema = z.object({
  body: z.object({
    subjectId: objectIdSchema,
    examType: z.string().min(1, "Exam type is required"),
    marks: z.number().min(0, "Marks cannot be negative"),
    maxMarks: z.number().min(1, "Maximum marks must be at least 1"),
    grade: z.string().min(1, "Grade is required"),
    remarks: z.string().optional(),
    examDate: z.string().min(1, "Exam date is required"),
    academicYear: z.string().min(1, "Academic year is required"),
  }),
});

// Student fee validation schema
export const addFeeSchema = z.object({
  body: z.object({
    feeType: z.string().min(1, "Fee type is required"),
    amount: z.number().min(0, "Amount cannot be negative"),
    dueDate: z.string().min(1, "Due date is required"),
    paymentMethod: z.string().optional(),
    transactionId: z.string().optional(),
    remarks: z.string().optional(),
  }),
});

// Student search validation schema
export const searchStudentsSchema = z.object({
  query: z.object({
    q: z.string().min(1, "Search query is required"),
    filters: z.string().optional(),
    pageNo: z.string().transform(Number).optional(),
    pageSize: z.string().transform(Number).optional(),
  }),
});

// Student statistics validation schema
export const studentStatisticsSchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    classId: optionalObjectIdSchema,
    academicYear: z.string().optional(),
    groupBy: z.enum(["class", "status", "month"]).optional(),
  }),
});

// Student import validation schema
export const importStudentsSchema = z.object({
  body: z.object({
    data: z.array(
      z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Please enter a valid email"),
        phoneNumber: z.string().optional(),
        address: z.string().optional(),
        studentId: z.string().optional(),
        rollNumber: z.string().optional(),
        className: z.string().optional(),
        admissionDate: z.string().optional(),
        fatherName: z.string().optional(),
        motherName: z.string().optional(),
        guardianName: z.string().optional(),
        guardianPhone: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyPhone: z.string().optional(),
        previousSchool: z.string().optional(),
        bloodGroup: z.string().optional(),
        transportRequired: z.boolean().optional(),
      })
    ),
    options: z
      .object({
        skipDuplicates: z.boolean().optional(),
        updateExisting: z.boolean().optional(),
        validateEmails: z.boolean().optional(),
      })
      .optional(),
  }),
});

// Student export validation schema
export const exportStudentsSchema = z.object({
  query: z.object({
    format: z.enum(["csv", "excel", "pdf"]).optional(),
    fields: z.string().optional(),
    filters: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// Student notification validation schema
export const sendNotificationSchema = z.object({
  body: z.object({
    type: z.enum(["email", "sms", "push"]),
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(1, "Message is required"),
    recipients: z
      .array(z.string())
      .min(1, "At least one recipient is required"),
    scheduledAt: z.string().optional(),
  }),
});

// Student report validation schema
export const generateReportSchema = z.object({
  query: z.object({
    reportType: z.enum(["attendance", "performance", "fees", "disciplinary"]),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    classId: optionalObjectIdSchema,
    studentId: z.string().optional(),
    format: z.enum(["pdf", "excel", "csv"]).optional(),
  }),
});

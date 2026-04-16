import { IStudent } from '../models/student.schema';
import { AttendanceStatus } from '../models/attendance.schema';
import { SortOrder } from 'mongoose';

// Request types for student operations
export interface CreateStudentRequest extends Partial<IStudent> {
  // User data (for creating user in user-api)
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  tenantId?: string;
  tenantName?: string;
  demoPassword?: string;
  userAccessType?: string;
  isEmailVerified?: boolean;
  userType?: string;
  roleName?: string;

  // Student-specific fields from UI (all fields available)
  studentId?: string;
  rollNumber?: string;
  admissionDate?: Date;
  address?: string;
  spouseNumber?: string;
  classId?: string;
  className?: string;
  currentGrade?: string;
  section?: string;
  academicYear?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'graduated';
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  previousSchool?: string;
  previousGrade?: string;
  transferCertificate?: string;
  birthCertificate?: string;
  feeStructure?: string;
  scholarship?: string;
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  bloodGroup?: string;
  medicalConditions?: string;
  allergies?: string;
  transportRequired?: boolean;
  transportRoute?: string;
  subjects?: string[];
  subjectIds?: string[]; // Subject IDs for class_students assignment
  documents?: string[];
  achievements?: string[];
  disciplinaryActions?: string[];
  additionalInfo?: Record<string, any>;
}

export interface UpdateStudentRequest extends Partial<IStudent> {
  // User data (for updating user in user-api)
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  // Student-specific fields (all fields available)
  studentId?: string;
  rollNumber?: string;
  admissionDate?: Date;
  address?: string;
  spouseNumber?: string;
  classId?: string;
  className?: string;
  currentGrade?: string;
  section?: string;
  academicYear?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'graduated';
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  previousSchool?: string;
  previousGrade?: string;
  transferCertificate?: string;
  birthCertificate?: string;
  feeStructure?: string;
  scholarship?: string;
  paymentStatus?: 'paid' | 'pending' | 'overdue';
  bloodGroup?: string;
  medicalConditions?: string;
  allergies?: string;
  transportRequired?: boolean;
  transportRoute?: string;
  subjects?: string[];
  subjectIds?: string[]; // Subject IDs for class_students assignment
  documents?: string[];
  achievements?: string[];
  disciplinaryActions?: string[];
  additionalInfo?: Record<string, any>;
}

// Response types
export interface StudentResponse extends IStudent {
  // Additional computed fields
  fullName?: string;
  subjectsCount?: number;
  documentsCount?: number;
  age?: number;
  academicProgress?: {
    currentGrade: string;
    attendance: number;
    performance: string;
  };
}

// Bulk operations
export interface BulkCreateStudentRequest {
  students: CreateStudentRequest[];
}

export interface BulkCreateStudentResponse {
  created: StudentResponse[];
  failed: {
    data: CreateStudentRequest;
    error: string;
  }[];
}

// Query parameters for filtering and pagination
export interface StudentQueryParams {
  pageNo?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  classId?: string;
  academicYear?: string;
  tenantId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  sort?: Record<string, SortOrder>;
}

// Student statistics
export interface StudentStatistics {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  graduated: number;
  byClass: {
    classId: string;
    className: string;
    count: number;
  }[];
  byStatus: {
    status: string;
    count: number;
  }[];
  recentAdmissions: number;
  monthlyAdmissions: {
    month: string;
    count: number;
  }[];
}

// Student enrollment data
export interface StudentEnrollmentData {
  studentId: string;
  rollNumber: string;
  fullName: string;
  className: string;
  admissionDate: Date;
  status: string;
  contactInfo: {
    email: string;
    phoneNumber: string;
    emergencyContact: string;
  };
  academicInfo: {
    currentGrade: string;
    academicYear: string;
    subjects: string[];
  };
}

// Student search result
export interface StudentSearchResult {
  students: StudentResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  filters: {
    appliedFilters: Record<string, any>;
    availableFilters: Record<string, string[]>;
  };
}

// Student validation errors
export interface StudentValidationError {
  field: string;
  message: string;
  value?: any;
}

// Student import/export types
export interface StudentImportData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  studentId: string;
  rollNumber: string;
  className: string;
  admissionDate: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  previousSchool?: string;
  bloodGroup?: string;
  transportRequired?: boolean;
}

export interface StudentImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: {
    row: number;
    errors: StudentValidationError[];
  }[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

// Student attendance types
export interface StudentAttendance {
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: string;
  markedAt: Date;
}

// Student performance types
export interface StudentPerformance {
  studentId: string;
  subjectId: string;
  examType: string;
  marks: number;
  maxMarks: number;
  grade: string;
  remarks?: string;
  examDate: Date;
  academicYear: string;
}

// Student fee types
export interface StudentFee {
  studentId: string;
  feeType: string;
  amount: number;
  dueDate: Date;
  paidDate?: Date;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: string;
  transactionId?: string;
  remarks?: string;
}

// Student document types
export interface StudentDocument {
  studentId: string;
  documentType: string;
  documentName: string;
  documentUrl: string;
  uploadedBy: string;
  uploadedAt: Date;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  remarks?: string;
}

// Student performance breakdown response
export interface GetStudentPerformanceBreakdownResponse {
  success: boolean;
  data: {
    performanceBreakdown: Array<{
      examId: string;
      examTitle: string;
      examType: "Official" | "Practice" | "Exam Repository";
      averageScore: number; // percentage
      totalStudents: number;
      completedCount: number;
    }>;
  };
}

// Top Students API types
export interface GetTopStudentsRequest {
  classId: string; // Required
  subjectId?: string; // Optional
}

export interface TopStudentItem {
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  className: string;
  subjectName?: string;
  rank: number;
  overallScore: number; // percentage
  totalStudentsInClass: number;
}

export interface GetTopStudentsResponse {
  success: boolean;
  message: string;
  data: {
    students: TopStudentItem[];
  };
}

// Student Profile Details API types
export interface StudentProfileDetailsResponse {
  success: boolean;
  message: string;
  data: {
    studentId: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    profileImage?: string;
    studentIdNumber?: string;
    classId?: string;
    className?: string;
    classAverage?: number; // Average percentage of all students in the class
    totalSubjects: number;
    totalTeachers: number;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      description?: string | null;
      teacher?: {
        teacherId: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    }>;
    subjectsSummary: {
      totalSubjects: number;
      totalTeachers: number;
    };
    currentRank?: number | null; // Rank in class based on overall percentage (1 = highest)
    previousRank?: number | null; // Rank from previous month
    rankChange?: number | null; // Positive = improved, negative = dropped
    rankDisplay?: string | null; // Formatted rank display: "Out of 25 students in the class"
    totalStudentsInClass?: number | null;
    overallAverageScore: number; // Student's average across all completed exams
    totalExamsCompleted: number;
    classTeacher?: {
      teacherId: string;
      firstName: string;
      lastName: string;
      email: string;
      profileImage?: string;
    } | null;
    schoolRank?: number | null; // Rank in school (across all students)
    totalSchoolsInTenant?: number | null; // Total schools (classes) in tenant
    achievements?: {
      badgesCount: number;
      achievementsCount: number;
      credentialsCount: number;
    };
  };
}
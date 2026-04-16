/**
 * Teacher Credentials Types - Teacher credential management
 */
import { CredentialCategory } from '../utils/constants/credentialEnums';

// Teacher object for createdBy field
export interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  thrId?: string;
  profilePicture?: string;
}

// Create Credential Request
export interface CreateCredentialRequest {
  credentialName: string;
  description?: string;
  credentialType: string;
  credentialCategory?: CredentialCategory;
  /** Credential template/definition id (e.g. "Good Performance"). Used to prevent re-assigning same credential to same student+exam. */
  credentialId?: string;
  examId?: string;
  otherDetails?: string;
  studentIds: string[];
  validUntil?: Date;
  issuedDate?: Date;
}

// Update Credential Request
export interface UpdateCredentialRequest {
  credentialId: string;
  isActive?: boolean;
  validUntil?: Date;
}

// Credential Response
export interface CredentialResponse {
  credentialId: string;
  credentialName: string;
  description?: string;
  credentialType: string;
  credentialCategory: CredentialCategory;
  examId?: string;
  otherDetails?: string;
  studentId: string;
  issuedDate: Date;
  validUntil?: Date;
  verificationCode: string;
  isActive: boolean;

  createdBy?: TeacherInfo;
}

// Get Credentials Request
export interface GetTeacherCredentialsRequest {
  pageNo?: number;
  pageSize?: number;
  examId?: string;
  studentId?: string;
  isActive?: boolean;
  // Enhanced filters
  credentialType?: string; // "Badge", "Certificate", "Award", "All"
  classId?: string;
  // "All", "Teachers", "Ai Generated", or specific teacher name
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  search?: string; // Search credential title
}

// Enhanced Credential Response (for issued credentials list)
export interface EnhancedCredentialResponse {
  credentialId: string;
  credentialName: string;
  credentialType: string;
  credentialCategory: CredentialCategory;
  className?: string;
  issuedBy: string; // Teacher name or "Percipio Ai"
  dateIssued: Date;
  studentName: string;
  studentId: string;
  examId?: string;
  otherDetails?: string;
  description?: string;
  validUntil?: Date;
  isActive: boolean;
  createdBy?: TeacherInfo;
}

// Get Credentials Response
export interface GetTeacherCredentialsResponse {
  credentials: CredentialResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Enhanced Get Issued Credentials Response
export interface GetIssuedCredentialsResponse {
  credentials: EnhancedCredentialResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Get Teacher Credentials by Teacher ID Response
export interface GetTeacherCredentialsByTeacherIdResponse {
  assignedCredentials: Array<{
    assignmentId: string;
    credentialTemplateId: string;
    credentialTemplateName?: string;
    credentialType?: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    validationPeriod: 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly';
    issuedBy: string;
    issuedTo: string;
    credentialInfo?: string;
    classId?: string;
    className?: string;
    credentialCategory?: string;
  }>;
  issuedCredentials: Array<{
    credentialId: string;
    credentialName: string;
    description?: string;
    credentialType: string;
    credentialCategory: CredentialCategory;
    examId?: string;
    examTitle?: string;
    otherDetails?: string;
    studentId: string;
    studentName?: string;
    className?: string;
    issuedDate: Date;
    validUntil?: Date;
    verificationCode: string;
    isActive: boolean;
    issuedBy: string;
    credentialInfo?: string;
  }>;
}
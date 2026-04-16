/**
 * Credential Template Types - Credential template management
 */

import {
  CredentialType,
  ValidationPeriod,
  CredentialGeneratedBy,
  CredentialFilterType,
} from "../utils/constants/credentialEnums";

// Create Credential Template Request
export interface CreateCredentialTemplateRequest {
  meritBadge: string;
  credentialType: CredentialType;
  validationPeriod: ValidationPeriod;
  subjectId?: string;
  classId?: string;
  issuingCriteria: string;
  credentialInfo: string;
  fileUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
  generatedBy?: CredentialGeneratedBy;
}

// Update Credential Template Request
export interface UpdateCredentialTemplateRequest {
  credentialTemplateId: string;
  meritBadge?: string;
  credentialType?: CredentialType;
  validationPeriod?: ValidationPeriod;
  subjectId?: string;
  classId?: string;
  issuingCriteria?: string;
  credentialInfo?: string;
  fileUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
}

// Credential Template Response
export interface CredentialTemplateResponse {
  credentialTemplateId: string;
  meritBadge: string;
  credentialType: CredentialType;
  validationPeriod: ValidationPeriod;
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  issuingCriteria: string;
  credentialInfo: string;
  fileUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
  createdBy: string;
  createdByName?: string;
  generatedBy: CredentialGeneratedBy;
  createdAt: Date;
  updatedAt: Date;
  // Student information (students who have been issued this credential)
  students?: Array<{
    studentId: string;
    studentName: string;
  }>;
  totalIssuedCount?: number; // Total number of students issued this credential
}

// Get Credential Templates Request
export interface GetCredentialTemplatesRequest {
  pageNo?: number;
  pageSize?: number;
  credentialType?: CredentialType | "All";
  generatedBy?: CredentialGeneratedBy | "All";
  filterType?: CredentialFilterType;
  subjectId?: string;
  classId?: string;
  month?: number; // 1-12
  year?: number;
  search?: string; // Search by meritBadge
}

// Get Credential Templates Response
export interface GetCredentialTemplatesResponse {
  credentialTemplates: CredentialTemplateResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Credential Repository Response (available credential types)
export interface CredentialRepositoryResponse {
  credentialTemplates: Array<{
    credentialTemplateId: string;
    meritBadge: string;
    credentialType: CredentialType;
    validationPeriod: ValidationPeriod;
    subjectName?: string;
    className?: string;
  }>;
}

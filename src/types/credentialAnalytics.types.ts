/**
 * Credential Analytics Types - Analytics for issued credentials
 */

import {
  CredentialType,
  IssuedByFilter,
} from "../utils/constants/credentialEnums";

// Get Credential Analytics Request
export interface GetCredentialAnalyticsRequest {
  subjectId?: string;
  issuedBy?: IssuedByFilter | string; // "All", "Teachers", "Ai Generated", or specific teacher name
  issuerName?: string; // Specific teacher name
  type?: CredentialType | "All";
  month?: number; // 1-12
  year?: number;
}

// Credential Analytics Response
export interface CredentialAnalyticsResponse {
  summary: {
    badges: number;
    certificates: number;
    awards: number;
    total: number;
  };
  issuedItems: Array<{
    credentialId: string;
    credentialName: string;
    credentialType: CredentialType;
    issuedDate: Date;
    issuedBy: string; // Teacher name or "Percipio Ai"
    studentId?: string;
    studentName?: string;
    className?: string;
  }>;
}

// Credential Statistics Response (for dashboard)
export interface CredentialStatisticsResponse {
  totalCredentials: number;
  aiGenerated: number;
  teacherGenerated: number;
  totalAwards: number;
  createdByCurrentUser: number;
  createdByAdmin: number;
}

// Credential Template Stats Response (for credential templates)
export interface CredentialTemplateStatsResponse {
  total: number;
  badges: number;
  certificates: number;
  awards: number;
}

/**
 * Student Credentials & Achievements Types
 */
import { CredentialCategory } from '../utils/constants/credentialEnums';

// Exam summary in credential response (when credentialCategory is exam)
export interface CredentialExamInfo {
  examId: string;
  examName: string;
  examTitle?: string;
  classId?: string;
  subjectId?: string;
}

// Student Credential Response
export interface StudentCredentialResponse {
  credentialId: string;
  credentialName: string;
  description?: string;
  credentialType: string;
  credentialCategory: CredentialCategory;
  examId?: string;
  examTitle: string;
  /** When credentialCategory is exam, contains examId, examName, and related fields */
  exam?: CredentialExamInfo;
  otherDetails?: string;
  studentId: string;
  issuedDate: Date;
  validUntil?: Date;
  credentialUrl?: string;
  verificationCode: string;
  isActive: boolean;
  createdBy?: string;
  schoolName?: string;
  tenantLogo?: string;
}

// Get Credentials Request
export interface GetCredentialsRequest {
  pageNo?: number;
  pageSize?: number;
  credentialType?: string;
  isActive?: boolean;
  sortBy?: 'issuedDate';
  sortOrder?: 'asc' | 'desc';
  fromDate?: string;
  toDate?: string;
  createdBy?: string;
}

// Get Credentials Response
export interface GetCredentialsResponse {
  credentials: StudentCredentialResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Student Achievement Response
export interface StudentAchievementResponse {
  achievementId: string;
  achievementName: string;
  description: string;
  achievementType: string;
  category: string;
  icon: string;
  unlockedDate: Date;
  progress: number;
  isUnlocked: boolean;
}

// Get Achievements Request
export interface GetAchievementsRequest {
  pageNo?: number;
  pageSize?: number;
  category?: string;
  isUnlocked?: boolean;
}

// Get Achievements Response
export interface GetAchievementsResponse {
  achievements: StudentAchievementResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    totalAchievements: number;
    unlockedAchievements: number;
    unlockedPercentage: number;
  };
}

// Student Badge Response
export interface StudentBadgeResponse {
  badgeId: string;
  badgeName: string;
  description: string;
  badgeType: string;
  tier: string;
  icon: string;
  earnedDate: Date;
  progress: number;
  isEarned: boolean;
}

// Get Badges Request
export interface GetBadgesRequest {
  pageNo?: number;
  pageSize?: number;
  badgeType?: string;
  tier?: string;
  isEarned?: boolean;
}

// Get Badges Response
export interface GetBadgesResponse {
  badges: StudentBadgeResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    totalBadges: number;
    earnedBadges: number;
    earnedPercentage: number;
  };
}

// Verify Credential Request
export interface VerifyCredentialRequest {
  verificationCode: string;
}

// Verify Credential Response
export interface VerifyCredentialResponse {
  isValid: boolean;
  credential?: StudentCredentialResponse;
  message: string;
}

// Download Credential Request
export interface DownloadCredentialRequest {
  credentialId: string;
  format: 'pdf' | 'png';
}


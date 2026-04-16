/**
 * Grading System Types
 * Type definitions for grading system management
 * Updated to fix compilation issues
 */

export interface GradeRange {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  description?: string;
  color?: string;
}

export interface CreateGradingSystemRequest {
  systemName: string;
  description?: string;
  gradeRanges: GradeRange[];
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateGradingSystemRequest {
  systemName?: string;
  description?: string;
  gradeRanges?: GradeRange[];
  isActive?: boolean;
  isDefault?: boolean;
}

export interface SearchGradingSystemsRequest {
  query?: string;
  isActive?: boolean;
  isDefault?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CalculateGradeRequest {
  percentage: number;
  gradingSystemId: string;
}

export interface GradingSystemResponse {
  _id: string;
  systemName: string;
  description?: string;
  gradeRanges: GradeRange[];
  isActive: boolean;
  isDefault: boolean;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface GradingSystemListResponse {
  gradingSystems: GradingSystemResponse[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GradingSystemStatistics {
  totalGradingSystems: number;
  activeGradingSystems: number;
  defaultGradingSystems: number;
  gradingSystemsByTenant: Record<string, number>;
  averageGradeRanges: number;
}

export interface CalculateGradeResponse {
  percentage: number;
  grade: string;
  gradingSystemId: string;
  gradingSystemName: string;
}

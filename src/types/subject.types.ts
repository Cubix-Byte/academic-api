// Type definitions for Subject-related requests and responses

// Create subject request interface
export interface CreateSubjectRequest {
  tenantId: string;
  name: string;
  code: string;
  grade?: number;
}

// Update subject request interface
export interface UpdateSubjectRequest {
  name?: string;
  code?: string;
  grade?: number;
  isActive?: boolean;
}

// Subject response interface
export interface SubjectResponse {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  grade?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}


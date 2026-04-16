import { IExamMode } from '../models/examMode.schema';

/**
 * ExamMode Types - Request and Response interfaces for Exam Mode management
 */

// Create ExamMode Request
export interface CreateExamModeRequest {
  name: string;
  description: string;
}

// Update ExamMode Request
export interface UpdateExamModeRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// ExamMode Response
export interface ExamModeResponse extends IExamMode {
  examCount?: number; // Number of exams associated with this mode
  examStatusCounts?: {
    Draft: number;
    Unpublished: number;
    Published: number;
    Released: number;
    "In Progress": number;
    Completed: number;
    Cancelled: number;
  };
  gradingTypeStatusCounts?: {
    "In Progress": number;
    "Waiting for Grading": number;
    "Completed": number;
  };
  /** Pass count for this mode (student context only: classId + studentId, Released exams) */
  passCount?: number;
  /** Fail count for this mode (student context only) */
  failCount?: number;
}

// Get All ExamModes Request
export interface GetAllExamModesRequest {
  pageNo?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  tenantId?: string;
  teacherId?: string; // Filter exams by teacherId if provided (for TEACHER role)
  batchId?: string; // Filter exams by batchId if provided
  classId?: string; // Filter exams by classId if provided (e.g. for student results)
  studentId?: string; // When STUDENT role + classId: used to add passCount/failCount per mode
}

// Get All ExamModes Response
export interface GetAllExamModesResponse {
  examModes: ExamModeResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// ExamMode Statistics
export interface ExamModeStatistics {
  total: number;
  active: number;
  inactive: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  recentExamModes: number;
}

// ExamMode Dropdown List Item (for DDL endpoint)
export interface ExamModeDDLItem {
  id: string;
  name: string;
}

// ExamMode Dropdown List Response (for DDL endpoint)
export interface ExamModeDDLResponse {
  examModes: ExamModeDDLItem[];
}


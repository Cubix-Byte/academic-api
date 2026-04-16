/**
 * Activity Log Types
 * Type definitions for activity log requests and responses
 */

export type TeacherActivityType = 
  | 'ExamCreated' 
  | 'ExamEdited' 
  | 'ExamScheduled' 
  | 'PracticeExamCreated' 
  | 'PracticeExamEdited' 
  | 'CredentialCreated' 
  | 'CredentialAssigned';

export type StudentActivityType = 
  | 'ExamCompleted' 
  | 'PracticeCompleted' 
  | 'BadgeEarned' 
  | 'CertificateEarned';

export type ActivityType = TeacherActivityType | StudentActivityType;

// Request types
export interface GetActivityLogsRequest {
  tenantId: string;
  userType?: 'teacher' | 'student';
  userId?: string;
  classId?: string;
  subjectId?: string;
  activityType?: ActivityType;
  month?: string; // Month name like "August"
  year?: number;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  limit?: number;
  offset?: number;
}

export interface GetTeacherActivityLogsRequest {
  tenantId: string;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  activityType?: TeacherActivityType;
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface GetStudentActivityLogsRequest {
  tenantId: string;
  studentId?: string;
  classId?: string;
  subjectId?: string;
  activityType?: StudentActivityType;
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface GetClassActivityLogsRequest {
  tenantId: string;
  classId: string;
  userType?: 'teacher' | 'student';
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface GetSubjectActivityLogsRequest {
  tenantId: string;
  subjectId: string;
  userType?: 'teacher' | 'student';
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface GetUserActivityLogsRequest {
  tenantId: string;
  userId: string;
  userType: 'teacher' | 'student';
  month?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Create log request types
export interface CreateTeacherActivityLogRequest {
  teacherId: string;
  activityType: TeacherActivityType;
  activityDescription: string;
  relatedEntityId: string;
  relatedEntityType: string;
  classId: string;
  subjectId: string;
  studentId?: string;
  tenantId: string;
}

export interface CreateStudentActivityLogRequest {
  studentId: string;
  activityType: StudentActivityType;
  activityDescription: string;
  relatedEntityId: string;
  relatedEntityType: string;
  classId: string;
  subjectId: string;
  tenantId: string;
}

// Response types
export interface ActivityLogItem {
  activityId: string;
  userName: string;
  activityDescription: string;
  activityType: ActivityType;
  logDate: string; // Formatted as "13/08/2025"
  relativeTime: string; // "1h ago", "1day ago", "1w ago", "1M ago"
  subject?: {
    id: string;
    name: string;
  };
  class?: {
    id: string;
    name: string;
    form: string; // "Form 4 | Class A"
  };
  relatedEntity?: {
    id: string;
    type: string;
    name: string;
  };
  createdAt: Date;
}

export interface ActivityLogsResponse {
  success: boolean;
  data: {
    logs: ActivityLogItem[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface TeacherActivityLogsResponse {
  success: boolean;
  data: {
    logs: ActivityLogItem[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

export interface StudentActivityLogsResponse {
  success: boolean;
  data: {
    logs: ActivityLogItem[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

// New simplified request types for the 3 new APIs (using generic filter pattern with pagination)
export interface GetTeacherActivitiesRequest {
  tenantId: string;
  pageNo: number;
  pageSize: number;
  filters?: Record<string, any>; // Generic filter from buildQueryFromRequest
  sort?: Record<string, 1 | -1>; // Sort from buildQueryFromRequest
}

export interface GetExamActivitiesRequest {
  tenantId: string;
  pageNo: number;
  pageSize: number;
  filters?: Record<string, any>; // Generic filter from buildQueryFromRequest
  sort?: Record<string, 1 | -1>; // Sort from buildQueryFromRequest
}

export interface GetStudentActivitiesRequest {
  tenantId: string;
  studentId: string; // Required
  pageNo: number;
  pageSize: number;
  filters?: Record<string, any>; // Generic filter from buildQueryFromRequest
  sort?: Record<string, 1 | -1>; // Sort from buildQueryFromRequest
}

// Response types for the 3 new APIs (with pagination)
export interface TeacherActivitiesResponse {
  success: boolean;
  message: string;
  data: {
    logs: ActivityLogItem[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

export interface ExamActivitiesResponse {
  success: boolean;
  message: string;
  data: {
    logs: ActivityLogItem[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  };
}

export interface StudentActivitiesResponse {
  success: boolean;
  message: string;
  data: {
    logs: ActivityLogItem[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  };
}



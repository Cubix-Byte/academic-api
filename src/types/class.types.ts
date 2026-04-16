// Type definitions for Class-related requests and responses

// Create class request interface (unified structure for single or bulk)
export interface CreateClassRequest {
  batchId: string;
  subjectIds: string[];
  grade: number;
  class_details: Array<{
    name: string;
    description: string;
    capacity: number;
  }>;
  // Status is not in request - defaults to active in backend
}

// Update class request interface
export interface UpdateClassRequest {
  name?: string;
  section?: string;
  capacity?: number;
  classTeacherId?: string;
  batchId?: string; // Optional batch reference
  subjectIds?: string[];
  description?: string;
  isActive?: boolean;
}

// Class response interface
export interface ClassResponse {
  id: string;
  tenantId: string;
  name: string;
  grade: number;
  section?: string;
  capacity: number;
  classTeacherId?: string;
  mainClassTeacherId?: string; // Alias for classTeacherId (main class teacher)
  mainClassTeacherName?: string; // Name of the main class teacher
  batchId?: string; // Optional batch reference
  batch?: {
    // Batch details if available
    id: string;
    batchName: string;
    totalClasses: number;
    startFrom?: Date;
    endTill?: Date;
  };
  subjectIds: string[];
  studentIds: string[];
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Add students to class request
export interface AddStudentsRequest {
  studentIds: string[];
}

// Remove students from class request
export interface RemoveStudentsRequest {
  studentIds: string[];
}

// Add subjects to class request
export interface AddSubjectsRequest {
  subjectIds: string[];
}

// Remove subjects from class request
export interface RemoveSubjectsRequest {
  subjectIds: string[];
}

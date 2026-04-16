/**
 * Credential Assignment Types - Assign credentials to teachers
 */

// Assign Credential to Teachers Request
export interface AssignCredentialToTeachersRequest {
  teacherIds: string[];
  startDate: Date;
  endDate: Date;
  classId?: string;
  credentialCategory?: string;
}

// Assign Credential to Teachers Response
export interface AssignCredentialToTeachersResponse {
  assignments: Array<{
    assignmentId: string;
    credentialTemplateId: string;
    teacherId: string;
    teacherName?: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }>;
}

// Get Teacher Credential Assignments Request
export interface GetTeacherCredentialAssignmentsRequest {
  pageNo?: number;
  pageSize?: number;
  teacherId?: string;
  credentialTemplateId?: string;
  isActive?: boolean;
}

// Get Teacher Credential Assignments Response
export interface GetTeacherCredentialAssignmentsResponse {
  assignments: Array<{
    assignmentId: string;
    credentialTemplateId: string;
    credentialTemplateName?: string;
    teacherId: string;
    teacherName?: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }>;
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// Get Credential Assignments Details Request
export interface GetCredentialAssignmentsDetailsRequest {
  pageNo?: number;
  pageSize?: number;
  /** When provided (e.g. teacher section), return only this teacher's assignment and issued credentials */
  teacherId?: string;
}

// Get Credential Assignments Details Response
export interface GetCredentialAssignmentsDetailsResponse {
  assignedTeachers: Array<{
    assignmentId: string;
    teacherId: string;
    teacherName: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }>;
  issuedToStudents: Array<{
    credentialId: string;
    credentialName: string;
    description?: string;
    credentialType: string;
    studentId: string;
    studentName: string;
    teacherId: string;
    teacherName: string;
    examId: string;
    examTitle?: string;
    issuedDate: Date;
    validUntil?: Date;
    verificationCode: string;
    isActive: boolean;
  }>;
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

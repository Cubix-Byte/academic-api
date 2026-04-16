import { ITeacher } from '../models/teacher.schema';

// Request types for teacher operations
export interface CreateTeacherRequest extends Partial<ITeacher> {
  // User data (for creating user in user-api)
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  tenantId?: string;
  tenantName?: string;
  demoPassword?: string;
  userAccessType?: string;
  isEmailVerified?: boolean;
  userType?: string;
  roleName?: string;
}

export interface UpdateTeacherRequest extends Partial<ITeacher> {
  // User data (for updating user in user-api)
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  profilePicture?: string; // Profile picture URL
  password?: string; // Password for updating user in user-api
}

// Response types
export interface TeacherResponse extends ITeacher {
  // Additional computed fields
  fullName?: string;
  assignedClassesCount?: number;
  assignedSubjectsCount?: number;
}

// Assignment operations
export interface AssignClassesRequest {
  assignments: {
    classId: string;
    subjectId: string;
  }[];
}

export interface AssignSubjectsRequest {
  subjectIds: string[];
}

// Bulk operations
export interface BulkCreateTeacherRequest {
  teachers: CreateTeacherRequest[];
}

export interface BulkCreateTeacherResponse {
  created: TeacherResponse[];
  failed: {
    data: CreateTeacherRequest;
    error: string;
  }[];
}

// Get My Class Detail
export interface GetMyClassDetailRequest {
  classId: string;
  subjectId: string;
}

export interface GetMyClassDetailResponse {
  success: boolean;
  data: {
    classInfo: {
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      totalStudents: number;
      classTeacherId: string | null;
    };
    overallStats: {
      totalExams: number;
      overallClassAverage: number; // percentage
      subjectAverage: number; // percentage
      grade: string; // calculated from percentage
      totalStudents: number;
    };
    topStudents: Array<{
      studentId: string;
      studentName: string;
      rank: number;
      overallScore: number; // percentage
      grade: string;
    }>;
    studentList: Array<{
      studentId: string;
      studentName: string;
      rollNumber: string;
      avgScore: number; // percentage
      examsCompleted: number;
      totalExams: number;
      performanceStatus: string; // Excellent, Average, Low
    }>;
    performanceBreakdown: Array<{
      examId: string;
      examTitle: string;
      averageScore: number; // percentage
      totalStudents: number;
      completedCount: number;
      createdOn: Date | string;
    }>;
  };
}

import * as activityLogRepository from "../repositories/activityLog.repository";
import { Class } from "../models/class.schema";
import { Subject } from "../models/subject.schema";
import { Exam } from "../models/exam.schema";
import { ExamCredential } from "../models/examCredential.schema";
import { TeacherAssignClasses } from "../models";
import {
  formatRelativeTime,
  formatLogDate,
  fetchUserNames,
  parseMonth,
} from "@/utils/activityLog.helper";
import {
  GetActivityLogsRequest,
  GetTeacherActivityLogsRequest,
  GetStudentActivityLogsRequest,
  GetClassActivityLogsRequest,
  GetSubjectActivityLogsRequest,
  GetUserActivityLogsRequest,
  CreateTeacherActivityLogRequest,
  CreateStudentActivityLogRequest,
  ActivityLogItem,
  ActivityLogsResponse,
  TeacherActivityLogsResponse,
  StudentActivityLogsResponse,
  GetTeacherActivitiesRequest,
  GetExamActivitiesRequest,
  GetStudentActivitiesRequest,
  TeacherActivitiesResponse,
  ExamActivitiesResponse,
  StudentActivitiesResponse
} from '@/types/activityLog.types';
import { ITeacherActivityLog } from '@/models';
import { IStudentActivityLog } from '@/models';
import mongoose from 'mongoose';

/**
 * Activity Log Service - Business logic for activity log management
 */

// Create teacher activity log
export const createTeacherActivityLog = async (
  data: CreateTeacherActivityLogRequest,
  session?: mongoose.ClientSession
): Promise<ITeacherActivityLog> => {
  try {
    return await activityLogRepository.createTeacherActivityLog(data, session);
  } catch (error) {
    console.error("Error creating teacher activity log:", error);
    throw error;
  }
};

// Create student activity log
export const createStudentActivityLog = async (
  data: CreateStudentActivityLogRequest,
  session?: mongoose.ClientSession
): Promise<IStudentActivityLog> => {
  try {
    return await activityLogRepository.createStudentActivityLog(data, session);
  } catch (error) {
    console.error("Error creating student activity log:", error);
    throw error;
  }
};

// Helper function to transform logs to ActivityLogItem format
const transformLogsToItems = async (
  teacherLogs: ITeacherActivityLog[],
  studentLogs: IStudentActivityLog[]
): Promise<ActivityLogItem[]> => {
  const items: ActivityLogItem[] = [];

  // Collect all user IDs and entity IDs
  const userIds = new Set<string>();
  const classIds = new Set<string>();
  const subjectIds = new Set<string>();
  const entityIds = new Set<string>();

  teacherLogs.forEach((log) => {
    userIds.add(log.teacherId.toString());
    classIds.add(log.classId.toString());
    subjectIds.add(log.subjectId.toString());
    entityIds.add(log.relatedEntityId.toString());
  });

  studentLogs.forEach((log) => {
    userIds.add(log.studentId.toString());
    classIds.add(log.classId.toString());
    subjectIds.add(log.subjectId.toString());
    entityIds.add(log.relatedEntityId.toString());
  });

  // Fetch all data in parallel
  const [userNames, classes, subjects, exams, credentials] = await Promise.all([
    fetchUserNames(Array.from(userIds)),
    Class.find({
      _id: {
        $in: Array.from(classIds).map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("_id name grade section")
      .lean(),
    Subject.find({
      _id: {
        $in: Array.from(subjectIds).map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      },
    })
      .select("_id name")
      .lean(),
    Exam.find({
      _id: {
        $in: Array.from(entityIds).map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("_id examTitle examType")
      .lean(),
    ExamCredential.find({
      _id: {
        $in: Array.from(entityIds).map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("_id credentialName credentialType")
      .lean(),
  ]);

  // Build entity map
  const entityMap: Record<string, { id: string; type: string; name: string }> =
    {};
  exams.forEach((exam: any) => {
    entityMap[exam._id.toString()] = {
      id: exam._id.toString(),
      type: exam.examType === "Practice" ? "PracticeExam" : "Exam",
      name: exam.examTitle,
    };
  });
  credentials.forEach((cred: any) => {
    entityMap[cred._id.toString()] = {
      id: cred._id.toString(),
      type: cred.credentialType,
      name: cred.credentialName,
    };
  });

  // Create class and subject maps
  const classMap: Record<string, { id: string; name: string; form: string }> =
    {};
  classes.forEach((cls: any) => {
    const form = cls.grade ? `Form ${cls.grade}` : "";
    const section = cls.section ? ` | Class ${cls.section}` : "";
    classMap[cls._id.toString()] = {
      id: cls._id.toString(),
      name: cls.name,
      form: `${form}${section}`,
    };
  });

  const subjectMap: Record<string, { id: string; name: string }> = {};
  subjects.forEach((subj: any) => {
    subjectMap[subj._id.toString()] = {
      id: subj._id.toString(),
      name: subj.name,
    };
  });

  // Transform teacher logs
  teacherLogs.forEach((log) => {
    const userName = userNames[log.teacherId.toString()] || "Unknown Teacher";
    const classInfo = classMap[log.classId.toString()];
    const subjectInfo = subjectMap[log.subjectId.toString()];
    const entityInfo = entityMap[log.relatedEntityId.toString()];

    items.push({
      activityId: log._id.toString(),
      userName,
      activityDescription: log.activityDescription,
      activityType: log.activityType,
      logDate: formatLogDate(log.createdAt),
      relativeTime: formatRelativeTime(log.createdAt),
      subject: subjectInfo,
      class: classInfo,
      relatedEntity: entityInfo,
      createdAt: log.createdAt,
    });
  });

  // Transform student logs
  studentLogs.forEach((log) => {
    const userName = userNames[log.studentId.toString()] || "Unknown Student";
    const classInfo = classMap[log.classId.toString()];
    const subjectInfo = subjectMap[log.subjectId.toString()];
    const entityInfo = entityMap[log.relatedEntityId.toString()];

    items.push({
      activityId: log._id.toString(),
      userName,
      activityDescription: log.activityDescription,
      activityType: log.activityType,
      logDate: formatLogDate(log.createdAt),
      relativeTime: formatRelativeTime(log.createdAt),
      subject: subjectInfo,
      class: classInfo,
      relatedEntity: entityInfo,
      createdAt: log.createdAt,
    });
  });

  // Sort by createdAt descending
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return items;
};

// Get activity logs with role-based filtering
export const getActivityLogs = async (
  params: GetActivityLogsRequest,
  userRole: string,
  userId?: string
): Promise<ActivityLogsResponse> => {
  try {
    const {
      tenantId,
      month,
      year,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    // Parse dates
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    // Role-based filtering
    let userType: "teacher" | "student" | undefined = params.userType;
    let filteredUserId: string | undefined = params.userId;
    let teacherClassIds: string[] | undefined;

    if (userRole === "STUDENT") {
      // Students can only see their own logs
      userType = "student";
      filteredUserId = userId;
    } else if (userRole === "TEACHER") {
      // Teachers can see their class subject-wise logs and individual student logs
      // If no specific user is requested, show teacher's own logs
      if (!params.userId) {
        userType = "teacher";
        filteredUserId = userId;
      } else {
        // Viewing specific student logs - must be in one of the teacher's classes
        // Fetch teacher's assigned classes
        const assignedClasses = await TeacherAssignClasses.find({
          teacherId: new mongoose.Types.ObjectId(userId),
          tenantId: tenantId,
          status: 'active'
        }).select('classId').lean();

        const myClassIds = assignedClasses.map(ac => ac.classId.toString());

        // If teacher is trying to view a specific class, ensure it's one of theirs
        if (params.classId && !myClassIds.includes(params.classId)) {
          return {
            success: true,
            data: { logs: [], total: 0, limit, offset }
          };
        }

        // If viewing student logs, restrict to their classes
        userType = "student";
        filteredUserId = params.userId;

        // Apply class filter if not already present
        if (!params.classId) {
          teacherClassIds = myClassIds;
        }
      }
    }
    // ADMIN/SUPERADMIN can see all logs

    const filters: any = {
      tenantId,
      userType,
      userId: filteredUserId,
      classId: params.classId,
      classIds: teacherClassIds, // Added for teacher filtering
      subjectId: params.subjectId,
      activityType: params.activityType,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      month: parsedMonth,
      year: parsedYear,
      limit,
      offset,
    };

    const { teacherLogs, studentLogs } =
      await activityLogRepository.findActivityLogs(filters);
    const items = await transformLogsToItems(teacherLogs, studentLogs);

    return {
      success: true,
      data: {
        logs: items,
        total: items.length,
        limit,
        offset,
      },
    };
  } catch (error) {
    console.error("Error getting activity logs:", error);
    throw error;
  }
};

// Get teacher activity logs
export const getTeacherActivityLogs = async (
  params: GetTeacherActivityLogsRequest
): Promise<TeacherActivityLogsResponse> => {
  try {
    const {
      tenantId,
      month,
      year,
      startDate,
      endDate,
      pageNo = 1,
      pageSize = 10,
    } = params;

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    // Convert pageNo/pageSize to limit/offset for repository
    const limit = pageSize;
    const offset = (pageNo - 1) * pageSize;

    // Get total count and logs in parallel
    const [total, logs] = await Promise.all([
      activityLogRepository.countTeacherActivityLogs({
        tenantId,
        teacherId: params.teacherId,
        classId: params.classId,
        subjectId: params.subjectId,
        activityType: params.activityType,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        month: parsedMonth,
        year: parsedYear,
      }),
      activityLogRepository.findTeacherActivityLogs({
        tenantId,
        teacherId: params.teacherId,
        classId: params.classId,
        subjectId: params.subjectId,
        activityType: params.activityType,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        month: parsedMonth,
        year: parsedYear,
        limit,
        offset,
      }),
    ]);

    const items = await transformLogsToItems(logs, []);

    return {
      success: true,
      data: {
        logs: items,
        pagination: {
          total,
          pageNo,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  } catch (error) {
    console.error("Error getting teacher activity logs:", error);
    throw error;
  }
};

// Get student activity logs
export const getStudentActivityLogs = async (
  params: GetStudentActivityLogsRequest,
  userRole?: string,
  userId?: string
): Promise<StudentActivityLogsResponse> => {
  try {
    const {
      tenantId,
      month,
      year,
      startDate,
      endDate,
      pageNo = 1,
      pageSize = 10,
    } = params;

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    // Convert pageNo/pageSize to limit/offset for repository
    const limit = pageSize;
    const offset = (pageNo - 1) * pageSize;

    let classIds: string[] | undefined;

    // Role-based filtering for students
    if (userRole === 'TEACHER' && userId) {
      const assignedClasses = await TeacherAssignClasses.find({
        teacherId: new mongoose.Types.ObjectId(userId),
        tenantId: tenantId,
        status: 'active'
      }).select('classId').lean();

      classIds = assignedClasses.map(ac => ac.classId.toString());

      // If teacher is trying to view a specific class, ensure it's one of theirs
      if (params.classId && !classIds.includes(params.classId)) {
        return {
          success: true,
          data: {
            logs: [],
            pagination: { total: 0, pageNo, pageSize, totalPages: 0 }
          }
        };
      }
    }

    // Get total count and logs in parallel
    const [total, logs] = await Promise.all([
      activityLogRepository.countStudentActivityLogs({
        tenantId,
        studentId: params.studentId,
        classId: params.classId,
        classIds: classIds, // Added for teacher filtering
        subjectId: params.subjectId,
        activityType: params.activityType,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        month: parsedMonth,
        year: parsedYear,
      }),
      activityLogRepository.findStudentActivityLogs({
        tenantId,
        studentId: params.studentId,
        classId: params.classId,
        classIds: classIds, // Added for teacher filtering
        subjectId: params.subjectId,
        activityType: params.activityType,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        month: parsedMonth,
        year: parsedYear,
        limit,
        offset,
      }),
    ]);

    const items = await transformLogsToItems([], logs);

    return {
      success: true,
      data: {
        logs: items,
        pagination: {
          total,
          pageNo,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  } catch (error) {
    console.error("Error getting student activity logs:", error);
    throw error;
  }
};

// Get class-wise activity logs
export const getClassActivityLogs = async (
  params: GetClassActivityLogsRequest,
  userRole: string
): Promise<ActivityLogsResponse> => {
  try {
    const {
      tenantId,
      classId,
      month,
      year,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    const filters: any = {
      tenantId,
      classId,
      userType: params.userType,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      month: parsedMonth,
      year: parsedYear,
      limit,
      offset,
    };

    const { teacherLogs, studentLogs } =
      await activityLogRepository.findClassActivityLogs(filters);
    const items = await transformLogsToItems(teacherLogs, studentLogs);

    return {
      success: true,
      data: {
        logs: items,
        total: items.length,
        limit,
        offset,
      },
    };
  } catch (error) {
    console.error("Error getting class activity logs:", error);
    throw error;
  }
};

// Get subject-wise activity logs
export const getSubjectActivityLogs = async (
  params: GetSubjectActivityLogsRequest,
  userRole: string
): Promise<ActivityLogsResponse> => {
  try {
    const {
      tenantId,
      subjectId,
      month,
      year,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    const filters: any = {
      tenantId,
      subjectId,
      userType: params.userType,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      month: parsedMonth,
      year: parsedYear,
      limit,
      offset,
    };

    const { teacherLogs, studentLogs } =
      await activityLogRepository.findSubjectActivityLogs(filters);
    const items = await transformLogsToItems(teacherLogs, studentLogs);

    return {
      success: true,
      data: {
        logs: items,
        total: items.length,
        limit,
        offset,
      },
    };
  } catch (error) {
    console.error("Error getting subject activity logs:", error);
    throw error;
  }
};

// Get user-specific activity logs
export const getUserActivityLogs = async (
  params: GetUserActivityLogsRequest
): Promise<ActivityLogsResponse> => {
  try {
    const {
      tenantId,
      userId,
      userType,
      month,
      year,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = params;

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;

    if (startDate) parsedStartDate = new Date(startDate);
    if (endDate) parsedEndDate = new Date(endDate);
    if (month) parsedMonth = parseMonth(month);
    if (year) parsedYear = year;

    const filters: any = {
      tenantId,
      userId,
      userType,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      month: parsedMonth,
      year: parsedYear,
      limit,
      offset,
    };

    const { teacherLogs, studentLogs } =
      await activityLogRepository.findActivityLogs(filters);
    const items = await transformLogsToItems(teacherLogs, studentLogs);

    return {
      success: true,
      data: {
        logs: items,
        total: items.length,
        limit,
        offset,
      },
    };
  } catch (error) {
    console.error("Error getting user activity logs:", error);
    throw error;
  }
};

// Get teacher activities (using generic filter pattern with pagination)
export const getTeacherActivities = async (
  params: GetTeacherActivitiesRequest
): Promise<TeacherActivitiesResponse> => {
  try {
    const { tenantId, pageNo, pageSize, filters = {}, sort = { createdAt: -1 } } = params;

    // Extract teacherId from filter if present
    let teacherId: string | undefined;
    if (filters.teacherId) {
      if (typeof filters.teacherId === 'object' && filters.teacherId.$eq !== undefined) {
        teacherId = filters.teacherId.$eq;
      } else if (typeof filters.teacherId === 'string') {
        teacherId = filters.teacherId;
      }
      // Remove from filters as it will be handled separately
      delete filters.teacherId;
    }

    // Build repository filters (get all matching records for total count)
    const repoFilters: any = {
      tenantId,
      teacherId
    };

    // Handle date filters from generic filter
    if (filters.createdAt) {
      if (filters.createdAt.$gte) {
        repoFilters.startDate = new Date(filters.createdAt.$gte);
      }
      if (filters.createdAt.$lte) {
        repoFilters.endDate = new Date(filters.createdAt.$lte);
      }
      delete filters.createdAt;
    }

    // Handle activityType filter
    if (filters.activityType) {
      if (typeof filters.activityType === 'object' && filters.activityType.$eq !== undefined) {
        repoFilters.activityType = filters.activityType.$eq;
      } else if (typeof filters.activityType === 'string') {
        repoFilters.activityType = filters.activityType;
      }
    }

    // Get all teacher logs (no limit for total count calculation)
    const allLogs = await activityLogRepository.findTeacherActivityLogs(repoFilters);
    const allItems = await transformLogsToItems(allLogs, []);

    // Apply custom sort if provided, otherwise default to createdAt desc
    if (sort && Object.keys(sort).length > 0) {
      allItems.sort((a, b) => {
        for (const [field, direction] of Object.entries(sort)) {
          let aVal: any;
          let bVal: any;

          // Handle createdAt field
          if (field === 'createdAt') {
            aVal = a.createdAt;
            bVal = b.createdAt;
          } else {
            aVal = (a as any)[field];
            bVal = (b as any)[field];
          }

          if (aVal !== bVal) {
            if (aVal instanceof Date && bVal instanceof Date) {
              return direction === 1 ? (aVal.getTime() - bVal.getTime()) : (bVal.getTime() - aVal.getTime());
            }
            return direction === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          }
        }
        return 0;
      });
    } else {
      // Default sort by createdAt descending
      allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Calculate pagination
    const total = allItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (pageNo - 1) * pageSize;
    const paginatedItems = allItems.slice(offset, offset + pageSize);

    return {
      success: true,
      message: 'Teacher activities retrieved successfully',
      data: {
        logs: paginatedItems,
        pagination: {
          total,
          pageNo,
          pageSize,
          totalPages
        }
      }
    };
  } catch (error) {
    console.error('Error getting teacher activities:', error);
    throw error;
  }
};

// Get exam activities (teacher created + student attempted, using generic filter pattern with pagination)
export const getExamActivities = async (
  params: GetExamActivitiesRequest
): Promise<ExamActivitiesResponse> => {
  try {
    const { tenantId, pageNo, pageSize, filters = {}, sort = { createdAt: -1 } } = params;

    // Build repository filters (get all matching records for total count)
    const teacherFilters: any = {
      tenantId
    };

    const studentFilters: any = {
      tenantId
    };

    // Handle date filters from generic filter
    if (filters.createdAt) {
      if (filters.createdAt.$gte) {
        teacherFilters.startDate = new Date(filters.createdAt.$gte);
        studentFilters.startDate = new Date(filters.createdAt.$gte);
      }
      if (filters.createdAt.$lte) {
        teacherFilters.endDate = new Date(filters.createdAt.$lte);
        studentFilters.endDate = new Date(filters.createdAt.$lte);
      }
    }

    const [allTeacherLogs, allStudentLogs] = await Promise.all([
      activityLogRepository.findTeacherActivityLogs(teacherFilters),
      activityLogRepository.findStudentActivityLogs(studentFilters)
    ]);

    // Filter teacher logs for exam-related activities
    const examActivityTypes = ['ExamCreated', 'PracticeExamCreated', 'ExamEdited', 'PracticeExamEdited', 'ExamScheduled'];
    const teacherLogs = allTeacherLogs.filter(log => examActivityTypes.includes(log.activityType));

    // Filter student logs for exam-related activities
    const studentExamActivityTypes = ['ExamCompleted', 'PracticeCompleted'];
    const studentLogs = allStudentLogs.filter(log => studentExamActivityTypes.includes(log.activityType));

    // Combine and transform
    const allItems = await transformLogsToItems(teacherLogs, studentLogs);

    // Apply custom sort if provided, otherwise default to createdAt desc
    if (sort && Object.keys(sort).length > 0) {
      allItems.sort((a, b) => {
        for (const [field, direction] of Object.entries(sort)) {
          let aVal: any;
          let bVal: any;

          // Handle createdAt field
          if (field === 'createdAt') {
            aVal = a.createdAt;
            bVal = b.createdAt;
          } else {
            aVal = (a as any)[field];
            bVal = (b as any)[field];
          }

          if (aVal !== bVal) {
            if (aVal instanceof Date && bVal instanceof Date) {
              return direction === 1 ? (aVal.getTime() - bVal.getTime()) : (bVal.getTime() - aVal.getTime());
            }
            return direction === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          }
        }
        return 0;
      });
    } else {
      // Default sort by createdAt descending
      allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Calculate pagination
    const total = allItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (pageNo - 1) * pageSize;
    const paginatedItems = allItems.slice(offset, offset + pageSize);

    return {
      success: true,
      message: 'Exam activities retrieved successfully',
      data: {
        logs: paginatedItems,
        pagination: {
          total,
          pageNo,
          pageSize,
          totalPages
        }
      }
    };
  } catch (error) {
    console.error('Error getting exam activities:', error);
    throw error;
  }
};

// Get student activities (studentId required, using generic filter pattern with pagination)
export const getStudentActivities = async (
  params: GetStudentActivitiesRequest,
  userRole?: string,
  userId?: string
): Promise<StudentActivitiesResponse> => {
  try {
    const { tenantId, studentId, pageNo, pageSize, filters = {}, sort = { createdAt: -1 } } = params;

    if (!studentId) {
      throw new Error('Student ID is required');
    }

    let classIds: string[] | undefined;

    // Role-based filtering for students
    if (userRole === 'TEACHER' && userId) {
      const assignedClasses = await TeacherAssignClasses.find({
        teacherId: new mongoose.Types.ObjectId(userId),
        tenantId: tenantId,
        status: 'active'
      }).select('classId').lean();

      classIds = assignedClasses.map(ac => ac.classId.toString());
    }

    // Build repository filters (get all matching records for total count)
    const repoFilters: any = {
      tenantId,
      studentId,
      classIds // Added for teacher filtering
    };

    // Handle date filters from generic filter
    if (filters.createdAt) {
      if (filters.createdAt.$gte) {
        repoFilters.startDate = new Date(filters.createdAt.$gte);
      }
      if (filters.createdAt.$lte) {
        repoFilters.endDate = new Date(filters.createdAt.$lte);
      }
      delete filters.createdAt;
    }

    // Handle activityType filter
    if (filters.activityType) {
      if (typeof filters.activityType === 'object' && filters.activityType.$eq !== undefined) {
        repoFilters.activityType = filters.activityType.$eq;
      } else if (typeof filters.activityType === 'string') {
        repoFilters.activityType = filters.activityType;
      }
    }

    // Get all student logs (no limit for total count calculation)
    const allLogs = await activityLogRepository.findStudentActivityLogs(repoFilters);
    const allItems = await transformLogsToItems([], allLogs);

    // Apply custom sort if provided, otherwise default to createdAt desc
    if (sort && Object.keys(sort).length > 0) {
      allItems.sort((a, b) => {
        for (const [field, direction] of Object.entries(sort)) {
          let aVal: any;
          let bVal: any;

          // Handle createdAt field
          if (field === 'createdAt') {
            aVal = a.createdAt;
            bVal = b.createdAt;
          } else {
            aVal = (a as any)[field];
            bVal = (b as any)[field];
          }

          if (aVal !== bVal) {
            if (aVal instanceof Date && bVal instanceof Date) {
              return direction === 1 ? (aVal.getTime() - bVal.getTime()) : (bVal.getTime() - aVal.getTime());
            }
            return direction === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          }
        }
        return 0;
      });
    } else {
      // Default sort by createdAt descending
      allItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Calculate pagination
    const total = allItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (pageNo - 1) * pageSize;
    const paginatedItems = allItems.slice(offset, offset + pageSize);

    return {
      success: true,
      message: 'Student activities retrieved successfully',
      data: {
        logs: paginatedItems,
        pagination: {
          total,
          pageNo,
          pageSize,
          totalPages
        }
      }
    };
  } catch (error) {
    console.error('Error getting student activities:', error);
    throw error;
  }
};


import * as studentRepository from "../repositories/student.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as activityLogRepository from "../repositories/activityLog.repository";
import { TeacherAssignClassesRepository } from "@/repositories/teacherAssignClasses.repository";
import * as examRepository from "../repositories/exam.repository";
import { Class, Subject, TeacherAssignClasses, Exam, ExamStudent, Student, StudentActivityLog } from "../models";
import mongoose from "mongoose";
import {
  GetTopStudentsRequest,
  GetTopStudentsResponse,
  TopStudentItem,
  GetClassAnalyticsRequest,
  GetClassAnalyticsResponse,
  TopicPerformance,
  GetStudentActivityRequest,
  GetStudentActivityResponse,
  StudentActivityItem,
  GetTeacherStudentsActivitiesRequest,
  GetTeacherStudentsActivitiesResponse,
} from "@/types/teacherDashboard.types";
import { formatRelativeTime } from "@/utils/activityLog.helper";

/**
 * Teacher Dashboard Service - Business logic for teacher dashboard
 */

// Get top students for teacher's assigned classes
export const getTopStudents = async (
  teacherId: string,
  tenantId: string,
  params: GetTopStudentsRequest
): Promise<GetTopStudentsResponse> => {
  try {
    // Get teacher's assigned classes
    const assignments = await TeacherAssignClassesRepository.findAssignmentsByTeacher(
      teacherId,
      tenantId
    );

    if (assignments.length === 0) {
      return {
        students: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Filter assignments by classId and subjectId if provided
    let filteredAssignments = assignments;
    if (params.classId) {
      filteredAssignments = filteredAssignments.filter((a: any) => {
        // Handle populated classId (object with _id) or direct ObjectId
        const aClassId = a.classId?._id ? a.classId._id.toString() : a.classId?.toString();
        return aClassId === params.classId;
      });
    }
    if (params.subjectId) {
      filteredAssignments = filteredAssignments.filter((a: any) => {
        // Handle populated subjectId (object with _id) or direct ObjectId
        const aSubjectId = a.subjectId?._id ? a.subjectId._id.toString() : a.subjectId?.toString();
        return aSubjectId === params.subjectId;
      });
    }

    if (filteredAssignments.length === 0) {
      return {
        students: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Get class IDs and subject IDs from assignments (handle both ObjectId and populated objects)
    const classIdsSet = new Set(
      filteredAssignments
        .map((a: any) => {
          // Handle populated classId (object with _id) or direct ObjectId
          if (a.classId?._id) {
            return a.classId._id.toString();
          } else if (a.classId) {
            return a.classId.toString();
          }
          return null;
        })
        .filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id))
    );
    const classIds = Array.from(classIdsSet) as string[];
    const subjectIds = params.subjectId
      ? [params.subjectId]
      : Array.from(
        new Set(
          filteredAssignments
            .map((a: any) => {
              // Handle populated subjectId (object with _id) or direct ObjectId
              if (a.subjectId?._id) {
                return a.subjectId._id.toString();
              } else if (a.subjectId) {
                return a.subjectId.toString();
              }
              return null;
            })
            .filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id))
        )
      ) as string[];

    // Build date filter for month/year
    const dateFilter: any = {};
    if (params.month && params.year) {
      const start = new Date(params.year, params.month - 1, 1);
      const end = new Date(params.year, params.month, 0, 23, 59, 59, 999);
      dateFilter.createdAt = { $gte: start, $lte: end };
    }

    // Get top students based on rank type
    let studentsData: any[] = [];

    if (params.rankType === "Subject Rank" && params.subjectId) {
      // Get top students for specific subject
      studentsData = await studentRepository.getTopStudentsByClass(
        classIds[0] as string, // Use first class if multiple
        tenantId,
        params.subjectId
      );
    } else if (params.rankType === "Class Rank" && params.classId) {
      // Get top students for specific class
      studentsData = await studentRepository.getTopStudentsByClass(
        params.classId,
        tenantId
      );
    } else {
      // Overall rank - aggregate across all assigned classes/subjects
      const allStudents: Record<string, any> = {};

      for (const assignment of filteredAssignments) {
        // Handle populated classId/subjectId (object with _id) or direct ObjectId
        const classId = assignment.classId?._id
          ? assignment.classId._id.toString()
          : assignment.classId?.toString() || '';
        const subjectId = assignment.subjectId?._id
          ? assignment.subjectId._id.toString()
          : assignment.subjectId?.toString() || '';

        if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
          console.warn(`⚠️ Invalid classId in assignment, skipping...`);
          continue;
        }
        if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
          console.warn(`⚠️ Invalid subjectId in assignment, skipping...`);
          continue;
        }

        const classStudents = await studentRepository.getTopStudentsByClass(
          classId,
          tenantId,
          subjectId
        );

        // Aggregate scores across subjects
        classStudents.forEach((student) => {
          const key = student.studentId;
          if (!allStudents[key]) {
            allStudents[key] = {
              ...student,
              scores: [],
              totalExams: 0,
            };
          }
          allStudents[key].scores.push(student.averagePercentage);
          allStudents[key].totalExams += student.totalExams || 0;
        });
      }

      // Calculate overall average for each student
      studentsData = Object.values(allStudents).map((student: any) => ({
        ...student,
        averagePercentage:
          student.scores.reduce((sum: number, score: number) => sum + score, 0) /
          student.scores.length,
      }));

      // Sort by overall average
      studentsData.sort((a, b) => b.averagePercentage - a.averagePercentage);
    }

    // Format response with ranks
    const students: TopStudentItem[] = studentsData.map((studentData, index) => ({
      studentId: studentData.studentId,
      name: `${studentData.firstName} ${studentData.lastName}`,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      className: studentData.className,
      subjectName: studentData.subjectName,
      rank: index + 1,
      overallScore: studentData.averagePercentage,
      totalStudentsInClass: studentsData.length,
    }));

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedStudents = students.slice(startIndex, startIndex + pageSize);

    return {
      students: paginatedStudents,
      pagination: {
        total: students.length,
        pageNo,
        pageSize,
        totalPages: Math.ceil(students.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get top students error:", error);
    throw error;
  }
};

// Get class analytics (radar chart data)
export const getClassAnalytics = async (
  teacherId: string,
  tenantId: string,
  params: GetClassAnalyticsRequest
): Promise<GetClassAnalyticsResponse> => {
  try {
    // Verify teacher is assigned to this class and subject
    const assignments = await TeacherAssignClassesRepository.findAssignmentsByTeacher(
      teacherId,
      tenantId
    );

    const isAssigned = assignments.some((a: any) => {
      // Handle populated classId/subjectId (object with _id) or direct ObjectId
      const aClassId = a.classId?._id ? a.classId._id.toString() : a.classId?.toString();
      const aSubjectId = a.subjectId?._id ? a.subjectId._id.toString() : a.subjectId?.toString();
      return aClassId === params.classId && aSubjectId === params.subjectId;
    });

    if (!isAssigned) {
      throw new Error("Teacher is not assigned to this class and subject");
    }

    // Get class and subject info
    const classInfo = await Class.findById(params.classId).lean();
    const subjectInfo = await Subject.findById(params.subjectId).lean();

    if (!classInfo || !subjectInfo) {
      throw new Error("Class or subject not found");
    }

    // Get all exams for this class and subject
    const exams = await examRepository.findExams({
      tenantId,
      classId: params.classId,
      subjectId: params.subjectId,
      pageNo: 1,
      pageSize: 1000,
    } as any);

    if (exams.length === 0) {
      return {
        classId: params.classId,
        className: (classInfo as any).name || "Unknown Class",
        subjectId: params.subjectId,
        subjectName: (subjectInfo as any).name || "Unknown Subject",
        topics: [],
        overallAverage: 0,
        totalStudents: 0,
      };
    }

    // Get exam statistics
    const examIds = exams.map((exam: any) =>
      exam._id ? exam._id.toString() : exam.id || exam._id
    );

    const stats = await examAttemptRepository.getClassSubjectStatistics(
      params.classId,
      params.subjectId,
      tenantId,
      examIds
    );

    // Build topics from exam titles (or use exam topics if available)
    // For now, we'll use exam titles as topics
    const topics: TopicPerformance[] = exams.map((exam: any) => {
      const examId = exam._id ? exam._id.toString() : exam.id || exam._id;
      const examStat = stats.examStats.find((s) => s.examId === examId);

      return {
        topicName: exam.examTitle || "Unknown Topic",
        score: examStat ? Math.round(examStat.averageScore * 100) / 100 : 0,
        maxScore: 100,
        description: examStat
          ? `${examStat.averageScore.toFixed(1)} out of 100`
          : undefined,
      };
    });

    // Calculate overall average
    const overallAverage =
      topics.length > 0
        ? topics.reduce((sum, topic) => sum + topic.score, 0) / topics.length
        : 0;

    return {
      classId: params.classId,
      className: (classInfo as any).name || "Unknown Class",
      subjectId: params.subjectId,
      subjectName: (subjectInfo as any).name || "Unknown Subject",
      topics,
      overallAverage: Math.round(overallAverage * 100) / 100,
      totalStudents: stats.totalStudents,
    };
  } catch (error) {
    console.error("Get class analytics error:", error);
    throw error;
  }
};

// Get student activity for teacher's classes
export const getStudentActivity = async (
  teacherId: string,
  tenantId: string,
  params: GetStudentActivityRequest
): Promise<GetStudentActivityResponse> => {
  try {
    // Get teacher's assigned classes
    const assignments = await TeacherAssignClassesRepository.findAssignmentsByTeacher(
      teacherId,
      tenantId
    );

    if (assignments.length === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Filter assignments by classId and subjectId if provided (for getting the right classes)
    let filteredAssignments = assignments;
    if (params.classId) {
      filteredAssignments = filteredAssignments.filter((a: any) => {
        // Handle populated classId (object with _id) or direct ObjectId
        const aClassId = a.classId?._id ? a.classId._id.toString() : a.classId?.toString();
        return aClassId === params.classId;
      });
    }
    if (params.subjectId) {
      filteredAssignments = filteredAssignments.filter((a: any) => {
        // Handle populated subjectId (object with _id) or direct ObjectId
        const aSubjectId = a.subjectId?._id ? a.subjectId._id.toString() : a.subjectId?.toString();
        return aSubjectId === params.subjectId;
      });
    }

    if (filteredAssignments.length === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Get unique class IDs from filtered assignments
    const classIdsSet = new Set(
      filteredAssignments
        .map((a: any) => {
          // Handle populated classId (object with _id) or direct ObjectId
          if (a.classId && typeof a.classId === 'object' && a.classId._id) {
            return a.classId._id.toString();
          } else if (a.classId) {
            return a.classId.toString();
          }
          return null;
        })
        .filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id))
    );
    const classIds = Array.from(classIdsSet) as string[];

    // Get ALL students from these classes (not filtered by subjectId in student query)
    const allStudentIds = new Set<string>();
    for (const classId of classIds) {
      if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
        console.warn(`⚠️ Invalid classId: ${classId}, skipping...`);
        continue;
      }

      const students = await studentRepository.findStudentsByClass(
        classId,
        tenantId
      );

      students.forEach((student: any) => {
        const studentId = student._id?.toString() || student.id?.toString();
        if (studentId) {
          allStudentIds.add(studentId);
        }
      });
    }

    if (allStudentIds.size === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Build date filter
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;
    if (params.month && params.year) {
      parsedMonth = params.month;
      parsedYear = params.year;
    }

    // Get activity logs for all students using $in query
    const studentIdsArray = Array.from(allStudentIds);

    // Build query
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      studentId: { $in: studentIdsArray.map(id => new mongoose.Types.ObjectId(id)) }
    };

    // Apply optional filters
    if (params.classId && mongoose.Types.ObjectId.isValid(params.classId)) {
      query.classId = new mongoose.Types.ObjectId(params.classId);
    }
    if (params.subjectId && mongoose.Types.ObjectId.isValid(params.subjectId)) {
      query.subjectId = new mongoose.Types.ObjectId(params.subjectId);
    }
    if (params.activityType) {
      query.activityType = params.activityType;
    }

    // Build date filter
    if (parsedMonth !== undefined && parsedYear !== undefined) {
      const start = new Date(parsedYear, parsedMonth - 1, 1);
      const end = new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    // Get all student logs (we'll paginate after filtering)
    const studentLogs = await StudentActivityLog.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get student names in batch to avoid N+1 queries
    const studentIdToNameMap = new Map<string, string>();
    const uniqueStudentIds = new Set(studentLogs.map((log: any) => log.studentId.toString()));

    // Fetch all students in parallel
    const studentPromises = Array.from(uniqueStudentIds).map(async (studentId) => {
      try {
        const student = await studentRepository.findStudentById(studentId);
        if (student) {
          studentIdToNameMap.set(studentId, `${student.firstName} ${student.lastName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch student ${studentId}:`, error);
      }
    });
    await Promise.all(studentPromises);

    // Transform logs to activity items
    const allActivities: StudentActivityItem[] = studentLogs.map((log: any) => {
      const studentId = log.studentId.toString();
      const studentName = studentIdToNameMap.get(studentId) || "Unknown Student";

      // Map activity types
      let activityType: StudentActivityItem["activityType"] = "ExamCompleted";
      if (log.activityType === "PracticeCompleted") {
        activityType = "PracticeCompleted";
      } else if (log.activityType === "BadgeEarned") {
        activityType = "BadgeEarned";
      } else if (log.activityType === "CertificateEarned") {
        activityType = "CertificateEarned";
      }

      return {
        activityId: log._id.toString(),
        studentId: studentId,
        studentName,
        activityType,
        activityDescription: log.activityDescription,
        logDate: log.createdAt,
        relativeTime: formatRelativeTime(log.createdAt),
        relatedEntityId: log.relatedEntityId?.toString(),
        relatedEntityType: log.relatedEntityType,
      };
    });

    // Sort by date (newest first) - already sorted by query, but ensure it
    allActivities.sort(
      (a, b) => b.logDate.getTime() - a.logDate.getTime()
    );

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedActivities = allActivities.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      activities: paginatedActivities,
      pagination: {
        total: allActivities.length,
        pageNo,
        pageSize,
        totalPages: Math.ceil(allActivities.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get student activity error:", error);
    throw error;
  }
};

// Get all students activities for a teacher (new endpoint - only teacherId, no classId/subjectId filtering)
export const getTeacherStudentsActivities = async (
  teacherId: string,
  tenantId: string,
  params: GetTeacherStudentsActivitiesRequest
): Promise<GetTeacherStudentsActivitiesResponse> => {
  try {
    // Get teacher's assigned classes
    const assignments = await TeacherAssignClassesRepository.findAssignmentsByTeacher(
      teacherId,
      tenantId
    );

    if (assignments.length === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Get unique class IDs from all assignments (handle both ObjectId and populated objects)
    const classIdsSet = new Set(
      assignments
        .map((a: any) => {
          // Handle populated classId (object with _id) or direct ObjectId
          if (a.classId && typeof a.classId === 'object' && a.classId._id) {
            return a.classId._id.toString();
          } else if (a.classId) {
            return a.classId.toString();
          }
          return null;
        })
        .filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id))
    );
    const classIds = Array.from(classIdsSet) as string[];

    // Get ALL students from these classes
    const allStudentIds = new Set<string>();
    for (const classId of classIds) {
      if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
        console.warn(`⚠️ Invalid classId: ${classId}, skipping...`);
        continue;
      }

      const students = await studentRepository.findStudentsByClass(
        classId,
        tenantId
      );

      students.forEach((student: any) => {
        const studentId = student._id?.toString() || student.id?.toString();
        if (studentId) {
          allStudentIds.add(studentId);
        }
      });
    }

    if (allStudentIds.size === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Build date filter
    let parsedMonth: number | undefined;
    let parsedYear: number | undefined;
    if (params.month && params.year) {
      parsedMonth = params.month;
      parsedYear = params.year;
    }

    // Get activity logs for all students using $in query (NO classId/subjectId filtering)
    const studentIdsArray = Array.from(allStudentIds);

    // Build query - only filter by studentId, activityType, and date
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      studentId: { $in: studentIdsArray.map(id => new mongoose.Types.ObjectId(id)) }
    };

    // Apply optional filters (NO classId/subjectId)
    if (params.activityType) {
      query.activityType = params.activityType;
    }

    // Build date filter
    if (parsedMonth !== undefined && parsedYear !== undefined) {
      const start = new Date(parsedYear, parsedMonth - 1, 1);
      const end = new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    // Get all student logs (we'll paginate after filtering)
    const studentLogs = await StudentActivityLog.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get student names in batch to avoid N+1 queries
    const studentIdToNameMap = new Map<string, string>();
    const uniqueStudentIds = new Set(studentLogs.map((log: any) => log.studentId.toString()));

    // Fetch all students in parallel
    const studentPromises = Array.from(uniqueStudentIds).map(async (studentId) => {
      try {
        const student = await studentRepository.findStudentById(studentId);
        if (student) {
          studentIdToNameMap.set(studentId, `${student.firstName} ${student.lastName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch student ${studentId}:`, error);
      }
    });
    await Promise.all(studentPromises);

    // Transform logs to activity items
    const allActivities: StudentActivityItem[] = studentLogs.map((log: any) => {
      const studentId = log.studentId.toString();
      const studentName = studentIdToNameMap.get(studentId) || "Unknown Student";

      // Map activity types
      let activityType: StudentActivityItem["activityType"] = "ExamCompleted";
      if (log.activityType === "PracticeCompleted") {
        activityType = "PracticeCompleted";
      } else if (log.activityType === "BadgeEarned") {
        activityType = "BadgeEarned";
      } else if (log.activityType === "CertificateEarned") {
        activityType = "CertificateEarned";
      }

      return {
        activityId: log._id.toString(),
        studentId: studentId,
        studentName,
        activityType,
        activityDescription: log.activityDescription,
        logDate: log.createdAt,
        relativeTime: formatRelativeTime(log.createdAt),
        relatedEntityId: log.relatedEntityId?.toString(),
        relatedEntityType: log.relatedEntityType,
      };
    });

    // Sort by date (newest first) - already sorted by query, but ensure it
    allActivities.sort(
      (a, b) => b.logDate.getTime() - a.logDate.getTime()
    );

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedActivities = allActivities.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      activities: paginatedActivities,
      pagination: {
        total: allActivities.length,
        pageNo,
        pageSize,
        totalPages: Math.ceil(allActivities.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get teacher students activities error:", error);
    throw error;
  }
};

// Get teacher dashboard statistics
export const getTeacherDashboardStats = async (
  teacherId: string,
  tenantId: string,
  classId?: string,
  subjectId?: string,
  batchId?: string
): Promise<{
  teacherassignclasscounts: number;
  totalStudents: number;
  totalExams: number;
  overallAverage: number;
  issuedAchievements: number;
}> => {
  try {
    // Validate teacherId format
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      throw new Error(`Invalid teacherId format: ${teacherId}`);
    }

    // Validate tenantId
    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    // Prepare filter for assignments
    const assignmentFilter: any = {
      teacherId: new mongoose.Types.ObjectId(teacherId),
      tenantId: tenantId,
      isActive: true,
      isDeleted: false,
    };

    if (classId) {
      assignmentFilter.classId = new mongoose.Types.ObjectId(classId);
    }
    if (subjectId) {
      assignmentFilter.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    // 1. Get distinct class count from teacher-assign-classes
    // If filters are applied, this ensures we only look at relevant assigned classes
    const distinctClassIds = await TeacherAssignClasses.distinct("classId", assignmentFilter);

    // Filter out deleted classes and filter by batchId if provided
    let activeClassIds: any[] = [];
    if (distinctClassIds.length > 0) {
      // Build class filter
      const classFilter: any = {
        _id: { $in: distinctClassIds },
        isDeleted: false,
      };

      // Add batchId filter if provided
      if (batchId) {
        classFilter.batchId = new mongoose.Types.ObjectId(batchId);
      }

      // Check which classes are not deleted and match batchId if provided
      const activeClasses = await Class.find(classFilter).select("_id").lean();

      activeClassIds = activeClasses.map((cls: any) => cls._id);
    }

    const teacherassignclasscounts = activeClassIds.length;

    // 2. Get total students across all assigned classes (or selected class)
    let totalStudents = 0;
    if (activeClassIds.length > 0) {
      // Convert classIds to strings (Student.classId is stored as string)
      const classIdStrings = activeClassIds.map((id: any) =>
        id.toString()
      );

      // Count distinct active students across all assigned classes
      // Note: Student.classId is String, Student.tenantId is String
      const uniqueStudentIds = await Student.distinct("_id", {
        classId: { $in: classIdStrings },
        isActive: true,
        isDeleted: false,
        tenantId: tenantId.toString(),
      });

      totalStudents = uniqueStudentIds.length;
    }

    // 3. Get total exams created by this teacher for selected filters
    const examFilter: any = {
      teacherId: new mongoose.Types.ObjectId(teacherId),
      isDeleted: false,
    };

    if (classId) {
      examFilter.classId = new mongoose.Types.ObjectId(classId);
    } else if (batchId && activeClassIds.length > 0) {
      // If batchId is provided but no specific classId, filter by classes in the batch
      examFilter.classId = { $in: activeClassIds };
    }

    if (subjectId) examFilter.subjectId = new mongoose.Types.ObjectId(subjectId);

    const totalExams = await Exam.countDocuments(examFilter);

    // 4. Get overall average percentage from exam_students
    // Only include exams created by this teacher where status="Completed" and gradingStatus="Completed"
    let overallAverage = 0;

    if (totalExams > 0) {
      // First, get all exam IDs created by this teacher
      const teacherExamIds = await Exam.distinct("_id", examFilter);

      if (teacherExamIds.length > 0) {
        // Calculate average percentage from exam_students
        // Now including unattempted exams (percentage will be counted as 0)
        const averageResult = await ExamStudent.aggregate([
          {
            $match: {
              examId: { $in: teacherExamIds },
              isActive: true,
              // Removed filters for completed/graded status to include all assigned students
            },
          },
          // Join with exams to get totalMarks and check grading status
          {
            $lookup: {
              from: "exams",
              localField: "examId",
              foreignField: "_id",
              as: "exam",
            },
          },
          {
            $unwind: "$exam",
          },
          // Filter: Only include exams where grading is completed/published
          {
            $match: {
              "exam.gradingTypeStatus": "Completed",
            },
          },
          // Calculate obtained marks and total marks for the group
          {
            $group: {
              _id: null,
              totalObtainedMarks: {
                $sum: {
                  $divide: [
                    {
                      $multiply: [
                        { $ifNull: ["$percentage", 0] }, // Treat missing percentage as 0
                        "$exam.totalMarks",
                      ],
                    },
                    100,
                  ],
                },
              },
              totalPossibleMarks: { $sum: "$exam.totalMarks" },
            },
          },
          // Calculate weighted average
          {
            $project: {
              averagePercentage: {
                $cond: {
                  if: { $gt: ["$totalPossibleMarks", 0] },
                  then: {
                    $multiply: [
                      { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
        ]);

        if (averageResult.length > 0 && averageResult[0].averagePercentage !== null) {
          // Round to 2 decimal places
          overallAverage = Math.round(averageResult[0].averagePercentage * 100) / 100;
        }
      }
    }

    // 5. Get issued achievements count for teacher's assigned classes/subjects
    let issuedAchievements = 0;
    let achievementExamIds: any[] = [];

    if (classId && subjectId) {
      // Specific class & subject: Filter exams by these exact values
      const achievementExamFilter: any = {
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
        isDeleted: false
      };
      achievementExamIds = await Exam.distinct("_id", achievementExamFilter);

    } else if (classId) {
      // Specific class: Filter by class
      const achievementExamFilter: any = {
        classId: new mongoose.Types.ObjectId(classId),
        isDeleted: false
      };

      // Match assigned subjects logic
      const teacherAssignments = await TeacherAssignClasses.find(assignmentFilter)
        .select('subjectId').lean();

      const assignedSubjectIds = teacherAssignments
        .map((a: any) => a.subjectId)
        .filter((id: any) => id);

      if (assignedSubjectIds.length > 0) {
        achievementExamFilter.subjectId = { $in: assignedSubjectIds };
      }

      achievementExamIds = await Exam.distinct("_id", achievementExamFilter);

    } else {
      // No specific classId: Filter by activeClassIds (which are already filtered by batchId if provided)
      if (activeClassIds.length > 0) {
        const teacherAssignments = await TeacherAssignClasses.find({
          teacherId: new mongoose.Types.ObjectId(teacherId),
          tenantId: tenantId,
          isActive: true,
          isDeleted: false
        }).select('classId subjectId').lean();

        achievementExamIds = await Exam.find({
          classId: { $in: activeClassIds },
          subjectId: {
            $in: teacherAssignments
              .map((a: any) => a.subjectId)
              .filter((id: any) => id)
          },
          isDeleted: false
        }).distinct('_id');
      }
    }

    if (achievementExamIds.length > 0) {
      // Import ExamCredential model
      const { ExamCredential } = await import('../models');

      // Count credentials issued for these exams
      issuedAchievements = await ExamCredential.countDocuments({
        examId: { $in: achievementExamIds },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
        isDeleted: false
      });
    }

    return {
      teacherassignclasscounts,
      totalStudents,
      totalExams,
      overallAverage,
      issuedAchievements,
    };
  } catch (error: any) {
    console.error("Get teacher dashboard stats error:", error);
    throw new Error(`Failed to get teacher dashboard stats: ${error.message}`);
  }
};

// ----------------------------------------------------------------------
// New Analytics Services
// ----------------------------------------------------------------------

/**
 * Get class monthly performance trends
 * Returns class average scores grouped by month for the past 12 months
 */
export const getClassMonthlyTrends = async (
  classId: string,
  subjectId: string,
  tenantId: string
) => {
  try {
    // Import ExamAttempt model
    const { ExamAttempt } = await import("../models");

    // Get last 12 months data
    const currentDate = new Date();
    const twelveMonthsAgo = new Date(currentDate);
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // Aggregate data by month with two-level averaging
    // Step 1: Group by student within each month, calculate each student's monthly average
    // Step 2: Calculate class metrics from student averages
    const monthlyData = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: "Graded",
          submittedAt: { $gte: twelveMonthsAgo },
          percentage: { $exists: true, $ne: null },
          isDeleted: false,
        },
      },
      {
        // First group by student within each month and calculate weighted average per student per month
        $group: {
          _id: {
            year: { $year: "$submittedAt" },
            month: { $month: "$submittedAt" },
            studentId: "$studentId",
          },
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
        },
      },
      {
        $addFields: {
          studentMonthlyAvg: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        // Second group by month to calculate class metrics from student averages
        $group: {
          _id: {
            year: "$_id.year",
            month: "$_id.month",
          },
          avgPercentage: { $avg: "$studentMonthlyAvg" },
          maxPercentage: { $max: "$studentMonthlyAvg" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Create array of last 12 months with labels
    const months = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-based month

      // Find matching data
      const monthData = monthlyData.find(
        (m: any) => m._id.year === year && m._id.month === month
      );

      months.push({
        month: monthNames[month - 1],
        score: monthData ? Math.round(monthData.avgPercentage * 100) / 100 : 0,
        topScore: monthData ? Math.round(monthData.maxPercentage * 100) / 100 : 0,
        classAvg: monthData ? Math.round(monthData.avgPercentage * 100) / 100 : 0,
      });
    }

    return {
      success: true,
      message: "Monthly trends retrieved successfully",
      data: months,
    };
  } catch (error: any) {
    console.error("Get class monthly trends error:", error);
    throw new Error(`Failed to get monthly trends: ${error.message}`);
  }
};

/**
 * Get question type performance for a class
 * Returns performance breakdown by question type
 */
export const getQuestionTypePerformance = async (
  classId: string,
  subjectId: string,
  tenantId: string
) => {
  try {
    // Import ExamAnswer model
    const { ExamAnswer } = await import("../models");

    // Get all exam attempts for the class and subject to filter answers
    const { ExamAttempt } = await import("../models");
    const attemptIds = await ExamAttempt.distinct("_id", {
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptStatus: "Graded",
      isDeleted: false,
    });

    if (attemptIds.length === 0) {
      return {
        success: true,
        message: "No graded exams found",
        data: {
          questionTypes: [],
        },
      };
    }

    // Aggregate by question type
    const questionTypeData = await ExamAnswer.aggregate([
      {
        $match: {
          attemptId: { $in: attemptIds },
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$questionType",
          totalQuestions: { $sum: 1 },
          correctAnswers: {
            $sum: {
              $cond: [{ $eq: ["$isCorrect", true] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          questionType: "$_id",
          totalQuestions: 1,
          correctAnswers: 1,
          percentage: {
            $cond: [
              { $eq: ["$totalQuestions", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$correctAnswers", "$totalQuestions"] },
                  100,
                ],
              },
            ],
          },
        },
      },
      {
        $sort: { questionType: 1 },
      },
    ]);

    const formattedData = questionTypeData.map((item: any) => ({
      questionType: item.questionType,
      totalQuestions: item.totalQuestions,
      correctAnswers: item.correctAnswers,
      percentage: Math.round(item.percentage * 100) / 100,
    }));

    return {
      success: true,
      message: "Question type performance retrieved successfully",
      data: {
        questionTypes: formattedData,
      },
    };
  } catch (error: any) {
    console.error("Get question type performance error:", error);
    throw new Error(`Failed to get question type performance: ${error.message}`);
  }
};

/**
 * Get class exam time analysis
 * Returns average time metrics for exams and questions
 */
export const getClassExamTimeAnalysis = async (
  classId: string,
  subjectId: string,
  tenantId: string
) => {
  try {
    const { ExamAttempt, ExamAnswer } = await import("../models");

    // Get exam time statistics
    const examTimeStats = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: { $in: ["Submitted", "Graded"] },
          timeTakenInSeconds: { $exists: true, $ne: null, $gt: 0 },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          avgTimePerExam: { $avg: "$timeTakenInSeconds" },
          totalTimeSpent: { $sum: "$timeTakenInSeconds" },
          totalAttempts: { $sum: 1 },
        },
      },
    ]);

    // Get question time statistics
    const attemptIds = await ExamAttempt.distinct("_id", {
      classId: new mongoose.Types.ObjectId(classId),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptStatus: { $in: ["Submitted", "Graded"] },
      isDeleted: false,
    });

    let avgTimePerQuestion = 0;
    if (attemptIds.length > 0) {
      const questionTimeStats = await ExamAnswer.aggregate([
        {
          $match: {
            attemptId: { $in: attemptIds },
            tenantId: new mongoose.Types.ObjectId(tenantId),
            timeTakenInSeconds: { $exists: true, $ne: null, $gt: 0 },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: null,
            avgTimePerQuestion: { $avg: "$timeTakenInSeconds" },
          },
        },
      ]);

      if (questionTimeStats.length > 0) {
        avgTimePerQuestion = questionTimeStats[0].avgTimePerQuestion;
      }
    }

    const stats = examTimeStats.length > 0 ? examTimeStats[0] : null;

    return {
      success: true,
      message: "Exam time analysis retrieved successfully",
      data: {
        avgTimePerExam: stats ? Math.round(stats.avgTimePerExam) : 0,
        avgTimePerQuestion: Math.round(avgTimePerQuestion),
        totalTimeSpent: stats ? stats.totalTimeSpent : 0,
      },
    };
  } catch (error: any) {
    console.error("Get class exam time analysis error:", error);
    throw new Error(`Failed to get exam time analysis: ${error.message}`);
  }
};

/**
 * Get class score distribution
 * Returns distribution of student scores in predefined ranges
 */
export const getClassScoreDistribution = async (
  classId: string,
  subjectId: string,
  tenantId: string
) => {
  try {
    const { ExamAttempt } = await import("../models");

    // Get all graded attempts
    const attempts = await ExamAttempt.aggregate([
      {
        $match: {
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          attemptStatus: "Graded",
          percentage: { $exists: true, $ne: null },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$studentId",
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
        },
      },
      {
        $addFields: {
          avgPercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    // Initialize score ranges
    const ranges = [
      { range: "0-20%", min: 0, max: 20, count: 0 },
      { range: "21-40%", min: 21, max: 40, count: 0 },
      { range: "41-60%", min: 41, max: 60, count: 0 },
      { range: "61-80%", min: 61, max: 80, count: 0 },
      { range: "81-100%", min: 81, max: 100, count: 0 },
    ];

    // Count students in each range
    attempts.forEach((attempt: any) => {
      const percentage = attempt.avgPercentage;
      for (const range of ranges) {
        if (percentage >= range.min && percentage <= range.max) {
          range.count++;
          break;
        }
      }
    });

    return {
      success: true,
      message: "Score distribution retrieved successfully",
      data: ranges.map(r => ({
        range: r.range,
        count: r.count,
      })),
    };
  } catch (error: any) {
    console.error("Get class score distribution error:", error);
    throw new Error(`Failed to get score distribution: ${error.message}`);
  }
};



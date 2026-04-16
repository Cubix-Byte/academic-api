import mongoose from "mongoose";
import * as studentExamsRepository from "../repositories/studentExams.repository";
import * as batchRepository from "../repositories/batch.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as studentRepository from "../repositories/student.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import { calculateGradeFromPercentage } from "./gradingSystem.service";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";
import * as examCredentialRepository from "../repositories/examCredential.repository";
import { SubjectRepository } from "@/repositories/subject.repository";
import * as studentCredentialsService from "./studentCredentials.service";
import {
  GetStudentExamsRequest,
  GetStudentExamsResponse,
  StudentExamResponse,
  GetStudentExamByIdResponse,
  StudentExamStatisticsResponse,
  StudentExamDashboardResponse,
  GetCurrentClassStatsResponse,
  GetSubjectStatsResponse,
  GetRecentResultsResponse,
  PerformedExamResponse,
  StartedExamResponse,
} from "@/types/studentExams.types";

/**
 * Student Exams Service - Business logic for student exam management
 */

// Get student exams with pagination and filtering
export const getStudentExams = async (
  params: GetStudentExamsRequest & { studentId: string }
): Promise<GetStudentExamsResponse> => {
  try {
    // Get all exams for the student
    let exams = await studentExamsRepository.findExamsByStudent(
      params.studentId,
      {
        examType: params.examType,
        examStatus: params.examStatus,
        examStudentStatus: params.examStudentStatus,
        timeFilter: params.timeFilter,
        subjectId: params.subjectId,
        classId: params.classId,
      }
    );

    // Sort exams
    if (params.sortBy && params.sortOrder) {
      exams.sort((a, b) => {
        const examA = a.examId as any;
        const examB = b.examId as any;

        let valueA: any, valueB: any;

        switch (params.sortBy) {
          case "startOn":
            valueA = examA.startOn;
            valueB = examB.startOn;
            break;
          case "examTitle":
            valueA = examA.examTitle;
            valueB = examB.examTitle;
            break;
          case "totalMarks":
            valueA = examA.totalMarks;
            valueB = examB.totalMarks;
            break;
          default:
            valueA = examA.startOn;
            valueB = examB.startOn;
        }

        if (params.sortOrder === "asc") {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
    }

    // Filter out completed exams and exams where max attempts reached (for upcoming filter)
    const now = new Date();
    const filteredExams = await Promise.all(
      exams.map(async (examStudent) => {
        const exam = examStudent.examId as any;

        // For upcoming exams, exclude completed exams and exams where max attempts reached
        if (params.timeFilter === "upcoming") {
          // Exclude if exam is already completed
          if (examStudent.status === "Completed") {
            return null;
          }

          // Check if student has reached max attempts
          const attemptsTaken =
            await examAttemptRepository.countAttemptsByStudentAndExam(
              params.studentId,
              exam._id.toString()
            );
          const maxAttempts = exam.maxAttempts || exam.allowedAttempts || 1;

          if (attemptsTaken >= maxAttempts) {
            return null;
          }

          // Also exclude if exam time window has passed
          const examEndOn = new Date(exam.endOn);
          if (examEndOn < now) {
            return null;
          }
        }

        return examStudent;
      })
    );

    // Remove null values
    let validExams = filteredExams.filter(
      (exam): exam is (typeof exams)[0] => exam !== null
    );

    // Exclude exams for which student already has a credential assigned (one credential per exam per student).
    // When credentialId is set, exclude only exams where student has this specific credential (e.g. "Good").
    if (params.excludeExamsWithCredentialForStudent && params.studentId) {
      const examIdsWithCredential =
        await examCredentialRepository.findExamIdsWithCredentialForStudent(
          params.studentId,
          params.credentialId
        );
      if (examIdsWithCredential.length > 0) {
        const excludeSet = new Set(examIdsWithCredential);
        validExams = validExams.filter((examStudent) => {
          const exam = examStudent.examId as any;
          let examId: string | null = null;
          if (exam?._id) examId = exam._id.toString();
          else if (exam instanceof mongoose.Types.ObjectId) examId = exam.toString();
          else if (typeof exam === "string" && mongoose.Types.ObjectId.isValid(exam)) examId = exam;
          return examId ? !excludeSet.has(examId) : true;
        });
      }
    }

    // Enrich with additional details
    const enrichedExams: StudentExamResponse[] = await Promise.all(
      validExams.map(async (examStudent) => {
        const exam = examStudent.examId as any;
        const batchInfo = await batchRepository.findBatchById(
          exam.batchId.toString()
        );
        const teacherInfo = await teacherRepository.findTeacherById(
          exam.teacherId.toString()
        );

        // Get questions count for the exam
        const questionsCount = await examQuestionRepository.countExamQuestions(
          exam._id.toString()
        );

        // Get subject name
        let subjectName = "Unknown Subject";
        let subjectId = "";

        if (exam.subjectId) {
          if (typeof exam.subjectId === "object" && exam.subjectId.name) {
            // Populated subject
            subjectName = exam.subjectId.name;
            subjectId =
              exam.subjectId._id?.toString() || exam.subjectId.toString();
          } else if (typeof exam.subjectId === "string") {
            subjectId = exam.subjectId;
          } else if (exam.subjectId._id) {
            subjectId = exam.subjectId._id.toString();
          } else {
            subjectId = exam.subjectId.toString();
          }
        }

        // Fallback: fetch subject name if not populated
        if ((!subjectName || subjectName === "Unknown Subject") && subjectId) {
          try {
            const subjectRepo = new SubjectRepository();
            const tenantId =
              exam.tenantId?.toString() ||
              examStudent.tenantId?.toString() ||
              "";
            if (tenantId) {
              const subject = await subjectRepo.findById(subjectId, tenantId);
              if (subject && (subject as any).name) {
                subjectName = (subject as any).name;
              }
            }
          } catch (err) {
            console.warn(`Could not fetch subject name for ${subjectId}`);
          }
        }

        // Get class name if populated
        let className = "Unknown Class";
        if (exam.classId) {
          if (typeof exam.classId === "object" && exam.classId.name) {
            className = exam.classId.name;
          } else {
            className = "Class " + exam.classId.toString().slice(-4); // Fallback
          }
        }

        return {
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          maxAttempts: exam.maxAttempts,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          examStatus: exam.examStatus,
          teacherId: exam.teacherId.toString(),
          teacherName: teacherInfo?.firstName + " " + teacherInfo?.lastName,
          classId: exam.classId.toString(),
          className: className,
          subjectId: subjectId || exam.subjectId.toString(),
          subjectName: subjectName,
          batchId: exam.batchId.toString(),
          batchName: batchInfo?.batchName,
          isActive: examStudent.isActive,
          questionsCount: questionsCount,
          createdAt: examStudent.createdAt,
          updatedAt: examStudent.updatedAt,
        };
      })
    );

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedExams = enrichedExams.slice(
      startIndex,
      startIndex + pageSize
    );

    const totalExams = enrichedExams.length;
    const totalPages = Math.ceil(totalExams / pageSize);

    return {
      success: true,
      message: "Student exams retrieved successfully",
      data: {
        exams: paginatedExams,
        pagination: {
          currentPage: pageNo,
          totalPages,
          totalExams,
          pageSize,
          hasNextPage: pageNo < totalPages,
          hasPreviousPage: pageNo > 1,
        },
        filters: {
          examType: params.examType,
          examStatus: params.examStatus,
          timeFilter: params.timeFilter,
          subjectId: params.subjectId,
        },
      },
    };
  } catch (error) {
    console.error("Get student exams error:", error);
    throw error;
  }
};

// Get exams for student's current class
export const getStudentExamsByCurrentClass = async (
  params: GetStudentExamsRequest & { studentId: string }
): Promise<GetStudentExamsResponse> => {
  try {
    // 1. Get student profile to find current classId
    const student = await studentRepository.findStudentById(params.studentId);
    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    if (!student.classId) {
      return {
        success: true,
        message: "Student is not enrolled in any class",
        data: {
          exams: [],
          pagination: {
            currentPage: params.pageNo || 1,
            totalPages: 0,
            totalExams: 0,
            pageSize: params.pageSize || 10,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          filters: {
            examType: params.examType,
            examStatus: params.examStatus,
            timeFilter: params.timeFilter,
            subjectId: params.subjectId,
          },
        },
      };
    }

    // 2. Fetch exams filtered by identified classId
    // Only return exams: student has attempted+completed, exam is released, and exclude exams where student already has this credential (when credentialId/assignmentId provided)
    return await getStudentExams({
      ...params,
      classId: student.classId.toString(),
      examStatus: "Released",
      examStudentStatus: "Completed",
      excludeExamsWithCredentialForStudent: true,
      credentialId: params.credentialId,
    });
  } catch (error) {
    console.error("Get student exams by current class error:", error);
    throw error;
  }
};

// Get exam by ID for a specific student
export const getStudentExamById = async (
  examId: string,
  studentId: string
): Promise<GetStudentExamByIdResponse> => {
  try {
    const examStudent = await studentExamsRepository.findExamByIdForStudent(
      examId,
      studentId
    );

    if (!examStudent) {
      throw new Error("EXAM_NOT_FOUND_OR_NOT_ASSIGNED");
    }

    const exam = examStudent.examId as any;
    const batchInfo = await batchRepository.findBatchById(
      exam.batchId.toString()
    );
    const teacherInfo = await teacherRepository.findTeacherById(
      exam.teacherId.toString()
    );

    const examResponse: StudentExamResponse = {
      examId: exam._id.toString(),
      examTitle: exam.examTitle,
      description: exam.description,
      examType: exam.examType,
      totalMarks: exam.totalMarks,
      maxAttempts: exam.maxAttempts,
      durationInMinutes: exam.durationInMinutes,
      startOn: exam.startOn,
      endOn: exam.endOn,
      examStatus: exam.examStatus,
      teacherId: exam.teacherId.toString(),
      teacherName: teacherInfo?.firstName + " " + teacherInfo?.lastName,
      classId: exam.classId.toString(),
      className: "Class " + exam.classId.toString().slice(-4), // Fallback
      subjectId: exam.subjectId.toString(),
      subjectName: "Subject " + exam.subjectId.toString().slice(-4), // Fallback
      batchId: exam.batchId.toString(),
      batchName: batchInfo?.batchName,
      isActive: examStudent.isActive,
      createdAt: examStudent.createdAt,
      updatedAt: examStudent.updatedAt,
    };

    return {
      success: true,
      message: "Student exam retrieved successfully",
      data: examResponse,
    };
  } catch (error) {
    console.error("Get student exam by ID error:", error);
    throw error;
  }
};

// Get student exam statistics
export const getStudentExamStatistics = async (
  studentId: string,
  examType?: "Official" | "Practice" | "Exam Repository"
): Promise<StudentExamStatisticsResponse> => {
  try {
    const statistics = await studentExamsRepository.getExamStatisticsForStudent(
      studentId,
      examType
    );

    return {
      success: true,
      message: "Student exam statistics retrieved successfully",
      data: {
        totalExams: statistics.totalExams,
        openedExams: statistics.openExams,
        performedExams: statistics.completedExams,
        scheduledExams: statistics.upcomingExams,
        expiredExams: statistics.pastExams,
      },
    };
  } catch (error) {
    console.error("Get student exam statistics error:", error);
    throw error;
  }
};

// Get student exam dashboard
export const getStudentExamDashboard = async (
  studentId: string
): Promise<StudentExamDashboardResponse> => {
  try {
    const [upcomingExams, recentExams, statistics] = await Promise.all([
      studentExamsRepository.getUpcomingExamsForStudent(studentId, 5),
      studentExamsRepository.getRecentExamsForStudent(studentId, 5),
      studentExamsRepository.getExamStatisticsForStudent(studentId),
    ]);

    // Enrich upcoming exams
    const enrichedUpcomingExams: StudentExamResponse[] = await Promise.all(
      upcomingExams.map(async (examStudent) => {
        const exam = examStudent.examId as any;
        // Note: Class and Subject repositories don't have findById methods
        // Using fallback values for now
        const batchInfo = await batchRepository.findBatchById(
          exam.batchId.toString()
        );
        const teacherInfo = await teacherRepository.findTeacherById(
          exam.teacherId.toString()
        );

        return {
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          maxAttempts: exam.maxAttempts,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          examStatus: exam.examStatus,
          teacherId: exam.teacherId.toString(),
          teacherName: teacherInfo?.firstName + " " + teacherInfo?.lastName,
          classId: exam.classId.toString(),
          className: "Class " + exam.classId.toString().slice(-4), // Fallback
          subjectId: exam.subjectId.toString(),
          subjectName: "Subject " + exam.subjectId.toString().slice(-4), // Fallback
          batchId: exam.batchId.toString(),
          batchName: batchInfo?.batchName,
          isActive: examStudent.isActive,
          createdAt: examStudent.createdAt,
          updatedAt: examStudent.updatedAt,
        };
      })
    );

    // Enrich recent exams
    const enrichedRecentExams: StudentExamResponse[] = await Promise.all(
      recentExams.map(async (examStudent) => {
        const exam = examStudent.examId as any;
        // Note: Class and Subject repositories don't have findById methods
        // Using fallback values for now
        const batchInfo = await batchRepository.findBatchById(
          exam.batchId.toString()
        );
        const teacherInfo = await teacherRepository.findTeacherById(
          exam.teacherId.toString()
        );

        return {
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          description: exam.description,
          examType: exam.examType,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
          maxAttempts: exam.maxAttempts,
          durationInMinutes: exam.durationInMinutes,
          startOn: exam.startOn,
          endOn: exam.endOn,
          examStatus: exam.examStatus,
          teacherId: exam.teacherId.toString(),
          teacherName: teacherInfo?.firstName + " " + teacherInfo?.lastName,
          classId: exam.classId.toString(),
          className: "Class " + exam.classId.toString().slice(-4), // Fallback
          subjectId: exam.subjectId.toString(),
          subjectName: "Subject " + exam.subjectId.toString().slice(-4), // Fallback
          batchId: exam.batchId.toString(),
          batchName: batchInfo?.batchName,
          isActive: examStudent.isActive,
          createdAt: examStudent.createdAt,
          updatedAt: examStudent.updatedAt,
        };
      })
    );

    return {
      success: true,
      message: "Student exam dashboard retrieved successfully",
      data: {
        upcomingExams: enrichedUpcomingExams,
        recentExams: enrichedRecentExams,
        examStatistics: {
          totalExams: statistics.totalExams,
          completedExams: statistics.completedExams,
          totalAttempts: statistics.totalExams, // This would need to be calculated from exam attempts
        },
      },
    };
  } catch (error) {
    console.error("Get student exam dashboard error:", error);
    throw error;
  }
};

// Get current class stats - completed exam counts by examType
export const getCurrentClassStats = async (
  studentId: string
): Promise<GetCurrentClassStatsResponse> => {
  try {
    // Get student's classId from Student model
    const student = await studentRepository.findStudentById(studentId);

    if (!student) {
      throw new Error("Student not found");
    }

    if (!student.classId) {
      // If student has no classId, return zero counts
      return {
        success: true,
        message: "Current class stats retrieved successfully",
        data: {
          totalCompletedExams: 0,
          officialExamsCount: 0,
          practiceExamsCount: 0,
        },
      };
    }

    // Get stats filtered by student's classId
    const stats = await studentExamsRepository.getCurrentClassStats(
      studentId,
      student.classId
    );

    return {
      success: true,
      message: "Current class stats retrieved successfully",
      data: {
        totalCompletedExams: stats.totalCompletedExams,
        officialExamsCount: stats.officialExamsCount,
        practiceExamsCount: stats.practiceExamsCount,
      },
    };
  } catch (error) {
    console.error("Get current class stats error:", error);
    throw error;
  }
};

// Get subject-wise stats - average percentage and grade per subject
// ...existing code...

// Get subject-wise stats - average percentage and grade per subject
export const getSubjectStats = async (
  studentId: string,
  tenantId: string,
  examType?: "Official" | "Practice" | "Exam Repository" | "all",
  filters?: Record<string, any>
): Promise<GetSubjectStatsResponse> => {
  try {
    // Import repositories dynamically to avoid circular dependency
    const classStudentRepository = await import(
      "../repositories/classStudent.repository"
    );
    const mongoose = await import("mongoose");

    // Get all ClassStudent records for this student (query by studentId only)
    const classStudentRecords = await classStudentRepository.findByStudent(
      studentId,
      undefined // Don't filter by tenantId - verify through Class instead
    );

    // Filter to only include active and promoted enrollments
    const activeAndPromotedRecords = classStudentRecords.filter(
      (record) =>
        record.enrollmentStatus === "active" ||
        record.enrollmentStatus === "promoted"
    );

    // If student has no active/promoted classes, return empty array
    if (!activeAndPromotedRecords || activeAndPromotedRecords.length === 0) {
      return {
        success: true,
        message: "Subject stats retrieved successfully",
        data: [],
      };
    }

    // Separate active and promoted records
    const activeRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "active"
    );
    const promotedRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "promoted"
    );

    // Get class IDs for active and promoted classes
    const activeClassIds = activeRecords.map((record) => {
      const classId = record.classId;
      return classId instanceof mongoose.Types.ObjectId
        ? classId.toString()
        : classId.toString();
    });

    const promotedClassIdsWithDates = promotedRecords.map((record) => {
      const classId = record.classId;
      const classIdStr = classId instanceof mongoose.Types.ObjectId
        ? classId.toString()
        : classId.toString();
      return {
        classId: classIdStr,
        promotionDate: record.updatedAt || record.createdAt, // Use updatedAt (when status changed) or createdAt as fallback
      };
    });

    // Combine all valid classIds for validation
    const allValidClassIds = [
      ...activeClassIds,
      ...promotedClassIdsWithDates.map((p) => p.classId),
    ];

    // Handle classId filter if provided in filters
    let filteredClassIds = allValidClassIds;
    let requestedClassId: string | null = null;

    if (filters) {
      // Check if classId filter is provided (after buildQueryFromRequest processing)
      // It could be: filters.classId.$eq or filters.classId (direct value, string or ObjectId)
      if (filters.classId?.$eq) {
        // Handle $eq operator format
        const classIdValue = filters.classId.$eq;
        requestedClassId = classIdValue?.toString() || null;
      } else if (filters.classId) {
        // Handle direct value (could be string, ObjectId, or other)
        const classIdValue = filters.classId;
        if (typeof classIdValue === 'string') {
          requestedClassId = classIdValue;
        } else if (classIdValue && typeof classIdValue === 'object' && 'toString' in classIdValue) {
          // Handle ObjectId or similar objects
          requestedClassId = classIdValue.toString();
        }
      }

      // If classId filter is provided, validate and filter
      if (requestedClassId) {
        // Normalize to string for comparison
        const normalizedRequestedId = requestedClassId.toString();

        // Validate that the requested classId is one of the student's valid classes
        if (allValidClassIds.includes(normalizedRequestedId)) {
          filteredClassIds = [normalizedRequestedId];
        } else {
          // Requested classId is not in student's classes - return empty array
          return {
            success: true,
            message: "Subject stats retrieved successfully",
            data: [],
          };
        }
      }
    }

    // Filter activeClassIds and promotedClassIdsWithDates based on requested classId
    const filteredActiveClassIds = activeClassIds.filter((id) =>
      filteredClassIds.includes(id)
    );
    const filteredPromotedClassIdsWithDates = promotedClassIdsWithDates.filter(
      (item) => filteredClassIds.includes(item.classId)
    );

    // Get all classIds for querying
    const allClassIds = [
      ...filteredActiveClassIds,
      ...filteredPromotedClassIdsWithDates.map((p) => p.classId),
    ];

    if (allClassIds.length === 0) {
      return {
        success: true,
        message: "Subject stats retrieved successfully",
        data: [],
      };
    }

    // Get all exam attempts for date filtering
    const { ExamStudent } = await import("../models/examStudent.schema");

    // Get all exam attempts for all classes
    const allExamAttempts = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: { $in: allClassIds.map(id => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: "Completed",
      isActive: true,
    })
      .populate({
        path: "examId",
        select: "examTitle examType subjectId isDeleted examStatus",
        match: { isDeleted: false },
        populate: {
          path: "subjectId",
          select: "name",
        },
      })
      .lean();

    // Filter valid exams and apply date restrictions for promoted classes
    const validExams = allExamAttempts.filter((es: any) => {
      const exam = es.examId as any;
      // Exclude if exam is not populated (null - deleted exam) or is deleted
      if (!exam || exam.isDeleted) return false;

      // Only include exams with "Released" status
      if (exam.examStatus !== "Released") {
        return false;
      }

      // Filter by examType if specified (not "all")
      if (examType && examType !== "all" && exam.examType !== examType) {
        return false;
      }

      const examClassId = es.classId?.toString() || es.classId;

      // Check if exam is from an active class
      if (filteredActiveClassIds.includes(examClassId)) {
        return true; // Include all exams from active classes
      }

      // Check if exam is from a promoted class
      const promotedClassInfo = filteredPromotedClassIdsWithDates.find(
        (p) => p.classId === examClassId
      );

      if (promotedClassInfo) {
        // Only include exams completed before/at promotion date
        const promotionDate = promotedClassInfo.promotionDate instanceof Date
          ? promotedClassInfo.promotionDate
          : new Date(promotedClassInfo.promotionDate);
        const examDate = es.updatedAt || es.createdAt;
        const examDateObj = examDate instanceof Date
          ? examDate
          : new Date(examDate);

        return examDateObj <= promotionDate;
      }

      // Exam is not from any valid class - exclude it
      return false;
    });

    // Re-calculate stats from filtered validExams to ensure date restrictions are applied
    // Group by subjectId and calculate averages from validExams
    const subjectMap = new Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        percentages: number[];
        totalExams: number;
        completedExams: number;
      }
    >();

    validExams.forEach((es: any) => {
      const exam = es.examId as any;
      const subject = exam?.subjectId;

      if (!subject) return;

      let subjectId: string;
      let subjectName: string | null = null;

      // Extract subjectId and name
      if (subject._id) {
        subjectId = subject._id.toString();
        subjectName = subject.name || null;
      } else if (subject.name) {
        subjectId = subject._id?.toString() || subject.toString();
        subjectName = subject.name;
      } else {
        subjectId = subject.toString();
      }

      if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) return;

      // Normalize subjectId
      const normalizedSubjectId = new mongoose.Types.ObjectId(subjectId).toString();

      if (!subjectMap.has(normalizedSubjectId)) {
        subjectMap.set(normalizedSubjectId, {
          subjectId: normalizedSubjectId,
          subjectName: subjectName || "Unknown Subject",
          percentages: [],
          totalExams: 0,
          completedExams: 0,
        });
      }

      const subjectData = subjectMap.get(normalizedSubjectId)!;
      if (es.percentage !== null && es.percentage !== undefined) {
        subjectData.percentages.push(es.percentage);
        subjectData.completedExams++;
      }
      subjectData.totalExams++;
    });

    // Fetch subject names for any that weren't populated
    const subjectRepo = new SubjectRepository();
    const missingSubjectIds = Array.from(subjectMap.keys()).filter(
      (id) => !subjectMap.get(id)?.subjectName || subjectMap.get(id)?.subjectName === "Unknown Subject"
    );

    if (missingSubjectIds.length > 0) {
      const subjects = await subjectRepo.findByIds(missingSubjectIds, tenantId);
      subjects.forEach((subject: any) => {
        const subjectId = subject._id.toString();
        const subjectData = subjectMap.get(subjectId);
        if (subjectData) {
          subjectData.subjectName = subject.name || "Unknown Subject";
        }
      });
    }

    // Calculate final stats
    const finalSubjectStats = Array.from(subjectMap.values()).map((data) => {
      const averagePercentage =
        data.percentages.length > 0
          ? data.percentages.reduce((sum, p) => sum + p, 0) / data.percentages.length
          : 0;

      return {
        subjectId: data.subjectId,
        subjectName: data.subjectName,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        totalExams: data.totalExams,
        completedExams: data.completedExams,
      };
    });

    // Get active grading system for tenant
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
      tenantId
    );

    // Helper function to calculate grade from percentage using grading system
    const calculateGrade = (percentage: number): string => {
      return calculateGradeFromPercentage(percentage, gradingSystem || {});
    };

    // Add grade to each subject stat
    const subjectStatsWithGrade = finalSubjectStats.map((stat) => ({
      ...stat,
      grade: calculateGrade(stat.averagePercentage),
    }));

    return {
      success: true,
      message: "Subject stats retrieved successfully",
      data: subjectStatsWithGrade,
    };
  } catch (error: any) {
    console.error("Get subject stats service error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      studentId,
      tenantId,
      examType,
      errorMessage: error?.message,
      errorName: error?.name,
    });
    throw error;
  }
};

// Get recent results - last 3 graded results
export const getRecentResults = async (
  studentId: string
): Promise<GetRecentResultsResponse> => {
  try {
    const results = await studentExamsRepository.getRecentGradedResults(
      studentId
    );

    return {
      success: true,
      message: "Recent results retrieved successfully",
      data: results,
    };
  } catch (error: any) {
    console.error("Get recent results service error:", error);
    throw error;
  }
};

// Get academic progress trend (month-wise)
export const getAcademicProgressTrend = async (
  studentId: string,
  tenantId: string,
  examType?: "Official" | "Practice" | "Exam Repository" | "all",
  filters?: Record<string, any>
): Promise<{
  success: boolean;
  message: string;
  data: Array<{
    year: number;
    month: number;
    monthName: string;
    averagePercentage: number;
    totalExams: number;
  }>;
}> => {
  try {
    // Import repositories dynamically to avoid circular dependency
    const classStudentRepository = await import(
      "../repositories/classStudent.repository"
    );
    const mongoose = await import("mongoose");

    // Get all ClassStudent records for this student (query by studentId only)
    const classStudentRecords = await classStudentRepository.findByStudent(
      studentId,
      undefined // Don't filter by tenantId - verify through Class instead
    );

    // Filter to only include active and promoted enrollments
    const activeAndPromotedRecords = classStudentRecords.filter(
      (record) =>
        record.enrollmentStatus === "active" ||
        record.enrollmentStatus === "promoted"
    );

    // If student has no active/promoted classes, return empty array
    if (!activeAndPromotedRecords || activeAndPromotedRecords.length === 0) {
      return {
        success: true,
        message: "Academic progress trend retrieved successfully",
        data: [],
      };
    }

    // Separate active and promoted records
    const activeRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "active"
    );
    const promotedRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "promoted"
    );

    // Get class IDs for active and promoted classes
    const activeClassIds = activeRecords.map((record) => {
      const classId = record.classId;
      return classId instanceof mongoose.Types.ObjectId
        ? classId.toString()
        : classId.toString();
    });

    const promotedClassIdsWithDates = promotedRecords.map((record) => {
      const classId = record.classId;
      const classIdStr = classId instanceof mongoose.Types.ObjectId
        ? classId.toString()
        : classId.toString();
      return {
        classId: classIdStr,
        promotionDate: record.updatedAt || record.createdAt, // Use updatedAt (when status changed) or createdAt as fallback
      };
    });

    // Combine all valid classIds for validation
    const allValidClassIds = [
      ...activeClassIds,
      ...promotedClassIdsWithDates.map((p) => p.classId),
    ];

    // Handle classId filter if provided in filters
    let filteredClassIds = allValidClassIds;
    let requestedClassId: string | null = null;

    if (filters) {
      // Check if classId filter is provided (after buildQueryFromRequest processing)
      // It could be: filters.classId.$eq or filters.classId (direct value, string or ObjectId)
      if (filters.classId?.$eq) {
        // Handle $eq operator format
        const classIdValue = filters.classId.$eq;
        requestedClassId = classIdValue?.toString() || null;
      } else if (filters.classId) {
        // Handle direct value (could be string, ObjectId, or other)
        const classIdValue = filters.classId;
        if (typeof classIdValue === 'string') {
          requestedClassId = classIdValue;
        } else if (classIdValue && typeof classIdValue === 'object' && 'toString' in classIdValue) {
          // Handle ObjectId or similar objects
          requestedClassId = classIdValue.toString();
        }
      }

      // If classId filter is provided, validate and filter
      if (requestedClassId) {
        // Normalize to string for comparison
        const normalizedRequestedId = requestedClassId.toString();

        // Validate that the requested classId is one of the student's valid classes
        if (allValidClassIds.includes(normalizedRequestedId)) {
          filteredClassIds = [normalizedRequestedId];
        } else {
          // Requested classId is not in student's classes - return empty array
          return {
            success: true,
            message: "Academic progress trend retrieved successfully",
            data: [],
          };
        }
      }
    }

    // Filter activeClassIds and promotedClassIdsWithDates based on requested classId
    const filteredActiveClassIds = activeClassIds.filter((id) =>
      filteredClassIds.includes(id)
    );
    const filteredPromotedClassIdsWithDates = promotedClassIdsWithDates.filter(
      (item) => filteredClassIds.includes(item.classId)
    );

    // Get academic progress trend from repository (all classes at once)
    const allClassIds = [
      ...filteredActiveClassIds,
      ...filteredPromotedClassIdsWithDates.map((p) => p.classId),
    ];

    if (allClassIds.length === 0) {
      return {
        success: true,
        message: "Academic progress trend retrieved successfully",
        data: [],
      };
    }

    // Get all exam attempts for date filtering (we'll process them ourselves to apply date restrictions)
    const { ExamStudent } = await import("../models/examStudent.schema");

    // Get all exam attempts for all classes
    const allExamAttempts = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: { $in: allClassIds.map(id => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
      percentage: { $exists: true, $ne: null },
    })
      .populate({
        path: "examId",
        select: "examTitle examType examStatus isDeleted",
        match: { isDeleted: false },
      })
      .sort({ updatedAt: 1 }) // Sort by date ascending
      .lean();

    // Filter valid exams and apply date restrictions for promoted classes
    const validExams = allExamAttempts.filter((es: any) => {
      const exam = es.examId;
      if (!exam || exam.isDeleted) return false;
      if (exam.examStatus !== "Released") return false;
      if (examType && examType !== "all" && exam.examType !== examType) {
        return false;
      }

      const examClassId = es.classId?.toString() || es.classId;

      // Check if exam is from an active class
      if (filteredActiveClassIds.includes(examClassId)) {
        return true; // Include all exams from active classes
      }

      // Check if exam is from a promoted class
      const promotedClassInfo = filteredPromotedClassIdsWithDates.find(
        (p) => p.classId === examClassId
      );

      if (promotedClassInfo) {
        // Only include exams completed before/at promotion date
        const promotionDate = promotedClassInfo.promotionDate instanceof Date
          ? promotedClassInfo.promotionDate
          : new Date(promotedClassInfo.promotionDate);
        const examDate = es.updatedAt || es.createdAt;
        const examDateObj = examDate instanceof Date
          ? examDate
          : new Date(examDate);

        return examDateObj <= promotionDate;
      }

      // Exam is not from any valid class - exclude it
      return false;
    });

    // Re-group by month with filtered data
    const monthMap = new Map<
      string,
      {
        year: number;
        month: number;
        percentages: number[];
      }
    >();

    validExams.forEach((es: any) => {
      const date = es.updatedAt || es.createdAt;
      if (!date) return;

      const examDate = new Date(date);
      const year = examDate.getFullYear();
      const month = examDate.getMonth() + 1; // 1-12
      const key = `${year}-${month}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          year,
          month,
          percentages: [],
        });
      }

      const monthData = monthMap.get(key)!;
      if (es.percentage !== null && es.percentage !== undefined) {
        monthData.percentages.push(es.percentage);
      }
    });

    // Calculate averages and format response
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const trend = Array.from(monthMap.entries())
      .map(([key, data]) => {
        const averagePercentage =
          data.percentages.length > 0
            ? data.percentages.reduce((sum, p) => sum + p, 0) /
            data.percentages.length
            : 0;

        return {
          year: data.year,
          month: data.month,
          monthName: monthNames[data.month - 1],
          averagePercentage: Math.round(averagePercentage * 100) / 100, // Round to 2 decimal places
          totalExams: data.percentages.length,
        };
      })
      .sort((a, b) => {
        // Sort by year first, then by month
        if (a.year !== b.year) {
          return a.year - b.year;
        }
        return a.month - b.month;
      });

    return {
      success: true,
      message: "Academic progress trend retrieved successfully",
      data: trend,
    };
  } catch (error: any) {
    console.error("Get academic progress trend service error:", error);
    throw error;
  }
};

// Get started exams for student (exams with status "Started" that haven't expired)
export const getStartedExams = async (
  studentId: string,
  examType?: "Official" | "Practice" | "Exam Repository"
): Promise<{
  success: boolean;
  message: string;
  data: StartedExamResponse[];
}> => {
  try {
    const startedExamsData =
      await studentExamsRepository.getStartedExamsForStudent(
        studentId,
        examType
      );

    // Enrich started exams (similar to performedExams logic)
    const enrichedStartedExams: (StartedExamResponse | null)[] =
      await Promise.all(
        startedExamsData.map(async (examStudent: any) => {
          const exam = examStudent.examId;
          if (!exam) return null;

          // Get subject name
          let subjectName = "Unknown Subject";
          let subjectId = "";

          if (exam.subjectId) {
            if (typeof exam.subjectId === "object" && exam.subjectId.name) {
              // Populated subject
              subjectName = exam.subjectId.name;
              subjectId = exam.subjectId._id?.toString() || "";
            } else if (typeof exam.subjectId === "string") {
              subjectId = exam.subjectId;
            } else if (exam.subjectId._id) {
              subjectId = exam.subjectId._id.toString();
            }
          }

          // Fallback: fetch subject name if not populated
          if (
            (!subjectName || subjectName === "Unknown Subject") &&
            subjectId
          ) {
            try {
              const subjectRepo = new SubjectRepository();
              const tenantId = examStudent.tenantId?.toString() || "";
              if (tenantId) {
                const subject = await subjectRepo.findById(subjectId, tenantId);
                if (subject && (subject as any).name) {
                  subjectName = (subject as any).name;
                }
              }
            } catch (err) {
              console.warn(`Could not fetch subject name for ${subjectId}`);
            }
          }

          // Determine if result is graded (should be false for started exams)
          const isResultGraded = examStudent.gradingStatus === "Completed";

          // Get teacher name
          let teacherName = undefined;
          if (exam.teacherId) {
            try {
              const teacherInfo = await teacherRepository.findTeacherById(
                exam.teacherId.toString()
              );
              if (teacherInfo) {
                teacherName =
                  teacherInfo.firstName + " " + teacherInfo.lastName;
              }
            } catch (err) {
              console.warn(
                `Could not fetch teacher name for ${exam.teacherId}`
              );
            }
          }

          // Get questions count
          const questionsCount =
            await examQuestionRepository.countExamQuestions(
              exam._id.toString()
            );

          return {
            examId: exam._id?.toString() || "",
            title: exam.examTitle || "Unknown Exam",
            subject: subjectName,
            subjectId: subjectId,
            attemptedOn: examStudent.updatedAt || examStudent.createdAt,
            isResultGraded,
            examType: exam.examType || "Practice",
            status: examStudent.status, // Should be "Started"
            gradingStatus: examStudent.gradingStatus || "Waiting for Grading",
            percentage: examStudent.percentage || undefined,
            grade: examStudent.grade || undefined,
            teacherName: teacherName,
            durationInMinutes: exam.durationInMinutes || 0,
            questionsCount: questionsCount,
            totalMarks: exam.totalMarks || 0,
          };
        })
      );

    // Filter out null results
    const validStartedExams = enrichedStartedExams.filter(
      (exam): exam is StartedExamResponse => exam !== null
    );

    return {
      success: true,
      message: "Started exams retrieved successfully",
      data: validStartedExams,
    };
  } catch (error: any) {
    console.error("Get started exams service error:", error);
    throw error;
  }
};

export * from "./studentExamsByStatus.service";
// For clarity, re-export as category
export { getStudentExamsByCategory } from "./studentExamsByStatus.service";

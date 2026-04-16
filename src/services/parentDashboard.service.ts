/**
 * Parent Dashboard Service
 * Business logic for parent dashboard exam results, academic reports, and analytics
 */

import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as examRepository from "../repositories/exam.repository";
import * as parentChildRepository from "../repositories/parentChild.repository";
import * as studentRepository from "../repositories/student.repository";
import * as studentExamsService from "./studentExams.service";
import * as teacherRepository from "../repositories/teacher.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import * as examBadgeRepository from "../repositories/examBadge.repository";
import { calculateGradeFromPercentage } from "./gradingSystem.service";
import { SubjectRepository } from "@/repositories/subject.repository";
import ExamAttempt from "../models/examAttempt.schema";
import ExamBadge from "../models/examBadge.schema";
import ExamCredential from "../models/examCredential.schema";
import Exam from "../models/exam.schema";
import Student from "../models/student.schema";
import mongoose from "mongoose";
import {
  ExamResultsResponse,
  ExamResultItem,
  GetChildExamResultsRequest,
  ChildInfo,
  ParentChildrenResponse,
  ParentDashboardOverview,
  ChildPerformanceSummary,
  ChildActivityItem,
  GetChildrenActivitiesRequest,
  ChildrenActivitiesResponse,
} from "@/types";
import StudentActivityLog from "../models/studentActivityLog.schema";
import { GetSubjectStatsResponse } from "@/types/studentExams.types";
import { monetizationApiIntegration } from "./monetizationApiIntegration.service";
import { FREE_CREDITS_PER_CHILD } from "../utils/constants/credits";

const subjectRepository = new SubjectRepository();

/**
 * Get exam results for a child with filters
 */
export const getChildExamResults = async (
  params: GetChildExamResultsRequest & { tenantId: string; parentId: string }
): Promise<ExamResultsResponse> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        params.parentId,
        params.childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get all exam attempts for the child
    const allAttempts = await examAttemptRepository.getStudentExamAttempts(
      params.childId
    );

    // Filter by tenantId and only graded attempts
    let filteredAttempts = allAttempts.filter(
      (a) =>
        a.tenantId?.toString() === params.tenantId &&
        a.attemptStatus === "Graded"
    );

    // Apply exam type filter - get exam details for filtering
    if (params.examType) {
      const enrichedWithExamType = await Promise.all(
        filteredAttempts.map(async (attempt) => {
          try {
            const exam = await examRepository.findExamById(
              attempt.examId.toString()
            );
            return { attempt, examType: exam?.examType };
          } catch (error) {
            return { attempt, examType: null };
          }
        })
      );
      filteredAttempts = enrichedWithExamType
        .filter((item) => item.examType === params.examType)
        .map((item) => item.attempt);
    }

    // Enrich attempts with exam and subject details
    const enrichedResults = await Promise.all(
      filteredAttempts.map(async (attempt) => {
        try {
          const exam = await examRepository.findExamById(
            attempt.examId.toString()
          );
          if (!exam) {
            return null;
          }

          // Handle subjectId - it might be populated (object) or ObjectId
          let subjectIdStr = "";
          let subjectName = "Unknown";

          if (exam.subjectId) {
            // Check if subjectId is populated (object with _id and name)
            if (typeof exam.subjectId === "object" && exam.subjectId !== null) {
              if ("_id" in exam.subjectId) {
                // Populated subject object
                subjectIdStr = (exam.subjectId as any)._id?.toString() || "";
                subjectName = (exam.subjectId as any).name || "Unknown";
              } else if ("toString" in exam.subjectId) {
                // ObjectId object
                subjectIdStr = (exam.subjectId as any).toString();
              }
            } else if (typeof exam.subjectId === "string") {
              // String ObjectId
              subjectIdStr = exam.subjectId;
            }

            // If we don't have subject name yet, try to fetch it
            if (
              subjectName === "Unknown" &&
              subjectIdStr &&
              mongoose.Types.ObjectId.isValid(subjectIdStr)
            ) {
              try {
                const subject = await subjectRepository.findById(
                  subjectIdStr,
                  params.tenantId
                );
                if (subject) {
                  subjectName = (subject as any).name || "Unknown";
                }
              } catch (error) {
                console.error(
                  `Error fetching subject for exam ${attempt.examId}:`,
                  error
                );
              }
            }
          }

          // Calculate grade from percentage if not available
          const grade =
            attempt.grade ||
            (await calculateGrade(attempt.percentage || 0, params.tenantId));

          return {
            examId: attempt.examId.toString(),
            examTitle: exam?.examTitle || "Unknown Exam",
            examType: (exam?.examType || "Official") as
              | "Official"
              | "Practice"
              | "Exam Repository",
            subject: subjectName,
            subjectId: subjectIdStr,
            date: attempt.submittedAt || new Date(),
            score: attempt.obtainedMarks || 0,
            totalMarks: attempt.totalMarks || 0,
            percentage: attempt.percentage || 0,
            grade: grade,
            result: (attempt.result || "Pass") as "Pass" | "Fail" | "Pending",
            classRank: attempt.classRank,
            totalStudentsInClass: undefined,
          } as ExamResultItem;
        } catch (error) {
          console.error(
            `Error enriching attempt for exam ${attempt.examId}:`,
            error
          );
          return null;
        }
      })
    );

    // Remove null entries
    let results = enrichedResults.filter((r) => r !== null) as ExamResultItem[];

    // Apply subject filter
    if (params.subject) {
      results = results.filter((r) => r.subjectId === params.subject);
    }

    // Apply date filters
    if (params.month && params.year) {
      results = results.filter((r) => {
        const resultDate = new Date(r.date);
        return (
          resultDate.getMonth() + 1 === params.month &&
          resultDate.getFullYear() === params.year
        );
      });
    }

    // Apply result filter
    if (params.result) {
      results = results.filter((r) => r.result === params.result);
    }

    // Sort results
    const sortBy = params.sortBy || "date";
    const sortOrder = params.sortOrder === "asc" ? 1 : -1;

    results.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case "date":
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case "percentage":
          aVal = a.percentage;
          bVal = b.percentage;
          break;
        case "subject":
          aVal = a.subject;
          bVal = b.subject;
          break;
        default:
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
      }

      if (aVal < bVal) return -sortOrder;
      if (aVal > bVal) return sortOrder;
      return 0;
    });

    // Calculate summary
    const summary = {
      totalExams: results.length,
      passedExams: results.filter((r) => r.result === "Pass").length,
      failedExams: results.filter((r) => r.result === "Fail").length,
      averagePercentage:
        results.length > 0
          ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length
          : 0,
      highestScore:
        results.length > 0 ? Math.max(...results.map((r) => r.percentage)) : 0,
      lowestScore:
        results.length > 0 ? Math.min(...results.map((r) => r.percentage)) : 0,
    };

    // Extract unique filter values
    const uniqueExamTypes = [...new Set(results.map((r) => r.examType))];
    const uniqueSubjects = [...new Set(results.map((r) => r.subject))];
    const uniqueMonths = [
      ...new Set(results.map((r) => new Date(r.date).getMonth() + 1)),
    ];
    const uniqueYears = [
      ...new Set(results.map((r) => new Date(r.date).getFullYear())),
    ];

    // Paginate results
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIdx = (pageNo - 1) * pageSize;
    const paginatedResults = results.slice(startIdx, startIdx + pageSize);

    return {
      results: paginatedResults,
      filters: {
        examTypes: uniqueExamTypes,
        subjects: uniqueSubjects,
        months: uniqueMonths.sort((a, b) => a - b),
        years: uniqueYears.sort((a, b) => b - a),
      },
      summary,
      pagination: {
        total: results.length,
        pageNo,
        pageSize,
        totalPages: Math.ceil(results.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get child exam results error:", error);
    throw error;
  }
};

/**
 * Get academic reports for a child
 */
export const getChildAcademicReports = async (params: {
  childId: string;
  tenantId: string;
  parentId: string;
  search?: string;
  teacher?: string;
  subject?: string;
  fromDate?: Date;
  toDate?: Date;
  pageNo?: number;
  pageSize?: number;
}): Promise<{ availableReports: any[]; pagination: any }> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        params.parentId,
        params.childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get child info
    const child = await studentRepository.findStudentById(params.childId);
    if (!child) {
      throw new Error("Child/Student not found");
    }

    const studentName = `${child.firstName} ${child.lastName}`;

    // Get all exam attempts for reports
    const allAttempts = await examAttemptRepository.getStudentExamAttempts(
      params.childId
    );

    // Filter by tenantId and only graded attempts
    const gradedAttempts = allAttempts.filter(
      (a) =>
        a.tenantId?.toString() === params.tenantId &&
        a.attemptStatus === "Graded"
    );

    // Enrich attempts with exam and subject details
    const enrichedReports = await Promise.all(
      gradedAttempts.map(async (attempt) => {
        try {
          const exam = await examRepository.findExamById(
            attempt.examId.toString()
          );
          if (!exam) return null;

          // Get subject info
          let subjectIdStr = "";
          let subjectName = "Unknown";

          if (exam.subjectId) {
            if (typeof exam.subjectId === "object" && exam.subjectId !== null) {
              if ("_id" in exam.subjectId) {
                subjectIdStr = (exam.subjectId as any)._id?.toString() || "";
                subjectName = (exam.subjectId as any).name || "Unknown";
              } else if ("toString" in exam.subjectId) {
                subjectIdStr = (exam.subjectId as any).toString();
              }
            } else if (typeof exam.subjectId === "string") {
              subjectIdStr = exam.subjectId;
            }

            if (
              subjectName === "Unknown" &&
              subjectIdStr &&
              mongoose.Types.ObjectId.isValid(subjectIdStr)
            ) {
              try {
                const subject = await subjectRepository.findById(
                  subjectIdStr,
                  params.tenantId
                );
                if (subject) {
                  subjectName = (subject as any).name || "Unknown";
                }
              } catch (error) {
                console.error(`Error fetching subject:`, error);
              }
            }
          }

          const reportType = exam.examType || "Exam Result Report";

          // Get teacher info from exam
          let teacherName = "System Generated";
          if (exam.teacherId) {
            let teacherId = "";
            if (typeof exam.teacherId === "object" && exam.teacherId !== null) {
              teacherId =
                (exam.teacherId as any)._id?.toString() ||
                (exam.teacherId as any).toString();
            } else {
              teacherId = String(exam.teacherId);
            }

            if (mongoose.Types.ObjectId.isValid(teacherId)) {
              try {
                const teacher = await teacherRepository.findTeacherById(
                  teacherId
                );
                if (teacher) {
                  teacherName =
                    `${teacher.firstName} ${teacher.lastName}`.trim();
                }
              } catch (error) {
                console.error(`Error fetching teacher ${teacherId}:`, error);
              }
            }
          }

          const grade =
            attempt.grade ||
            (await calculateGrade(attempt.percentage || 0, params.tenantId));
          const percentage = attempt.percentage || 0;

          return {
            id: attempt._id.toString(),
            title: exam.examTitle || `Exam Result Report`,
            reportType,
            generatedDate: attempt.submittedAt || new Date(),
            tags: [subjectName],
            teacher: teacherName,
            subjectName,
            subjectId: subjectIdStr,
            percentage,
            grade,
            gradeColor: getGradeColor(grade),
          };
        } catch (error) {
          console.error(`Error processing attempt:`, error);
          return null;
        }
      })
    );

    // Filter out nulls
    let reports = enrichedReports.filter((r) => r !== null) as any[];

    // Calculate overall stats for report details
    const totalAttempts = reports.length;
    const totalObtainedMarks = reports.reduce((sum, r) => sum + (r.score || 0), 0);
    const totalPossibleMarks = reports.reduce((sum, r) => sum + (r.totalMarks || 100), 0);
    const averagePerformance =
      totalPossibleMarks > 0
        ? (totalObtainedMarks / totalPossibleMarks) * 100
        : 0;

    // Add complete report data to each report
    // Note: Each report already has its own 'subject' and 'teacherInfo' objects
    reports = reports.map((report, index) => ({
      ...report,
      studentName,
      currentRank: index + 1, // Simple rank based on position
      totalStudents: totalAttempts,
      averagePerformance: Math.round(averagePerformance),
    }));

    // Apply search filter
    if (params.search) {
      const searchLower = params.search.toLowerCase().trim();
      reports = reports.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.subjectName.toLowerCase().includes(searchLower) ||
          r.teacher.toLowerCase().includes(searchLower)
      );
    }

    // Apply teacher filter (case-insensitive)
    if (params.teacher) {
      const teacherLower = params.teacher.toLowerCase().trim();
      reports = reports.filter(
        (r) => r.teacher.toLowerCase().trim() === teacherLower
      );
    }

    // Apply subject filter (case-insensitive)
    if (params.subject) {
      const subjectLower = params.subject.toLowerCase().trim();
      reports = reports.filter(
        (r) => r.subjectName.toLowerCase().trim() === subjectLower
      );
    }

    // Apply date range filter
    if (params.fromDate) {
      const fromDate = new Date(params.fromDate);
      fromDate.setHours(0, 0, 0, 0); // Start of day
      reports = reports.filter((r) => new Date(r.generatedDate) >= fromDate);
    }
    if (params.toDate) {
      const toDate = new Date(params.toDate);
      toDate.setHours(23, 59, 59, 999); // End of day
      reports = reports.filter((r) => new Date(r.generatedDate) <= toDate);
    }

    // Sort by date descending
    reports.sort(
      (a, b) =>
        new Date(b.generatedDate).getTime() -
        new Date(a.generatedDate).getTime()
    );

    // Paginate
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIdx = (pageNo - 1) * pageSize;
    const paginatedReports = reports.slice(startIdx, startIdx + pageSize);

    return {
      availableReports: paginatedReports,
      pagination: {
        total: reports.length,
        pageNo,
        pageSize,
        totalPages: Math.ceil(reports.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get child academic reports error:", error);
    throw error;
  }
};

/**
 * Helper function to get color for grade
 */
function getGradeColor(grade: string): string {
  switch (grade) {
    case "A+":
    case "A":
      return "#22c55e"; // green
    case "B":
      return "#3b82f6"; // blue
    case "C":
      return "#f59e0b"; // amber
    case "D":
      return "#f97316"; // orange
    case "F":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

/**
 * Get all children for a parent
 */
export const getParentChildren = async (
  parentId: string,
  tenantId: string,
  status?: "active" | "all"
): Promise<ParentChildrenResponse> => {
  try {
    const relationships = await parentChildRepository.findChildrenByParentId(
      parentId
    );

    const { Class } = await import("../models/class.schema");
    const { Student } = await import("../models/student.schema");
    const ObjectId = mongoose.Types.ObjectId;

    // Extract all student IDs first for batch wallet fetch
    const filteredRelationships = relationships.filter(
      (rel: any) => status === "all" || rel.status === status
    );
    const studentIds = filteredRelationships
      .map((rel: any) => {
        const child = rel.childId;
        return child?._id?.toString() || null;
      })
      .filter((id: string | null) => id !== null) as string[];

    // Fetch all wallets in batch from Monetization-API
    let walletsMap = new Map<string, {
      balance: number;
      totalCreditsPurchased: number;
      totalCreditsUsed: number;
      lastTopupDate?: Date;
    }>();

    if (studentIds.length > 0) {
      try {
        const wallets = await monetizationApiIntegration.getStudentWalletsBatch(
          studentIds,
          tenantId
        );
        wallets.forEach((wallet) => {
          walletsMap.set(wallet.studentId, {
            balance: wallet.balance,
            totalCreditsPurchased: wallet.totalCreditsPurchased,
            totalCreditsUsed: wallet.totalCreditsUsed,
            lastTopupDate: wallet.lastTopupDate,
          });
        });
      } catch (error) {
        console.error("Error fetching wallets from Monetization-API:", error);
        // Continue without wallet data if API call fails
      }
    }

    const children: ChildInfo[] = await Promise.all(
      filteredRelationships.map(async (rel: any) => {
        const child = rel.childId;
        const childId = child._id.toString();
        const classId = child.classId?.toString() || "";

        let className = "Unknown";
        let classGrade = 0; // Added classGrade variable
        let classTeacher = "";
        let session = ""; // Added session variable
        let totalStudents = 0;

        if (classId && ObjectId.isValid(classId)) {
          try {
            const classData = await Class.findOne({
              _id: new ObjectId(classId),
              isDeleted: false,
            })
              .populate("classTeacherId", "firstName lastName")
              .populate("batchId", "batchName") // Populate batch info
              .lean();

            if (classData) {
              className = (classData as any).name || "Unknown";
              classGrade = (classData as any).grade || 0;

              // Extract class teacher name from populated field
              if ((classData as any).classTeacherId) {
                const teacher = (classData as any).classTeacherId;
                classTeacher = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
              }

              // Extract session/batch name
              if ((classData as any).batchId) {
                session = (classData as any).batchId.batchName || "";
              }
            }

            // Get total students in this class
            totalStudents = await Student.countDocuments({
              classId: new ObjectId(classId),
              isDeleted: false,
            });
          } catch (error) {
            console.error(
              `Error fetching class data for classId ${classId}:`,
              error
            );
          }
        }

        // Get student's photo
        const photo = child.profileImage || "";

        // Calculate rank based on exam performance
        let rank = 0;
        let rankDirection: "up" | "down" = "up";
        let avgPercentage = 0;

        if (classId && ObjectId.isValid(classId)) {
          try {
            // Get all students' average scores in the class
            const studentScores = await ExamAttempt.aggregate([
              {
                $match: {
                  classId: new ObjectId(classId),
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
                  averageScore: {
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
                $sort: { averageScore: -1 },
              },
            ]);

            // Find the rank of this child
            const childIndex = studentScores.findIndex(
              (s: any) => s._id.toString() === childId
            );
            rank = childIndex >= 0 ? childIndex + 1 : 0;

            // Get average percentage for this child
            const childScore = studentScores.find(
              (s: any) => s._id.toString() === childId
            );
            avgPercentage = childScore?.averageScore || 0;

            // For now, default to "up" - could be enhanced with historical comparison
            rankDirection = "up";
          } catch (error) {
            console.error(
              `Error calculating rank for child ${childId}:`,
              error
            );
          }
        }

        // Get badge count for this child from ExamCredential
        let badgesCount = 0;
        try {
          badgesCount = await ExamCredential.countDocuments({
            studentId: new mongoose.Types.ObjectId(childId),
            credentialType: 'badge',
            isActive: true,
            isDeleted: false
          });
        } catch (error) {
          console.error(`Error getting badge count for child ${childId}:`, error);
        }

        // Calculate letter grade from percentage
        let grade = "N/A";
        if (avgPercentage > 0) {
          if (avgPercentage >= 90) grade = "A+";
          else if (avgPercentage >= 80) grade = "A";
          else if (avgPercentage >= 70) grade = "B";
          else if (avgPercentage >= 60) grade = "C";
          else if (avgPercentage >= 50) grade = "D";
          else grade = "F";
        }

        // Format average grade as percentage string
        const avgGrade = `${Math.round(avgPercentage)}%`;

        // Get next upcoming exam for this child
        let nextExam: ChildInfo["nextExam"] = undefined;
        if (classId && ObjectId.isValid(classId)) {
          try {
            const upcomingExam = await Exam.findOne({
              classId: new ObjectId(classId),
              startOn: { $gt: new Date() },
              examStatus: "Published",
              isDeleted: false,
            })
              .sort({ startOn: 1 })
              .populate("subjectId", "name")
              .lean();

            if (upcomingExam) {
              const subjectData = upcomingExam.subjectId as any;
              nextExam = {
                examId: (upcomingExam as any)._id.toString(),
                examTitle: upcomingExam.examTitle || "",
                subject: subjectData?.name || "Unknown",
                subjectId: subjectData?._id?.toString() || "",
                startOn: upcomingExam.startOn,
                endOn: upcomingExam.endOn,
                durationInMinutes: upcomingExam.durationInMinutes || 0,
                totalMarks: upcomingExam.totalMarks || 0,
              };
            }
          } catch (error) {
            console.error(`Error getting next exam for child ${childId}:`, error);
          }
        }

        // Get wallet data for this child
        const wallet = walletsMap.get(childId);

        return {
          childId,
          firstName: child.firstName,
          lastName: child.lastName,
          email: child.email,
          rollNumber: child.rollNumber,
          studentId: child.studentId,
          className,
          classGrade, // Added classGrade
          classId,
          classTeacher: classTeacher || "",
          session: session || "",
          photo,
          rank,
          rankDirection,
          totalStudents,
          tenantName: rel.tenantName || "",
          badgesCount,
          grade,
          avgGrade,
          nextExam,
          studentWallet: wallet || {
            balance: 0,
            totalCreditsPurchased: 0,
            totalCreditsUsed: 0,
          },
        } as ChildInfo;
      })
    );

    return {
      children,
      totalChildren: children.length,
    };
  } catch (error) {
    console.error("Get parent children error:", error);
    throw error;
  }
};

/**
 * Get parent dashboard overview
 */
export const getParentDashboardOverview = async (
  parentId: string,
  tenantId: string
): Promise<ParentDashboardOverview> => {
  try {
    // Get all children
    const childrenResponse = await getParentChildren(parentId, tenantId);

    // Get performance summary for each child
    const childPerformances: ChildPerformanceSummary[] = await Promise.all(
      childrenResponse.children.map(async (child) => {
        try {
          const allAttempts =
            await examAttemptRepository.getStudentExamAttempts(child.childId);

          // Filter by tenantId and only graded attempts
          const gradedAttempts = allAttempts.filter(
            (a) =>
              a.tenantId?.toString() === tenantId &&
              a.attemptStatus === "Graded"
          );
          const passedCount = gradedAttempts.filter(
            (a) => a.result === "Pass"
          ).length;
          const totalObtainedMarks = gradedAttempts.reduce(
            (sum, a) => sum + (a.obtainedMarks || 0),
            0
          );
          const totalPossibleMarks = gradedAttempts.reduce(
            (sum, a) => sum + (a.totalMarks || 100),
            0
          );
          const avgPercentage =
            totalPossibleMarks > 0
              ? (totalObtainedMarks / totalPossibleMarks) * 100
              : 0;

          // Calculate trend
          const recentAttempts = gradedAttempts.slice(-5);
          let percentageChange = 0;
          if (recentAttempts.length >= 2) {
            const oldAvg =
              recentAttempts
                .slice(0, -1)
                .reduce((sum, a) => sum + (a.percentage || 0), 0) /
              (recentAttempts.length - 1);
            const newAvg =
              recentAttempts[recentAttempts.length - 1].percentage || 0;
            percentageChange = newAvg - oldAvg;
          }

          return {
            childId: child.childId,
            childName: `${child.firstName} ${child.lastName}`,
            totalExams: gradedAttempts.length,
            passedExams: passedCount,
            failedExams: gradedAttempts.length - passedCount,
            averagePercentage: avgPercentage,
            currentGrade:
              gradedAttempts.length > 0
                ? await calculateGrade(avgPercentage, tenantId)
                : "--",
            trends: {
              isImproving: percentageChange >= 0,
              percentageChange: Math.round(percentageChange * 100) / 100,
            },
          };
        } catch (error) {
          console.error(
            `Error getting performance for child ${child.childId}:`,
            error
          );
          return {
            childId: child.childId,
            childName: `${child.firstName} ${child.lastName}`,
            totalExams: 0,
            passedExams: 0,
            failedExams: 0,
            averagePercentage: 0,
            currentGrade: "N/A",
            trends: {
              isImproving: false,
              percentageChange: 0,
            },
          };
        }
      })
    );

    // Get recent exams across all children
    const allAttemptsArrays = await Promise.all(
      childrenResponse.children.map((child) =>
        examAttemptRepository.getStudentExamAttempts(child.childId)
      )
    );

    const recentExams: ExamResultItem[] = [];
    for (let i = 0; i < childrenResponse.children.length; i++) {
      // Filter by tenantId and only graded attempts
      const attempts = allAttemptsArrays[i]
        .filter(
          (a) =>
            a.tenantId?.toString() === tenantId && a.attemptStatus === "Graded"
        )
        .slice(0, 5);
      for (const attempt of attempts) {
        try {
          const exam = await examRepository.findExamById(
            attempt.examId.toString()
          );
          if (!exam) {
            continue;
          }

          // Handle subjectId - it might be populated (object) or ObjectId
          let subjectIdStr = "";
          let subjectName = "Unknown";

          if (exam.subjectId) {
            // Check if subjectId is populated (object with _id and name)
            if (typeof exam.subjectId === "object" && exam.subjectId !== null) {
              if ("_id" in exam.subjectId) {
                // Populated subject object
                subjectIdStr = (exam.subjectId as any)._id?.toString() || "";
                subjectName = (exam.subjectId as any).name || "Unknown";
              } else if ("toString" in exam.subjectId) {
                // ObjectId object
                subjectIdStr = (exam.subjectId as any).toString();
              }
            } else if (typeof exam.subjectId === "string") {
              // String ObjectId
              subjectIdStr = exam.subjectId;
            }

            // If we don't have subject name yet, try to fetch it
            if (
              subjectName === "Unknown" &&
              subjectIdStr &&
              mongoose.Types.ObjectId.isValid(subjectIdStr)
            ) {
              try {
                const subject = await subjectRepository.findById(
                  subjectIdStr,
                  tenantId
                );
                if (subject) {
                  subjectName = (subject as any).name || "Unknown";
                }
              } catch (error) {
                console.error(
                  `Error fetching subject for exam ${attempt.examId}:`,
                  error
                );
              }
            }
          }

          // Calculate grade from percentage if not available
          const grade =
            attempt.grade ||
            (await calculateGrade(attempt.percentage || 0, tenantId));

          recentExams.push({
            examId: attempt.examId.toString(),
            examTitle: exam?.examTitle || "Unknown",
            examType: (exam?.examType || "Official") as
              | "Official"
              | "Practice"
              | "Exam Repository",
            subject: subjectName,
            subjectId: subjectIdStr,
            date: attempt.submittedAt || new Date(),
            score: attempt.obtainedMarks || 0,
            totalMarks: attempt.totalMarks || 0,
            percentage: attempt.percentage || 0,
            grade: grade,
            result: (attempt.result || "Pass") as "Pass" | "Fail" | "Pending",
          });
        } catch (error) {
          console.error("Error enriching recent exam:", error);
        }
      }
    }

    // Sort and limit recent exams
    recentExams.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const limitedRecentExams = recentExams.slice(0, 10);

    return {
      children: childPerformances,
      recentExams: limitedRecentExams,
    };
  } catch (error) {
    console.error("Get parent dashboard overview error:", error);
    throw error;
  }
};

/**
 * Helper function to calculate grade based on percentage using grading system
 */
async function calculateGrade(
  percentage: number,
  tenantId: string
): Promise<string> {
  try {
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
      tenantId
    );
    return calculateGradeFromPercentage(percentage, gradingSystem || {});
  } catch (error) {
    console.error("Error calculating grade:", error);
    // Fallback to default
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
  }
}

/**
 * Get subject stats for a child (or all children if studentId not provided)
 * GET /parents/dashboard/subject-stats?studentId=xxx&examType=all
 */
export const getSubjectStats = async (
  parentId: string,
  tenantId: string,
  studentId?: string,
  examType?: "Official" | "Practice" | "Exam Repository" | "all"
): Promise<
  | GetSubjectStatsResponse
  | {
    success: boolean;
    message: string;
    data: Array<{
      studentId: string;
      studentName: string;
      stats: GetSubjectStatsResponse["data"];
    }>;
  }
> => {
  try {
    // If studentId is provided, validate parent-child relationship and return that student's stats
    if (studentId) {
      // Verify parent-child relationship
      const relationship =
        await parentChildRepository.findParentChildRelationship(
          parentId,
          studentId
        );

      if (!relationship) {
        throw new Error("Parent-child relationship not found or inactive");
      }

      // Get subject stats for the specific student
      const result = await studentExamsService.getSubjectStats(
        studentId,
        tenantId,
        examType || "all"
      );

      return result;
    }

    // If studentId is not provided, get stats for all children
    const relationships = await parentChildRepository.findChildrenByParentId(
      parentId
    );

    if (!relationships || relationships.length === 0) {
      return {
        success: true,
        message: "Subject stats retrieved successfully",
        data: [],
      };
    }

    // Get stats for each child
    const childrenStats = await Promise.all(
      relationships.map(async (rel: any) => {
        const child = rel.childId;
        const childId = child._id?.toString() || child.toString();
        const childName =
          child.firstName && child.lastName
            ? `${child.firstName} ${child.lastName}`
            : child.email || "Unknown";

        try {
          const stats = await studentExamsService.getSubjectStats(
            childId,
            tenantId,
            examType || "all"
          );

          return {
            studentId: childId,
            studentName: childName,
            stats: stats.data,
          };
        } catch (error: any) {
          console.error(`Error getting stats for child ${childId}:`, error);
          return {
            studentId: childId,
            studentName: childName,
            stats: [],
          };
        }
      })
    );

    return {
      success: true,
      message: "Subject stats retrieved successfully for all children",
      data: childrenStats,
    };
  } catch (error: any) {
    console.error("Get subject stats service error:", error);
    throw error;
  }
};

/**
 * Get recent graded results for a child (last 3 results)
 * Used in Parent Reports View to display recent exam results
 */
export const getChildRecentResults = async (
  parentId: string,
  childId: string,
  tenantId: string
): Promise<{
  success: boolean;
  message: string;
  data: Array<{
    examId: string;
    examTitle: string;
    examType: "Official" | "Practice" | "Exam Repository";
    subjectId: string;
    subjectName: string;
    percentage: number;
    grade?: string;
    isFirstTime: boolean;
    completedAt: Date;
  }>;
}> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        parentId,
        childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Reuse the student exams service to get recent results
    const result = await studentExamsService.getRecentResults(childId);

    return {
      success: true,
      message: "Recent results retrieved successfully",
      data: result.data || [],
    };
  } catch (error: any) {
    console.error("Get child recent results service error:", error);
    throw error;
  }
};

/**
 * Get reports count by year for a child
 * Returns total reports and available years for filtering
 */
export const getReportsByYear = async (
  parentId: string,
  childId: string,
  tenantId: string,
  year?: number
): Promise<{
  success: boolean;
  message: string;
  data: {
    totalReports: number;
    selectedYear: string;
    availableYears: Array<{ value: string; label: string }>;
  };
}> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        parentId,
        childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get all exam attempts for the child
    const allAttempts = await examAttemptRepository.getStudentExamAttempts(
      childId
    );

    // Filter by tenantId and only graded attempts
    const gradedAttempts = allAttempts.filter(
      (a) => a.tenantId?.toString() === tenantId && a.attemptStatus === "Graded"
    );

    // Extract unique years from attempts
    const yearsSet = new Set<number>();
    gradedAttempts.forEach((attempt) => {
      const attemptDate = attempt.submittedAt || attempt.createdAt;
      if (attemptDate) {
        yearsSet.add(new Date(attemptDate).getFullYear());
      }
    });

    // Sort years in descending order
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    // Build available years options with "All" as first option
    const availableYears: Array<{ value: string; label: string }> = [
      { value: "all", label: "All" },
      ...sortedYears.map((y) => ({
        value: y.toString(),
        label: `Since Year ${y}`,
      })),
    ];

    // Calculate total reports based on year filter
    let filteredAttempts = gradedAttempts;
    let selectedYear = "all";

    if (year) {
      filteredAttempts = gradedAttempts.filter((attempt) => {
        const attemptDate = attempt.submittedAt || attempt.createdAt;
        if (attemptDate) {
          return new Date(attemptDate).getFullYear() === year;
        }
        return false;
      });
      selectedYear = year.toString();
    }

    return {
      success: true,
      message: "Reports by year retrieved successfully",
      data: {
        totalReports: filteredAttempts.length,
        selectedYear,
        availableYears,
      },
    };
  } catch (error: any) {
    console.error("Get reports by year service error:", error);
    throw error;
  }
};

/**
 * Get teachers for a child
 * Returns list of teacher names who have taught/examined the child
 */
export const getChildTeachers = async (
  parentId: string,
  childId: string,
  tenantId: string
): Promise<string[]> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        parentId,
        childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get all exam attempts for the child
    const allAttempts = await examAttemptRepository.getStudentExamAttempts(
      childId
    );

    // Filter by tenantId and only graded attempts
    const gradedAttempts = allAttempts.filter(
      (a) => a.tenantId?.toString() === tenantId && a.attemptStatus === "Graded"
    );

    // Get unique teachers from exams
    const teachersSet = new Set<string>();

    await Promise.all(
      gradedAttempts.map(async (attempt) => {
        try {
          const exam = await examRepository.findExamById(
            attempt.examId.toString()
          );
          if (exam && exam.teacherId) {
            let teacherId = "";
            if (typeof exam.teacherId === "object" && exam.teacherId !== null) {
              teacherId =
                (exam.teacherId as any)._id?.toString() ||
                (exam.teacherId as any).toString();
            } else {
              teacherId = String(exam.teacherId);
            }

            if (mongoose.Types.ObjectId.isValid(teacherId)) {
              const teacher = await teacherRepository.findTeacherById(
                teacherId
              );
              if (teacher) {
                const teacherName =
                  `${teacher.firstName} ${teacher.lastName}`.trim();
                teachersSet.add(teacherName);
              }
            }
          }
        } catch (error) {
          console.error(
            `Error getting teacher for exam ${attempt.examId}:`,
            error
          );
        }
      })
    );

    // If no teachers found, add a fallback
    if (teachersSet.size === 0) {
      teachersSet.add("System Generated");
    }

    return Array.from(teachersSet);
  } catch (error: any) {
    console.error("Get child teachers service error:", error);
    throw error;
  }
};

/**
 * Get subjects for a child
 * Returns list of subject names the child has been examined on
 */
export const getChildSubjects = async (
  parentId: string,
  childId: string,
  tenantId: string
): Promise<string[]> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        parentId,
        childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get all exam attempts for the child
    const allAttempts = await examAttemptRepository.getStudentExamAttempts(
      childId
    );

    // Filter by tenantId and only graded attempts
    const gradedAttempts = allAttempts.filter(
      (a) => a.tenantId?.toString() === tenantId && a.attemptStatus === "Graded"
    );

    // Get unique subjects from exams
    const subjectsSet = new Set<string>();

    await Promise.all(
      gradedAttempts.map(async (attempt) => {
        try {
          const exam = await examRepository.findExamById(
            attempt.examId.toString()
          );
          if (exam && exam.subjectId) {
            // Handle subjectId - it might be populated (object) or ObjectId
            let subjectName = "";

            if (typeof exam.subjectId === "object" && exam.subjectId !== null) {
              if ("name" in exam.subjectId) {
                subjectName = (exam.subjectId as any).name || "";
              } else if ("_id" in exam.subjectId) {
                // Try to get name from populated object
                subjectName = (exam.subjectId as any).name || "";
              }
            }

            // If we don't have subject name yet, try to fetch it
            if (!subjectName) {
              let subjectIdStr = "";
              if (
                typeof exam.subjectId === "object" &&
                exam.subjectId !== null
              ) {
                if ("_id" in exam.subjectId) {
                  subjectIdStr = (exam.subjectId as any)._id?.toString() || "";
                } else if ("toString" in exam.subjectId) {
                  subjectIdStr = (exam.subjectId as any).toString();
                }
              } else if (typeof exam.subjectId === "string") {
                subjectIdStr = exam.subjectId;
              }

              if (
                subjectIdStr &&
                mongoose.Types.ObjectId.isValid(subjectIdStr)
              ) {
                try {
                  const subject = await subjectRepository.findById(
                    subjectIdStr,
                    tenantId
                  );
                  if (subject) {
                    subjectName = (subject as any).name || "";
                  }
                } catch (error) {
                  console.error(
                    `Error fetching subject ${subjectIdStr}:`,
                    error
                  );
                }
              }
            }

            if (subjectName) {
              subjectsSet.add(subjectName);
            }
          }
        } catch (error) {
          console.error(
            `Error getting subject for exam ${attempt.examId}:`,
            error
          );
        }
      })
    );

    return Array.from(subjectsSet);
  } catch (error: any) {
    console.error("Get child subjects service error:", error);
    throw error;
  }
};

/**
 * Get leaderboard data for a specific child
 * Calculates ranking based on average performance across all graded exams
 */
export const getChildLeaderboard = async (
  parentId: string,
  childId: string,
  tenantId: string,
  rankType: "class" | "grade" | "school"
): Promise<{
  currentRank: number;
  previousRank: number;
  totalStudents: number;
  rankHistory: Array<{
    date: string;
    rank: number;
    average: number;
    totalStudents: number;
  }>;
}> => {
  try {
    // Verify parent-child relationship
    const relationship =
      await parentChildRepository.findParentChildRelationship(
        parentId,
        childId
      );

    if (!relationship) {
      throw new Error("Parent-child relationship not found or inactive");
    }

    // Get student details to get classId
    const student = await studentRepository.findStudentById(childId);
    if (!student) {
      throw new Error("Student not found");
    }

    const studentClassId = student.classId?.toString();

    // Get all graded exam attempts for the child in the last 7 months
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);

    const childAttempts = await examAttemptRepository.getStudentExamAttempts(
      childId
    );

    const gradedAttempts = childAttempts.filter(
      (a) =>
        a.tenantId?.toString() === tenantId &&
        a.attemptStatus === "Graded" &&
        a.percentage !== undefined &&
        a.submittedAt &&
        new Date(a.submittedAt) >= sevenMonthsAgo
    );

    if (gradedAttempts.length === 0) {
      // No data available
      return {
        currentRank: 0,
        previousRank: 0,
        totalStudents: 0,
        rankHistory: [],
      };
    }

    // Group attempts by month
    const attemptsByMonth = new Map<
      string,
      Array<{ percentage: number; date: Date }>
    >();

    gradedAttempts.forEach((attempt) => {
      if (attempt.submittedAt && attempt.percentage !== undefined) {
        const date = new Date(attempt.submittedAt);
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!attemptsByMonth.has(monthKey)) {
          attemptsByMonth.set(monthKey, []);
        }

        attemptsByMonth.get(monthKey)!.push({
          percentage: attempt.percentage,
          date: date,
        });
      }
    });

    // Calculate monthly averages for the child
    const childMonthlyAverages = new Map<
      string,
      { average: number; date: Date }
    >();

    attemptsByMonth.forEach((attempts, monthKey) => {
      const totalPercentage = attempts.reduce(
        (sum, a) => sum + a.percentage,
        0
      );
      const average = totalPercentage / attempts.length;
      const mostRecentDate = attempts.reduce(
        (latest, curr) => (curr.date > latest ? curr.date : latest),
        attempts[0].date
      );

      childMonthlyAverages.set(monthKey, { average, date: mostRecentDate });
    });

    // Calculate current average (last month with data)
    const sortedMonths = Array.from(childMonthlyAverages.keys()).sort();
    const currentMonth = sortedMonths[sortedMonths.length - 1];
    const currentAverage = childMonthlyAverages.get(currentMonth)?.average || 0;

    // Calculate previous average (2 months ago)
    const twoMonthsAgoDate = new Date();
    twoMonthsAgoDate.setMonth(twoMonthsAgoDate.getMonth() - 2);
    const twoMonthsAgoKey = `${twoMonthsAgoDate.getFullYear()}-${String(
      twoMonthsAgoDate.getMonth() + 1
    ).padStart(2, "0")}`;
    const previousAverage =
      childMonthlyAverages.get(twoMonthsAgoKey)?.average || currentAverage;

    // Get all students based on rank type
    let allStudents: any[] = [];

    if (rankType === "class" && studentClassId) {
      // Get all students in the same class
      allStudents = await studentRepository.findStudentsByClass(
        studentClassId,
        tenantId
      );
    } else if (rankType === "grade") {
      // Get all students in the same grade
      const studentsResult = await studentRepository.findStudents({
        tenantId,
        filters: {
          currentGrade: student.currentGrade,
          status: "active",
        },
      });
      allStudents = studentsResult;
    } else if (rankType === "school") {
      // Get all students in the school (tenant)
      allStudents = await studentRepository.findStudents({
        tenantId,
        filters: {
          status: "active",
        },
      });
    }

    // Calculate rankings for each month
    const rankHistory: Array<{
      date: string;
      rank: number;
      average: number;
      totalStudents: number;
    }> = [];

    for (const [monthKey, childData] of Array.from(
      childMonthlyAverages.entries()
    ).sort((a, b) => a[0].localeCompare(b[0]))) {
      // Calculate average for all students in this month
      const studentAverages: Array<{ studentId: string; average: number }> = [];

      await Promise.all(
        allStudents.map(async (s: any) => {
          const studentId = s._id?.toString() || s.id?.toString();
          if (!studentId) return;

          const studentAttempts =
            await examAttemptRepository.getStudentExamAttempts(studentId);

          const studentMonthAttempts = studentAttempts.filter((a) => {
            if (
              a.tenantId?.toString() !== tenantId ||
              a.attemptStatus !== "Graded" ||
              a.percentage === undefined ||
              !a.submittedAt
            ) {
              return false;
            }

            const attemptDate = new Date(a.submittedAt);
            const attemptMonthKey = `${attemptDate.getFullYear()}-${String(
              attemptDate.getMonth() + 1
            ).padStart(2, "0")}`;
            return attemptMonthKey === monthKey;
          });

          if (studentMonthAttempts.length > 0) {
            const total = studentMonthAttempts.reduce(
              (sum, a) => sum + (a.percentage || 0),
              0
            );
            const avg = total / studentMonthAttempts.length;
            studentAverages.push({ studentId, average: avg });
          }
        })
      );

      // Sort by average (descending) and calculate rank
      studentAverages.sort((a, b) => b.average - a.average);

      const childRank =
        studentAverages.findIndex((s) => s.studentId === childId) + 1;

      if (childRank > 0) {
        rankHistory.push({
          date: childData.date.toISOString(),
          rank: childRank,
          average: parseFloat(childData.average.toFixed(1)),
          totalStudents: studentAverages.length,
        });
      }
    }

    // Calculate current and previous ranks
    let currentRank = 0;
    let previousRank = 0;
    let totalStudents = allStudents.length;

    if (rankHistory.length > 0) {
      currentRank = rankHistory[rankHistory.length - 1].rank;
      totalStudents = rankHistory[rankHistory.length - 1].totalStudents;

      // Find rank from ~2 months ago
      if (rankHistory.length >= 2) {
        const previousIndex = Math.max(0, rankHistory.length - 3); // ~2 months ago
        previousRank = rankHistory[previousIndex].rank;
      } else {
        previousRank = currentRank;
      }
    }

    return {
      currentRank,
      previousRank,
      totalStudents,
      rankHistory,
    };
  } catch (error: any) {
    console.error("Get child leaderboard service error:", error);
    throw error;
  }
};

/**
 * Get combined activities of all parent's children
 */
export const getChildrenActivities = async (
  params: GetChildrenActivitiesRequest
): Promise<ChildrenActivitiesResponse> => {
  try {
    const {
      parentId,
      activityType,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = params;

    // Get all children for this parent
    const relationships = await parentChildRepository.findChildrenByParentId(
      parentId
    );

    if (!relationships || relationships.length === 0) {
      return {
        activities: [],
        pagination: {
          total: 0,
          limit,
          currentPage: page,
          totalPages: 0,
          hasMore: false,
        },
      };
    }

    // Build child info map for enrichment
    const childInfoMap = new Map<
      string,
      { name: string; photo: string }
    >();
    const childIds: mongoose.Types.ObjectId[] = [];

    for (const rel of relationships) {
      const child = rel.childId as any;
      if (child && child._id) {
        // If specific childId requested, only include that child
        if (params.childId && child._id.toString() !== params.childId) {
          continue;
        }

        const childId = child._id.toString();
        childIds.push(new mongoose.Types.ObjectId(childId));
        childInfoMap.set(childId, {
          name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
          photo: child.profileImage || "",
        });
      }
    }

    // Build query for activities
    const query: any = {
      studentId: { $in: childIds },
    };

    // Map tab to activity types
    if (params.tab && params.tab !== 'all') {
      switch (params.tab) {
        case 'examScores':
          query.activityType = { $in: ['ExamCompleted', 'PracticeCompleted'] };
          break;
        case 'achievement':
          query.activityType = { $in: ['BadgeEarned', 'CertificateEarned'] };
          break;
        case 'officialExams':
          query.activityType = 'ExamCompleted';
          break;
        case 'practiceExams':
          query.activityType = 'PracticeCompleted';
          break;
        default:
          // Fallback to single activityType if provided
          if (activityType) {
            query.activityType = activityType;
          }
      }
    } else if (activityType) {
      query.activityType = activityType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // standard fetch: get activities for current page only
    const skip = (page - 1) * limit;

    // Aggregation pipeline for correct pagination with filtering
    const pipeline: any[] = [
      { $match: query },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $lookup: {
          from: "exam_attempts",
          let: { relatedId: "$relatedEntityId", type: "$activityType", studentId: "$studentId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$$type", "ExamCompleted"] },
                        { $eq: ["$$type", "PracticeCompleted"] }
                      ]
                    },
                    {
                      $or: [
                        { $eq: ["$_id", "$$relatedId"] },
                        {
                          $and: [
                            { $eq: ["$examId", "$$relatedId"] },
                            { $eq: ["$studentId", "$$studentId"] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: "exams",
                localField: "examId",
                foreignField: "_id",
                as: "examInfo"
              }
            },
            {
              $project: {
                result: 1,
                examType: { $arrayElemAt: ["$examInfo.examType", 0] }
              }
            }
          ],
          as: "attemptInfo"
        }
      },
      // Filter out activities based on tab requirements (examType and result status)
      {
        $match: {
          $and: [
            // Filter out Pending exams
            {
              $expr: {
                $not: {
                  $and: [
                    { $or: [{ $eq: ["$activityType", "ExamCompleted"] }, { $eq: ["$activityType", "PracticeCompleted"] }] },
                    { $gt: [{ $size: "$attemptInfo" }, 0] },
                    { $eq: [{ $arrayElemAt: ["$attemptInfo.result", 0] }, "Pending"] }
                  ]
                }
              }
            },
            // Filter by examType if tab is officialExams or practiceExams
            {
              $expr: {
                $cond: {
                  if: { $eq: [params.tab, "officialExams"] },
                  then: {
                    $and: [
                      { $gt: [{ $size: "$attemptInfo" }, 0] },
                      { $eq: [{ $arrayElemAt: ["$attemptInfo.examType", 0] }, "Official"] }
                    ]
                  },
                  else: {
                    $cond: {
                      if: { $eq: [params.tab, "practiceExams"] },
                      then: {
                        $and: [
                          { $gt: [{ $size: "$attemptInfo" }, 0] },
                          { $eq: [{ $arrayElemAt: ["$attemptInfo.examType", 0] }, "Practice"] }
                        ]
                      },
                      else: true
                    }
                  }
                }
              }
            }
          ]
        }
      }
    ];

    // Use facets to get total count and paginated data in one go
    const resultPipeline = [
      ...pipeline,
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const results = await StudentActivityLog.aggregate(resultPipeline);
    const total = results[0]?.metadata[0]?.total || 0;
    const activities = results[0]?.data || [];

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    // Transform activities with child info and fetch related details
    const transformedActivities: ChildActivityItem[] = await Promise.all(
      activities.map(async (activity: any) => {
        const childId = activity.studentId.toString();
        const childInfo = childInfoMap.get(childId) || {
          name: "Unknown",
          photo: "",
        };

        let enrichedData: any = {};

        try {
          // Enrich based on activity type
          if (
            (activity.activityType === "ExamCompleted" ||
              activity.activityType === "PracticeCompleted") &&
            activity.relatedEntityId
          ) {

            let attempt = await ExamAttempt.findById(activity.relatedEntityId)
              .lean()
              .populate("subjectId")
              .populate({
                path: "examId",
                select: "examType examModeId",
                populate: { path: "examModeId", select: "name" }
              });

            // If not found, maybe relatedEntityId is ExamId, so search for attempt by examId + studentId
            if (!attempt) {
              const attempts = await ExamAttempt.find({
                examId: activity.relatedEntityId,
                studentId: activity.studentId
              })
                .sort({ createdAt: -1 })
                .populate("subjectId")
                .populate({
                  path: "examId",
                  select: "examType examTitle examModeId",
                  populate: { path: "examModeId", select: "name" }
                })
                .limit(1)
                .lean();

              if (attempts && attempts.length > 0) {
                attempt = attempts[0];
              }
            }

            if (attempt) {
              // Get total students in class for ranking context
              let totalStudentsInClass = 0;
              if (attempt.classId) {
                try {
                  totalStudentsInClass = await Student.countDocuments({
                    classId: attempt.classId,
                    isDeleted: false,
                    status: "active",
                  });
                } catch (e) {
                  console.error("Error counting students:", e);
                }
              }

              // Calculate rank if missing
              let classRank = attempt.classRank;
              if (!classRank && attempt.classId && attempt.examId && attempt.percentage !== undefined) {
                try {
                  // Ensure examId is an ObjectId for the query if it's populated
                  const examIdQuery = attempt.examId && (attempt.examId as any)._id ? (attempt.examId as any)._id : attempt.examId;

                  const betterScoresCount = await ExamAttempt.countDocuments({
                    examId: examIdQuery,
                    classId: attempt.classId,
                    percentage: { $gt: attempt.percentage },
                    isDeleted: false,
                    attemptStatus: "Graded" // Only compare against graded attempts
                  });
                  classRank = betterScoresCount + 1;
                } catch (e) {
                  console.error("Error calculating rank:", e);
                }
              }

              enrichedData = {
                obtainedMarks: attempt.obtainedMarks,
                percentage: attempt.percentage,
                grade: attempt.grade,
                studentClassRank: classRank,
                totalStudentsInClass,
                rankLabel: totalStudentsInClass ? `${classRank}/${totalStudentsInClass}` : undefined,
                result: attempt.result,
                totalMarks: attempt.totalMarks,
                subjectId:
                  attempt.subjectId && (attempt.subjectId as any)._id
                    ? (attempt.subjectId as any)._id.toString()
                    : attempt.subjectId
                      ? attempt.subjectId.toString()
                      : undefined,
                subjectName:
                  attempt.subjectId && (attempt.subjectId as any).name
                    ? (attempt.subjectId as any).name
                    : undefined,
                examType: attempt.examId ? (attempt.examId as any).examType : undefined,
                examTitle: attempt.examId ? (attempt.examId as any).examTitle : undefined,
                examModeName: attempt.examId && (attempt.examId as any).examModeId ? (attempt.examId as any).examModeId.name : undefined,
              };

            }
          } else if (
            activity.activityType === "BadgeEarned" &&
            activity.relatedEntityId
          ) {
            // Fetch Badge
            const badge = await ExamBadge.findById(activity.relatedEntityId).lean();
            if (badge) {
              enrichedData = {
                badgeName: badge.badgeName,
                badgeType: badge.badgeType,
                tier: badge.tier,
                icon: badge.icon,
                description: badge.description
              };
            }
          } else if (
            activity.activityType === "CertificateEarned" &&
            activity.relatedEntityId
          ) {
            // Fetch Certificate
            const credential = await ExamCredential.findById(activity.relatedEntityId).lean();
            if (credential) {
              enrichedData = {
                credentialName: credential.credentialName,
                credentialType: credential.credentialType,
                issuedDate: credential.issuedDate,
                verificationCode: credential.verificationCode
              };
            }
          }
        } catch (err) {
          console.error(`Error enriching activity ${activity._id}:`, err);
          // Continue without enrichment
        }

        return {
          activityId: activity._id.toString(),
          childId,
          childName: childInfo.name,
          childPhoto: childInfo.photo,
          activityType: activity.activityType,
          activityDescription: activity.activityDescription,
          relatedEntityId: activity.relatedEntityId?.toString() || "",
          relatedEntityType: activity.relatedEntityType || "",
          title: activity.title,
          score: activity.score,
          duration: activity.duration,
          createdAt: activity.createdAt,
          ...enrichedData
        };
      })
    );

    return {
      activities: transformedActivities.filter(a => a !== null) as ChildActivityItem[],
      pagination: {
        total,
        limit,
        currentPage: page,
        totalPages,
        hasMore,
      },
    };
  } catch (error: any) {
    console.error("Get children activities error:", error);
    throw error;
  }
};

/**
 * Get aggregated credit statistics for all children of a parent
 * Returns total credits, free credits per child, and total credits used across all children
 */
export const getChildrenCreditsStats = async (
  parentId: string,
  tenantId: string
): Promise<{
  totalCredits: number;
  freeCredits: number;
  totalCreditsUsed: number;
}> => {
  try {
    // Get all children for this parent
    const relationships = await parentChildRepository.findChildrenByParentId(
      parentId
    );

    // Extract student IDs from relationships
    const studentIds = relationships
      .map((rel: any) => {
        const child = rel.childId;
        return child?._id?.toString() || null;
      })
      .filter((id: string | null) => id !== null) as string[];

    // If no children found, return default values
    if (!studentIds || studentIds.length === 0) {
      return {
        totalCredits: 0,
        freeCredits: FREE_CREDITS_PER_CHILD,
        totalCreditsUsed: 0,
      };
    }

    // Get all wallets for these students from Monetization-API
    const wallets = await monetizationApiIntegration.getStudentWalletsBatch(
      studentIds,
      tenantId
    );

    // Aggregate statistics across all children
    let totalCredits = 0;
    let totalCreditsUsed = 0;

    wallets.forEach((wallet) => {
      totalCredits += wallet.totalCreditsPurchased || 0;
      totalCreditsUsed += wallet.totalCreditsUsed || 0;
    });

    // Return free credits per child (not total free credits)
    // This represents the free credits allocated to each child when they are created
    return {
      totalCredits,
      freeCredits: FREE_CREDITS_PER_CHILD,
      totalCreditsUsed,
    };
  } catch (error: any) {
    console.error("Get children credits stats error:", error);
    throw new Error(`Failed to get children credits statistics: ${error.message}`);
  }
};

/**
 * Get all credit transactions for all children of a parent
 * Returns transaction history with pagination and student details
 */
export const getChildrenTransactions = async (
  parentId: string,
  tenantId: string,
  pageNo: number = 1,
  pageSize: number = 50,
  studentId?: string
): Promise<{
  success: boolean;
  message: string;
  total: number;
  pageNo: number;
  pageSize: number;
  totalPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  items: any[];
}> => {
  try {
    // Get all transactions for this parent from Monetization-API
    const result = await monetizationApiIntegration.getTransactionsByParentId(
      parentId,
      tenantId,
      pageNo,
      pageSize,
      studentId
    );

    // Get unique student IDs from transactions
    const studentIds = [...new Set(result.transactions.map((t: any) => t.studentId))];

    // Fetch student details in batch
    const studentMap = new Map<string, any>();
    if (studentIds.length > 0) {
      try {
        const students = await Promise.all(
          studentIds.map(async (sid) => {
            try {
              const student = await studentRepository.findStudentById(sid);
              if (student) {
                return {
                  studentId: sid,
                  student: {
                    id: student._id.toString(),
                    firstName: student.firstName,
                    lastName: student.lastName,
                    email: student.email,
                    rollNumber: student.rollNumber,
                    studentId: student.studentId,
                    profileImage: student.profileImage || "",
                  },
                };
              }
              return null;
            } catch (error) {
              console.error(`Error fetching student ${sid}:`, error);
              return null;
            }
          })
        );

        students.forEach((item) => {
          if (item) {
            studentMap.set(item.studentId, item.student);
          }
        });
      } catch (error) {
        console.error("Error fetching student details:", error);
        // Continue without student details if fetch fails
      }
    }

    // Enrich transactions with student details
    const enrichedTransactions = result.transactions.map((transaction: any) => {
      const student = studentMap.get(transaction.studentId);
      return {
        ...transaction,
        student: student || null,
      };
    });

    const total = result.pagination.total;
    const totalPage = result.pagination.totalPages;

    return {
      success: true,
      message: "Children transactions retrieved successfully",
      total,
      pageNo,
      pageSize,
      totalPage,
      hasNext: pageNo < totalPage,
      hasPrev: pageNo > 1,
      items: enrichedTransactions,
    };
  } catch (error: any) {
    console.error("Get children transactions error:", error);
    throw new Error(`Failed to get children transactions: ${error.message}`);
  }
};

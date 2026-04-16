import * as examRepository from "../repositories/exam.repository";
import * as examStudentRepository from "../repositories/examStudent.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as studentRepository from "../repositories/student.repository";
import * as examCredentialRepository from "../repositories/examCredential.repository";
import * as studentExamsRepository from "../repositories/studentExams.repository";
import * as studentCredentialsService from "./studentCredentials.service";
import {
  StudentDashboardResponse,
  UpcomingExam,
  RecentResult,
  DashboardStatistics,
  DashboardNotification,
  GetUpcomingExamsRequest,
  GetUpcomingExamsResponse,
  GetTopStudentsResponse,
  TopStudentItem
} from "@/types/studentDashboard.types";

/**
 * Student Dashboard Service - Business logic for student dashboard
 */

// Get dashboard overview
export const getDashboardOverview = async (
  studentId: string,
  tenantId: string
): Promise<StudentDashboardResponse> => {
  try {
    // Get all assigned exams
    const assignedExams = await examStudentRepository.findExamsByStudent(studentId);

    // Get upcoming exams (scheduled and not yet taken)
    const upcomingExams: UpcomingExam[] = [];
    const now = new Date();

    for (const assignment of assignedExams.slice(0, 5)) {
      const exam = await examRepository.findExamById(assignment.examId.toString());
      if (exam && exam.startOn && exam.startOn > now) {
        // Check attempts
        const allAttempts = await examAttemptRepository.findAttemptsByExamId(assignment.examId.toString());
        const attempts = allAttempts.filter(a => a.studentId.toString() === studentId);
        const attemptNumber = attempts.length + 1;
        const attemptsLeft = exam.maxAttempts - attempts.length;

        upcomingExams.push({
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          examType: exam.examType,
          subjectName: `Subject ${exam.subjectId.toString().slice(-6)}`, // TODO: Fetch from subject API
          scheduledStartDate: exam.startOn,
          scheduledEndDate: exam.endOn,
          durationInMinutes: exam.durationInMinutes,
          totalMarks: exam.totalMarks,
          attemptNumber: attemptNumber,
          attemptsLeft: attemptsLeft,
          isAssigned: true
        });
      }
    }

    // Get recent results (last 5 graded attempts)
    const allAttempts = await examAttemptRepository.getStudentAttemptHistory(studentId, '');
    const gradedAttempts = allAttempts.filter(a => a.attemptStatus === 'Graded').slice(0, 5);

    const recentResults: RecentResult[] = await Promise.all(
      gradedAttempts.map(async (attempt) => {
        const exam = await examRepository.findExamById(attempt.examId.toString());
        return {
          examId: attempt.examId.toString(),
          examTitle: exam?.examTitle || 'Unknown Exam',
          examType: exam?.examType || 'Official',
          submittedAt: attempt.submittedAt || new Date(),
          obtainedMarks: attempt.obtainedMarks || 0,
          totalMarks: attempt.totalMarks || 0,
          percentage: attempt.percentage || 0,
          result: attempt.result || 'Pending',
          grade: attempt.grade || 'F',
          classRank: attempt.classRank || 0
        } as RecentResult;
      })
    );

    // Get statistics
    const stats = await examAttemptRepository.getStudentExamStatistics(studentId, tenantId);
    const statistics: DashboardStatistics = {
      totalExamsAssigned: assignedExams.length,
      totalExamsTaken: stats.totalExamsTaken,
      totalExamsPending: assignedExams.length - stats.totalExamsTaken,
      averagePercentage: stats.averagePercentage,
      totalPassed: stats.totalPassed,
      totalFailed: stats.totalFailed,
      passRate: stats.totalExamsTaken > 0 ? (stats.totalPassed / stats.totalExamsTaken) * 100 : 0,
      currentRank: 15, // TODO: Calculate actual rank
      totalStudents: 50 // TODO: Get from class
    };

    // Generate notifications
    const notifications: DashboardNotification[] = [];

    // Exam reminders for upcoming exams
    for (const exam of upcomingExams.slice(0, 3)) {
      const hoursUntil = (exam.scheduledStartDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil <= 24) {
        notifications.push({
          id: `reminder_${exam.examId}`,
          type: 'exam_reminder',
          title: 'Upcoming Exam',
          message: `${exam.examTitle} starts in ${Math.round(hoursUntil)} hours`,
          priority: 'high',
          isRead: false,
          createdAt: now,
          relatedExamId: exam.examId
        });
      }
    }

    return {
      upcomingExams,
      recentResults,
      statistics,
      notifications
    };
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    throw error;
  }
};

// Get upcoming exams
export const getUpcomingExams = async (
  params: GetUpcomingExamsRequest & { studentId: string; tenantId: string }
): Promise<GetUpcomingExamsResponse> => {
  try {
    // Get all assigned exams
    const assignedExams = await examStudentRepository.findExamsByStudent(params.studentId);

    const upcomingExams: UpcomingExam[] = [];
    const now = new Date();

    for (const assignment of assignedExams) {
      const exam = await examRepository.findExamById(assignment.examId.toString());

      // Filter conditions
      if (!exam) continue;
      if (params.subjectId && exam.subjectId.toString() !== params.subjectId) continue;
      if (params.examType && exam.examType !== params.examType) continue;
      if (!exam.startOn || exam.startOn <= now) continue;

      // Check attempts
      const allAttempts = await examAttemptRepository.findAttemptsByExamId(assignment.examId.toString());
      const attempts = allAttempts.filter(a => a.studentId.toString() === params.studentId);
      const attemptNumber = attempts.length + 1;
      const attemptsLeft = exam.maxAttempts - attempts.length;

      if (attemptsLeft > 0) {
        upcomingExams.push({
          examId: exam._id.toString(),
          examTitle: exam.examTitle,
          examType: exam.examType,
          subjectName: `Subject ${exam.subjectId.toString().slice(-6)}`,
          scheduledStartDate: exam.startOn,
          scheduledEndDate: exam.endOn,
          durationInMinutes: exam.durationInMinutes,
          totalMarks: exam.totalMarks,
          attemptNumber: attemptNumber,
          attemptsLeft: attemptsLeft,
          isAssigned: true
        });
      }
    }

    // Sort by scheduled start date
    upcomingExams.sort((a, b) =>
      a.scheduledStartDate.getTime() - b.scheduledStartDate.getTime()
    );

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedExams = upcomingExams.slice(startIndex, startIndex + pageSize);

    return {
      exams: paginatedExams,
      pagination: {
        total: upcomingExams.length,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(upcomingExams.length / pageSize)
      }
    };
  } catch (error) {
    console.error('Get upcoming exams error:', error);
    throw error;
  }
};

// Get dashboard statistics
export const getDashboardStatistics = async (
  studentId: string,
  tenantId: string
): Promise<DashboardStatistics> => {
  try {
    const assignedExams = await examStudentRepository.findExamsByStudent(studentId);
    const stats = await examAttemptRepository.getStudentExamStatistics(studentId, tenantId);

    return {
      totalExamsAssigned: assignedExams.length,
      totalExamsTaken: stats.totalExamsTaken,
      totalExamsPending: assignedExams.length - stats.totalExamsTaken,
      averagePercentage: stats.averagePercentage,
      totalPassed: stats.totalPassed,
      totalFailed: stats.totalFailed,
      passRate: stats.totalExamsTaken > 0 ? (stats.totalPassed / stats.totalExamsTaken) * 100 : 0,
      currentRank: 15, // TODO: Calculate actual rank
      totalStudents: 50 // TODO: Get from class
    };
  } catch (error) {
    console.error('Get dashboard statistics error:', error);
    throw error;
  }
};

// Get top students in the same class
export const getTopStudents = async (
  studentId: string,
  tenantId: string,
  subjectId?: string
): Promise<GetTopStudentsResponse> => {
  try {
    // Get student to find their classId
    const student = await studentRepository.findStudentById(studentId);

    if (!student) {
      throw new Error('Student not found');
    }

    if (!student.classId) {
      // Return empty list if student has no class
      return {
        students: []
      };
    }

    // Get top students for the student's class
    const studentsData = await studentRepository.getTopStudentsByClass(
      student.classId.toString(),
      tenantId,
      subjectId
    );

    // Format response with ranks
    const students: TopStudentItem[] = studentsData.map((studentData, index) => ({
      studentId: studentData.studentId,
      name: `${studentData.firstName} ${studentData.lastName}`,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      className: studentData.className,
      subjectName: studentData.subjectName,
      rank: index + 1, // Rank starts from 1
      overallScore: studentData.averagePercentage,
      totalStudentsInClass: studentsData.length,
    }));

    return {
      students
    };
  } catch (error) {
    console.error('Get top students error:', error);
    throw error;
  }
};

// Get student dashboard stats (simplified for widget)
export const getStudentDashboardStats = async (
  studentId: string,
  tenantId: string
) => {
  try {
    // 1. Get exam statistics (reuses Logic for Completed/Performed vs AutoGraded, Upcoming, etc.)
    // Note: getExamStatisticsForStudent handles logic to exclude "AutoGraded" from "Completed" 
    // and defines "Upcoming" consistently.
    const examStats = await studentExamsRepository.getExamStatisticsForStudent(studentId);

    // 2. Get credential statistics (reuses logic from student-credentials/statistics API)
    // This ensures filtering by active/promoted classes matches the credentials page.
    const credentialStats = await studentCredentialsService.getStudentCredentialsStatistics(studentId);

    return {
      totalExams: examStats.totalExams,
      completedExams: examStats.completedExams, // This is "performed" exams (TrueCompleted)
      upcomingExams: examStats.upcomingExams,
      totalCredentials: credentialStats.totalCredentials
    };
  } catch (error) {
    console.error('Get student dashboard stats error:', error);
    throw error;
  }
};



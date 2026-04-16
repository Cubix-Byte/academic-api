import mongoose from "mongoose";
import { ExamStudent, Exam } from "../models";
import { IExamStudent, IExam } from "../models";
import { SubjectRepository } from "./subject.repository";

/**
 * Student Exams Repository - Data access layer for student exam operations
 */

// Find exams assigned to a student
export const findExamsByStudent = async (
  studentId: string,
  filters: {
    examType?: string;
    examStatus?: string;
    timeFilter?: "upcoming" | "past" | "all";
    isActive?: boolean;
    subjectId?: string;
    classId?: string;
    /** Filter by ExamStudent status (e.g. "Completed" = student has attempted and submitted) */
    examStudentStatus?: "Pending" | "Started" | "Completed";
  } = {}
): Promise<IExamStudent[]> => {
  try {
    const query: any = {
      studentId,
      isActive: filters.isActive !== undefined ? filters.isActive : true,
    };

    // Filter by ExamStudent status (attempted/completed)
    if (filters.examStudentStatus) {
      query.status = filters.examStudentStatus;
    }

    // Add subjectId filter if provided
    if (filters.subjectId) {
      query.subjectId = mongoose.Types.ObjectId.isValid(filters.subjectId)
        ? new mongoose.Types.ObjectId(filters.subjectId)
        : filters.subjectId;
      console.log("Filtering exams for subjectId:", query.subjectId);
    }

    // Add classId filter if provided
    if (filters.classId) {
      query.classId = mongoose.Types.ObjectId.isValid(filters.classId)
        ? new mongoose.Types.ObjectId(filters.classId)
        : filters.classId;
      console.log("Filtering exams for classId:", query.classId);
    }

    const examStudents = await ExamStudent.find(query)
      .populate("examId")
      .populate("classId")
      .populate("subjectId")
      .populate("batchId")
      .sort({ createdAt: -1 });

    // Filter by exam properties
    let filteredExams = examStudents.filter((es) => {
      const exam = es.examId as any;
      if (!exam || exam.isDeleted) return false;

      // Show Published and Released exams to students
      if (exam.examStatus !== "Published" && exam.examStatus !== "Released")
        return false;

      if (filters.examType && exam.examType !== filters.examType) return false;
      if (filters.examStatus && exam.examStatus !== filters.examStatus)
        return false;

      // Time filtering
      if (filters.timeFilter) {
        const now = new Date();
        const examStartOn = new Date(exam.startOn);
        const examEndOn = new Date(exam.endOn);

        switch (filters.timeFilter) {
          case "upcoming":
            // Show exams that haven't ended yet (currently active or future exams)
            return examEndOn >= now;
          case "past":
            return examEndOn < now;
          case "all":
          default:
            return true;
        }
      }

      return true;
    });

    return filteredExams;
  } catch (error) {
    console.error("Find exams by student error:", error);
    throw error;
  }
};

// Find exam by ID for a specific student
export const findExamByIdForStudent = async (
  examId: string,
  studentId: string,
): Promise<IExamStudent | null> => {
  try {
    const examStudent = await ExamStudent.findOne({
      examId,
      studentId,
      isActive: true,
    })
      .populate("examId")
      .populate("classId")
      .populate("subjectId")
      .populate("batchId");

    if (!examStudent) return null;

    const exam = examStudent.examId as any;
    if (!exam || exam.isDeleted) return null;

    return examStudent;
  } catch (error) {
    console.error("Find exam by ID for student error:", error);
    throw error;
  }
};

// Count exams for a student
export const countExamsByStudent = async (
  studentId: string,
  filters: {
    examType?: string;
    examStatus?: string;
    timeFilter?: "upcoming" | "past" | "all";
    isActive?: boolean;
  } = {},
): Promise<number> => {
  try {
    const exams = await findExamsByStudent(studentId, filters);
    return exams.length;
  } catch (error) {
    console.error("Count exams by student error:", error);
    throw error;
  }
};

// Get exam statistics for a student
export const getExamStatisticsForStudent = async (
  studentId: string,
  examType?: "Official" | "Practice" | "Exam Repository",
) => {
  try {
    // Get all exams (unfiltered) for examTypes calculation - this should always show all types
    const allExams = await findExamsByStudent(studentId, {});

    // Get filtered exams if examType is provided
    const filteredExams = examType
      ? await findExamsByStudent(studentId, { examType })
      : allExams;

    const now = new Date();

    // Calculate individual counts - ensuring all exams are categorized
    // All exams must fit into one of these 4 categories:
    // 1. Completed: status === "Completed"
    // 2. In Progress: status === "Started" AND endOn >= now (same logic as /started endpoint)
    // 3. Upcoming: status === "Pending" && endOn >= now
    // 4. Past: endOn < now (includes expired "Started" exams and "Pending" exams that ended)
    console.log("Filtered exams:", filteredExams.length);

    // Debug: Count exams by status
    const statusBreakdown = {
      Completed: 0,
      Started: 0,
      Pending: 0,
    };
    filteredExams.forEach((es) => {
      if (es.status === "Completed") statusBreakdown.Completed++;
      else if (es.status === "Started") statusBreakdown.Started++;
      else if (es.status === "Pending") statusBreakdown.Pending++;
    });
    console.log("Status breakdown:", statusBreakdown);

    const completedExamsData = await Promise.all(
      filteredExams.map(async (es: any) => {
        if (es.status !== "Completed") return false;

        // Return true for all completed exams regardless of submission time
        return "TrueCompleted";
      }),
    );

    const completedExams = completedExamsData.filter(
      (status) => status === "TrueCompleted",
    ).length;
    // const autoGradedCount = completedExamsData.filter(status => status === "AutoGraded").length;

    const examAttemptRepository =
      await import("../repositories/examAttempt.repository");
    // const inProgressExams = await Promise.all(
    //   filteredExams.map(async (es) => {
    //     const exam = es.examId as any;
    //     if (!exam) return false;
    //     if (es.status !== "Started") return false;
    //     const examEndOn = new Date(exam.endOn);
    //     // Fetch latest attempt for this student/exam
    //     const attempts =
    //       await examAttemptRepository.findAttemptsByStudentAndExam(
    //         es.studentId.toString(),
    //         exam._id.toString()
    //       );
    //     const latestAttempt =
    //       attempts && attempts.length > 0 ? attempts[0] : null;
    //     let examEndTime: Date;
    //     if (
    //       latestAttempt &&
    //       latestAttempt.startedAt &&
    //       exam.durationInMinutes
    //     ) {
    //       examEndTime = new Date(
    //         new Date(latestAttempt.startedAt).getTime() +
    //           exam.durationInMinutes * 60000
    //       );
    //     } else {
    //       examEndTime = new Date(exam.endOn);
    //     }
    //     console.log(examEndTime, examEndOn);
    //     const actualEndTime = examEndTime < examEndOn ? examEndTime : examEndOn;
    //     return actualEndTime >= now;
    //   })
    // );
    // const inProgressExamsCount = inProgressExams.filter(Boolean).length;

    const upcomingExams = filteredExams.filter((es) => {
      const exam = es.examId as any;
      if (!exam) return false;
      if (es.status !== "Pending") return false;
      // Upcoming: exam has not started yet (future exams only)
      const examStartOn = new Date(exam.startOn);
      return examStartOn > now;
    }).length;

    const pastExamsFiltered = await Promise.all(
      filteredExams.map(async (es: any) => {
        const exam = es.examId;
        if (!exam) return false;

        // Check if "AutoGraded" completed exam from previous step logic
        if (es.status === "Completed") {
          return false; // Completed exams are NOT past exams
        }

        // Standard expired checks for Pending/Started
        const examEndOn = new Date(exam.endOn);
        return examEndOn < now;
      }),
    );

    // Filter valid true results
    const validPastExams = pastExamsFiltered.filter(Boolean);

    // Debug: Show breakdown of past exams by status
    const pastExamsBreakdown = {
      Started: 0,
      Pending: 0,
      Completed: 0,
    };
    filteredExams.forEach((es, index) => {
      if (pastExamsFiltered[index]) {
        if (es.status === "Started") pastExamsBreakdown.Started++;
        else if (es.status === "Pending") pastExamsBreakdown.Pending++;
        else if (es.status === "Completed") pastExamsBreakdown.Completed++;
      }
    });
    console.log("Past exams breakdown:", pastExamsBreakdown);
    console.log("Total past exams:", validPastExams.length);

    const pastExams = validPastExams.length;

    const openExams = filteredExams.filter((es) => {
      const exam = es.examId as any;
      if (!exam) return false;
      if (es.status !== "Pending") return false;
      // Upcoming: exam hasn't ended yet (includes future and currently active exams)
      const examEndOn = new Date(exam.endOn);
      const examStartOn = new Date(exam.startOn);
      return examEndOn >= now && examStartOn <= now;
    }).length;

    // Calculate examTypes from filteredExams to match totalExams
    const examTypes = {
      official: filteredExams.filter((es) => {
        const exam = es.examId as any;
        return exam && exam.examType === "Official";
      }).length,
      practice: filteredExams.filter((es) => {
        const exam = es.examId as any;
        return exam && exam.examType === "Practice";
      }).length,
      examRepository: filteredExams.filter((es) => {
        const exam = es.examId as any;
        return exam && exam.examType === "Exam Repository";
      }).length,
    };

    // Calculate total Official exams (completed + past + upcoming + open)
    const totalOfficialExams = filteredExams.filter((es) => {
      const exam = es.examId as any;
      if (!exam || exam.examType !== "Official") return false;

      // All exams for a student in "active" status in ExamStudent table should count
      // This includes Completed, Started, Pending
      return true;
    }).length;

    // Calculate totalExams as sum of all categories to ensure consistency
    const calculatedTotalExams =
      completedExams + pastExams + upcomingExams + openExams;

    const statistics = {
      totalExams: calculatedTotalExams,
      totalOfficialExams,
      upcomingExams,
      pastExams,
      completedExams,
      // inProgressExams: inProgressExamsCount,
      openExams,
      examTypes,
    };

    return statistics;
  } catch (error) {
    console.error("Get exam statistics for student error:", error);
    throw error;
  }
};

// Find all students for an exam
export const findStudentsByExamId = async (
  examId: string,
): Promise<IExamStudent[]> => {
  try {
    return await ExamStudent.find({
      examId,
      isActive: true,
    })
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });
  } catch (error) {
    console.error("Find students by exam ID error:", error);
    throw error;
  }
};

// Get recent exams for a student
export const getRecentExamsForStudent = async (
  studentId: string,
  limit: number = 5,
  examType?: "Official" | "Practice" | "Exam Repository",
): Promise<IExamStudent[]> => {
  try {
    // When filtering by examType, fetch more records to account for filtering
    // Otherwise we might get empty results if the first N don't match the type
    const fetchLimit = examType ? limit * 3 : limit;

    const recentExams = await ExamStudent.find({
      studentId,
      isActive: true,
    })
      .populate("examId")
      .populate("classId")
      .populate({
        path: "subjectId",
        select: "name",
      })
      .populate("batchId")
      .sort({ createdAt: -1 })
      .limit(fetchLimit);

    const filtered = recentExams.filter((es) => {
      const exam = es.examId as any;
      if (!exam || exam.isDeleted) return false;

      // Only show Published exams to students
      if (exam.examStatus !== "Published") return false;

      // Filter by examType if provided
      if (examType && exam.examType !== examType) return false;

      return true;
    });

    // Apply limit after filtering
    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Get recent exams for student error:", error);
    throw error;
  }
};

// Get upcoming exams for a student
export const getUpcomingExamsForStudent = async (
  studentId: string,
  limit: number = 5,
): Promise<IExamStudent[]> => {
  try {
    const upcomingExams = await findExamsByStudent(studentId, {
      timeFilter: "upcoming",
      examStatus: "Published",
    });

    return upcomingExams
      .sort((a, b) => {
        const examA = a.examId as any;
        const examB = b.examId as any;
        return examA.startOn.getTime() - examB.startOn.getTime();
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Get upcoming exams for student error:", error);
    throw error;
  }
};

// Get current class stats - completed exam counts by examType
export const getCurrentClassStats = async (
  studentId: string,
  classId: string,
): Promise<{
  totalCompletedExams: number;
  officialExamsCount: number;
  practiceExamsCount: number;
}> => {
  try {
    // Get all completed exams for the student filtered by classId
    const completedExams = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(classId),
      status: "Completed",
      isActive: true,
    })
      .populate("examId")
      .lean();

    // Filter out deleted exams and get distinct exam IDs
    const validExams = completedExams.filter((es) => {
      const exam = es.examId as any;
      return exam && !exam.isDeleted;
    });

    // Get distinct exam IDs
    const distinctExamIds = new Set(
      validExams.map((es) => {
        const exam = es.examId as any;
        return exam._id.toString();
      }),
    );

    // Count by examType
    let officialCount = 0;
    let practiceCount = 0;

    distinctExamIds.forEach((examId) => {
      const examStudent = validExams.find((es) => {
        const exam = es.examId as any;
        return exam._id.toString() === examId;
      });

      if (examStudent) {
        const exam = examStudent.examId as any;
        if (exam.examType === "Official") {
          officialCount++;
        } else if (exam.examType === "Practice") {
          practiceCount++;
        }
      }
    });

    return {
      totalCompletedExams: distinctExamIds.size,
      officialExamsCount: officialCount,
      practiceExamsCount: practiceCount,
    };
  } catch (error) {
    console.error("Get current class stats error:", error);
    throw error;
  }
};

// Get subject-wise stats - average percentage per subject
export const getSubjectStats = async (
  studentId: string,
  classIds: string | string[],
  tenantId: string,
  examType?: "Official" | "Practice" | "Exam Repository" | "all",
): Promise<
  Array<{
    subjectId: string;
    subjectName: string;
    averagePercentage: number;
    totalExams: number;
    completedExams: number;
  }>
> => {
  try {
    // Normalize classIds to array for backward compatibility
    const classIdsArray = Array.isArray(classIds) ? classIds : [classIds];
    const classIdObjs = classIdsArray.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    // Build query for completed exams
    const query: any = {
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: { $in: classIdObjs }, // Support multiple classes
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: "Completed",
      isActive: true,
    };

    // Get all completed exams for the student in this class
    const completedExams = await ExamStudent.find(query)
      .populate({
        path: "examId",
        select: "examTitle examType subjectId isDeleted examStatus",
        match: { isDeleted: false }, // Only populate non-deleted exams
        populate: {
          path: "subjectId",
          select: "name",
        },
      })
      .lean();

    // Filter out deleted exams, filter by examType if specified, and only include Released exams
    const validExams = completedExams.filter((es) => {
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

      return true;
    });

    // Group by subjectId and calculate averages
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

    // Helper function to normalize subjectId to string
    const normalizeSubjectId = (subjectId: any): string | null => {
      if (!subjectId) return null;
      if (typeof subjectId === "string") {
        return subjectId.trim();
      }
      if (subjectId._id) {
        return subjectId._id.toString();
      }
      if (subjectId.toString) {
        return subjectId.toString();
      }
      return String(subjectId);
    };

    // Get unique subject IDs and names from populated exams
    const subjectNameMap = new Map<string, string>();
    const subjectIds = new Set<string>();

    validExams.forEach((es) => {
      const exam = es.examId as any;
      const subject = exam?.subjectId;

      // Check if subjectId is populated (has name property) or just an ObjectId
      if (subject) {
        let subjectId: string;
        let subjectName: string | null = null;

        // If populated, subject will have _id and name
        if (subject._id) {
          subjectId = subject._id.toString();
          subjectName = subject.name || null;
        } else if (subject.name) {
          // Already populated with name
          subjectId = normalizeSubjectId(subject._id || subject) || "";
          subjectName = subject.name;
        } else {
          // Just ObjectId, need to normalize
          subjectId = normalizeSubjectId(subject) || "";
        }

        if (
          subjectId &&
          subjectId !== "null" &&
          subjectId !== "undefined" &&
          mongoose.Types.ObjectId.isValid(subjectId)
        ) {
          // Normalize to ObjectId string format for consistency
          try {
            const normalizedId = new mongoose.Types.ObjectId(
              subjectId,
            ).toString();
            subjectIds.add(normalizedId);

            // If we have the name from populate, use it
            if (subjectName) {
              subjectNameMap.set(normalizedId, subjectName);
            }
          } catch {
            subjectIds.add(subjectId);
            if (subjectName) {
              subjectNameMap.set(subjectId, subjectName);
            }
          }
        }
      }
    });

    console.log(
      `📚 Found ${subjectIds.size} unique subjects. Already have ${subjectNameMap.size} names from populate.`,
    );

    // Fetch subject names for any that weren't populated
    const subjectRepo = new SubjectRepository();
    const missingSubjectIds = Array.from(subjectIds).filter(
      (id) => !subjectNameMap.has(id),
    );

    if (missingSubjectIds.length > 0) {
      console.log(
        `📚 Fetching ${missingSubjectIds.length} missing subject names...`,
      );
      await Promise.all(
        missingSubjectIds.map(async (subjectId) => {
          try {
            const subject = await subjectRepo.findById(subjectId, tenantId);
            if (subject && subject.name) {
              console.log(`✅ Found subject: ${subjectId} -> ${subject.name}`);
              subjectNameMap.set(subjectId, subject.name);
            } else {
              console.warn(
                `⚠️ Subject not found: ${subjectId} for tenant: ${tenantId}`,
              );
              subjectNameMap.set(subjectId, "Unknown Subject");
            }
          } catch (error: any) {
            console.error(
              `❌ Error fetching subject ${subjectId}:`,
              error?.message || error,
            );
            subjectNameMap.set(subjectId, "Unknown Subject");
          }
        }),
      );
    }

    // Process valid exams and group by subject
    for (const es of validExams) {
      const exam = es.examId as any;
      const subject = exam?.subjectId;

      // Get subjectId from populated exam or ExamStudent and normalize
      let rawSubjectId: string | null = null;

      // Check if subjectId is populated (has _id or name property)
      if (subject) {
        if (subject._id) {
          rawSubjectId = subject._id.toString();
        } else if (typeof subject === "string" || subject.toString) {
          rawSubjectId = normalizeSubjectId(subject);
        } else {
          rawSubjectId = normalizeSubjectId(subject);
        }
      } else {
        // Fallback to ExamStudent's subjectId
        rawSubjectId = normalizeSubjectId(es.subjectId);
      }

      // Skip if no subjectId or no percentage
      if (
        !rawSubjectId ||
        rawSubjectId === "null" ||
        rawSubjectId === "undefined" ||
        es.percentage === null ||
        es.percentage === undefined
      ) {
        continue;
      }

      // Normalize subjectId to ObjectId string format for consistent matching
      let subjectId: string;
      try {
        if (mongoose.Types.ObjectId.isValid(rawSubjectId)) {
          subjectId = new mongoose.Types.ObjectId(rawSubjectId).toString();
        } else {
          subjectId = rawSubjectId;
        }
      } catch {
        subjectId = rawSubjectId;
      }

      // Get subject name from map (should be populated now)
      let subjectName: string | undefined = subjectNameMap.get(subjectId);

      // If still not found, try to get from populated subject
      if (!subjectName && subject) {
        const populatedName = (subject as any)?.name;
        if (populatedName && typeof populatedName === "string") {
          subjectName = populatedName;
          subjectNameMap.set(subjectId, subjectName);
          console.log(
            `✅ Got subject name from populate: ${subjectId} -> ${subjectName}`,
          );
        }
      }

      // Final fallback if still not found
      if (!subjectName) {
        console.warn(
          `⚠️ Subject name not found in map for subjectId: ${subjectId}`,
        );
        console.warn(
          `Available keys in map:`,
          Array.from(subjectNameMap.keys()),
        );
        console.warn(`Raw subjectId was: ${rawSubjectId}`);
        subjectName = "Unknown Subject";
      }

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName: subjectName || "Unknown Subject",
          percentages: [],
          totalExams: 0,
          completedExams: 0,
        });
      }

      const subjectData = subjectMap.get(subjectId)!;
      subjectData.percentages.push(es.percentage);
      subjectData.completedExams++;
    }

    // Calculate average percentage for each subject
    const result = Array.from(subjectMap.values()).map((subjectData) => {
      const averagePercentage =
        subjectData.percentages.length > 0
          ? subjectData.percentages.reduce((sum, p) => sum + p, 0) /
            subjectData.percentages.length
          : 0;

      return {
        subjectId: subjectData.subjectId,
        subjectName: subjectData.subjectName,
        averagePercentage: Math.round(averagePercentage * 100) / 100,
        totalExams: subjectData.completedExams,
        completedExams: subjectData.completedExams,
      };
    });

    return result;
  } catch (error: any) {
    console.error("Get subject stats repository error:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", {
      studentId,
      classIds,
      tenantId,
      examType,
      errorMessage: error?.message,
      errorName: error?.name,
    });
    throw error;
  }
};

// Get performed exams for a student (exams that have been started or completed)
export const getPerformedExamsForStudent = async (
  studentId: string,
  examType?: "Official" | "Practice" | "Exam Repository",
): Promise<any[]> => {
  try {
    const performedExams = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: { $in: ["Started", "Completed"] },
      isActive: true,
    })
      .populate({
        path: "examId",
        select:
          "examTitle examType subjectId isDeleted examStatus durationInMinutes teacherId releasedAt endOn",
        populate: {
          path: "subjectId",
          select: "name",
        },
      })
      .populate("classId")
      .populate("batchId")
      .sort({ updatedAt: -1 }) // Most recently attempted first
      .lean();

    // Filter out deleted exams and show Published/Released exams
    // Filter performed exams:
    // 1. Must be Completed or Started
    // 2. Must NOT be auto-graded (missed) exams (which are technically marked Completed but submitted AFTER end date)

    // We need to check attempts for each exam to filter out auto-graded ones
    const examAttemptRepository =
      await import("../repositories/examAttempt.repository");

    const validPerformedExams = await Promise.all(
      performedExams.map(async (es: any) => {
        const exam = es.examId;
        if (!exam || exam.isDeleted) return null;
        if (exam.examStatus !== "Published" && exam.examStatus !== "Released")
          return null;
        if (examType && exam.examType !== examType) return null;

        // Check if auto-graded (missed)
        if (es.status === "Completed") {
          const attempts =
            await examAttemptRepository.findAttemptsByStudentAndExam(
              studentId,
              exam._id.toString(),
            );
          if (attempts && attempts.length > 0) {
            const latestAttempt = attempts[0];
            // If submitted after end date, it's auto-graded/missed -> Exclude from Performed
            if (
              latestAttempt.submittedAt &&
              exam.endOn &&
              new Date(latestAttempt.submittedAt) > new Date(exam.endOn)
            ) {
              return null;
            }
          }
        }

        return es;
      }),
    );

    return validPerformedExams.filter((es) => es !== null);
  } catch (error) {
    console.error("Get performed exams for student error:", error);
    throw error;
  }
};

// Get started exams for a student (exams with status "Started" that haven't expired)
export const getStartedExamsForStudent = async (
  studentId: string,
  examType?: "Official" | "Practice" | "Exam Repository",
): Promise<any[]> => {
  try {
    const now = new Date();

    const startedExams = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "Started", // Only "Started" status
      isActive: true,
    })
      .populate({
        path: "examId",
        select:
          "examTitle examType subjectId isDeleted examStatus endOn totalMarks durationInMinutes",
        populate: {
          path: "subjectId",
          select: "name",
        },
      })
      .populate("classId")
      .populate("batchId")
      .sort({ updatedAt: -1 }) // Most recently started first
      .lean();

    // Filter out deleted exams, only show Published exams, and ensure time hasn't passed
    return startedExams.filter((es: any) => {
      const exam = es.examId;
      if (!exam || exam.isDeleted) return false;
      if (exam.examStatus !== "Published") return false;

      // Filter by examType if provided
      if (examType && exam.examType !== examType) return false;

      // Ensure exam time hasn't passed (endOn must be in the future)
      if (exam.endOn) {
        const examEndOn = new Date(exam.endOn);
        if (examEndOn < now) return false; // Time has passed, exclude this exam
      }

      return true;
    });
  } catch (error) {
    console.error("Get started exams for student error:", error);
    throw error;
  }
};

// Get recent graded results - last 3 results that teacher has graded
export const getRecentGradedResults = async (
  studentId: string,
): Promise<
  Array<{
    examId: string;
    examTitle: string;
    examType: "Official" | "Practice" | "Exam Repository";
    subjectId: string;
    subjectName: string;
    percentage: number;
    grade?: string;
    isFirstTime: boolean;
    completedAt: Date;
  }>
> => {
  try {
    // Get last 3 graded results (gradingStatus === 'Completed' and status === 'Completed')
    const gradedResults = await ExamStudent.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
      percentage: { $exists: true, $ne: null }, // Must have percentage
    })
      .populate({
        path: "examId",
        select: "examTitle examType subjectId isDeleted",
        populate: {
          path: "subjectId",
          select: "name",
        },
      })
      .sort({ updatedAt: -1 }) // Most recently graded first
      .limit(3)
      .lean();

    // Process results
    const results = await Promise.all(
      gradedResults.map(async (examStudent: any) => {
        const exam = examStudent.examId;

        // Skip if exam is deleted or not found
        if (!exam || exam.isDeleted) {
          return null;
        }

        // Get subject name
        let subjectName = "Unknown Subject";
        let subjectId = "";

        if (exam.subjectId) {
          if (typeof exam.subjectId === "object" && exam.subjectId.name) {
            // Populated subject
            subjectName = exam.subjectId.name;
            subjectId = exam.subjectId._id?.toString() || "";
          } else if (typeof exam.subjectId === "string") {
            // Subject ID as string
            subjectId = exam.subjectId;
            // Try to get from populated data first
            if (!subjectName || subjectName === "Unknown Subject") {
              try {
                const subjectRepo = new SubjectRepository();
                const tenantId = examStudent.tenantId?.toString() || "";
                if (tenantId) {
                  const subject = await subjectRepo.findById(
                    subjectId,
                    tenantId,
                  );
                  if (subject && (subject as any).name) {
                    subjectName = (subject as any).name;
                  }
                }
              } catch (err) {
                console.warn(`Could not fetch subject name for ${subjectId}`);
              }
            }
          } else if (exam.subjectId._id) {
            // Subject ID as ObjectId
            subjectId = exam.subjectId._id.toString();
            // Try to get from populated data first
            if (!subjectName || subjectName === "Unknown Subject") {
              try {
                const subjectRepo = new SubjectRepository();
                const tenantId = examStudent.tenantId?.toString() || "";
                if (tenantId) {
                  const subject = await subjectRepo.findById(
                    subjectId,
                    tenantId,
                  );
                  if (subject && (subject as any).name) {
                    subjectName = (subject as any).name;
                  }
                }
              } catch (err) {
                console.warn(`Could not fetch subject name for ${subjectId}`);
              }
            }
          }
        }

        // Check if this is the first time (count previous attempts for same examId)
        const examIdStr = exam._id.toString();
        const previousAttempts = await ExamStudent.countDocuments({
          studentId: new mongoose.Types.ObjectId(studentId),
          examId: new mongoose.Types.ObjectId(examIdStr),
          status: "Completed",
          gradingStatus: "Completed",
          updatedAt: { $lt: examStudent.updatedAt }, // Before this attempt
        });

        const isFirstTime = previousAttempts === 0;

        return {
          examId: examIdStr,
          examTitle: exam.examTitle || "Unknown Exam",
          examType: exam.examType || "Practice",
          subjectId,
          subjectName,
          percentage: examStudent.percentage || 0,
          grade: examStudent.grade || undefined,
          isFirstTime,
          completedAt: examStudent.updatedAt || examStudent.createdAt, // Use updatedAt (when graded) or createdAt
        };
      }),
    );

    // Filter out null results
    return results.filter((result) => result !== null) as Array<{
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
  } catch (error) {
    console.error("Get recent graded results error:", error);
    throw error;
  }
};

// Get month-wise academic progress trend for a student
export const getAcademicProgressTrend = async (
  studentId: string,
  classIds: string | string[],
  tenantId: string,
  examType?: "Official" | "Practice" | "Exam Repository" | "all",
): Promise<
  Array<{
    year: number;
    month: number; // 1-12
    monthName: string; // "Jan", "Feb", etc.
    averagePercentage: number;
    totalExams: number;
  }>
> => {
  try {
    const studentIdObj = new mongoose.Types.ObjectId(studentId);
    const tenantIdObj = new mongoose.Types.ObjectId(tenantId);

    // Normalize classIds to array for backward compatibility
    const classIdsArray = Array.isArray(classIds) ? classIds : [classIds];
    const classIdObjs = classIdsArray.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    // Build match query for completed and graded exams
    const matchQuery: any = {
      studentId: studentIdObj,
      classId: { $in: classIdObjs }, // Support multiple classes
      tenantId: tenantIdObj,
      status: "Completed",
      gradingStatus: "Completed",
      isActive: true,
      percentage: { $exists: true, $ne: null },
    };

    // Get all graded exams for the student
    const gradedExams = await ExamStudent.find(matchQuery)
      .populate({
        path: "examId",
        select: "examTitle examType examStatus isDeleted",
        match: { isDeleted: false },
      })
      .sort({ updatedAt: 1 }) // Sort by date ascending
      .lean();

    // Filter valid exams (Released status, and examType if specified)
    const validExams = gradedExams.filter((es: any) => {
      const exam = es.examId;
      if (!exam || exam.isDeleted) return false;
      if (exam.examStatus !== "Released") return false;
      if (examType && examType !== "all" && exam.examType !== examType) {
        return false;
      }
      return true;
    });

    // Group by month and calculate averages
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

    // Process data from monthMap
    const dataMap = new Map<
      string,
      {
        year: number;
        month: number;
        averagePercentage: number;
        totalExams: number;
      }
    >();

    Array.from(monthMap.entries()).forEach(([key, data]) => {
      const averagePercentage =
        data.percentages.length > 0
          ? data.percentages.reduce((sum, p) => sum + p, 0) /
            data.percentages.length
          : 0;

      dataMap.set(key, {
        year: data.year,
        month: data.month,
        averagePercentage: Math.round(averagePercentage * 100) / 100, // Round to 2 decimal places
        totalExams: data.percentages.length,
      });
    });

    // Generate last 6 months from current date
    const now = new Date();
    const last6Months: Array<{
      year: number;
      month: number;
      monthName: string;
      averagePercentage: number;
      totalExams: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 1-12
      const key = `${year}-${month}`;

      // Get data from dataMap if exists, otherwise use defaults
      const monthData = dataMap.get(key);
      last6Months.push({
        year,
        month,
        monthName: monthNames[month - 1],
        averagePercentage: monthData?.averagePercentage || 0,
        totalExams: monthData?.totalExams || 0,
      });
    }

    return last6Months;
  } catch (error: any) {
    console.error("Error getting academic progress trend:", error);
    throw error;
  }
};

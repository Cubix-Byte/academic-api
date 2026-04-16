import * as examCredentialRepository from "../repositories/examCredential.repository";
import * as examAchievementRepository from "../repositories/examAchievement.repository";
import * as examBadgeRepository from "../repositories/examBadge.repository";
import * as examRepository from "../repositories/exam.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as studentRepository from "../repositories/student.repository";
import * as tenantRepository from "../repositories/tenant.repository";
import {
  GetCredentialsRequest,
  GetCredentialsResponse,
  StudentCredentialResponse,
  CredentialExamInfo,
  GetAchievementsRequest,
  GetAchievementsResponse,
  StudentAchievementResponse,
  GetBadgesRequest,
  GetBadgesResponse,
  StudentBadgeResponse,
  VerifyCredentialResponse,
} from "@/types/studentCredentials.types";
import { CredentialCategory } from "@/utils/constants/credentialEnums";

/**
 * Student Credentials Service - Business logic for credentials and achievements
 */

// Get student credentials
export const getStudentCredentials = async (
  params: GetCredentialsRequest & {
    studentId: string;
    filters?: Record<string, any>;
    sort?: Record<string, 1 | -1>;
  }
): Promise<GetCredentialsResponse> => {
  // Helper: get exam id from cred.examId (ObjectId or populated document) — avoid .toString() on populated doc
  const getExamIdFromCred = (cred: any): string | undefined => {
    if (!cred?.examId) return undefined;
    const e = cred.examId;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const id = e._id ?? e.id;
      if (id) return typeof id === "string" ? id : id.toString();
    }
    return undefined;
  };

  try {
    // Import repositories dynamically to avoid circular dependency
    const classStudentRepository = await import(
      "../repositories/classStudent.repository"
    );
    const mongoose = await import("mongoose");

    // Fetch student to get tenantId
    const student = await studentRepository.findStudentById(params.studentId);
    let schoolName: string | undefined;
    let tenantLogo: string | undefined;

    if (student && student.tenantId) {
      const tenant = await tenantRepository.findTenantById(student.tenantId);
      if (tenant) {
        schoolName = tenant.schoolName;
        tenantLogo = tenant.topIcon;
      }
    }

    // Get all ClassStudent records for this student (query by studentId only)
    const classStudentRecords = await classStudentRepository.findByStudent(
      params.studentId,
      undefined // Don't filter by tenantId - verify through Class instead
    );

    // Filter to only include active and promoted enrollments
    const activeAndPromotedRecords = classStudentRecords.filter(
      (record) =>
        record.enrollmentStatus === "active" ||
        record.enrollmentStatus === "promoted"
    );

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

    // Handle classId filter if provided in params
    let filteredClassIds = allValidClassIds;
    let requestedClassId: string | null = null;

    if (params.filters) {
      // Check if classId filter is provided (after buildQueryFromRequest processing)
      // It could be: filters.classId.$eq or filters.classId (direct value, string or ObjectId)
      if (params.filters.classId?.$eq) {
        // Handle $eq operator format
        const classIdValue = params.filters.classId.$eq;
        requestedClassId = classIdValue?.toString() || null;
      } else if (params.filters.classId) {
        // Handle direct value (could be string, ObjectId, or other)
        const classIdValue = params.filters.classId;
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
          // Requested classId is not in student's classes - return empty result
          return {
            credentials: [],
            pagination: {
              total: 0,
              pageNo: params.pageNo || 1,
              pageSize: params.pageSize || 10,
              totalPages: 0,
            },
          };
        }
      }

      // Remove classId from filters since we're filtering at the classIds level
      // This prevents it from being applied again in the repository
      const { classId, ...filtersWithoutClassId } = params.filters;
      params.filters = filtersWithoutClassId;
    }

    // Filter activeClassIds and promotedClassIdsWithDates based on requested classId
    const filteredActiveClassIds = activeClassIds.filter((id) =>
      filteredClassIds.includes(id)
    );
    const filteredPromotedClassIdsWithDates = promotedClassIdsWithDates.filter(
      (item) => filteredClassIds.includes(item.classId)
    );

    // Get all credentials with filters applied at repository level
    const allCredentials = await examCredentialRepository.findCredentialsByStudent(
      params.studentId,
      params.filters,
      params.sort
    );

    // Filter credentials based on active/promoted class logic
    const filteredCredentials = await Promise.all(
      allCredentials.map(async (cred) => {
        // Get exam to access classId (may be populated or need to fetch)
        let exam: any;
        if (cred.examId && typeof cred.examId === 'object' && 'classId' in cred.examId) {
          // Already populated
          exam = cred.examId;
        } else if (cred.examId) {
          const eid = getExamIdFromCred(cred);
          if (eid) exam = await examRepository.findExamById(eid);
        }

        const examClassId = exam?.classId?.toString() || exam?.classId;

        if (!examClassId) {
          // If exam has no classId, exclude it (shouldn't happen, but safety check)
          // Also handle non-exam credentials - they might not have a classId here
          // For now, if no examClassId, we check if it's 'other' category
          if (cred.credentialCategory === CredentialCategory.OTHER) return cred;
          return null;
        }

        // Check if credential is from an active class
        if (filteredActiveClassIds.includes(examClassId)) {
          return cred; // Show all credentials from active classes
        }

        // Check if credential is from a promoted class
        const promotedClassInfo = filteredPromotedClassIdsWithDates.find(
          (p) => p.classId === examClassId
        );

        if (promotedClassInfo) {
          // Only show credentials issued before/at promotion date
          const promotionDate = promotedClassInfo.promotionDate instanceof Date
            ? promotedClassInfo.promotionDate
            : new Date(promotedClassInfo.promotionDate);
          const issuedDate = cred.issuedDate instanceof Date
            ? cred.issuedDate
            : new Date(cred.issuedDate);

          if (issuedDate <= promotionDate) {
            return cred;
          }
        }

        // Credential is not from any active/promoted class - exclude it
        return null;
      })
    );

    // Remove null entries
    const validCredentials = filteredCredentials.filter((cred) => cred !== null) as typeof allCredentials;

    // Enrich with exam details and teacher name
    const enrichedCredentials: StudentCredentialResponse[] = await Promise.all(
      validCredentials.map(async (cred) => {
        // Get exam (may already be fetched during filtering, but fetch again to ensure we have full details)
        let exam: any;
        if (cred.examId && typeof cred.examId === 'object' && 'examTitle' in cred.examId) {
          // Already populated with full details
          exam = cred.examId;
        } else if (cred.examId) {
          const examIdStr = getExamIdFromCred(cred);
          if (examIdStr) {
            exam = await examRepository.findExamById(examIdStr);
          }
        }

        // Fetch teacher name if createdBy exists
        let createdByName: string | undefined;
        if (cred.createdBy) {
          const teacher = await teacherRepository.findTeacherById(
            cred.createdBy.toString()
          );
          if (teacher) {
            createdByName = `${teacher.firstName} ${teacher.lastName}`;
          }
        }

        const examIdStr = getExamIdFromCred(cred);
        const examTitle = exam?.examTitle;
        const isExamCategory = String(cred.credentialCategory || "").toLowerCase() === "exam";
        const examInfo: CredentialExamInfo | undefined = isExamCategory && (exam || examIdStr)
          ? {
              examId: examIdStr || (exam?._id?.toString?.() ?? exam?.id?.toString?.() ?? ""),
              examName: examTitle,
              examTitle,
              classId: exam?.classId?.toString?.() ?? (typeof exam?.classId === "string" ? exam.classId : undefined),
              subjectId: exam?.subjectId?.toString?.() ?? (typeof exam?.subjectId === "string" ? exam.subjectId : undefined),
            }
          : undefined;

        return {
          credentialId: cred._id.toString(),
          credentialName: cred.credentialName,
          description: cred.description,
          credentialType: cred.credentialType,
          credentialCategory: (cred.credentialCategory || CredentialCategory.EXAM),
          examId: examIdStr,
          examTitle,
          exam: examInfo,
          otherDetails: cred.otherDetails,
          studentId: cred.studentId.toString(),
          issuedDate: cred.issuedDate,
          validUntil: cred.validUntil,
          credentialUrl: cred.credentialUrl,
          verificationCode: cred.verificationCode,
          isActive: cred.isActive,
          createdBy: createdByName,
          schoolName,
          tenantLogo
        };
      })
    );

    // Apply sorting if provided
    if (params.sort && Object.keys(params.sort).length > 0) {
      enrichedCredentials.sort((a, b) => {
        for (const [key, direction] of Object.entries(params.sort!)) {
          const aValue = (a as any)[key];
          const bValue = (b as any)[key];
          if (aValue === undefined && bValue === undefined) continue;
          if (aValue === undefined) return direction === 1 ? 1 : -1;
          if (bValue === undefined) return direction === 1 ? -1 : 1;

          const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          if (comparison !== 0) {
            return direction === 1 ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedCredentials = enrichedCredentials.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      credentials: paginatedCredentials,
      pagination: {
        total: enrichedCredentials.length,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(enrichedCredentials.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get student credentials error:", error);
    throw error;
  }
};

// Get credential by ID
export const getCredentialById = async (
  credentialId: string,
  studentId: string
): Promise<StudentCredentialResponse> => {
  try {
    const credential = await examCredentialRepository.findCredentialById(
      credentialId
    );
    if (!credential) {
      throw new Error("CREDENTIAL_NOT_FOUND");
    }

    // Verify ownership
    if (credential.studentId.toString() !== studentId) {
      throw new Error("CREDENTIAL_NOT_OWNED_BY_STUDENT");
    }

    // Fetch tenant details
    let schoolName: string | undefined;
    let tenantLogo: string | undefined;

    const student = await studentRepository.findStudentById(studentId);
    if (student && student.tenantId) {
      const tenant = await tenantRepository.findTenantById(student.tenantId);
      if (tenant) {
        schoolName = tenant.schoolName;
        tenantLogo = tenant.topIcon;
      }
    }

    const exam = credential.examId
      ? await examRepository.findExamById(credential.examId.toString())
      : null;

    // Fetch teacher name if createdBy exists
    let createdByName: string | undefined;
    if (credential.createdBy) {
      const teacher = await teacherRepository.findTeacherById(
        credential.createdBy.toString()
      );
      if (teacher) {
        createdByName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }

    return {
      credentialId: credential._id.toString(),
      credentialName: credential.credentialName,
      description: credential.description,
      credentialType: credential.credentialType,
      credentialCategory: (credential.credentialCategory || CredentialCategory.EXAM),
      examId: credential.examId?.toString(),
      examTitle: exam?.examTitle || "Unknown Exam",
      otherDetails: credential.otherDetails,
      studentId: credential.studentId.toString(),
      issuedDate: credential.issuedDate,
      validUntil: credential.validUntil,
      credentialUrl: credential.credentialUrl,
      verificationCode: credential.verificationCode,
      isActive: credential.isActive,
      createdBy: createdByName,
      schoolName,
      tenantLogo
    };
  } catch (error) {
    console.error("Get credential by ID error:", error);
    throw error;
  }
};

// Verify credential
export const verifyCredential = async (
  verificationCode: string
): Promise<VerifyCredentialResponse> => {
  try {
    const credential =
      await examCredentialRepository.findCredentialByVerificationCode(
        verificationCode
      );

    if (!credential) {
      return {
        isValid: false,
        message: "Invalid verification code",
      };
    }

    if (!credential.isActive) {
      return {
        isValid: false,
        message: "Credential is no longer active",
      };
    }

    if (credential.validUntil && credential.validUntil < new Date()) {
      return {
        isValid: false,
        message: "Credential has expired",
      };
    }

    const exam = credential.examId
      ? await examRepository.findExamById(credential.examId.toString())
      : null;

    // Fetch teacher name if createdBy exists
    let createdByName: string | undefined;
    if (credential.createdBy) {
      const teacher = await teacherRepository.findTeacherById(
        credential.createdBy.toString()
      );
      if (teacher) {
        createdByName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }

    return {
      isValid: true,
      credential: {
        credentialId: credential._id.toString(),
        credentialName: credential.credentialName,
        description: credential.description,
        credentialType: credential.credentialType,
        credentialCategory: (credential.credentialCategory || CredentialCategory.EXAM),
        examId: credential.examId?.toString(),
        examTitle: exam?.examTitle || "Unknown Exam",
        otherDetails: credential.otherDetails,
        studentId: credential.studentId.toString(),
        issuedDate: credential.issuedDate,
        validUntil: credential.validUntil,
        credentialUrl: credential.credentialUrl,
        verificationCode: credential.verificationCode,
        isActive: credential.isActive,
        createdBy: createdByName
      },
      message: "Credential is valid",
    };
  } catch (error) {
    console.error("Verify credential error:", error);
    throw error;
  }
};

// Get student achievements
export const getStudentAchievements = async (
  params: GetAchievementsRequest & { studentId: string }
): Promise<GetAchievementsResponse> => {
  try {
    // Get all achievements
    let achievements =
      await examAchievementRepository.findAchievementsByStudent(
        params.studentId
      );

    // Apply filters
    if (params.category) {
      achievements = achievements.filter((a) => a.category === params.category);
    }
    if (params.isUnlocked !== undefined) {
      achievements = achievements.filter(
        (a) => a.isUnlocked === params.isUnlocked
      );
    }

    // Map to response
    const enrichedAchievements: StudentAchievementResponse[] = achievements.map(
      (ach) => ({
        achievementId: ach._id.toString(),
        achievementName: ach.achievementName,
        description: ach.description,
        achievementType: ach.achievementType,
        category: ach.category,
        icon: ach.icon,
        unlockedDate: ach.unlockedDate,
        progress: ach.progress,
        isUnlocked: ach.isUnlocked,
      })
    );

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedAchievements = enrichedAchievements.slice(
      startIndex,
      startIndex + pageSize
    );

    // Summary
    const totalAchievements = enrichedAchievements.length;
    const unlockedAchievements = enrichedAchievements.filter(
      (a) => a.isUnlocked
    ).length;

    return {
      achievements: paginatedAchievements,
      pagination: {
        total: totalAchievements,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(totalAchievements / pageSize),
      },
      summary: {
        totalAchievements: totalAchievements,
        unlockedAchievements: unlockedAchievements,
        unlockedPercentage:
          totalAchievements > 0
            ? (unlockedAchievements / totalAchievements) * 100
            : 0,
      },
    };
  } catch (error) {
    console.error("Get student achievements error:", error);
    throw error;
  }
};

// Get student badges
export const getStudentBadges = async (
  params: GetBadgesRequest & { studentId: string }
): Promise<GetBadgesResponse> => {
  try {
    // Get all badges
    let badges = await examBadgeRepository.findBadgesByStudent(
      params.studentId
    );

    // Apply filters
    if (params.badgeType) {
      badges = badges.filter((b) => b.badgeType === params.badgeType);
    }
    if (params.tier) {
      badges = badges.filter((b) => b.tier === params.tier);
    }
    if (params.isEarned !== undefined) {
      badges = badges.filter((b) => b.isEarned === params.isEarned);
    }

    // Map to response
    const enrichedBadges: StudentBadgeResponse[] = badges.map((badge) => ({
      badgeId: badge._id.toString(),
      badgeName: badge.badgeName,
      description: badge.description,
      badgeType: badge.badgeType,
      tier: badge.tier,
      icon: badge.icon,
      earnedDate: badge.earnedDate,
      progress: badge.progress,
      isEarned: badge.isEarned,
    }));

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedBadges = enrichedBadges.slice(
      startIndex,
      startIndex + pageSize
    );

    // Summary
    const totalBadges = enrichedBadges.length;
    const earnedBadges = enrichedBadges.filter((b) => b.isEarned).length;

    return {
      badges: paginatedBadges,
      pagination: {
        total: totalBadges,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(totalBadges / pageSize),
      },
      summary: {
        totalBadges: totalBadges,
        earnedBadges: earnedBadges,
        earnedPercentage:
          totalBadges > 0 ? (earnedBadges / totalBadges) * 100 : 0,
      },
    };
  } catch (error) {
    console.error("Get student badges error:", error);
    throw error;
  }
};

// Get student credentials statistics
export const getStudentCredentialsStatistics = async (
  studentId: string,
  filters?: Record<string, any>
) => {
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
          // Requested classId is not in student's classes - return empty statistics
          return {
            badges: 0,
            certificates: 0,
            awards: 0,
            totalCredentials: 0,
            activeCredentials: 0,
            expiredCredentials: 0,
            credentialsThisYear: 0,
            credentialsThisMonth: 0,
            expiringSoon: 0,
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

    // Get all credentials
    const allCredentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );

    // Filter credentials based on active/promoted class logic
    const filteredCredentials = allCredentials.filter((cred) => {
      // Get exam to access classId (should be populated)
      const exam = cred.examId as any;
      const examClassId = exam?.classId?.toString() || exam?.classId;

      if (!examClassId) {
        // If exam has no classId, check if it's 'other' category
        // Non-exam credentials might not be tied to a specific class for stats filtering
        // unless they are explicitly assigned to one. For now, if no examClassId, 
        // we check if it's 'other' to decide whether to include it.
        if (cred.credentialCategory === CredentialCategory.OTHER) return true;
        return false;
      }

      // Check if credential is from an active class
      if (filteredActiveClassIds.includes(examClassId)) {
        return true; // Show all credentials from active classes
      }

      // Check if credential is from a promoted class
      const promotedClassInfo = filteredPromotedClassIdsWithDates.find(
        (p) => p.classId === examClassId
      );

      if (promotedClassInfo) {
        // Only show credentials issued before/at promotion date
        const promotionDate = promotedClassInfo.promotionDate instanceof Date
          ? promotedClassInfo.promotionDate
          : new Date(promotedClassInfo.promotionDate);
        const issuedDate = cred.issuedDate instanceof Date
          ? cred.issuedDate
          : new Date(cred.issuedDate);

        return issuedDate <= promotionDate;
      }

      // Credential is not from any active/promoted class - exclude it
      return false;
    });

    // Normalize credential type for comparison (case-insensitive)
    const normalizeType = (type: string) => type.toLowerCase();

    const stats = {
      badges: filteredCredentials.filter(
        (c) => normalizeType(c.credentialType) === "badge"
      ).length,
      certificates: filteredCredentials.filter(
        (c) => normalizeType(c.credentialType) === "certificate"
      ).length,
      awards: filteredCredentials.filter(
        (c) => normalizeType(c.credentialType) === "award"
      ).length,
      totalCredentials: filteredCredentials.length,
      activeCredentials: filteredCredentials.filter((c) => c.isActive).length,
      expiredCredentials: filteredCredentials.filter(
        (c) => c.validUntil && new Date(c.validUntil) < new Date()
      ).length,
      credentialsThisYear: filteredCredentials.filter((c) => {
        const issuedYear = new Date(c.issuedDate).getFullYear();
        return issuedYear === new Date().getFullYear();
      }).length,
      credentialsThisMonth: filteredCredentials.filter((c) => {
        const issuedDate = new Date(c.issuedDate);
        const now = new Date();
        return (
          issuedDate.getFullYear() === now.getFullYear() &&
          issuedDate.getMonth() === now.getMonth()
        );
      }).length,
      expiringSoon: filteredCredentials.filter((c) => {
        if (!c.validUntil) return false;
        const daysUntilExpiry = Math.ceil(
          (new Date(c.validUntil).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      }).length,
    };

    return stats;
  } catch (error) {
    console.error("Get student credentials statistics error:", error);
    throw error;
  }
};

// Get student credentials dashboard
export const getStudentCredentialsDashboard = async (studentId: string) => {
  try {
    const credentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );

    // Recent credentials (last 5)
    const recentCredentials = credentials
      .sort((a, b) => b.issuedDate.getTime() - a.issuedDate.getTime())
      .slice(0, 5)
      .map((cred) => ({
        credentialId: cred._id.toString(),
        credentialName: cred.credentialName,
        credentialType: cred.credentialType,
        issuedDate: cred.issuedDate,
        validUntil: cred.validUntil,
        isActive: cred.isActive,
      }));

    // Expiring credentials (next 30 days)
    const expiringCredentials = credentials
      .filter((c) => {
        if (!c.validUntil) return false;
        const daysUntilExpiry = Math.ceil(
          (new Date(c.validUntil).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      })
      .sort(
        (a, b) =>
          new Date(a.validUntil!).getTime() - new Date(b.validUntil!).getTime()
      )
      .slice(0, 5)
      .map((cred) => ({
        credentialId: cred._id.toString(),
        credentialName: cred.credentialName,
        credentialType: cred.credentialType,
        validUntil: cred.validUntil,
        daysUntilExpiry: Math.ceil(
          (new Date(cred.validUntil!).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        ),
      }));

    // Credentials by type
    const credentialsByType = {
      certificate: credentials.filter((c) => c.credentialType === "certificate")
        .length,
      badge: credentials.filter((c) => c.credentialType === "badge").length,
      diploma: credentials.filter((c) => c.credentialType === "diploma").length,
      other: credentials.filter(
        (c) => !["certificate", "badge", "diploma"].includes(c.credentialType)
      ).length,
    };

    // Monthly credentials (last 6 months)
    const monthlyCredentials = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString("default", { month: "short" });
      const year = date.getFullYear();

      const count = credentials.filter((c) => {
        const issuedDate = new Date(c.issuedDate);
        return (
          issuedDate.getFullYear() === year &&
          issuedDate.getMonth() === date.getMonth()
        );
      }).length;

      monthlyCredentials.push({ month: `${month} ${year}`, count });
    }

    return {
      recentCredentials,
      expiringCredentials,
      credentialsByType,
      monthlyCredentials,
      totalCredentials: credentials.length,
      activeCredentials: credentials.filter((c) => c.isActive).length,
    };
  } catch (error) {
    console.error("Get student credentials dashboard error:", error);
    throw error;
  }
};

// Get recent credentials
export const getRecentCredentials = async (
  studentId: string,
  limit: number = 5
) => {
  try {
    const mongoose = await import("mongoose");
    const credentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );

    const recentCredentials = await Promise.all(
      credentials
        .sort((a, b) => b.issuedDate.getTime() - a.issuedDate.getTime())
        .slice(0, limit)
        .map(async (cred) => {
          // Get exam (may already be populated or need to fetch)
          let exam: any = null;
          let examId: string | undefined = undefined;

          if (cred.examId) {
            if (typeof cred.examId === 'object' && 'examTitle' in cred.examId) {
              // Already populated with full details
              exam = cred.examId;
              examId = exam._id?.toString() || exam.id?.toString() || (typeof exam.toString === 'function' ? exam.toString() : String(exam));
            } else {
              // Need to fetch exam - extract ID properly
              const examIdValue = cred.examId as any;
              if (mongoose.Types.ObjectId.isValid(examIdValue)) {
                const validExamId = examIdValue.toString();
                examId = validExamId;
                exam = await examRepository.findExamById(validExamId);
              } else {
                examId = String(examIdValue);
              }
            }
          }

          let issuedBy = "System";
          if (exam?.teacherId) {
            const teacher = await teacherRepository.findTeacherById(
              exam.teacherId.toString()
            );
            if (teacher) {
              issuedBy = `${teacher.firstName} ${teacher.lastName}`;
            }
          } else if (cred.createdBy) {
            const teacher = await teacherRepository.findTeacherById(
              cred.createdBy.toString()
            );
            if (teacher) {
              issuedBy = `${teacher.firstName} ${teacher.lastName}`;
            }
          }

          return {
            credentialId: cred._id.toString(),
            credentialName: cred.credentialName,
            description: cred.description,
            credentialType: cred.credentialType,
            credentialCategory: (cred.credentialCategory || 'exam') as any,
            examId: examId,
            examName: exam?.examTitle || (cred.credentialCategory === 'other' ? 'Other' : "Unknown Exam"),
            otherDetails: cred.otherDetails,
            issuedDate: cred.issuedDate,
            validUntil: cred.validUntil,
            verificationCode: cred.verificationCode,
            isActive: cred.isActive,
            issuedBy: issuedBy,
          };
        })
    );

    return { recent: recentCredentials };
  } catch (error) {
    console.error("Get recent credentials error:", error);
    throw error;
  }
};

// Get expiring credentials
export const getExpiringCredentials = async (
  studentId: string,
  days: number = 30
) => {
  try {
    const credentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );

    const expiringCredentials = credentials
      .filter((c) => {
        if (!c.validUntil) return false;
        const daysUntilExpiry = Math.ceil(
          (new Date(c.validUntil).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
        );
        return daysUntilExpiry <= days && daysUntilExpiry > 0;
      })
      .sort(
        (a, b) =>
          new Date(a.validUntil!).getTime() - new Date(b.validUntil!).getTime()
      )
      .map(async (cred) => {
        const exam = cred.examId ? await examRepository.findExamById(cred.examId.toString()) : null;
        return {
          credentialId: cred._id.toString(),
          credentialName: cred.credentialName,
          description: cred.description,
          credentialType: cred.credentialType,
          credentialCategory: (cred.credentialCategory || 'exam') as any,
          examId: cred.examId?.toString(),
          examName: exam?.examTitle || "Unknown Exam",
          otherDetails: cred.otherDetails,
          validUntil: cred.validUntil,
          daysUntilExpiry: Math.ceil(
            (new Date(cred.validUntil!).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
          ),
          isActive: cred.isActive,
        };
      });

    return await Promise.all(expiringCredentials);
  } catch (error) {
    console.error("Get expiring credentials error:", error);
    throw error;
  }
};

// Get credentials grouped by type
export const getCredentialsByType = async (studentId: string) => {
  try {
    const credentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );

    const groupedCredentials: {
      certificate: any[];
      badge: any[];
      diploma: any[];
      other: any[];
    } = {
      certificate: [],
      badge: [],
      diploma: [],
      other: [],
    };

    for (const cred of credentials) {
      const exam = cred.examId ? await examRepository.findExamById(cred.examId.toString()) : null;
      const credentialData = {
        credentialId: cred._id.toString(),
        credentialName: cred.credentialName,
        description: cred.description,
        credentialType: cred.credentialType,
        credentialCategory: (cred.credentialCategory || CredentialCategory.EXAM),
        examId: cred.examId?.toString(),
        examName: exam?.examTitle || "Unknown Exam",
        otherDetails: cred.otherDetails,
        issuedDate: cred.issuedDate,
        validUntil: cred.validUntil,
        isActive: cred.isActive,
      };

      if (cred.credentialType === "certificate") {
        groupedCredentials.certificate.push(credentialData);
      } else if (cred.credentialType === "badge") {
        groupedCredentials.badge.push(credentialData);
      } else if (cred.credentialType === "diploma") {
        groupedCredentials.diploma.push(credentialData);
      } else {
        groupedCredentials.other.push(credentialData);
      }
    }

    return groupedCredentials;
  } catch (error) {
    console.error("Get credentials by type error:", error);
    throw error;
  }
};

// Get credentials grouped by exam
export const getCredentialsByExam = async (studentId: string) => {
  try {
    const credentials = await examCredentialRepository.findCredentialsByStudent(
      studentId
    );
    const examGroups = new Map();

    for (const cred of credentials) {
      const exam = cred.examId ? await examRepository.findExamById(cred.examId.toString()) : null;
      const examId = cred.examId?.toString() || CredentialCategory.OTHER;

      if (!examGroups.has(examId)) {
        examGroups.set(examId, {
          examId,
          examName: exam?.examTitle || (cred.credentialCategory === CredentialCategory.OTHER ? 'Other' : "Unknown Exam"),
          examDescription: exam?.description || "",
          credentials: [],
        });
      }

      examGroups.get(examId).credentials.push({
        credentialId: cred._id.toString(),
        credentialName: cred.credentialName,
        description: cred.description,
        credentialType: cred.credentialType,
        credentialCategory: (cred.credentialCategory || CredentialCategory.EXAM),
        otherDetails: cred.otherDetails,
        issuedDate: cred.issuedDate,
        validUntil: cred.validUntil,
        isActive: cred.isActive,
      });
    }

    return Array.from(examGroups.values());
  } catch (error) {
    console.error("Get credentials by exam error:", error);
    throw error;
  }
};

/**
 * Get achievement detail by ID
 */
export const getAchievementDetail = async (
  achievementId: string,
  studentId: string
): Promise<{
  achievement: StudentAchievementResponse;
  details: {
    givenFrom?: string;
    givenTo?: string;
    quizResult?: string;
    grade?: string;
    badgeInfo?: string;
  };
}> => {
  try {
    const achievement = await examAchievementRepository.findAchievementById(
      achievementId
    );

    if (!achievement) {
      throw new Error("Achievement not found");
    }

    // Verify the achievement belongs to the student
    if (achievement.studentId.toString() !== studentId) {
      throw new Error("Achievement does not belong to this student");
    }

    // Map to response
    const enrichedAchievement: StudentAchievementResponse = {
      achievementId: achievement._id.toString(),
      achievementName: achievement.achievementName,
      description: achievement.description,
      achievementType: achievement.achievementType,
      category: achievement.category,
      icon: achievement.icon,
      unlockedDate: achievement.unlockedDate,
      progress: achievement.progress,
      isUnlocked: achievement.isUnlocked,
    };

    // Extract additional details including teacher information
    const details = {
      badgeInfo: achievement.description,
      givenFrom: achievement.teacherName || "System Generated",
      givenTo: "", // Can be student name if stored
      quizResult: `${achievement.progress}/100`,
      grade: achievement.achievementType,
    };

    return {
      achievement: enrichedAchievement,
      details,
    };
  } catch (error: any) {
    console.error("Get achievement detail error:", error);
    throw new Error(`Failed to get achievement detail: ${error.message}`);
  }
};
// Download credential
export const downloadCredential = async (
  credentialId: string,
  format: 'pdf' | 'png'
): Promise<{ url: string; filename: string }> => {
  try {
    const credential = await examCredentialRepository.findCredentialById(credentialId);
    if (!credential) {
      throw new Error("CREDENTIAL_NOT_FOUND");
    }

    // In a real implementation, this might generate a PDF/PNG dynamically
    // For now, we return the stored URL or a placeholder
    // If format is specific, we might append a query param or handle it differently

    // Check if we have a file URL
    const url = (credential as any).fileUrl || (credential as any).imageUrl || (credential as any).credentialUrl;

    if (!url) {
      throw new Error("CREDENTIAL_FILE_NOT_FOUND");
    }

    return {
      url,
      filename: `${credential.credentialName}.${format}`
    };
  } catch (error) {
    console.error('Download credential error:', error);
    throw error;
  }
};

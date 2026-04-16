import * as examCredentialRepository from "../repositories/examCredential.repository";
import {
  ExamCredential,
  TeacherActivityLog,
  CredentialTemplate,
  TeacherCredentialAssignment,
} from "../models";
import mongoose from "mongoose";
import {
  GetCredentialAnalyticsRequest,
  CredentialAnalyticsResponse,
  CredentialStatisticsResponse,
  CredentialTemplateStatsResponse,
} from "@/types/credentialAnalytics.types";
import {
  CredentialType,
  IssuedByFilter,
} from "@/utils/constants/credentialEnums";
import { fetchUserNames } from "@/utils/activityLog.helper";
import { UserApiIntegrationService } from "./userApiIntegration.service";

/**
 * Credential Analytics Service - Business logic for credential analytics
 */

// Get credential analytics
export const getCredentialAnalytics = async (
  params: GetCredentialAnalyticsRequest & {
    tenantId: string;
    filters?: Record<string, any>;
  }
): Promise<CredentialAnalyticsResponse> => {
  try {
    // Build base query
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      isDeleted: false,
    };

    // Merge with generic filters from buildQuery
    if (params.filters) {
      const filters = params.filters;
      // Merge filters into query, but handle special cases
      Object.keys(filters).forEach((key) => {
        // Skip issuedDate if it's already handled below
        if (key === "issuedDate") {
          return;
        }

        const filterValue = filters[key];

        // Handle $eq operator - simplify to direct value for simple equality
        if (
          filterValue &&
          typeof filterValue === "object" &&
          filterValue.$eq !== undefined
        ) {
          query[key] = filterValue.$eq;
        } else {
          // Handle ObjectId conversions
          if (key === "examId" || key === "studentId" || key === "subjectId") {
            if (typeof filterValue === "string") {
              query[key] = new mongoose.Types.ObjectId(filterValue);
            } else {
              query[key] = filterValue;
            }
          } else {
            query[key] = filterValue;
          }
        }
      });

      // Handle issuedDate from filters (date range)
      if (filters.issuedDate) {
        query.issuedDate = filters.issuedDate;
      }

      // Filter by credential type from filters (handle $eq)
      if (filters.credentialType) {
        const credType =
          typeof filters.credentialType === "object" &&
          filters.credentialType.$eq
            ? filters.credentialType.$eq
            : filters.credentialType;
        if (credType && credType !== "All") {
          query.credentialType = credType;
        }
      }
    }

    // Filter by credential type (support legacy params)
    if (params.type && params.type !== "All" && !query.credentialType) {
      query.credentialType = params.type;
    }

    // Filter by month/year (only if not already in filters.issuedDate)
    if (!params.filters?.issuedDate) {
      if (params.month && params.year) {
        const startDate = new Date(params.year, params.month - 1, 1);
        const endDate = new Date(params.year, params.month, 0, 23, 59, 59, 999);
        query.issuedDate = {
          $gte: startDate,
          $lte: endDate,
        };
      } else if (params.year) {
        const startDate = new Date(params.year, 0, 1);
        const endDate = new Date(params.year, 11, 31, 23, 59, 59, 999);
        query.issuedDate = {
          $gte: startDate,
          $lte: endDate,
        };
      }
    }

    // Get all credentials matching filters
    let credentials = await ExamCredential.find(query)
      .populate("examId", "classId subjectId")
      .sort({ issuedDate: -1 })
      .lean();

    // Filter by subjectId if provided
    if (params.subjectId) {
      credentials = credentials.filter((cred: any) => {
        const exam = cred.examId;
        return exam?.subjectId?.toString() === params.subjectId;
      });
    }

    // Get credential IDs for activity log lookup
    const credentialIds = credentials.map((c: any) => c._id.toString());

    // Fetch issuedBy from activity logs
    const issuedByMap: Record<string, string> = {};
    const teacherIdMap: Record<string, string> = {};
    try {
      const activityLogs = await TeacherActivityLog.find({
        relatedEntityId: {
          $in: credentialIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        activityType: "CredentialCreated",
        relatedEntityType: "Credential",
      })
        .select("relatedEntityId teacherId")
        .lean();

      // Get unique teacher IDs
      const teacherIds = [
        ...new Set(
          activityLogs
            .map((log: any) => log.teacherId?.toString())
            .filter((id) => id)
        ),
      ];

      // Fetch teacher names
      const teacherNames = await fetchUserNames(teacherIds);

      // Map credential ID to teacher name and ID
      activityLogs.forEach((log: any) => {
        const credentialId = log.relatedEntityId?.toString();
        const teacherId = log.teacherId?.toString();
        if (credentialId && teacherId) {
          issuedByMap[credentialId] =
            teacherNames[teacherId] || "Unknown Teacher";
          teacherIdMap[credentialId] = teacherId;
        }
      });
    } catch (error) {
      console.error("Error fetching issuedBy from activity logs:", error);
    }

    // Apply issuedBy filter
    if (params.issuedBy && params.issuedBy !== IssuedByFilter.ALL) {
      if (params.issuedBy === IssuedByFilter.TEACHERS) {
        credentials = credentials.filter((cred: any) => {
          const credentialId = cred._id.toString();
          return (
            issuedByMap[credentialId] &&
            issuedByMap[credentialId] !== "Percipio Ai"
          );
        });
      } else if (params.issuedBy === IssuedByFilter.AI_GENERATED) {
        credentials = credentials.filter((cred: any) => {
          const credentialId = cred._id.toString();
          return (
            !issuedByMap[credentialId] ||
            issuedByMap[credentialId] === "Percipio Ai"
          );
        });
      } else if (params.issuerName) {
        // Filter by specific teacher name
        credentials = credentials.filter((cred: any) => {
          const credentialId = cred._id.toString();
          const issuedBy = issuedByMap[credentialId] || "Percipio Ai";
          return issuedBy
            .toLowerCase()
            .includes(params.issuerName!.toLowerCase());
        });
      }
    }

    // Calculate summary statistics
    const badges = credentials.filter(
      (c: any) => c.credentialType === CredentialType.BADGE
    ).length;
    const certificates = credentials.filter(
      (c: any) => c.credentialType === CredentialType.CERTIFICATE
    ).length;
    const awards = credentials.filter(
      (c: any) => c.credentialType === CredentialType.AWARD
    ).length;

    // Get student IDs for name fetching
    const studentIds = [
      ...new Set(credentials.map((c: any) => c.studentId.toString())),
    ];

    // Fetch student names
    const studentNameMap: Record<string, string> = {};
    try {
      if (studentIds.length > 0) {
        const usersResponse = await UserApiIntegrationService.getUsersByIds(
          studentIds
        );
        const users = usersResponse?.data?.users || usersResponse?.users || [];
        users.forEach((user: any) => {
          const userId = user._id?.toString() || user.id?.toString();
          if (userId) {
            const fullName = `${user.firstName || ""} ${
              user.lastName || ""
            }`.trim();
            studentNameMap[userId] = fullName || "Unknown Student";
          }
        });
      }
    } catch (error) {
      console.error("Error fetching student names:", error);
    }

    // Get class names
    const classNameMap: Record<string, string> = {};
    try {
      const { Class } = await import("../models");
      const uniqueClassIds = [
        ...new Set(
          credentials
            .map((c: any) => {
              const exam = c.examId;
              return exam?.classId?.toString();
            })
            .filter((id) => id)
        ),
      ];

      if (uniqueClassIds.length > 0) {
        const classes = await Class.find({
          _id: {
            $in: uniqueClassIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("_id name")
          .lean();

        classes.forEach((cls: any) => {
          classNameMap[cls._id.toString()] = cls.name || "Unknown Class";
        });
      }
    } catch (error) {
      console.error("Error fetching class names:", error);
    }

    // Map to issued items
    const issuedItems = credentials.map((cred: any) => {
      const exam = cred.examId;
      const classId = exam?.classId?.toString();
      const credentialId = cred._id.toString();

      return {
        credentialId,
        credentialName: cred.credentialName,
        credentialType: cred.credentialType,
        issuedDate: cred.issuedDate,
        issuedBy: issuedByMap[credentialId] || "Percipio Ai",
        studentId: cred.studentId.toString(),
        studentName:
          studentNameMap[cred.studentId.toString()] || "Unknown Student",
        className: classId ? classNameMap[classId] : undefined,
      };
    });

    return {
      summary: {
        badges,
        certificates,
        awards,
        total: credentials.length,
      },
      issuedItems,
    };
  } catch (error) {
    console.error("Get credential analytics error:", error);
    throw error;
  }
};

// Get credential statistics (for dashboard)
export const getCredentialStatistics = async (
  tenantId: string,
  userId?: string
): Promise<CredentialStatisticsResponse> => {
  try {
    // Get all active issued credentials (ExamCredential)
    // Note: This counts ISSUED credentials, not templates
    // Templates are created via POST /credentials but must be issued via POST /teacher-credentials
    const query = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
      isActive: true,
    };

    const credentials = await ExamCredential.find(query).lean();

    // Debug logging
    console.log(`📊 [STATISTICS] Query:`, JSON.stringify(query, null, 2));
    console.log(
      `📊 [STATISTICS] Found ${credentials.length} issued credentials for tenant ${tenantId}`
    );

    // Also check templates for debugging
    const templates = await CredentialTemplate.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).lean();
    console.log(
      `📊 [STATISTICS] Found ${templates.length} credential templates for tenant ${tenantId}`
    );

    // Get credential IDs for activity log lookup
    const credentialIds = credentials.map((c: any) => c._id.toString());

    // Fetch issuedBy from activity logs
    const issuedByMap: Record<string, string> = {};
    const credentialHasActivityLog: Record<string, boolean> = {}; // Track which credentials have activity logs with teacherId
    try {
      const activityLogs = await TeacherActivityLog.find({
        relatedEntityId: {
          $in: credentialIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        activityType: "CredentialCreated",
        relatedEntityType: "Credential",
        tenantId: new mongoose.Types.ObjectId(tenantId),
      })
        .select("relatedEntityId teacherId")
        .lean();

      // Get unique teacher IDs
      const teacherIds = [
        ...new Set(
          activityLogs
            .map((log: any) => log.teacherId?.toString())
            .filter((id) => id)
        ),
      ];

      console.log(`📊 [STATISTICS] Found ${activityLogs.length} activity logs`);
      console.log(`📊 [STATISTICS] Unique teacher IDs:`, teacherIds);

      // Fetch teacher names
      const teacherNames = await fetchUserNames(teacherIds);
      console.log(`📊 [STATISTICS] Teacher names fetched:`, teacherNames);

      // Map credential ID to teacher name and track which credentials have activity logs
      activityLogs.forEach((log: any) => {
        const credentialId = log.relatedEntityId?.toString();
        const teacherId = log.teacherId?.toString();
        if (credentialId && teacherId) {
          // Mark that this credential has an activity log with a teacherId
          credentialHasActivityLog[credentialId] = true;
          // Use "Teacher" instead of "Unknown Teacher" to ensure it counts as teacher-generated
          const teacherName = teacherNames[teacherId] || "Teacher";
          issuedByMap[credentialId] = teacherName;
          console.log(
            `📊 [STATISTICS] Mapped credential ${credentialId} to teacher: ${teacherName} (ID: ${teacherId})`
          );
        } else {
          console.log(
            `📊 [STATISTICS] ⚠️ Activity log missing credentialId or teacherId:`,
            {
              credentialId,
              teacherId,
              log: log,
            }
          );
        }
      });

      console.log(
        `📊 [STATISTICS] Total credentials with activity logs: ${
          Object.keys(issuedByMap).length
        }`
      );
    } catch (error) {
      console.error("Error fetching issuedBy from activity logs:", error);
    }

    // Calculate statistics
    const totalCredentials = credentials.length;

    // Count AI Generated (no activity log entry with teacherId OR explicitly "Percipio Ai")
    // If an activity log exists with a teacherId, it's human-generated (teacher/admin), not AI-generated
    const aiGenerated = credentials.filter((cred: any) => {
      const credentialId = cred._id.toString();
      const hasActivityLog = credentialHasActivityLog[credentialId] || false;
      const issuedBy = issuedByMap[credentialId];
      // AI Generated = no activity log with teacherId OR explicitly "Percipio Ai"
      const isAI = !hasActivityLog || issuedBy === "Percipio Ai";
      if (isAI) {
        console.log(
          `📊 [STATISTICS] ❌ Credential ${credentialId} is AI Generated (hasActivityLog: ${hasActivityLog}, issuedBy: ${
            issuedBy || "none"
          })`
        );
      }
      return isAI;
    }).length;

    // Count Teacher Generated (has activity log entry with teacherId and not "Percipio Ai")
    // If an activity log exists with a teacherId, count it as teacher-generated regardless of name lookup success
    const teacherGenerated = credentials.filter((cred: any) => {
      const credentialId = cred._id.toString();
      const hasActivityLog = credentialHasActivityLog[credentialId] || false;
      const issuedBy = issuedByMap[credentialId];
      // Teacher Generated = has activity log entry with teacherId and not "Percipio Ai"
      const isTeacher = hasActivityLog && issuedBy !== "Percipio Ai";
      if (isTeacher) {
        console.log(
          `📊 [STATISTICS] ✅ Credential ${credentialId} is Teacher Generated by: ${
            issuedBy || "Teacher (name lookup failed)"
          }`
        );
      }
      return isTeacher;
    }).length;

    // Count Awards (credentialType === "Award")
    const totalAwards = credentials.filter(
      (c: any) => c.credentialType === CredentialType.AWARD
    ).length;

    // Count credentials created by current user
    const createdByCurrentUser = userId
      ? credentials.filter((cred: any) => {
          const createdById = cred.createdBy?.toString();
          return createdById === userId;
        }).length
      : 0;

    console.log(
      `📊 [STATISTICS] Credentials created by current user (${userId}): ${createdByCurrentUser}`
    );

    // Count credentials created by admin (via templates assigned to teacher)
    let createdByAdmin = 0;
    if (userId) {
      try {
        // Get all credential template IDs assigned to current teacher
        const teacherAssignments = await TeacherCredentialAssignment.find({
          teacherId: new mongoose.Types.ObjectId(userId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isActive: true,
        })
          .select("credentialTemplateId")
          .lean();

        const assignedTemplateIds = teacherAssignments.map((assignment: any) =>
          assignment.credentialTemplateId.toString()
        );

        if (assignedTemplateIds.length > 0) {
          // Get all assigned templates with their createdBy field
          const assignedTemplates = await CredentialTemplate.find({
            _id: {
              $in: assignedTemplateIds.map(
                (id) => new mongoose.Types.ObjectId(id)
              ),
            },
            tenantId: new mongoose.Types.ObjectId(tenantId),
            isDeleted: false,
          })
            .select("_id meritBadge createdBy")
            .lean();

          // Get unique creator IDs from templates
          const creatorIds = [
            ...new Set(
              assignedTemplates
                .map((t: any) => t.createdBy?.toString())
                .filter((id) => id)
            ),
          ];

          if (creatorIds.length > 0) {
            // Fetch users to check their userType
            const usersResponse =
              await UserApiIntegrationService.getUsersByIds(creatorIds);
            const users = usersResponse?.data?.users || usersResponse?.users || [];

            // Create a map of creator ID to userType
            const creatorUserTypeMap: Record<string, string> = {};
            users.forEach((user: any) => {
              const userId = user._id?.toString() || user.id?.toString();
              if (userId && user.userType) {
                creatorUserTypeMap[userId] = user.userType;
              }
            });

            // Filter templates where creator's userType is 'admin' or 'superadmin'
            const adminTemplates = assignedTemplates.filter((t: any) => {
              const creatorId = t.createdBy?.toString();
              const userType = creatorUserTypeMap[creatorId];
              return userType === "admin" || userType === "superadmin";
            });

            const adminTemplateNames = new Set(
              adminTemplates.map((t: any) => t.meritBadge)
            );

            // Count credentials created by current user that match admin-created templates
            // Match by credentialName matching template's meritBadge
            createdByAdmin = credentials.filter((cred: any) => {
              const createdById = cred.createdBy?.toString();
              const isCreatedByUser = createdById === userId;
              const matchesAdminTemplate = adminTemplateNames.has(
                cred.credentialName
              );
              return isCreatedByUser && matchesAdminTemplate;
            }).length;
          }
        }
      } catch (error) {
        console.error(
          "Error fetching admin-created credential count:",
          error
        );
      }
    }

    return {
      totalCredentials,
      aiGenerated,
      teacherGenerated,
      totalAwards,
      createdByCurrentUser,
      createdByAdmin,
    };
  } catch (error) {
    console.error("Get credential statistics error:", error);
    throw error;
  }
};

// Get credential template statistics (for credential templates)
export const getCredentialTemplateStats = async (
  tenantId: string
): Promise<CredentialTemplateStatsResponse> => {
  try {
    // Query CredentialTemplate collection for non-deleted templates
    const query = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    const templates = await CredentialTemplate.find(query)
      .select("credentialType")
      .lean();

    // Count total templates
    const total = templates.length;

    // Count by credential type
    const badges = templates.filter(
      (t: any) => t.credentialType === CredentialType.BADGE
    ).length;
    const certificates = templates.filter(
      (t: any) => t.credentialType === CredentialType.CERTIFICATE
    ).length;
    const awards = templates.filter(
      (t: any) => t.credentialType === CredentialType.AWARD
    ).length;

    return {
      total,
      badges,
      certificates,
      awards,
    };
  } catch (error) {
    console.error("Get credential template stats error:", error);
    throw error;
  }
};

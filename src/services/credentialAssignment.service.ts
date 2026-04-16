import * as teacherCredentialAssignmentRepository from "../repositories/teacherCredentialAssignment.repository";
import * as credentialTemplateRepository from "../repositories/credentialTemplate.repository";
import * as examCredentialRepository from "../repositories/examCredential.repository";
import * as notificationService from "./notification.service";
import * as teacherService from "./teacher.service";
import {
  AssignCredentialToTeachersRequest,
  AssignCredentialToTeachersResponse,
  GetTeacherCredentialAssignmentsRequest,
  GetTeacherCredentialAssignmentsResponse,
  GetCredentialAssignmentsDetailsRequest,
  GetCredentialAssignmentsDetailsResponse,
} from "@/types/credentialAssignment.types";
import { fetchUserNames } from "@/utils/activityLog.helper";
import mongoose from "mongoose";
import { TeacherActivityLog } from "@/models";

/**
 * Credential Assignment Service - Business logic for assigning credentials to teachers
 */

// Assign credential to teachers
export const assignCredentialToTeachers = async (
  credentialTemplateId: string,
  data: AssignCredentialToTeachersRequest,
  tenantId: string,
  assignedById?: string,
  assignedByRole?: string
): Promise<AssignCredentialToTeachersResponse> => {
  try {
    const template =
      await credentialTemplateRepository.findCredentialTemplateById(
        credentialTemplateId,
        tenantId
      );
    if (!template) {
      throw new Error("CREDENTIAL_TEMPLATE_NOT_FOUND");
    }

    const now = new Date();

    // Duplicate check: when classId + credentialCategory are provided, only block if same credential+class+category.
    // Otherwise block any active assignment of this credential to the teacher.
    const classId = data.classId && String(data.classId).trim() ? String(data.classId).trim() : undefined;
    const credentialCategory = data.credentialCategory && String(data.credentialCategory).trim() ? String(data.credentialCategory).trim().toLowerCase() : undefined;

    if (classId && credentialCategory) {
      const existingActiveAssignments =
        await teacherCredentialAssignmentRepository.findActiveAssignmentsForTeachersWithClassAndCategory(
          credentialTemplateId,
          data.teacherIds,
          classId,
          credentialCategory,
          tenantId,
          now
        );
      if (existingActiveAssignments.length > 0) {
        throw new Error("TEACHER_ALREADY_ASSIGNED_FOR_CREDENTIAL");
      }
    } else {
      const existingActiveAssignments =
        await teacherCredentialAssignmentRepository.findActiveAssignmentsForTeachers(
          credentialTemplateId,
          data.teacherIds,
          tenantId,
          now
        );
      if (existingActiveAssignments.length > 0) {
        throw new Error("TEACHER_ALREADY_ASSIGNED_FOR_CREDENTIAL");
      }
    }

    const assignments =
      await teacherCredentialAssignmentRepository.createTeacherCredentialAssignments(
        credentialTemplateId,
        data,
        tenantId
      );

    // Fetch teacher names
    const teacherIds = assignments.map((a) => a.teacherId.toString());
    const userNames = await fetchUserNames(teacherIds);

    // ===== SEND NOTIFICATIONS FOR CREDENTIAL ASSIGNMENT TO TEACHERS =====
    // Send notifications to admin and all assigned teachers
    try {
      const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
      const credentialName = template.meritBadge || "Credential";
      const credentialType = template.credentialType || "Credential";

      console.log("🔔 [CredentialAssignment] Preparing notifications (admin -> teachers)", {
        credentialTemplateId,
        tenantId: tenantIdString,
        credentialName,
        credentialType,
        assignedById,
        assignedByRole,
        teachersRequested: Array.isArray(data.teacherIds) ? data.teacherIds.length : 0,
        assignmentsCreated: assignments.length,
      });

      // Validate tenantId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(tenantIdString)) {
        console.warn("⚠️ Invalid tenantId, skipping credential assignment notifications");
      } else {
        const notifications: notificationService.INotificationRequest[] = [];

        // 1. Send notification to admin who assigned the credential (if assignedById is provided)
        if (assignedById && mongoose.Types.ObjectId.isValid(assignedById)) {
          const adminRole = assignedByRole || "ADMIN";
          const teacherNames = assignments
            .map((a) => userNames[a.teacherId.toString()] || "Unknown Teacher")
            .join(", ");
          
          notifications.push({
            receiverId: assignedById,
            receiverRole: adminRole,
            title: "Credential Assigned to Teachers",
            content: `You have successfully assigned "${credentialName}" credential to ${assignments.length} teacher(s): ${teacherNames}.`,
            senderId: undefined, // No sender for system notifications
            senderRole: "SYSTEM",
            tenantId: tenantIdString,
            meta: {
              entityId: credentialTemplateId,
              entityType: "CredentialTemplate",
              credentialTemplateId: credentialTemplateId,
              credentialName: credentialName,
              credentialType: credentialType,
              teacherCount: assignments.length,
              teacherIds: teacherIds,
            },
          });
        }

        // 2. Send notification to each assigned teacher
        assignments.forEach((assignment) => {
          const teacherId = assignment.teacherId.toString();
          if (mongoose.Types.ObjectId.isValid(teacherId)) {
            const teacherName = userNames[teacherId] || "Teacher";
            notifications.push({
              receiverId: teacherId,
              receiverRole: "TEACHER",
              title: "Credential Assigned",
              content: `You have been assigned the "${credentialName}" credential. You can now issue this credential to your students.`,
              senderId: assignedById && mongoose.Types.ObjectId.isValid(assignedById) ? assignedById : undefined,
              senderRole: assignedById ? (assignedByRole || "ADMIN") : "SYSTEM",
              tenantId: tenantIdString,
              meta: {
                entityId: credentialTemplateId,
                entityType: "CredentialTemplate",
                credentialTemplateId: credentialTemplateId,
                credentialName: credentialName,
                credentialType: credentialType,
                assignmentId: assignment._id.toString(),
                startDate: assignment.startDate,
                endDate: assignment.endDate,
              },
            });
          }
        });

        console.log("🧾 [CredentialAssignment] Notifications prepared (admin -> teachers)", {
          totalNotifications: notifications.length,
          teacherNotificationCount: assignments.length,
          adminNotificationIncluded: Boolean(assignedById && mongoose.Types.ObjectId.isValid(assignedById)),
          sampleReceivers: notifications.slice(0, 5).map((n) => ({
            receiverId: n.receiverId,
            receiverRole: n.receiverRole,
            title: n.title,
          })),
        });

        // Send all notifications in batches (API limit is 100)
        if (notifications.length > 0) {
          console.log(`📤 Sending ${notifications.length} notification(s) for credential assignment to teachers...`);
          const batchSize = 100;
          for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            notificationService
              .sendNotifications(batch)
              .then((result) => {
                console.log(
                  `✅ Successfully sent notification batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notifications.length / batchSize)} for credential assignment`
                );
              })
              .catch((notificationError: any) => {
                console.error(
                  `⚠️ Failed to send notification batch ${Math.floor(i / batchSize) + 1} for credential assignment:`,
                  notificationError.message
                );
              });
          }
        }
      }
    } catch (notificationError: any) {
      // Log error but don't fail the credential assignment
      console.error(
        "⚠️ Error preparing credential assignment notifications:",
        notificationError.message
      );
    }

    return {
      assignments: assignments.map((assignment) => ({
        assignmentId: assignment._id.toString(),
        credentialTemplateId: assignment.credentialTemplateId.toString(),
        teacherId: assignment.teacherId.toString(),
        teacherName:
          userNames[assignment.teacherId.toString()] || "Unknown Teacher",
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        isActive: assignment.isActive,
      })),
    };
  } catch (error) {
    console.error("Assign credential to teachers error:", error);
    throw error;
  }
};

// Get teacher credential assignments
export const getTeacherCredentialAssignments = async (
  params: GetTeacherCredentialAssignmentsRequest & { tenantId: string }
): Promise<GetTeacherCredentialAssignmentsResponse> => {
  try {
    const assignments =
      await teacherCredentialAssignmentRepository.findTeacherCredentialAssignments(
        params
      );
    const total =
      await teacherCredentialAssignmentRepository.countTeacherCredentialAssignments(
        params
      );

    // Get unique teacher IDs
    const teacherIds = [
      ...new Set(assignments.map((a) => a.teacherId.toString())),
    ];
    const userNames = await fetchUserNames(teacherIds);

    // Map to response
    const assignmentResponses = assignments.map((assignment) => {
      const template = assignment.credentialTemplateId as any;
      return {
        assignmentId: assignment._id.toString(),
        credentialTemplateId: assignment.credentialTemplateId.toString(),
        credentialTemplateName: template?.meritBadge,
        teacherId: assignment.teacherId.toString(),
        teacherName:
          userNames[assignment.teacherId.toString()] || "Unknown Teacher",
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        isActive: assignment.isActive,
      };
    });

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedAssignments = assignmentResponses.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      assignments: paginatedAssignments,
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get teacher credential assignments error:", error);
    throw error;
  }
};

// Get credential assignments details (teachers assigned + students who received credentials)
export const getCredentialAssignmentsDetails = async (
  credentialTemplateId: string,
  params: GetCredentialAssignmentsDetailsRequest & { tenantId: string }
): Promise<GetCredentialAssignmentsDetailsResponse> => {
  try {
    // Verify credential template exists
    const template =
      await credentialTemplateRepository.findCredentialTemplateById(
        credentialTemplateId,
        params.tenantId
      );
    if (!template) {
      throw new Error("CREDENTIAL_TEMPLATE_NOT_FOUND");
    }

    // Get teachers assigned to this credential template (optionally filtered by teacherId)
    const assignments =
      await teacherCredentialAssignmentRepository.findTeacherCredentialAssignments(
        {
          credentialTemplateId,
          tenantId: params.tenantId,
          ...(params.teacherId && { teacherId: params.teacherId }),
        }
      );

    // Get unique teacher IDs from assignments, ensuring they are valid strings
    const teacherIds = [
      ...new Set(
        assignments
          .map((a) => {
            const teacherId = a.teacherId;
            // Handle both ObjectId and populated object cases
            if (teacherId instanceof mongoose.Types.ObjectId) {
              return teacherId.toString();
            } else if (
              typeof teacherId === "object" &&
              teacherId !== null &&
              "_id" in teacherId
            ) {
              const populatedTeacher = teacherId as {
                _id: mongoose.Types.ObjectId | string;
              };
              return populatedTeacher._id.toString();
            } else if (typeof teacherId === "string") {
              return teacherId;
            }
            return null;
          })
          .filter(
            (id): id is string =>
              id !== null && mongoose.Types.ObjectId.isValid(id)
          )
      ),
    ];

    if (teacherIds.length === 0) {
      return {
        assignedTeachers: [],
        issuedToStudents: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
      };
    }

    // Fetch teacher names
    const teacherNames = await fetchUserNames(teacherIds);

    // Map assignments to response format
    const assignedTeachers = assignments.map((assignment) => {
      const teacherId = assignment.teacherId;
      // Handle both ObjectId and populated object cases
      let teacherIdStr: string;
      if (teacherId instanceof mongoose.Types.ObjectId) {
        teacherIdStr = teacherId.toString();
      } else if (
        typeof teacherId === "object" &&
        teacherId !== null &&
        "_id" in teacherId
      ) {
        const populatedTeacher = teacherId as {
          _id: mongoose.Types.ObjectId | string;
        };
        teacherIdStr = populatedTeacher._id.toString();
      } else {
        teacherIdStr = String(teacherId);
      }

      return {
        assignmentId: assignment._id.toString(),
        teacherId: teacherIdStr,
        teacherName: teacherNames[teacherIdStr] || "Unknown Teacher",
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        isActive: assignment.isActive,
      };
    });

    // Get credentials issued by these teachers
    // Filter by the credential template's meritBadge (credentialName) and credentialType
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;

    console.log("🔍 [CREDENTIAL ASSIGNMENTS] Filtering credentials by:", {
      templateId: credentialTemplateId,
      meritBadge: template.meritBadge,
      credentialType: template.credentialType,
      teacherIds: teacherIds.length,
      teacherIdsList: teacherIds,
    });

    // First, let's check what credentials exist for these teachers WITHOUT filtering
    // This will help us debug if the issue is with the filter or if no credentials exist
    const allCredentialsWithoutFilter =
      await examCredentialRepository.findCredentialsByTeacherIds(
        teacherIds,
        params.tenantId,
        1,
        100 // Get first 100 to see what exists
      );

    console.log("📋 [CREDENTIAL ASSIGNMENTS] All credentials (no filter):", {
      count: allCredentialsWithoutFilter.length,
      credentialNames: [
        ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialName)),
      ],
      credentialTypes: [
        ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialType)),
      ],
      sampleCredentials: allCredentialsWithoutFilter.slice(0, 5).map((c) => ({
        credentialId: c._id.toString(),
        credentialName: c.credentialName,
        credentialType: c.credentialType,
        studentId: c.studentId?.toString(),
      })),
    });

    // Compare template values with actual credential values
    if (allCredentialsWithoutFilter.length > 0) {
      const uniqueNames = [
        ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialName)),
      ];
      const uniqueTypes = [
        ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialType)),
      ];

      console.log("🔎 [CREDENTIAL ASSIGNMENTS] Template vs Actual Comparison:", {
        templateMeritBadge: template.meritBadge,
        templateCredentialType: template.credentialType,
        actualCredentialNames: uniqueNames,
        actualCredentialTypes: uniqueTypes,
        nameMatch: uniqueNames.some(
          (name) =>
            name.toLowerCase().trim() ===
            (template.meritBadge || "").toLowerCase().trim()
        ),
        typeMatch: uniqueTypes.some(
          (type) =>
            type.toLowerCase().trim() ===
            (template.credentialType || "").toLowerCase().trim()
        ),
      });
    }

    const credentials =
      await examCredentialRepository.findCredentialsByTeacherIds(
        teacherIds,
        params.tenantId,
        pageNo,
        pageSize,
        template.meritBadge, // Filter by template's meritBadge (matches credentialName)
        template.credentialType // Also filter by credentialType for additional matching
      );

    console.log("📊 [CREDENTIAL ASSIGNMENTS] Found credentials (with filter):", {
      count: credentials.length,
      credentialNames: credentials.map((c) => c.credentialName),
      credentialTypes: credentials.map((c) => c.credentialType),
    });

    // If no credentials found with filter but credentials exist without filter, warn
    if (credentials.length === 0 && allCredentialsWithoutFilter.length > 0) {
      console.warn(
        "⚠️ [CREDENTIAL ASSIGNMENTS] WARNING: Credentials exist but don't match template filters!",
        {
          templateMeritBadge: template.meritBadge,
          templateCredentialType: template.credentialType,
          actualCredentialNames: [
            ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialName)),
          ],
          actualCredentialTypes: [
            ...new Set(allCredentialsWithoutFilter.map((c) => c.credentialType)),
          ],
        }
      );
    }

    const totalCredentials =
      await examCredentialRepository.countCredentialsByTeacherIds(
        teacherIds,
        params.tenantId,
        template.meritBadge, // Filter by template's meritBadge
        template.credentialType // Also filter by credentialType
      );

    // Get credential IDs to map to teachers via activity logs, ensuring valid ObjectIds
    const credentialIds = credentials
      .map((c) => {
        const id = c._id;
        if (id instanceof mongoose.Types.ObjectId) {
          return id.toString();
        } else if (
          typeof id === "string" &&
          mongoose.Types.ObjectId.isValid(id)
        ) {
          return id;
        }
        return null;
      })
      .filter((id): id is string => id !== null);

    // Map credentials to teachers using activity logs, with fallback to createdBy
    const credentialToTeacherMap: Record<string, string> = {};
    if (credentialIds.length > 0) {
      try {
        const validCredentialObjectIds = credentialIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        if (validCredentialObjectIds.length > 0) {
          const activityLogs = await TeacherActivityLog.find({
            relatedEntityId: { $in: validCredentialObjectIds },
            activityType: "CredentialCreated",
            relatedEntityType: "Credential",
            tenantId: new mongoose.Types.ObjectId(params.tenantId),
          })
            .select("relatedEntityId teacherId")
            .lean();

          console.log("📋 [CREDENTIAL ASSIGNMENTS] Activity logs for credential mapping:", {
            count: activityLogs.length,
            credentialIds: validCredentialObjectIds.length,
          });

          activityLogs.forEach((log: any) => {
            const credentialId = log.relatedEntityId;
            const teacherId = log.teacherId;

            // Handle both ObjectId and string formats
            const credentialIdStr =
              credentialId instanceof mongoose.Types.ObjectId
                ? credentialId.toString()
                : credentialId?.toString();

            const teacherIdStr =
              teacherId instanceof mongoose.Types.ObjectId
                ? teacherId.toString()
                : teacherId?.toString();

            if (
              credentialIdStr &&
              teacherIdStr &&
              mongoose.Types.ObjectId.isValid(teacherIdStr)
            ) {
              credentialToTeacherMap[credentialIdStr] = teacherIdStr;
            }
          });

          // Fallback: If activity logs don't cover all credentials, use createdBy field
          credentials.forEach((credential) => {
            const credentialIdStr = credential._id.toString();
            // Only use createdBy if not already mapped from activity logs
            if (!credentialToTeacherMap[credentialIdStr] && credential.createdBy) {
              const createdBy: any = credential.createdBy;
              let teacherIdStr: string | undefined;
              
              if (createdBy instanceof mongoose.Types.ObjectId) {
                teacherIdStr = createdBy.toString();
              } else if (typeof createdBy === "string") {
                teacherIdStr = createdBy;
              } else if (createdBy && typeof createdBy.toString === "function") {
                teacherIdStr = createdBy.toString();
              }
              
              if (teacherIdStr && mongoose.Types.ObjectId.isValid(teacherIdStr)) {
                credentialToTeacherMap[credentialIdStr] = teacherIdStr;
                console.log(
                  "🔄 [CREDENTIAL ASSIGNMENTS] Using createdBy fallback for credential:",
                  credentialIdStr,
                  "teacher:",
                  teacherIdStr
                );
              }
            }
          });
        }
      } catch (error) {
        console.error("Error mapping credentials to teachers:", error);
      }
    }

    // Get student IDs and teacher IDs for name fetching, ensuring they are valid strings
    const studentIds = [
      ...new Set(
        credentials
          .map((c) => {
            const studentId = c.studentId;
            if (studentId instanceof mongoose.Types.ObjectId) {
              return studentId.toString();
            } else if (
              typeof studentId === "string" &&
              mongoose.Types.ObjectId.isValid(studentId)
            ) {
              return studentId;
            }
            console.warn("⚠️ [CREDENTIAL ASSIGNMENTS] Invalid studentId found:", {
              credentialId: c._id?.toString(),
              studentId: studentId,
              studentIdType: typeof studentId,
            });
            return null;
          })
          .filter((id): id is string => id !== null)
      ),
    ];

    console.log("👥 [CREDENTIAL ASSIGNMENTS] Student IDs extracted:", {
      totalCredentials: credentials.length,
      uniqueStudentIds: studentIds.length,
      studentIds: studentIds,
    });

    const allTeacherIds = [
      ...new Set(
        Object.values(credentialToTeacherMap).filter(
          (id) =>
            id && typeof id === "string" && mongoose.Types.ObjectId.isValid(id)
        )
      ),
    ];

    const allUserIds = [...new Set([...studentIds, ...allTeacherIds])];

    console.log("📞 [CREDENTIAL ASSIGNMENTS] Fetching user names for:", {
      totalUserIds: allUserIds.length,
      studentIds: studentIds.length,
      teacherIds: allTeacherIds.length,
    });

    // Fetch user names, defaulting to empty object if no IDs
    const userNames =
      allUserIds.length > 0 ? await fetchUserNames(allUserIds) : {};

    console.log("✅ [CREDENTIAL ASSIGNMENTS] User names fetched:", {
      totalNames: Object.keys(userNames).length,
      studentNamesCount: studentIds.filter((id) => userNames[id]).length,
      teacherNamesCount: allTeacherIds.filter((id) => userNames[id]).length,
    });

    // Map credentials to response format
    const issuedToStudents = credentials
      .map((credential) => {
        try {
          const exam = credential.examId as any;
          const teacherId = credentialToTeacherMap[credential._id.toString()] || "";

          // Safely extract studentId with validation
          let studentIdStr: string;
          const studentId = credential.studentId;
          if (studentId instanceof mongoose.Types.ObjectId) {
            studentIdStr = studentId.toString();
          } else if (
            typeof studentId === "string" &&
            mongoose.Types.ObjectId.isValid(studentId)
          ) {
            studentIdStr = studentId;
          } else {
            console.error("❌ [CREDENTIAL ASSIGNMENTS] Invalid studentId in credential:", {
              credentialId: credential._id?.toString(),
              studentId: studentId,
            });
            return null; // Skip this credential if studentId is invalid
          }

          return {
            credentialId: credential._id.toString(),
            credentialName: credential.credentialName,
            description: credential.description,
            credentialType: credential.credentialType,
            studentId: studentIdStr,
            studentName:
              userNames[studentIdStr] || "Unknown Student",
            teacherId: teacherId,
            teacherName: userNames[teacherId] || "Unknown Teacher",
            examId: credential.examId?.toString() || "",
            examTitle: exam?.examTitle || "Unknown Exam",
            issuedDate: credential.issuedDate,
            validUntil: credential.validUntil,
            verificationCode: credential.verificationCode,
            isActive: credential.isActive,
          };
        } catch (error) {
          console.error("❌ [CREDENTIAL ASSIGNMENTS] Error mapping credential:", {
            credentialId: credential._id?.toString(),
            error: error instanceof Error ? error.message : String(error),
          });
          return null; // Skip this credential if mapping fails
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    console.log("🎓 [CREDENTIAL ASSIGNMENTS] Final issuedToStudents:", {
      totalCredentials: credentials.length,
      mappedStudents: issuedToStudents.length,
      sampleStudentIds: issuedToStudents.slice(0, 3).map((s) => ({
        studentId: s.studentId,
        studentName: s.studentName,
      })),
    });

    // When teacherId is provided (teacher section), only send issuedToStudents in response
    return {
      assignedTeachers: params.teacherId ? [] : assignedTeachers,
      issuedToStudents,
      pagination: {
        total: totalCredentials,
        pageNo,
        pageSize,
        totalPages: Math.ceil(totalCredentials / pageSize),
      },
    };
  } catch (error) {
    console.error("Get credential assignments details error:", error);
    throw error;
  }
};

/**
 * Get teachers by class for credential assignment dropdown.
 * Returns minimal teacher data (id, firstName, lastName, name) only.
 * When credentialId and credentialCategory are provided, excludes teachers who already
 * have this credential (same category) assigned for this class.
 */
export const getTeachersByClassForCredentialAssignment = async (
  classId: string,
  tenantId: string,
  credentialId?: string,
  credentialCategory?: string
): Promise<{ id: string; firstName: string; lastName: string; name: string }[]> => {
  try {
    const result = await teacherService.getTeachersByClass(classId, tenantId);
    const teachers = result?.data || [];
    let list = teachers.map((t: any) => {
      const id = t._id?.toString() || t.id?.toString() || "";
      const firstName = t.firstName || "";
      const lastName = t.lastName || "";
      const name =
        t.name || `${firstName} ${lastName}`.trim() || "Unknown";
      return { id, firstName, lastName, name };
    });

    if (credentialId && credentialCategory) {
      const now = new Date();
      const assignedTeacherIds =
        await teacherCredentialAssignmentRepository.findAssignedTeacherIdsForClassAndCategory(
          credentialId,
          classId,
          credentialCategory,
          tenantId,
          now
        );
      const assignedSet = new Set(assignedTeacherIds);
      list = list.filter((t) => !assignedSet.has(t.id));
    }

    return list;
  } catch (error: any) {
    console.error(
      "Get teachers by class for credential assignment error:",
      error
    );
    throw error;
  }
};
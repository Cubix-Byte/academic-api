import * as examCredentialRepository from "../repositories/examCredential.repository";
import * as examRepository from "../repositories/exam.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as teacherCredentialAssignmentRepository from "../repositories/teacherCredentialAssignment.repository";
import * as activityLogService from "./activityLog.service";
import {
  buildActivityDescription,
  fetchUserNames,
} from "@/utils/activityLog.helper";
import { ExamCredential, TeacherActivityLog, Class } from "../models";
import { TeacherInfo } from "@/types/teacherCredentials.types";
import {
  CreateCredentialRequest,
  UpdateCredentialRequest,
  CredentialResponse,
  GetTeacherCredentialsRequest,
  GetTeacherCredentialsResponse,
  GetIssuedCredentialsResponse,
  EnhancedCredentialResponse,
  GetTeacherCredentialsByTeacherIdResponse,
} from "@/types/teacherCredentials.types";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { IssuedByFilter, CredentialCategory } from "@/utils/constants/credentialEnums";
import { UserApiIntegrationService } from "./userApiIntegration.service";

/**
 * Teacher Credentials Service - Business logic for credential management
 */

/**
 * Calculate validation period based on start and end dates
 * @param startDate - Start date of the credential assignment
 * @param endDate - End date of the credential assignment
 * @returns Validation period category: 'Monthly', 'Quarterly', 'Half-yearly', or 'Yearly'
 */
const calculateValidationPeriod = (
  startDate: Date,
  endDate: Date
): 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Categorize based on number of days
  if (diffDays <= 60) {
    return 'Monthly';
  } else if (diffDays <= 120) {
    return 'Quarterly';
  } else if (diffDays <= 240) {
    return 'Half-yearly';
  } else {
    return 'Yearly';
  }
};

// Create credentials
export const createCredentials = async (
  data: CreateCredentialRequest,
  teacherId: string,
  tenantId: string
): Promise<CredentialResponse[]> => {
  try {
    const category = data.credentialCategory || CredentialCategory.EXAM;

    // Verify exam exists if category is EXAM
    let exam: any = null;
    if (category === CredentialCategory.EXAM) {
      if (!data.examId) {
        throw new Error("EXAM_ID_REQUIRED");
      }
      exam = await examRepository.findExamById(data.examId);
      if (!exam) {
        throw new Error("EXAM_NOT_FOUND");
      }
    }

    // Create credentials for each student
    const credentials: CredentialResponse[] = [];

    // Fetch teacher details for createdBy field
    const teacher = await teacherRepository.findTeacherById(teacherId);
    const createdByInfo: TeacherInfo | undefined = teacher
      ? {
        id: teacher._id.toString(),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        thrId: teacher.thrId,
        profilePicture: teacher.profilePicture,
      }
      : undefined;

    // Fetch teacher and student names for logging
    const userIds = [teacherId, ...data.studentIds];
    const userNames = await fetchUserNames(userIds);
    const teacherName = userNames[teacherId] || "Teacher";

    for (const studentId of data.studentIds) {
      const credential = new ExamCredential({
        credentialName: data.credentialName,
        description: data.description || undefined,
        credentialType: data.credentialType,
        credentialCategory: category,
        credentialId: data.credentialId && mongoose.Types.ObjectId.isValid(data.credentialId)
          ? new mongoose.Types.ObjectId(data.credentialId)
          : undefined,
        classId: exam && (exam.classId as any)
          ? (exam.classId instanceof mongoose.Types.ObjectId ? exam.classId : new mongoose.Types.ObjectId(String((exam.classId as any)?._id ?? exam.classId)))
          : undefined,
        examId: exam ? new mongoose.Types.ObjectId(data.examId) : undefined,
        otherDetails: category === CredentialCategory.OTHER ? data.otherDetails : undefined,
        studentId: new mongoose.Types.ObjectId(studentId),
        issuedDate: data.issuedDate || new Date(),
        validUntil: data.validUntil,
        verificationCode: randomUUID(),
        isActive: true,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        createdBy: new mongoose.Types.ObjectId(teacherId),
        isDeleted: false,
      });

      const saved = await credential.save();



      credentials.push({
        credentialId: saved._id.toString(),
        credentialName: saved.credentialName,
        description: saved.description,
        credentialType: saved.credentialType,
        credentialCategory: saved.credentialCategory,
        examId: saved.examId?.toString(),
        otherDetails: saved.otherDetails,
        studentId: saved.studentId.toString(),
        issuedDate: saved.issuedDate,
        validUntil: saved.validUntil,
        verificationCode: saved.verificationCode,
        isActive: saved.isActive,
        createdBy: createdByInfo,
      });

      // Log CredentialCreated activity
      try {
        // Handle populated classId and subjectId
        const classIdString = exam && (exam.classId as any)?._id
          ? String((exam.classId as any)._id)
          : exam ? String(exam.classId) : undefined;
        const subjectIdString = exam && (exam.subjectId as any)?._id
          ? String((exam.subjectId as any)._id)
          : exam ? String(exam.subjectId) : undefined;

        const activityDescription = buildActivityDescription(
          teacherName,
          "CredentialCreated",
          data.credentialName
        );
        await activityLogService.createTeacherActivityLog({
          teacherId,
          activityType: "CredentialCreated",
          activityDescription,
          relatedEntityId: saved._id.toString(),
          relatedEntityType: "Credential",
          classId: classIdString || "",
          subjectId: subjectIdString || "",
          tenantId,
        });
      } catch (logError) {
        console.error("Error creating credential created log:", logError);
      }

      // Log CredentialAssigned activity (teacher perspective)
      try {
        // Handle populated classId and subjectId
        const classIdString = exam && (exam.classId as any)?._id
          ? String((exam.classId as any)._id)
          : exam ? String(exam.classId) : undefined;
        const subjectIdString = exam && (exam.subjectId as any)?._id
          ? String((exam.subjectId as any)._id)
          : exam ? String(exam.subjectId) : undefined;

        const studentName = userNames[studentId] || "Student";
        const activityDescription = buildActivityDescription(
          teacherName,
          "CredentialAssigned",
          data.credentialName,
          studentName
        );
        await activityLogService.createTeacherActivityLog({
          teacherId,
          activityType: "CredentialAssigned",
          activityDescription,
          relatedEntityId: saved._id.toString(),
          relatedEntityType: "Credential",
          classId: classIdString || "",
          subjectId: subjectIdString || "",
          studentId,
          tenantId,
        });
      } catch (logError) {
        console.error("Error creating credential assigned log:", logError);
      }

      // Log BadgeEarned/CertificateEarned activity (student perspective)
      try {
        // Handle populated classId and subjectId
        const classIdString = exam && (exam.classId as any)?._id
          ? String((exam.classId as any)._id)
          : exam ? String(exam.classId) : undefined;
        const subjectIdString = exam && (exam.subjectId as any)?._id
          ? String((exam.subjectId as any)._id)
          : exam ? String(exam.subjectId) : undefined;

        const studentName = userNames[studentId] || "Student";
        const activityType =
          data.credentialType === "Badge"
            ? "BadgeEarned"
            : data.credentialType === "Certificate"
              ? "CertificateEarned"
              : "BadgeEarned"; // Default to BadgeEarned
        const activityDescription = buildActivityDescription(
          studentName,
          activityType,
          data.credentialName
        );
        await activityLogService.createStudentActivityLog({
          studentId,
          activityType,
          activityDescription,
          relatedEntityId: saved._id.toString(),
          relatedEntityType: "Credential",
          classId: classIdString || "",
          subjectId: subjectIdString || "",
          tenantId,
        });
      } catch (logError) {
        console.error(
          "Error creating student credential earned log:",
          logError
        );
      }
    }



    // Trigger report regeneration for all students in parallel
    try {
      const { updateStudentReportOnCredential } = await import('./reportGenerator.service');

      // Correctly handle subjectId: if it exists (populated or not), ensure it's a string.
      // If it doesn't exist, it should remain undefined, NOT string "undefined".
      let subjectIdString: string | undefined;

      if (exam.subjectId) {
        subjectIdString = (exam.subjectId as any)?._id
          ? String((exam.subjectId as any)._id)
          : String(exam.subjectId);
      }

      console.log(`🚀 [Trigger] CredentialAssign: Triggering report updates for ${data.studentIds.length} students (Subject: ${subjectIdString || 'None'})...`);

      await Promise.all(
        data.studentIds.map(studentId =>
          updateStudentReportOnCredential(studentId, subjectIdString)
            .catch(err => console.error(`❌ [Trigger] CredentialAssign: Error updating report for student ${studentId}:`, err))
        )
      );

      console.log(`✅ [Trigger] CredentialAssign: Completed report updates for all students.`);
    } catch (error: any) {
      console.error("❌ [Trigger] CredentialAssign: Error in parallel report update batch:", error);
    }

    // ===== SEND NOTIFICATIONS FOR CREDENTIAL ASSIGNMENT TO STUDENTS =====
    // Send notifications to teacher, students, and parents
    try {
      const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
      const teacherIdString = teacherId?.toString ? teacherId.toString() : String(teacherId);
      const credentialName = data.credentialName || "Credential";
      const examTitle = exam.examTitle || "Exam";

      console.log("🔔 [TeacherCredentials] Preparing notifications (teacher -> students)", {
        tenantId: tenantIdString,
        teacherId: teacherIdString,
        credentialName,
        credentialType: data.credentialType,
        examId: data.examId,
        examTitle,
        studentCount: Array.isArray(data.studentIds) ? data.studentIds.length : 0,
      });

      // Validate IDs are valid ObjectIds
      if (!mongoose.Types.ObjectId.isValid(tenantIdString) || !mongoose.Types.ObjectId.isValid(teacherIdString)) {
        console.warn("⚠️ Invalid tenantId or teacherId, skipping credential assignment notifications");
      } else {
        const notifications: any[] = [];

        // 1. Send notification to teacher who assigned the credentials
        notifications.push({
          receiverId: teacherIdString,
          receiverRole: "TEACHER",
          title: "Credentials Assigned Successfully",
          content: `You have successfully assigned "${credentialName}" credential to ${data.studentIds.length} student(s).`,
          senderId: undefined, // No sender for system notifications
          senderRole: "SYSTEM",
          tenantId: tenantIdString,
          meta: {
            entityType: "Credential",
            credentialName: credentialName,
            credentialType: data.credentialType,
            examId: data.examId,
            examTitle: examTitle,
            studentCount: data.studentIds.length,
            studentIds: data.studentIds,
          },
        });

        // 2. Send notification to each student
        data.studentIds.forEach((studentId) => {
          const studentIdString = studentId?.toString ? studentId.toString() : String(studentId);
          if (mongoose.Types.ObjectId.isValid(studentIdString)) {
            const studentName = userNames[studentId] || "Student";
            const contextText = category === CredentialCategory.OTHER ? (data.otherDetails || "Other") : examTitle;
            notifications.push({
              receiverId: studentIdString,
              receiverRole: "STUDENT",
              title: "Credential Earned!",
              content: `Congratulations ${studentName}! You have earned the "${credentialName}" credential for ${contextText}.`,
              senderId: teacherIdString,
              senderRole: "TEACHER",
              tenantId: tenantIdString,
              meta: {
                entityType: "Credential",
                credentialName: credentialName,
                credentialType: data.credentialType,
                credentialCategory: category,
                examId: exam ? data.examId : undefined,
                examTitle: exam ? examTitle : undefined,
                otherDetails: category === CredentialCategory.OTHER ? data.otherDetails : undefined,
                studentId: studentIdString,
                studentName: studentName,
              },
            });
          }
        });

        // 3. Get parents for each student and send notifications to them
        const parentIds = new Set<string>();
        const parentToChildNames = new Map<string, Set<string>>();
        for (const studentId of data.studentIds) {
          try {
            const { getParentsByChildId } = await import("./parentChild.service");
            const parentsResult = await getParentsByChildId(studentId);
            if (parentsResult.success && parentsResult.data && Array.isArray(parentsResult.data)) {
              const parents = parentsResult.data;
              parents.forEach((parentRel: any) => {
                const parent = parentRel.parentId;
                if (parent && parent._id) {
                  const parentId = parent._id.toString();
                  // Validate parentId is a valid ObjectId
                  if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
                    parentIds.add(parentId);

                    // Track which child(ren) belong to this parent for a personalized message
                    const childName = userNames[studentId] || "Student";
                    if (!parentToChildNames.has(parentId)) {
                      parentToChildNames.set(parentId, new Set<string>());
                    }
                    parentToChildNames.get(parentId)!.add(childName);
                  }
                }
              });
            }
          } catch (parentError: any) {
            console.warn(`⚠️ Could not fetch parents for student ${studentId}:`, parentError.message);
          }
        }

        console.log("👪 [TeacherCredentials] Parent recipients resolved", {
          studentCount: Array.isArray(data.studentIds) ? data.studentIds.length : 0,
          uniqueParentCount: parentIds.size,
        });

        // Send notification to each parent (include child name(s))
        parentIds.forEach((parentId) => {
          const childNamesForParent = parentToChildNames.get(parentId);
          const childNamesText =
            childNamesForParent && childNamesForParent.size > 0
              ? Array.from(childNamesForParent).join(", ")
              : "your child";
          const contextText = category === CredentialCategory.OTHER ? (data.otherDetails || "Other") : examTitle;
          notifications.push({
            receiverId: parentId,
            receiverRole: "PARENT",
            title: `Your Child ${childNamesText} Earned a Credential!`,
            content: `Congratulations! Your child ${childNamesText} has earned the "${credentialName}" credential for ${contextText}.`,
            senderId: teacherIdString,
            senderRole: "TEACHER",
            tenantId: tenantIdString,
            meta: {
              entityType: "Credential",
              credentialName: credentialName,
              credentialType: data.credentialType,
              credentialCategory: category,
              examId: exam ? data.examId : undefined,
              examTitle: exam ? examTitle : undefined,
              otherDetails: category === CredentialCategory.OTHER ? data.otherDetails : undefined,
              studentCount: data.studentIds.length,
              studentIds: data.studentIds,
              childNames: childNamesForParent ? Array.from(childNamesForParent) : undefined,
            },
          });
        });

        // Send all notifications in batches (API limit is 100)
        if (notifications.length > 0) {
          console.log("🧾 [TeacherCredentials] Notifications prepared (teacher -> students)", {
            totalNotifications: notifications.length,
            studentNotificationCount: Array.isArray(data.studentIds) ? data.studentIds.length : 0,
            parentNotificationCount: parentIds.size,
            includesTeacherConfirmation: true,
            sampleReceivers: notifications.slice(0, 5).map((n: any) => ({
              receiverId: n.receiverId,
              receiverRole: n.receiverRole,
              title: n.title,
            })),
          });

          console.log(`📤 Sending ${notifications.length} notification(s) for credential assignment to students...`);
          const { sendNotifications } = await import("./notification.service");
          const batchSize = 100;
          for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            sendNotifications(batch)
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
      // Log error but don't fail the credential creation
      console.error(
        "⚠️ Error preparing credential assignment notifications:",
        notificationError.message
      );
    }

    return credentials;
  } catch (error) {
    console.error("Create credentials error:", error);
    throw error;
  }
};

// Update credential
export const updateCredential = async (
  data: UpdateCredentialRequest,
  teacherId: string
): Promise<CredentialResponse> => {
  try {
    const credential = await examCredentialRepository.findCredentialById(
      data.credentialId
    );
    if (!credential) {
      throw new Error("CREDENTIAL_NOT_FOUND");
    }

    // Update fields
    if (data.isActive !== undefined) {
      credential.isActive = data.isActive;
    }
    if (data.validUntil !== undefined) {
      credential.validUntil = data.validUntil;
    }

    const updated = await credential.save();

    // Populate createdBy if it exists
    await updated.populate(
      "createdBy",
      "firstName lastName email thrId profilePicture"
    );
    const createdByTeacher = updated.createdBy as any;
    const createdByInfo: TeacherInfo | undefined = createdByTeacher
      ? {
        id:
          createdByTeacher._id?.toString() || createdByTeacher.id?.toString(),
        firstName: createdByTeacher.firstName || "",
        lastName: createdByTeacher.lastName || "",
        email: createdByTeacher.email || "",
        thrId: createdByTeacher.thrId,
        profilePicture: createdByTeacher.profilePicture,
      }
      : undefined;

    return {
      credentialId: updated._id.toString(),
      credentialName: updated.credentialName,
      description: updated.description,
      credentialType: updated.credentialType,
      credentialCategory: updated.credentialCategory,
      examId: updated.examId?.toString(),
      otherDetails: updated.otherDetails,
      studentId: updated.studentId.toString(),
      issuedDate: updated.issuedDate,
      validUntil: updated.validUntil,
      verificationCode: updated.verificationCode,
      isActive: updated.isActive,
      createdBy: createdByInfo,
    };
  } catch (error) {
    console.error("Update credential error:", error);
    throw error;
  }
};

// Delete credential
export const deleteCredential = async (
  credentialId: string,
  teacherId: string
): Promise<void> => {
  try {
    const credential = await examCredentialRepository.findCredentialById(
      credentialId
    );
    if (!credential) {
      throw new Error("CREDENTIAL_NOT_FOUND");
    }

    credential.isDeleted = true;
    await credential.save();
  } catch (error) {
    console.error("Delete credential error:", error);
    throw error;
  }
};

// Get teacher credentials (original - for backward compatibility)
export const getTeacherCredentials = async (
  params: GetTeacherCredentialsRequest & { tenantId: string }
): Promise<GetTeacherCredentialsResponse> => {
  try {
    // Build query
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      isDeleted: false,
    };

    if (params.examId) {
      query.examId = new mongoose.Types.ObjectId(params.examId);
    }
    if (params.studentId) {
      query.studentId = new mongoose.Types.ObjectId(params.studentId);
    }
    if (params.isActive !== undefined) {
      query.isActive = params.isActive;
    }

    const credentials = await ExamCredential.find(query)
      .populate(
        "createdBy",
        "firstName lastName email thrId profilePicture"
      )
      .sort({ issuedDate: -1 });

    // Map to response
    const credentialResponses: CredentialResponse[] = credentials.map((c) => {
      const createdByTeacher = c.createdBy as any;
      const createdByInfo = createdByTeacher
        ? {
          id:
            createdByTeacher._id?.toString() ||
            createdByTeacher.id?.toString(),
          firstName: createdByTeacher.firstName || "",
          lastName: createdByTeacher.lastName || "",
          email: createdByTeacher.email || "",
          thrId: createdByTeacher.thrId,
          profilePicture: createdByTeacher.profilePicture,
        }
        : undefined;

      return {
        credentialId: c._id.toString(),
        credentialName: c.credentialName,
        description: c.description,
        credentialType: c.credentialType,
        credentialCategory: c.credentialCategory,
        examId: c.examId?.toString(),
        otherDetails: c.otherDetails,
        studentId: c.studentId.toString(),
        issuedDate: c.issuedDate,
        validUntil: c.validUntil,
        verificationCode: c.verificationCode,
        isActive: c.isActive,
        createdBy: createdByInfo,
      };
    });

    // Pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedCredentials = credentialResponses.slice(
      startIndex,
      startIndex + pageSize
    );

    return {
      credentials: paginatedCredentials,
      pagination: {
        total: credentialResponses.length,
        pageNo: pageNo,
        pageSize: pageSize,
        totalPages: Math.ceil(credentialResponses.length / pageSize),
      },
    };
  } catch (error) {
    console.error("Get teacher credentials error:", error);
    throw error;
  }
};

// Get issued credentials with enhanced filters and data enrichment
export const getIssuedCredentials = async (params: {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  classId?: string; // For post-query filtering
  teacherId?: string; // For post-query filtering (filters by teacher who issued)
  issuedBy?: string; // For post-query filtering (backward compatibility)
}): Promise<GetIssuedCredentialsResponse> => {
  try {
    // Check if we need post-query filtering (classId, teacherId, or issuedBy)
    // If so, we need to fetch ALL records first, then filter and paginate
    const needsPostQueryFiltering = !!(
      params.classId ||
      params.teacherId ||
      params.issuedBy
    );

    // Get credentials with basic filters
    // Don't apply pagination at DB level if we need post-query filtering
    let credentials = await examCredentialRepository.findIssuedCredentials({
      tenantId: params.tenantId,
      pageNo: needsPostQueryFiltering ? undefined : params.pageNo,
      pageSize: needsPostQueryFiltering ? undefined : params.pageSize,
      filters: params.filters,
      sort: params.sort,
    });

    // Apply classId filter (requires exam data)
    if (params.classId) {
      credentials = credentials.filter((cred) => {
        const exam = cred.examId as any;
        return exam?.classId?.toString() === params.classId;
      });
    }

    // Get all unique IDs for batch fetching
    const studentIds = [
      ...new Set(credentials.map((c) => c.studentId.toString())),
    ];
    const examIds = [...new Set(credentials.map((c) => c.examId?.toString()).filter((id) => id))];
    const credentialIds = credentials.map((c) => c._id.toString());

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
            const fullName = `${user.firstName || ""} ${user.lastName || ""
              }`.trim();
            studentNameMap[userId] = fullName || "Unknown Student";
          }
        });
      }
    } catch (error) {
      console.error("Error fetching student names:", error);
    }

    // Fetch class names
    const classNameMap: Record<string, string> = {};
    try {
      const { Class } = await import("../models");
      const uniqueClassIds = [
        ...new Set(
          credentials
            .map((c) => {
              const exam = c.examId as any;
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

    // Fetch issuedBy from activity logs
    const issuedByMap: Record<string, string> = {};
    try {
      const activityLogs = await TeacherActivityLog.find({
        relatedEntityId: {
          $in: credentialIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        activityType: "CredentialCreated",
        relatedEntityType: "Credential",
        tenantId: new mongoose.Types.ObjectId(params.tenantId), // Add tenant filter
      })
        .select("relatedEntityId teacherId")
        .populate("teacherId", "firstName lastName")
        .lean();

      // Get unique teacher IDs
      const teacherIds = [
        ...new Set(
          activityLogs
            .map(
              (log: any) =>
                log.teacherId?._id?.toString() || log.teacherId?.toString()
            )
            .filter((id) => id)
        ),
      ];

      // Fetch teacher names
      const teacherNames = await fetchUserNames(teacherIds);

      // Map credential ID to teacher name
      activityLogs.forEach((log: any) => {
        const credentialId = log.relatedEntityId?.toString();
        const teacherId =
          log.teacherId?._id?.toString() || log.teacherId?.toString();
        if (credentialId && teacherId) {
          // Use "Teacher" instead of "Unknown Teacher" to ensure it counts as teacher-generated
          issuedByMap[credentialId] = teacherNames[teacherId] || "Teacher";
        }
      });
    } catch (error) {
      console.error("Error fetching issuedBy from activity logs:", error);
    }

    // Map createdBy teachers for all credentials
    const createdByMap: Record<string, TeacherInfo> = {};
    credentials.forEach((cred: any) => {
      const credentialId = cred._id.toString();
      const createdByTeacher = cred.createdBy;
      if (createdByTeacher) {
        createdByMap[credentialId] = {
          id:
            createdByTeacher._id?.toString() || createdByTeacher.id?.toString(),
          firstName: createdByTeacher.firstName || "",
          lastName: createdByTeacher.lastName || "",
          email: createdByTeacher.email || "",
          thrId: createdByTeacher.thrId,
          profilePicture: createdByTeacher.profilePicture,
        };
      }
    });

    // Map to enhanced response
    let enhancedCredentials: EnhancedCredentialResponse[] = credentials.map(
      (cred) => {
        const exam = cred.examId as any;
        const classId = exam?.classId?.toString();
        const credentialId = cred._id.toString();

        return {
          credentialId,
          credentialName: cred.credentialName,
          credentialType: cred.credentialType,
          credentialCategory: cred.credentialCategory,
          className: classId ? classNameMap[classId] : undefined,
          issuedBy: issuedByMap[credentialId] || "Percipio Ai",
          dateIssued: cred.issuedDate,
          studentName:
            studentNameMap[cred.studentId.toString()] || "Unknown Student",
          studentId: cred.studentId.toString(),
          examId: cred.examId?.toString(),
          otherDetails: cred.otherDetails,
          description: cred.description,
          validUntil: cred.validUntil,
          isActive: cred.isActive,
          createdBy: createdByMap[credentialId],
        };
      }
    );

    // Apply teacherId filter (filter by specific teacher who issued the credential)
    if (params.teacherId) {
      // Get teacher name from teacherId
      const teacherNames = await fetchUserNames([params.teacherId]);
      const teacherName = teacherNames[params.teacherId];

      if (teacherName) {
        // Filter by teacher name
        enhancedCredentials = enhancedCredentials.filter(
          (c) =>
            c.issuedBy.toLowerCase() === teacherName.toLowerCase() ||
            c.issuedBy.toLowerCase().includes(teacherName.toLowerCase())
        );
      } else {
        // If teacher not found, filter out all (no matches)
        enhancedCredentials = [];
      }
    }

    // Apply issuedBy filter (backward compatibility)
    if (params.issuedBy && params.issuedBy !== "All") {
      if (params.issuedBy === IssuedByFilter.TEACHERS) {
        enhancedCredentials = enhancedCredentials.filter(
          (c) => c.issuedBy !== "Percipio Ai"
        );
      } else if (params.issuedBy === IssuedByFilter.AI_GENERATED) {
        enhancedCredentials = enhancedCredentials.filter(
          (c) => c.issuedBy === "Percipio Ai"
        );
      } else {
        // Specific teacher name
        enhancedCredentials = enhancedCredentials.filter((c) =>
          c.issuedBy.toLowerCase().includes(params.issuedBy!.toLowerCase())
        );
      }
    }

    // Handle pagination based on whether we applied post-query filtering
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    let total: number;
    let paginatedCredentials: EnhancedCredentialResponse[];

    if (needsPostQueryFiltering) {
      // Post-query filtering was applied, so we need to paginate in memory
      // Get total count from filtered results
      total = enhancedCredentials.length;
      const startIndex = (pageNo - 1) * pageSize;
      paginatedCredentials = enhancedCredentials.slice(
        startIndex,
        startIndex + pageSize
      );
    } else {
      // No post-query filtering, pagination was done at DB level
      // Get total count from database
      total = await examCredentialRepository.countIssuedCredentials({
        tenantId: params.tenantId,
        filters: params.filters,
      });
      // Credentials are already paginated from DB
      paginatedCredentials = enhancedCredentials;
    }

    return {
      credentials: paginatedCredentials,
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get issued credentials error:", error);
    throw error;
  }
};

// Get teacher credentials by teacher ID (assigned + issued)
export const getTeacherCredentialsByTeacherId = async (
  teacherId: string,
  tenantId: string
): Promise<GetTeacherCredentialsByTeacherIdResponse> => {
  try {
    // Validate inputs
    if (!teacherId || typeof teacherId !== "string") {
      throw new Error("Teacher ID is required");
    }

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Tenant ID is required");
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      throw new Error("Invalid Teacher ID format");
    }

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error("Invalid Tenant ID format");
    }

    // 1. Get credentials assigned to this teacher (from TeacherCredentialAssignment)
    const assignments =
      await teacherCredentialAssignmentRepository.findTeacherCredentialAssignments(
        {
          teacherId,
          tenantId,
        }
      );

    // Get teacher names for assigned credentials
    const assignedTeacherIds = [...new Set(assignments.map((a: any) => {
      const teacher = a.teacherId as any;
      return teacher?._id?.toString() || teacher?.toString() || a.teacherId?.toString();
    }).filter((id: string | undefined) => id))];
    const assignedTeacherNames = await fetchUserNames(assignedTeacherIds);

    // Get template creator names for assigned credentials
    const templateCreatorIds = [...new Set(assignments.map((a: any) => {
      const template = a.credentialTemplateId as any;
      const creator = template?.createdBy;
      if (creator) {
        return creator._id?.toString() || creator?.toString();
      }
      return null;
    }).filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id)))];
    const templateCreatorNames = await fetchUserNames(templateCreatorIds);

    // Fetch class names for assigned credentials (classId -> className)
    const assignedClassIds = [...new Set(
      assignments
        .map((a: any) => {
          const cid = a.classId;
          if (!cid) return null;
          return typeof cid === "object" && cid?.toString ? cid.toString() : String(cid);
        })
        .filter((id: string | null) => id && mongoose.Types.ObjectId.isValid(id))
    )];
    const assignedClassNameMap: Record<string, string> = {};
    try {
      if (assignedClassIds.length > 0) {
        const classes = await Class.find({
          _id: { $in: assignedClassIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select("_id name")
          .lean();
        classes.forEach((cls: any) => {
          assignedClassNameMap[cls._id.toString()] = cls.name || "Unknown Class";
        });
      }
    } catch (error) {
      console.error("Error fetching class names for assigned credentials:", error);
    }

    // Format assigned credentials
    const assignedCredentials = assignments.map((assignment: any) => {
      const template = assignment.credentialTemplateId as any;
      const teacher = assignment.teacherId as any;
      const teacherId = teacher?._id?.toString() || teacher?.toString() || assignment.teacherId?.toString();
      const creator = template?.createdBy as any;
      const creatorId = creator?._id?.toString() || creator?.toString();
      const classId = assignment.classId ? assignment.classId.toString() : undefined;

      return {
        assignmentId: assignment._id.toString(),
        credentialTemplateId: assignment.credentialTemplateId?._id?.toString() || assignment.credentialTemplateId?.toString(),
        credentialTemplateName: template?.meritBadge || undefined,
        credentialType: template?.credentialType || undefined,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        isActive: assignment.isActive,
        validationPeriod: calculateValidationPeriod(assignment.startDate, assignment.endDate),
        issuedBy: creatorId ? (templateCreatorNames[creatorId] || 'Unknown') : 'Unknown',
        issuedTo: teacherId ? (assignedTeacherNames[teacherId] || 'Unknown Teacher') : 'Unknown Teacher',
        credentialInfo: template?.credentialInfo || undefined,
        classId: classId || undefined,
        className: classId ? (assignedClassNameMap[classId] || undefined) : undefined,
        credentialCategory: assignment.credentialCategory || undefined,
      };
    });

    // 2. Get credentials issued by this teacher to students (from ExamCredential)
    // Find credentials where createdBy = teacherId
    const issuedCredentialsDocs = await ExamCredential.find({
      createdBy: new mongoose.Types.ObjectId(teacherId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    })
      .populate("examId", "examTitle classId subjectId")
      .populate(
        "createdBy",
        "firstName lastName email thrId profilePicture"
      )
      .sort({ issuedDate: -1 })
      .lean();

    // Get unique student IDs and class IDs for batch fetching
    const studentIds = [
      ...new Set(issuedCredentialsDocs.map((c: any) => c.studentId.toString())),
    ];
    const classIds = [
      ...new Set(
        issuedCredentialsDocs
          .map((c: any) => {
            const exam = c.examId as any;
            return exam?.classId?.toString();
          })
          .filter((id: string | undefined) => id)
      ),
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
            const fullName = `${user.firstName || ""} ${user.lastName || ""
              }`.trim();
            studentNameMap[userId] = fullName || "Unknown Student";
          }
        });
      }
    } catch (error) {
      console.error("Error fetching student names:", error);
    }

    // Fetch class names
    const classNameMap: Record<string, string> = {};
    try {
      if (classIds.length > 0) {
        const classes = await Class.find({
          _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
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

    // Get teacher names for issued credentials (issuedBy)
    const issuedByTeacherIds = [...new Set(issuedCredentialsDocs.map((cred: any) => {
      const teacher = cred.createdBy as any;
      return teacher?._id?.toString() || teacher?.toString() || cred.createdBy?.toString();
    }).filter((id: string | undefined) => id))];
    const issuedByTeacherNames = await fetchUserNames(issuedByTeacherIds);

    // Format issued credentials
    const issuedCredentials = issuedCredentialsDocs.map((cred: any) => {
      const exam = cred.examId as any;
      const classId = exam?.classId?.toString();
      const studentId = cred.studentId.toString();

      // Extract examId - handle both populated object and ObjectId
      let examId: string | undefined;
      if (exam) {
        if (exam._id) {
          examId = exam._id.toString();
        } else if (typeof exam.toString === 'function') {
          examId = exam.toString();
        }
      } else if (cred.examId) {
        examId = cred.examId.toString();
      }

      const createdByTeacher = cred.createdBy as any;
      const createdByTeacherId = createdByTeacher?._id?.toString() || createdByTeacher?.toString() || cred.createdBy?.toString();

      return {
        credentialId: cred._id.toString(),
        credentialName: cred.credentialName,
        description: cred.description,
        credentialType: cred.credentialType,
        credentialCategory: cred.credentialCategory,
        examId: examId,
        examTitle: exam?.examTitle || undefined,
        other: cred.other,
        studentId: studentId,
        studentName: studentNameMap[studentId] || undefined,
        className: classId ? classNameMap[classId] : undefined,
        issuedDate: cred.issuedDate,
        validUntil: cred.validUntil || undefined,
        verificationCode: cred.verificationCode,
        isActive: cred.isActive,
        issuedBy: createdByTeacherId ? (issuedByTeacherNames[createdByTeacherId] || 'Unknown') : 'Unknown',
        credentialInfo: cred.description || undefined,
      };
    });

    return {
      assignedCredentials,
      issuedCredentials: issuedCredentials as any,
    };
  } catch (error: any) {
    console.error("Get teacher credentials by teacher ID error:", error);
    throw new Error(`Failed to get teacher credentials: ${error.message}`);
  }
};

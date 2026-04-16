import * as teacherRepository from "../repositories/teacher.repository";
import { TeacherAssignClassesRepository } from "@/repositories/teacherAssignClasses.repository";
import {
  CreateTeacherRequest,
  UpdateTeacherRequest,
  GetMyClassDetailResponse,
} from "@/types";

import * as examRepository from "../repositories/exam.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import * as studentRepository from "../repositories/student.repository";
import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import { calculateGradeFromPercentage } from "./gradingSystem.service";
import mongoose, { SortOrder } from "mongoose";
import { HttpStatusCodes } from "@/utils/shared-lib-imports";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { Class, Subject, Teacher, TeacherAssignClasses } from "@/models";
import * as notificationService from "./notification.service";
import { getRoleDisplayNameForTenant, sendWelcomeEmail } from "@/utils/email.helper";
import { generateRandomPassword } from "@/utils/password.helper";
import { ContentLibraryService } from "./contentLibrary.service";
import { SYLLABUS_FOLDER_NAME } from "@/utils/constants/contentLibrary.constants";
import { assertSeatAvailable } from "@/utils/seatsNlicense.helper";

/**
 * Teacher Service - Business logic for teacher management
 * Handles teacher CRUD operations
 */

// Create new teacher (simplified without transaction)
export const createTeacher = async (
  data: CreateTeacherRequest,
  tenantId: string,
  tenantName?: string,
  createdBy?: string,
  createdByRole?: string
) => {
  return await createTeacherWithSession(data, tenantId, tenantName, undefined, createdBy, createdByRole);
};

// Create new teacher with session (for transaction support)
export const createTeacherWithSession = async (
  data: CreateTeacherRequest,
  tenantId: string,
  tenantName?: string,
  session?: mongoose.ClientSession,
  createdBy?: string,
  createdByRole?: string
) => {
  // Declare userIdForCleanup at function level for cleanup in catch block
  let userIdForCleanup: string | null = null;

  try {
    const finalTenantName = tenantName;
    if (!finalTenantName) {
      throw new Error("Tenant name is required");
    }

    console.log("✅ Using tenant name:", finalTenantName);

    // Enforce seats/quota (0 means unlimited)
    await assertSeatAvailable({ tenantId, type: "teacher", requested: 1 });

    // ===== STEP 1: ALL VALIDATIONS FIRST =====
    console.log("🔍 Starting comprehensive validation...");

    // Basic required field validation
    if (!data.email) {
      throw new Error("Email is required for teacher creation");
    }
    // Generate random password if not provided
    if (!data.password || data.password.trim().length === 0) {
      data.password = generateRandomPassword();
    }
    if (!data.firstName) {
      throw new Error("First name is required for teacher creation");
    }
    if (!data.lastName) {
      throw new Error("Last name is required for teacher creation");
    }
    if (!data.gender) {
      throw new Error("Gender is required for teacher creation");
    }

    // Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Invalid email format");
    }

    // Password strength validation
    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Phone number validation (if provided)
    if (data.phoneNumber && !/^[\+]?[0-9\-\s]{10,20}$/.test(data.phoneNumber)) {
      throw new Error(
        "Invalid phone number format. Must be 10-20 characters with optional + prefix"
      );
    }

    // Check for existing teacher with same email
    console.log("🔍 Checking for existing teacher with email:", data.email);
    const existingTeacherByEmail = await teacherRepository.findTeacherByEmail(
      data.email,
      tenantId
    );
    if (existingTeacherByEmail) {
      throw new Error(
        `Teacher with email ${data.email} already exists in this tenant`
      );
    }

    // Check if user already exists in user-api BEFORE creating
    console.log("🔍 Initial check: Checking if user exists in user-api...");
    const username = data.email.toLowerCase();
    try {
      const userExistsCheck = await UserApiIntegrationService.checkUserExists(
        data.email,
        username,
        tenantId
      );
      if (userExistsCheck.exists) {
        throw new Error(
          `User with email ${data.email} already exists in user-api for this tenant. Please use a different email.`
        );
      }
      console.log("✅ User does not exist in user-api, safe to create");
    } catch (checkError: any) {
      // If checkUserExists throws an error about user existing, re-throw it
      if (
        checkError.message.includes("already exists") ||
        checkError.message.includes("USERNAME_EXISTS") ||
        checkError.message.includes("EMAIL_EXISTS") ||
        checkError.message.includes("exists in user-api")
      ) {
        throw checkError;
      }
      // For other errors (like network issues), log but continue - we'll catch it during creation
      console.warn(
        "⚠️ User existence check had an issue, but continuing:",
        checkError.message
      );
    }

    console.log("✅ All validations passed - no conflicts found");

    // ===== STEP 2: FINAL VALIDATION CHECK RIGHT BEFORE CREATION =====
    // Re-validate everything one more time to catch any race conditions
    console.log(
      "🔍 Final validation check before creation (to catch race conditions)..."
    );

    // Re-check teacher email
    const finalCheckTeacherByEmail = await teacherRepository.findTeacherByEmail(
      data.email,
      tenantId
    );
    if (finalCheckTeacherByEmail) {
      throw new Error(
        `Teacher with email ${data.email} already exists in this tenant (race condition detected)`
      );
    }

    // Re-check user existence in user-api
    const finalUserExistsCheck =
      await UserApiIntegrationService.checkUserExists(
        data.email,
        username,
        tenantId
      );
    if (finalUserExistsCheck.exists) {
      throw new Error(
        `User with email ${data.email} already exists in user-api for this tenant (race condition detected). Please use a different email.`
      );
    }

    console.log("✅ Final validation passed - safe to proceed with creation");

    // ===== STEP 3: GENERATE ID AFTER VALIDATION =====
    const sharedId = new mongoose.Types.ObjectId();
    console.log(
      "🆔 Generated shared ID for user and teacher:",
      sharedId.toString()
    );

    // ===== STEP 4: CREATE USER RECORD IN USER-API =====
    // Only create user AFTER all validations pass (both initial and final)
    console.log("👤 Creating user record in user-api...");
    const userData = {
      _id: sharedId, // Use the shared ID
      username: data.email.toLowerCase(), // Use email as username
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password, // Use provided password (now mandatory)
      phoneNumber: data.phoneNumber,
      tenantId: tenantId,
      tenantName: finalTenantName,
      userType: "teacher",
      roleName: "TEACHER", // Will be resolved to role ID in user-api
      userAccessType: "private",
      isEmailVerified: false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: "academic-api", // Add required createdBy field
    };

    let user;
    try {
      console.log(
        "📤 Sending user data to user-api:",
        JSON.stringify(userData, null, 2)
      );
      user = await UserApiIntegrationService.createUser(userData);

      // Extract user ID from response (handle different response structures)
      const userId =
        user?.data?.user?.id ||
        user?.data?.id ||
        user?.id ||
        user?.data?.user?._id ||
        user?.data?._id ||
        user?._id ||
        sharedId.toString();

      // Store user ID immediately for reliable cleanup
      userIdForCleanup = userId;
      console.log("✅ User created successfully. User ID:", userId);
      console.log("🔍 User response data:", JSON.stringify(user, null, 2));

      // Ensure user object has id property for later use
      if (!user.id && userId) {
        user.id = userId;
      }
    } catch (userError: any) {
      console.error("❌ Failed to create user in user-api:", userError.message);
      console.error("❌ User creation error details:", {
        message: userError.message,
        response: userError.response?.data,
        status: userError.response?.status,
        statusText: userError.response?.statusText,
      });

      // Handle 409 Conflict (USERNAME_EXISTS or EMAIL_EXISTS)
      if (
        userError.response?.status === 409 ||
        userError.message.includes("409") ||
        userError.message.includes("USERNAME_EXISTS") ||
        userError.message.includes("EMAIL_EXISTS") ||
        userError.message.includes("Conflict")
      ) {
        const errorDetails =
          userError.response?.data?.message || userError.message;
        throw new Error(
          `User with email ${data.email} already exists in user-api. ${errorDetails}. Please use a different email.`
        );
      }

      // Handle other errors
      const errorMessage =
        userError.response?.data?.message || userError.message;
      throw new Error(`Failed to create user in user-api: ${errorMessage}`);
    }

    // ===== STEP 5: CREATE TEACHER RECORD =====
    // All validations already completed above (both initial and final checks)
    console.log("👨‍🏫 Creating teacher record in academy-api...");
    let teacher: any = null;

    // Use stored userIdForCleanup or extract from user object
    const userId =
      userIdForCleanup ||
      user?.data?.user?.id ||
      user?.data?.id ||
      user?.id ||
      user?.data?.user?._id ||
      user?.data?._id ||
      user?._id ||
      sharedId.toString();

    // Start a session so teacher creation runs in a transaction.
    const mongoSession = await mongoose.startSession();

    const teacherData = {
      _id: sharedId, // Use the same shared ID
      userId: new mongoose.Types.ObjectId(userId), // Set userId to match user record
      // Core required fields
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      address: data.address,
      gender: data.gender,
      joiningDate: new Date(data.joiningDate || new Date()),
      qualification: data.qualification,
      specialization: data.specialization,
      experience: data.experience,
      emergencyContact: data.emergencyContact,
      emergencyPhone: data.emergencyPhone,
      designation: data.designation,
      demoPassword: data.password, // Use the mandatory password
      department: data.department || "",
      salary: data.salary || 0,
      bio: data.bio || "",
      achievements: data.achievements || [],
      certifications: data.certifications || [],
      assignedClasses: [],
      assignedSubjects: [],
      documents: Array.isArray(data.documents)
        ? data.documents
          .map((doc: any) => {
            if (!doc || typeof doc !== "object") return null;
            const mappedDoc: any = {
              name: (doc as any).name,
              type: (doc as any).type,
              url: (doc as any).url,
            };
            // Preserve uploadedAt if provided; schema will default if missing
            if ((doc as any).uploadedAt) {
              mappedDoc.uploadedAt = new Date((doc as any).uploadedAt);
            }
            return mappedDoc;
          })
          .filter((d: any) => d && d.name && d.type && d.url)
        : [],
      status: data.status || ("active" as const),
      tenantId: tenantId,
      tenantName: finalTenantName,
      createdBy: "academy-api",
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: false,
    };

    console.log("📝 Creating teacher record with data:", teacherData);

    try {
      // Execute the teacher save inside a transaction so that the auto-ID
      // counter increment rolls back on failure (no gaps).
      await mongoSession.withTransaction(async () => {
        teacher = await teacherRepository.createTeacher(
          teacherData,
          mongoSession
        );
      });

      console.log(
        "✅ Teacher created successfully:",
        teacher ? teacher._id : undefined
      );
    } catch (teacherError: any) {
      console.log("❌ Teacher creation failed:", teacherError.message);

      // If teacher creation fails, clean up the user record
      console.log(
        "🧹 Starting cleanup of user record after teacher creation failure..."
      );
      try {
        const cleanupUserId = userIdForCleanup || userId;
        if (cleanupUserId && cleanupUserId !== "undefined") {
          await UserApiIntegrationService.deleteUser(cleanupUserId);
          console.log(
            "✅ Successfully cleaned up user record (ID:",
            cleanupUserId,
            ") after teacher creation failure"
          );
        } else {
          console.warn("⚠️ Cannot cleanup user record - user ID is undefined");
        }
      } catch (cleanupError: any) {
        console.error(
          "⚠️ CRITICAL: Failed to cleanup user record (ID:",
          userIdForCleanup || userId,
          "):",
          cleanupError.message
        );
        console.error(
          "⚠️ User record may be orphaned. Manual cleanup may be required."
        );
      }
      throw new Error(
        `Failed to create teacher record: ${teacherError.message}`
      );
    }

    // End the session
    await mongoSession.endSession();

    if (!teacher) {
      throw new Error("Failed to create teacher record");
    }

    // Verify that both records have the same ID
    console.log("🔍 Verifying ID consistency:");
    console.log("  User ID:", user.id);
    console.log("  Teacher ID:", teacher ? String(teacher._id) : "undefined");

    console.log("✅ Both user and teacher records created with matching IDs");

    // ===== STEP 6: CREATE SYLLABUS FOLDER =====
    // Create Syllabus folder for the teacher (non-blocking - don't fail teacher creation if this fails)
    try {
      const contentLibraryService = new ContentLibraryService();
      await contentLibraryService.createFolder({
        name: SYLLABUS_FOLDER_NAME,
        tenantId: tenantId,
        teacherId: teacher._id.toString(),
        createdBy: "system",
        isSyllabus: true,
      } as any);
      console.log("✅ Syllabus folder created successfully for teacher:", teacher._id.toString());
    } catch (syllabusFolderError: any) {
      // Log error but don't fail teacher creation
      console.error("⚠️ Failed to create Syllabus folder for teacher:", {
        teacherId: teacher._id.toString(),
        error: syllabusFolderError?.message || String(syllabusFolderError),
        timestamp: new Date().toISOString(),
      });
      // Continue with teacher creation even if Syllabus folder creation fails
    }

    // ===== STEP 7: SEND WELCOME EMAIL TO TEACHER =====
    // Send email asynchronously (don't block the response if email fails)
    try {
      const { generateLoginUrl } = require("../utils/email.helper");
      const loginUrl = generateLoginUrl(finalTenantName);
      const userName = `${data.firstName} ${data.lastName}`;

      // Get partner name by querying database directly
      // Flow: tenantId -> query tenants collection -> get partnerId -> query partners collection -> get companyName
      let partnerName = finalTenantName || "Brighton AI"; // Fallback

      try {
        // Step 1: Query tenants collection directly to get partnerId
        const tenantsCollection = mongoose.connection.db?.collection("tenants");
        if (tenantsCollection) {
          const tenantDoc = await tenantsCollection.findOne({
            _id: new mongoose.Types.ObjectId(tenantId),
            isActive: true,
            isDeleted: false,
          });

          const partnerId = tenantDoc?.partnerId;

          if (partnerId) {
            // Step 2: Query partners collection directly to get companyName
            const partnersCollection =
              mongoose.connection.db?.collection("partners");
            if (partnersCollection) {
              const partnerDoc = await partnersCollection.findOne({
                _id: new mongoose.Types.ObjectId(partnerId),
                isActive: true,
                isDeleted: false,
              });

              if (partnerDoc?.companyName) {
                partnerName = partnerDoc.companyName;
                console.log("📋 Partner name from database:", partnerName);
              } else {
                console.warn(
                  "⚠️ No companyName found in partner document, using tenant name as fallback"
                );
              }
            } else {
              console.warn(
                "⚠️ Partners collection not available, using tenant name as fallback"
              );
            }
          } else {
            console.warn(
              "⚠️ No partnerId found in tenant document, using tenant name as fallback"
            );
          }
        } else {
          console.warn(
            "⚠️ Tenants collection not available, using tenant name as fallback"
          );
        }
      } catch (partnerError: any) {
        console.warn(
          "⚠️ Could not fetch partner data from database, using tenant name as fallback:",
          partnerError.message
        );
      }

      const templateParams = {
        title: "Welcome onboard",
        userName: userName,
        role: await getRoleDisplayNameForTenant({ tenantId, role: "Teacher" }),
        email: data.email,
        password: data.password, // Temporary password
        loginUrl: loginUrl,
        tenantName: finalTenantName || "Brighton AI Education", // For header
        partnerName: partnerName, // For footer - from partner.companyName
        features: [
          "Create and manage assignments for your classes",
          "Evaluate student submissions and assign grades",
          "Track student performance and academic progress",
        ],
      };

      console.log("📧 Sending welcome email to teacher:", data.email);

      // Send email asynchronously - don't await to avoid blocking
      notificationService
        .sendEmailWithTemplate(
          data.email,
          "account-created",
          templateParams,
          tenantId,
          userId
        )
        .then(() => {
          console.log(`✅ Welcome email sent successfully to ${data.email}`);
        })
        .catch((emailError: any) => {
          // Log error but don't fail the teacher creation
          console.error(
            `⚠️ Failed to send welcome email to ${data.email}:`,
            emailError.message
          );
        });
    } catch (emailError: any) {
      // Log error but don't fail the teacher creation
      console.error("⚠️ Error preparing welcome email:", emailError.message);
    }

    // ===== STEP 8: SEND NOTIFICATIONS =====
    // Send notifications asynchronously (don't block the response if notifications fail)
    try {
      // Use sharedId as the teacher's userId - this is what's used in the JWT token
      // The sharedId is the same ID used to create both user and teacher records
      const teacherUserIdString = sharedId.toString();
      const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
      const createdByString = createdBy ? (createdBy?.toString ? createdBy.toString() : String(createdBy)) : undefined;

      console.log("📧 Preparing notifications:", {
        teacherUserId: teacherUserIdString,
        sharedId: sharedId.toString(),
        extractedUserId: userId,
        tenantId: tenantIdString,
        createdBy: createdByString,
        createdByRole: createdByRole,
      });

      const teacherName = `${data.firstName} ${data.lastName}`;
      const notifications: notificationService.INotificationRequest[] = [];

      // 1. Send notification to admin who created the teacher (if createdBy is provided)
      if (createdByString) {
        // Use the role from the request, or default to ADMIN
        const adminRole = createdByRole || "ADMIN";
        notifications.push({
          receiverId: createdByString,
          receiverRole: adminRole,
          title: "Teacher Created Successfully",
          content: `You have successfully created a new teacher account for ${teacherName} (${data.email}).`,
          senderId: teacherUserIdString,
          senderRole: "TEACHER",
          tenantId: tenantIdString,
          meta: {
            entityId: teacher._id.toString(),
            entityType: "Teacher",
            teacherId: teacher._id.toString(),
            teacherName: teacherName,
            teacherEmail: data.email,
          },
        });
        console.log(`📧 Prepared admin notification for: ${createdByString}`);
      }

      // 2. Send welcome notification to the newly created teacher
      notifications.push({
        receiverId: teacherUserIdString,
        receiverRole: "TEACHER",
        title: "Welcome to the Platform!",
        content: `Welcome ${teacherName}! Your teacher account has been successfully created. You can now log in and start managing your classes and students.`,
        senderId: createdByString || "system",
        senderRole: createdByString ? (createdByRole || "ADMIN") : "SYSTEM",
        tenantId: tenantIdString,
        meta: {
          entityId: teacher._id.toString(),
          entityType: "Teacher",
          teacherId: teacher._id.toString(),
          teacherName: teacherName,
        },
      });
      console.log(`📧 Prepared teacher welcome notification for: ${teacherUserIdString}`);

      // Send all notifications
      if (notifications.length > 0) {
        console.log(`📤 Sending ${notifications.length} notification(s)...`);
        notificationService
          .sendNotifications(notifications)
          .then((result) => {
            console.log(
              `✅ Successfully sent ${notifications.length} notification(s) for teacher creation:`,
              result
            );
          })
          .catch((notificationError: any) => {
            // Log error but don't fail the teacher creation
            console.error(
              "⚠️ Failed to send notifications:",
              notificationError.message,
              notificationError.stack
            );
            console.error("⚠️ Notification error details:", {
              message: notificationError.message,
              response: notificationError.response?.data,
              status: notificationError.response?.status,
            });
          });
      } else {
        console.warn("⚠️ No notifications to send");
      }
    } catch (notificationError: any) {
      // Log error but don't fail the teacher creation
      console.error(
        "⚠️ Error preparing notifications:",
        notificationError.message,
        notificationError.stack
      );
    }

    // Return the created teacher with user information
    return {
      success: true,
      message: "Teacher and user created successfully",
      data: {
        teacher: teacher,
        user: user,
        sharedId: sharedId.toString(),
      },
    };
  } catch (error: any) {
    console.error("Create teacher error:", error);

    // CRITICAL: If we have a user ID stored and teacher creation failed, cleanup user record
    // This handles any errors that occur after user creation but before successful teacher creation
    if (userIdForCleanup) {
      console.log(
        "🧹 Starting cleanup of user record due to error in teacher creation process..."
      );
      try {
        await UserApiIntegrationService.deleteUser(userIdForCleanup);
        console.log(
          "✅ Successfully cleaned up user record (ID:",
          userIdForCleanup,
          ") due to error"
        );
      } catch (cleanupError: any) {
        console.error(
          "⚠️ CRITICAL: Failed to cleanup user record (ID:",
          userIdForCleanup,
          "):",
          cleanupError.message
        );
        console.error(
          "⚠️ User record may be orphaned. Manual cleanup may be required."
        );
      }
    }

    // Re-throw the original error
    throw new Error(`Failed to create teacher: ${error.message}`);
  }
};

// Get all teachers
export const getAllTeachers = async (
  tenantId: string,
  pageNo: number = 1,
  pageSize: number = 10,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    // Extract special filters
    const { search, isActive, classId, subjectId, ...otherFilters } = filters;

    // Extract actual values from classId and subjectId (they might be in { $eq: 'value' } format)
    let actualClassId: string | undefined = undefined;
    if (classId) {
      if (typeof classId === "string") {
        actualClassId = classId;
      } else if (classId && typeof classId === "object" && "$eq" in classId) {
        actualClassId = String(classId.$eq);
      }
    }

    let actualSubjectId: string | undefined = undefined;
    if (subjectId) {
      if (typeof subjectId === "string") {
        actualSubjectId = subjectId;
      } else if (
        subjectId &&
        typeof subjectId === "object" &&
        "$eq" in subjectId
      ) {
        actualSubjectId = String(subjectId.$eq);
      }
    }

    // Handle classId and subjectId filters using TeacherAssignClasses
    let teacherIds: string[] | undefined = undefined;
    if (actualClassId || actualSubjectId) {
      teacherIds =
        await TeacherAssignClassesRepository.findTeacherIdsByClassAndSubject(
          tenantId,
          actualClassId,
          actualSubjectId
        );

      // If no teachers found for the class/subject filter, return empty result
      if (teacherIds.length === 0) {
        return {
          success: true,
          message: "Teachers retrieved successfully",
          data: {
            teachers: [],
            pagination: {
              pageNo,
              pageSize,
              total: 0,
              totalPages: 0,
            },
          },
        };
      }
    }

    // Build repository filters
    const repositoryFilters: Record<string, any> = {
      ...otherFilters,
    };

    // Add isActive filter (defaults to true if not provided, handled in controller)
    if (isActive !== undefined) {
      repositoryFilters.isActive = isActive;
    }

    // Add teacher IDs filter if class/subject filtering was applied
    if (teacherIds && teacherIds.length > 0) {
      // Convert string IDs to ObjectIds
      repositoryFilters._id = {
        $in: teacherIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Add search filter (will be handled in repository)
    if (search) {
      repositoryFilters.search = search;
    }

    // Get teachers with pagination
    const result = await teacherRepository.findTeachers({
      pageNo,
      pageSize,
      tenantId,
      filters: repositoryFilters,
      sort,
    });

    // Filter out null values from populated arrays (deleted classes/subjects)
    if (result.teachers) {
      result.teachers = result.teachers.map((teacher: any) => {
        // Filter out null values from assignedClasses (deleted classes)
        if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) {
          teacher.assignedClasses = teacher.assignedClasses.filter(
            (cls: any) => cls !== null && cls !== undefined
          );
        }
        // Filter out null values from assignedSubjects (deleted subjects)
        if (
          teacher.assignedSubjects &&
          Array.isArray(teacher.assignedSubjects)
        ) {
          teacher.assignedSubjects = teacher.assignedSubjects.filter(
            (subj: any) => subj !== null && subj !== undefined
          );
        }
        return teacher;
      });
    }

    // Helper function to extract ID from populated object or ObjectId (handles all formats)
    const extractId = (item: any): string | null => {
      if (!item) return null;

      // If it's already a string, return as is
      if (typeof item === "string") {
        return item.trim();
      }

      // Handle populated object with _id
      if (item._id) {
        if (typeof item._id === "string") {
          return item._id.trim();
        }
        if (item._id.toString) {
          return item._id.toString().trim();
        }
      }

      // Handle object with id property
      if (item.id) {
        if (typeof item.id === "string") {
          return item.id.trim();
        }
        if (item.id.toString) {
          return item.id.toString().trim();
        }
      }

      // Handle direct ObjectId
      if (mongoose.Types.ObjectId.isValid(item)) {
        return item.toString().trim();
      }

      return null;
    };

    // Normalize filter IDs for comparison (remove any whitespace)
    const normalizedClassId = actualClassId ? actualClassId.trim() : null;
    const normalizedSubjectId = actualSubjectId ? actualSubjectId.trim() : null;

    // If both classId and subjectId are provided, filter the response to show only that specific assignment
    if (normalizedClassId && normalizedSubjectId && result.teachers) {
      result.teachers = result.teachers.map((teacher: any) => {
        // Filter assignedClasses nested array - sirf matching class ki details
        if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) {
          teacher.assignedClasses = teacher.assignedClasses.filter(
            (cls: any) => {
              const clsId = extractId(cls);
              return clsId && clsId === normalizedClassId;
            }
          );
        }

        // Filter assignedSubjects nested array - sirf matching subject ki details
        if (
          teacher.assignedSubjects &&
          Array.isArray(teacher.assignedSubjects)
        ) {
          teacher.assignedSubjects = teacher.assignedSubjects.filter(
            (subj: any) => {
              const subjId = extractId(subj);
              return subjId && subjId === normalizedSubjectId;
            }
          );
        }

        return teacher;
      });
    } else if (normalizedClassId && result.teachers) {
      // If only classId is provided (without subjectId), filter assignedClasses to show only that specific class
      // AND filter assignedSubjects to show only subjects assigned to this class

      // 1. Fetch all valid assignments for this class to know which subjects are valid for each teacher
      const classAssignments =
        await TeacherAssignClassesRepository.findAssignmentsByClass(
          normalizedClassId,
          tenantId
        );

      // 2. Create a map of TeacherID -> Set<SubjectID> for this class
      const teacherClassSubjectsMap = new Map<string, Set<string>>();
      classAssignments.forEach((assignment: any) => {
        const tId =
          assignment.teacherId?._id?.toString() ||
          assignment.teacherId?.toString();
        const sId =
          assignment.subjectId?._id?.toString() ||
          assignment.subjectId?.toString();

        if (tId && sId) {
          if (!teacherClassSubjectsMap.has(tId)) {
            teacherClassSubjectsMap.set(tId, new Set());
          }
          teacherClassSubjectsMap.get(tId)?.add(sId);
        }
      });

      result.teachers = result.teachers.map((teacher: any) => {
        const teacherId = extractId(teacher);

        // Filter assignedClasses nested array - sirf matching class ki details
        if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) {
          teacher.assignedClasses = teacher.assignedClasses.filter(
            (cls: any) => {
              const clsId = extractId(cls);
              return clsId && clsId === normalizedClassId;
            }
          );
        }

        // Filter assignedSubjects nested array - based on the assignments we found for this class
        if (
          teacherId &&
          teacherClassSubjectsMap.has(teacherId) &&
          teacher.assignedSubjects &&
          Array.isArray(teacher.assignedSubjects)
        ) {
          const validSubjectIds = teacherClassSubjectsMap.get(teacherId);
          teacher.assignedSubjects = teacher.assignedSubjects.filter(
            (subj: any) => {
              const subjId = extractId(subj);
              return subjId && validSubjectIds?.has(subjId);
            }
          );
        } else if (teacherId && !teacherClassSubjectsMap.has(teacherId)) {
          // If teacher has no assignments for this class in the junction table, clear subjects
          // This handles edge cases where teacher might be linked to class but subjects were removed
          teacher.assignedSubjects = [];
        }

        return teacher;
      });
    } else {
      // No class/subject filter: Still need to filter assignedSubjects based on active assignments
      // to exclude soft-deleted assignments from TeacherAssignClasses

      // Get all teacher IDs from the result
      const teacherIds = result.teachers
        .map((t: any) => extractId(t))
        .filter((id): id is string => !!id);

      if (teacherIds.length > 0) {
        // Fetch all active assignments for these teachers using repository
        const allAssignmentsPromises = teacherIds.map((teacherId) =>
          TeacherAssignClassesRepository.findAssignmentsByTeacher(
            teacherId,
            tenantId
          )
        );

        const allAssignmentsArrays = await Promise.all(allAssignmentsPromises);
        const allAssignments = allAssignmentsArrays.flat();

        // Create a map of TeacherID -> Set<SubjectID> for all active assignments
        const teacherActiveSubjectsMap = new Map<string, Set<string>>();
        allAssignments.forEach((assignment: any) => {
          const tId =
            assignment.teacherId?._id?.toString() ||
            assignment.teacherId?.toString();
          const sId =
            assignment.subjectId?._id?.toString() ||
            assignment.subjectId?.toString();

          if (tId && sId) {
            if (!teacherActiveSubjectsMap.has(tId)) {
              teacherActiveSubjectsMap.set(tId, new Set());
            }
            teacherActiveSubjectsMap.get(tId)?.add(sId);
          }
        });

        // Filter assignedSubjects for each teacher based on active assignments
        result.teachers = result.teachers.map((teacher: any) => {
          const teacherId = extractId(teacher);

          if (
            teacherId &&
            teacher.assignedSubjects &&
            Array.isArray(teacher.assignedSubjects)
          ) {
            const activeSubjectIds = teacherActiveSubjectsMap.get(teacherId);

            if (activeSubjectIds && activeSubjectIds.size > 0) {
              // Filter to only include subjects with active assignments
              teacher.assignedSubjects = teacher.assignedSubjects.filter(
                (subj: any) => {
                  const subjId = extractId(subj);
                  return subjId && activeSubjectIds.has(subjId);
                }
              );
            } else {
              // No active assignments for this teacher, clear subjects
              teacher.assignedSubjects = [];
            }
          }

          return teacher;
        });
      }
    }

    return {
      success: true,
      message: "Teachers retrieved successfully",
      data: result,
    };
  } catch (error: any) {
    console.error("Get all teachers error:", error);
    throw new Error(`Failed to get teachers: ${error.message}`);
  }
};

// Get teacher by ID
export const getTeacherById = async (teacherId: string) => {
  const teacher = await teacherRepository.findTeacherById(teacherId);
  if (!teacher) {
    const error = new Error("Teacher not found");
    (error as any).statusCode = HttpStatusCodes.NOT_FOUND;
    throw error;
  }
  return {
    success: true,
    message: "Teacher retrieved successfully",
    data: teacher,
  };
};

// Get teacher profile details with statistics
export const getTeacherProfileDetails = async (
  teacherId: string,
  tenantId: string
) => {
  try {
    // Get teacher basic info
    const teacher = await teacherRepository.findTeacherById(teacherId);
    if (!teacher) {
      const error = new Error("Teacher not found");
      (error as any).statusCode = HttpStatusCodes.NOT_FOUND;
      throw error;
    }

    // Validate tenant access
    if (teacher.tenantId !== tenantId) {
      const error = new Error("Unauthorized access to teacher");
      (error as any).statusCode = HttpStatusCodes.FORBIDDEN;
      throw error;
    }

    // Get assigned classes and subjects from TeacherAssignClasses
    const assignments =
      await TeacherAssignClassesRepository.findAssignmentsByTeacher(
        teacherId,
        tenantId
      );

    // Filter out assignments where class or subject is null (soft-deleted)
    const validAssignments = assignments.filter(
      (assignment: any) =>
        assignment.classId !== null && assignment.subjectId !== null
    );

    // Extract unique classes and subjects
    const uniqueClassIds = new Set<string>();
    const uniqueSubjectIds = new Set<string>();
    const assignedClasses: any[] = [];
    const assignedSubjects: any[] = [];

    validAssignments.forEach((assignment: any) => {
      // Handle classId
      let classId: string | null = null;
      if (assignment.classId) {
        if (typeof assignment.classId === "string") {
          classId = assignment.classId;
        } else if (assignment.classId._id) {
          classId = assignment.classId._id.toString();
        } else if (assignment.classId.toString) {
          classId = assignment.classId.toString();
        }
      }

      // Handle subjectId
      let subjectId: string | null = null;
      if (assignment.subjectId) {
        if (typeof assignment.subjectId === "string") {
          subjectId = assignment.subjectId;
        } else if (assignment.subjectId._id) {
          subjectId = assignment.subjectId._id.toString();
        } else if (assignment.subjectId.toString) {
          subjectId = assignment.subjectId.toString();
        }
      }

      // Add unique classes
      if (classId && !uniqueClassIds.has(classId)) {
        uniqueClassIds.add(classId);
        const classData = assignment.classId;
        assignedClasses.push({
          _id: classId,
          name: classData?.name || "Unknown Class",
          grade: classData?.grade || null,
          section: classData?.section || null,
        });
      }

      // Add unique subjects
      if (subjectId && !uniqueSubjectIds.has(subjectId)) {
        uniqueSubjectIds.add(subjectId);
        const subjectData = assignment.subjectId;
        assignedSubjects.push({
          _id: subjectId,
          name: subjectData?.name || "Unknown Subject",
          code: subjectData?.code || null,
        });
      }
    });

    // Count exams created by this teacher
    const examCount = await examRepository.countExams({
      tenantId,
      teacherId: teacherId,
    } as any);

    // Count credentials (documents with type 'certificate')
    const credentialsCount =
      teacher.documents?.filter(
        (doc) => doc.type?.toLowerCase() === "certificate"
      ).length || 0;

    // Format response
    const profileData = {
      // Basic Information
      _id: teacher._id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      fullName: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      phoneNumber: teacher.phoneNumber,
      thrId: teacher.thrId,
      profilePicture: teacher.profilePicture || null,

      // Contact Information
      address: teacher.address,
      emergencyContact: teacher.emergencyContact,
      emergencyPhone: teacher.emergencyPhone,

      // Academic Information
      qualification: teacher.qualification,
      specialization: teacher.specialization,
      experience: teacher.experience,
      department: teacher.department,
      designation: teacher.designation,
      joiningDate: teacher.joiningDate,

      // Assignments
      assignedClasses: assignedClasses,
      assignedSubjects: assignedSubjects,

      // Statistics
      statistics: {
        totalClassAssign: uniqueClassIds.size,
        totalSubjectsAssign: uniqueSubjectIds.size,
        examCreated: examCount,
        credentialsIssued: credentialsCount,
      },

      // Additional Information
      bio: teacher.bio,
      achievements: teacher.achievements || [],
      certifications: teacher.certifications || [],
      status: teacher.status,
      tenantId: teacher.tenantId,
      tenantName: teacher.tenantName,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };

    return {
      success: true,
      message: "Teacher profile details retrieved successfully",
      data: profileData,
    };
  } catch (error: any) {
    console.error("Get teacher profile details error:", error);
    throw error;
  }
};

// Update teacher
export const updateTeacher = async (
  teacherId: string,
  data: UpdateTeacherRequest,
  tenantId: string
) => {
  try {
    // Get existing teacher to retrieve userId for user-api sync
    const existingTeacher = await teacherRepository.findTeacherById(teacherId);
    if (!existingTeacher) {
      throw new Error("Teacher not found");
    }

    // Handle password update if provided
    if (data.password !== undefined) {
      // Validate password length
      if (data.password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      // Determine user ID for user-api update (use userId if available, otherwise use _id)
      const userIdForUpdate = existingTeacher.userId
        ? existingTeacher.userId.toString()
        : existingTeacher._id.toString();

      // Update password in user-api
      try {
        await UserApiIntegrationService.updateUser(userIdForUpdate, {
          password: data.password,
        });
        console.log("✅ Password updated successfully in user-api");
      } catch (passwordUpdateError: any) {
        console.error(
          "⚠️ Failed to update password in user-api:",
          passwordUpdateError.message
        );
        throw new Error(
          `Failed to update password: ${passwordUpdateError.message}`
        );
      }

      // Also update demoPassword in teacher record
      data.demoPassword = data.password;
    }

    // Prepare user update data (only fields that exist in User entity)
    const userUpdateData: any = {};
    if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
    if (data.email !== undefined) userUpdateData.email = data.email;
    if (data.phoneNumber !== undefined)
      userUpdateData.phoneNumber = data.phoneNumber;

    // Handle isActive status sync
    if (data.status !== undefined) {
      userUpdateData.isActive = data.status === "active";
    } else if (data.isActive !== undefined) {
      userUpdateData.isActive = data.isActive;
    }

    // Update User entity if there are fields to update (excluding password which is handled above)
    if (Object.keys(userUpdateData).length > 0) {
      const userIdForUpdate = existingTeacher.userId
        ? existingTeacher.userId.toString()
        : existingTeacher._id.toString();

      try {
        await UserApiIntegrationService.updateUser(
          userIdForUpdate,
          userUpdateData
        );
        console.log("✅ User entity updated successfully in user-api");
      } catch (userUpdateError: any) {
        console.error(
          "⚠️ Failed to update user entity in user-api:",
          userUpdateError.message
        );
        // Log warning but continue with teacher update
        console.warn(
          "⚠️ Continuing with teacher update despite user-api sync failure"
        );
      }
    }

    // Handle documents field transformation
    // If documents is a string or array of strings (file IDs), transform to proper format
    const updateData: any = { ...data };

    // Remove password from updateData (it's already handled above and stored as demoPassword)
    // Password should not be stored in teacher record, only in user-api
    delete updateData.password;

    if (updateData.documents !== undefined) {
      // If documents is a string (single file ID), convert to array
      if (typeof updateData.documents === "string") {
        // If it's a single file ID string, we need to preserve existing documents and add this one
        // Or if it's meant to replace, we need proper document object format
        // For now, remove it from updateData to prevent casting error
        // Frontend should send proper document objects
        console.warn(
          "⚠️ Documents field received as string. Expected array of document objects. Removing from update."
        );
        delete updateData.documents;
      }
      // If documents is an array, check if it contains strings (file IDs) or objects
      else if (Array.isArray(updateData.documents)) {
        // Check if array contains strings (file IDs) instead of objects
        const hasStringItems = updateData.documents.some(
          (item: any) => typeof item === "string"
        );

        if (hasStringItems) {
          // If array contains strings, these are likely file IDs
          // We need to either:
          // 1. Fetch file metadata from storage-api and create document objects
          // 2. Or remove documents from update and let frontend send proper format
          // For now, filter out string items and keep only valid document objects
          updateData.documents = updateData.documents.filter(
            (item: any) =>
              typeof item === "object" && item !== null && item.name && item.url
          );

          if (updateData.documents.length === 0) {
            // If all items were strings, remove documents field to prevent error
            delete updateData.documents;
            console.warn(
              "⚠️ Documents array contained only file IDs (strings). Expected document objects. Removed from update."
            );
          }
        }
        // If array contains objects, validate they have required fields
        else {
          // Validate document objects have required fields
          updateData.documents = updateData.documents
            .map((doc: any) => {
              if (typeof doc === "object" && doc !== null) {
                // Ensure required fields exist
                if (!doc.name || !doc.type || !doc.url) {
                  console.warn(
                    "⚠️ Document object missing required fields:",
                    doc
                  );
                  return null;
                }
                // Ensure uploadedAt exists
                if (!doc.uploadedAt) {
                  doc.uploadedAt = new Date();
                }
                return doc;
              }
              return null;
            })
            .filter((doc: any) => doc !== null);
        }
      }
    }

    // Update teacher record
    const teacher = await teacherRepository.updateTeacherById(
      teacherId,
      updateData
    );
    if (!teacher) {
      throw new Error("Teacher not found");
    }
    return {
      success: true,
      message: "Teacher updated successfully",
      data: teacher,
    };
  } catch (error: any) {
    console.error("Update teacher error:", error);
    throw new Error(`Failed to update teacher: ${error.message}`);
  }
};

// Delete teacher
export const deleteTeacher = async (teacherId: string, tenantId: string) => {
  try {
    const teacher = await teacherRepository.softDeleteTeacherById(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found");
    }

    // Also delete the corresponding user in the User API
    try {
      await UserApiIntegrationService.deleteUser(teacherId);
      console.log(`✅ Successfully deleted user ${teacherId} in User API`);
    } catch (userApiError: any) {
      console.error(`⚠️ Failed to delete user ${teacherId} in User API:`, userApiError.message);
      // Don't fail the entire operation if user API deletion fails
      // The teacher is already marked as deleted in academic-api
    }

    return {
      success: true,
      message: "Teacher deleted successfully",
      data: teacher,
    };
  } catch (error: any) {
    console.error("Delete teacher error:", error);
    throw new Error(`Failed to delete teacher: ${error.message}`);
  }
};

// Get teachers by class
export const getTeachersByClass = async (
  classId: string,
  tenantId: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const teachers = await teacherRepository.findTeachersByClass(
      classId,
      tenantId,
      filters,
      sort
    );
    return {
      success: true,
      message: "Teachers retrieved successfully",
      data: teachers,
    };
  } catch (error: any) {
    console.error("Get teachers by class error:", error);
    throw new Error(`Failed to get teachers by class: ${error.message}`);
  }
};

// Get teachers by subject
export const getTeachersBySubject = async (
  subjectId: string,
  tenantId: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const teachers = await teacherRepository.findTeachersBySubject(
      subjectId,
      tenantId,
      filters,
      sort
    );
    return {
      success: true,
      message: "Teachers retrieved successfully",
      data: teachers,
    };
  } catch (error: any) {
    console.error("Get teachers by subject error:", error);
    throw new Error(`Failed to get teachers by subject: ${error.message}`);
  }
};

// Get teachers DDL (dropdown list) - simplified data for dropdowns
export const getTeachersDDL = async (tenantId: string) => {
  try {
    // Validate tenantId before proceeding
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    const teachers = await teacherRepository.getTeachersDDL(tenantId);
    return {
      success: true,
      message: "Teachers DDL retrieved successfully",
      data: teachers,
    };
  } catch (error: any) {
    // Provide more specific error messages
    if (error.message.includes("Invalid tenantId format")) {
      throw new Error(
        `Invalid tenantId format: ${tenantId}. Please check your authentication token.`
      );
    } else if (error.message.includes("Invalid tenantId")) {
      throw new Error(`Invalid tenantId: ${error.message}`);
    }
    throw error;
  }
};

// Assign classes to teacher with subjects
export const assignClasses = async (
  teacherId: string,
  assignments: { classId: string; subjectId: string }[],
  tenantId: string,
  assignedBy: string
) => {
  try {
    console.log("🔄 Starting teacher class assignments...");
    console.log("Teacher ID:", teacherId);
    console.log("Assignments:", assignments);
    console.log("Tenant ID:", tenantId);
    console.log("Assigned By:", assignedBy);

    // Validate teacher exists
    const teacher = await teacherRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found");
    }

    // Validate tenant access
    if (teacher.tenantId !== tenantId) {
      throw new Error("Unauthorized access to teacher");
    }

    // Get tenant name
    const tenantName = teacher.tenantName;

    // Extract unique class IDs and subject IDs from assignments
    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];

    console.log("📋 Extracted class IDs:", classIds);
    console.log("📋 Extracted subject IDs:", subjectIds);

    // Convert to ObjectIds
    const classObjectIds = classIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const subjectObjectIds = subjectIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Execute operations sequentially without transactions
    // (Transactions require replica set which may not be available in all environments)
    try {
      // 1. Hard delete all existing assignments for this teacher
      console.log("🗑️ Deleting all existing assignments for teacher...");
      const deletedCount =
        await TeacherAssignClassesRepository.hardDeleteAssignmentsByTeacher(
          teacherId,
          tenantId
        );
      console.log(`✅ Deleted ${deletedCount} existing assignment(s)`);

      // 2. Create new assignments in TeacherAssignClasses table
      console.log(`📝 Creating ${assignments.length} new assignments...`);

      let createdAssignments: any[] = [];

      if (assignments.length > 0) {
        const assignmentData = assignments.map((assignment) => ({
          teacherId: new mongoose.Types.ObjectId(teacherId),
          classId: new mongoose.Types.ObjectId(assignment.classId),
          subjectId: new mongoose.Types.ObjectId(assignment.subjectId),
          tenantId: tenantId,
          tenantName: tenantName,
          assignedBy: new mongoose.Types.ObjectId(assignedBy),
          assignedAt: new Date(),
          status: "active" as const,
          createdBy: assignedBy, // Required by BaseDocumentSchema
          isActive: true,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        try {
          createdAssignments =
            await TeacherAssignClassesRepository.createBulkAssignments(
              assignmentData
            );
          console.log(
            `✅ Created ${createdAssignments.length} new assignments`
          );
        } catch (bulkError: any) {
          console.error("❌ Error creating assignments:", bulkError);
          throw new Error(`Failed to create assignments: ${bulkError.message}`);
        }
      }

      // 3. Update teacher's assignedClasses and assignedSubjects arrays with new assignments
      console.log("📝 Updating teacher assignments arrays...");

      const allClassObjectIds = classIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const allSubjectObjectIds = subjectIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const updatedTeacher = await teacherRepository.updateTeacherById(
        teacherId,
        {
          assignedClasses: allClassObjectIds,
          assignedSubjects: allSubjectObjectIds,
          updatedAt: new Date(),
        }
      );

      if (!updatedTeacher) {
        throw new Error("Failed to update teacher assignments");
      }

      console.log("✅ Teacher assignments updated successfully");
      console.log("🎉 Assignments completed successfully");

      // Get updated teacher with populated data
      const finalTeacher = await teacherRepository.findTeacherById(teacherId);

      // Get assignment details for response
      const assignmentDetails =
        await TeacherAssignClassesRepository.findAssignmentsByTeacher(
          teacherId,
          tenantId
        );

      return {
        success: true,
        message: `Successfully replaced all assignments. Deleted ${deletedCount} old assignment(s) and created ${createdAssignments.length} new assignment(s).`,
        data: {
          teacher: finalTeacher,
          assignments: assignmentDetails,
          summary: {
            deleted: deletedCount,
            created: createdAssignments.length,
            uniqueClasses: classIds.length,
            uniqueSubjects: subjectIds.length,
          },
        },
      };
    } catch (operationError) {
      console.error("❌ Assignment operations failed:", operationError);
      throw operationError;
    }
  } catch (error: any) {
    console.error("❌ Assign classes error:", error);
    throw new Error(`Failed to assign classes: ${error.message}`);
  }
};

// Assign subjects to teacher
export const assignSubjects = async (
  teacherId: string,
  subjectIds: string[],
  tenantId: string
) => {
  try {
    // Validate teacher exists
    const teacher = await teacherRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found");
    }

    // Validate tenant access
    if (teacher.tenantId !== tenantId) {
      throw new Error("Unauthorized access to teacher");
    }

    // Convert string IDs to ObjectIds
    const objectIds = subjectIds.map((id) => new mongoose.Types.ObjectId(id));

    // Get existing assigned subjects and merge with new ones (avoid duplicates)
    const existingSubjectIds = teacher.assignedSubjects.map((subject: any) =>
      typeof subject === "object" ? subject._id.toString() : subject.toString()
    );

    const newSubjectIds = objectIds.filter(
      (id) => !existingSubjectIds.includes(id.toString())
    );

    // If no new subjects to add, return current state
    if (newSubjectIds.length === 0) {
      return {
        success: true,
        message: "All subjects are already assigned to this teacher",
        data: teacher,
      };
    }

    // Combine existing and new subjects
    const allSubjectIds = [...teacher.assignedSubjects, ...newSubjectIds];

    // Update teacher with assigned subjects
    const updatedTeacher = await teacherRepository.updateTeacherById(
      teacherId,
      {
        assignedSubjects: allSubjectIds,
      }
    );

    return {
      success: true,
      message: "Subjects assigned successfully",
      data: updatedTeacher,
    };
  } catch (error: any) {
    console.error("Assign subjects error:", error);
    throw new Error(`Failed to assign subjects: ${error.message}`);
  }
};

// Get teacher statistics
export const getTeacherStatistics = async (tenantId: string) => {
  try {
    const statistics = await teacherRepository.getTeacherStatistics(tenantId);
    return {
      success: true,
      message: "Teacher statistics retrieved successfully",
      data: statistics,
    };
  } catch (error: any) {
    console.error("Get teacher statistics error:", error);
    throw new Error(`Failed to get teacher statistics: ${error.message}`);
  }
};

// Get teacher stats (total, active, inactive)
export const getActiveStats = async (tenantId: string) => {
  try {
    // Get total teachers count (active + inactive)
    const totalTeachersCount = await teacherRepository.countTeachers({
      tenantId,
      filters: { isActive: { $in: [true, false] } },
    });

    // Get active teachers count
    const activeTeachersCount = await teacherRepository.countTeachers({
      tenantId,
      filters: { isActive: true },
    });

    // Calculate inactive teachers
    const inactiveTeachersCount = totalTeachersCount - activeTeachersCount;

    return {
      success: true,
      message: "Teacher statistics retrieved successfully",
      data: {
        total: totalTeachersCount,
        active: activeTeachersCount,
        inactive: inactiveTeachersCount,
      },
    };
  } catch (error: any) {
    console.error("Get teacher stats error:", error);
    throw new Error(`Failed to get teacher stats: ${error.message}`);
  }
};

// Get teacher counts (total, active, inactive)
export const getActiveCounts = async (tenantId: string) => {
  try {
    // Get total teachers count (not deleted)
    const totalTeacher = await Teacher.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    // Get active teachers count (isActive: true, isDeleted: false)
    const totalActiveTeacher = await Teacher.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false,
    });

    // Get inactive teachers count (isActive: false, isDeleted: false)
    const totalInactiveTeacher = await Teacher.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: false,
      isDeleted: false,
    });

    return {
      success: true,
      message: "Teacher counts retrieved successfully",
      data: {
        totalTeacher,
        totalActiveTeacher,
        totalInactiveTeacher,
      },
    };
  } catch (error: any) {
    console.error("Get teacher counts error:", error);
    throw new Error(`Failed to get teacher counts: ${error.message}`);
  }
};

// Get my class detail
export const getMyClassDetail = async (
  teacherId: string,
  classId: string,
  subjectId: string,
  tenantId: string
): Promise<GetMyClassDetailResponse> => {
  try {
    // Validate classId and subjectId
    if (!classId || !subjectId) {
      throw new Error("Class ID and Subject ID are required");
    }

    // Get class and subject info
    const classInfo = await Class.findById(classId).lean();
    const subjectInfo = await Subject.findById(subjectId).lean();
    const studentCount = await studentRepository.countStudentsByClass(
      classId,
      tenantId
    );

    if (!classInfo) {
      throw new Error("Class not found");
    }
    if (!subjectInfo) {
      throw new Error("Subject not found");
    }

    // Get all exams for the class (for totalExams count)
    const allClassExams = await examRepository.findExams({
      tenantId,
      classId,
      pageNo: 1,
      pageSize: 1000, // Get all exams
    } as any);

    // Get all exams matching classId and subjectId (for subject-specific stats)
    const subjectExams = await examRepository.findExams({
      tenantId,
      classId,
      subjectId,
      pageNo: 1,
      pageSize: 1000, // Get all exams
    } as any);

    const subjectExamIds = subjectExams.map((exam: any) => {
      // Handle both ObjectId and string formats
      return exam._id ? exam._id.toString() : exam.id || exam._id;
    });

    // Get all students in the class
    const allClassStudents = await studentRepository.findStudentsByClass(
      classId,
      tenantId
    );

    // Get statistics from graded attempts for the subject (even if no exams, we still want to show all students)
    let stats: any;
    if (subjectExamIds.length === 0) {
      // If no subject exams, create empty stats structure
      stats = {
        studentStats: [],
        averagePercentage: 0,
        totalStudents: allClassStudents.length,
        examStats: [],
      };
    } else {
      stats = await examAttemptRepository.getClassSubjectStatistics(
        classId,
        subjectId,
        tenantId,
        subjectExamIds
      );
    }

    // Create a map of student stats from the subject exams
    const studentStatsMap = new Map();
    stats.studentStats.forEach((stat: any) => {
      studentStatsMap.set(stat.studentId, stat);
    });

    // Create student map for quick lookup
    const studentMap = new Map();
    allClassStudents.forEach((student) => {
      if (student) {
        studentMap.set(student._id.toString(), student);
      }
    });

    // Calculate overall class average (average of all student averages who have attempted exams)
    // Note: This is still based on subject exams, but we show all students in the list
    const overallClassAverage =
      stats.studentStats.length > 0
        ? stats.studentStats.reduce(
          (sum: any, s: any) => sum + s.avgPercentage,
          0
        ) / stats.studentStats.length
        : 0;

    // Get active grading system for tenant
    const gradingSystem = await gradingSystemRepository.findActiveGradingSystem(
      tenantId
    );

    // Calculate grade from percentage using grading system
    const calculateGrade = (percentage: number): string => {
      return calculateGradeFromPercentage(percentage, gradingSystem || {});
    };

    const overallGrade =
      subjectExamIds.length > 0 && stats.studentStats.length > 0
        ? calculateGrade(overallClassAverage)
        : "--";
    const subjectGrade =
      subjectExamIds.length > 0 && stats.studentStats.length > 0
        ? calculateGrade(stats.averagePercentage)
        : "--";

    // Build student list with rankings - include ALL students in the class
    const studentListWithDetails = allClassStudents
      .map((student) => {
        const studentId = student._id.toString();
        const stat = studentStatsMap.get(studentId);

        // If student has attempted exams, use their stats; otherwise use defaults
        const avgPercentage = stat ? stat.avgPercentage : 0;
        const totalAttempts = stat ? stat.totalAttempts : 0;

        // Determine performance status
        let performanceStatus = "Average";
        if (avgPercentage >= 80) performanceStatus = "Excellent";
        else if (avgPercentage < 50) performanceStatus = "Low";

        return {
          studentId: studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          rollNumber: student.rollNumber || "N/A",
          avgScore: Math.round(avgPercentage * 100) / 100,
          examsCompleted: totalAttempts,
          totalExams: subjectExamIds.length, // Total exams for this subject
          performanceStatus,
        };
      })
      .filter((s) => s !== null) as any[];

    // Sort students by average score for rankings
    studentListWithDetails.sort((a, b) => b.avgScore - a.avgScore);

    // Apply dense ranking - students with same score get same rank
    let currentRankValue = 1;
    let previousScore: number | null = null;

    const rankedStudents = studentListWithDetails.map((student) => {
      // If score has dropped, increment rank
      if (previousScore !== null && student.avgScore < previousScore) {
        currentRankValue++;
      }
      previousScore = student.avgScore;

      return {
        ...student,
        rank: currentRankValue,
      };
    });

    // Build top students list (top 10)
    const topStudents = rankedStudents.slice(0, 10).map((student) => ({
      studentId: student.studentId,
      studentName: student.studentName,
      rank: student.rank,
      overallScore: student.avgScore,
      grade:
        student.examsCompleted > 0 ? calculateGrade(student.avgScore) : "--",
    }));

    // Build performance breakdown per exam (for the subject)
    const performanceBreakdown = subjectExams.map((exam: any) => {
      const examId = exam._id ? exam._id.toString() : exam.id || exam._id;
      const examStat = stats.examStats.find((s: any) => s.examId === examId);
      return {
        examId: examId,
        examTitle: exam.examTitle,
        averageScore: examStat
          ? Math.round(examStat.averageScore * 100) / 100
          : 0,
        totalStudents: examStat?.totalStudents || 0,
        completedCount: examStat?.completedCount || 0,
        createdOn: exam.createdAt || exam.createdOn || new Date(),
      };
    });

    return {
      success: true,
      data: {
        classInfo: {
          classId,
          className: (classInfo as any).name || "Unknown Class",
          subjectId,
          subjectName: (subjectInfo as any).name || "Unknown Subject",
          totalStudents: studentCount,
          classTeacherId: (classInfo as any).classTeacherId ? (classInfo as any).classTeacherId.toString() : null,
        },
        overallStats: {
          totalExams: allClassExams.length, // Total exams for the entire class
          overallClassAverage: Math.round(overallClassAverage * 100) / 100,
          subjectAverage: Math.round(stats.averagePercentage * 100) / 100,
          grade: overallGrade,
          totalStudents: studentCount, // Total students in the class
        },
        topStudents,
        studentList: rankedStudents.map(({ rank, ...student }) => student),
        performanceBreakdown,
      },
    };
  } catch (error: any) {
    console.error("Get my class detail error:", error);
    throw new Error(`Failed to get class detail: ${error.message}`);
  }
};

/**
 * Get teacher classes with subjects (Admin only)
 * Returns simplified data structure with only essential fields
 */
export const getTeacherClassesWithSubjects = async (
  teacherId: string,
  tenantId: string
): Promise<any[]> => {
  try {
    // Validate inputs
    if (!teacherId || typeof teacherId !== "string") {
      throw new Error("Teacher ID is required");
    }

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Tenant ID is required");
    }

    // Get classes with subjects from repository
    const classes =
      await TeacherAssignClassesRepository.findTeacherClassesWithSubjects(
        teacherId,
        tenantId
      );

    // Transform response to include only required fields
    const simplifiedClasses = classes.map((classItem: any) => ({
      classId: classItem.id,
      name: classItem.name,
      grade: classItem.grade,
      section: classItem.section || null,
      subjects: classItem.subjects.map((subject: any) => ({
        id: subject.id,
        name: subject.name,
      })),
    }));

    return simplifiedClasses;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to get teacher classes with subjects");
  }
};

/**
 * Get teacher's classes with students
 * Returns all classes assigned to the teacher with their students
 */
export const getMyClassesWithStudents = async (
  teacherId: string,
  tenantId: string
): Promise<any> => {
  try {
    // Validate inputs
    if (!teacherId || typeof teacherId !== "string") {
      throw new Error("Teacher ID is required");
    }

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Tenant ID is required");
    }

    // Get teacher's assigned classes with subjects
    const classesWithSubjects =
      await TeacherAssignClassesRepository.findTeacherClassesWithSubjects(
        teacherId,
        tenantId
      );

    // Collect all classes and all students separately
    const allClasses: any[] = [];
    const allStudents: any[] = [];
    const studentMap = new Map<string, any>(); // Map to track students with their assigned classes

    // Process each class
    for (const classItem of classesWithSubjects) {
      console.log(`🔍 Processing class: ${classItem.id} (${classItem.name})`);

      // Get full class details using findById (like other parts of codebase)
      const classDetails = await Class.findById(classItem.id)
        .populate({
          path: "batchId",
          select: "batchName",
        })
        .lean();

      if (!classDetails) {
        console.warn(`⚠️ Class not found: ${classItem.id} (${classItem.name})`);
        continue;
      }

      // Verify tenantId matches (security check)
      // Handle both ObjectId and string formats
      const classTenantId = (classDetails as any).tenantId;
      const classTenantIdStr =
        classTenantId?.toString?.() || String(classTenantId || "");
      const tenantIdStr = String(tenantId || "");

      if (classTenantIdStr !== tenantIdStr) {
        console.warn(
          `⚠️ Tenant mismatch for class ${classItem.id} (${classItem.name}): expected ${tenantIdStr}, got ${classTenantIdStr}`
        );
        continue;
      }

      // Check if class is deleted - exclude deleted classes
      if ((classDetails as any).isDeleted) {
        console.warn(
          `⚠️ Class is deleted, excluding: ${classItem.id} (${classItem.name})`
        );
        continue;
      }

      // Get students for this class
      const students = await studentRepository.findStudentsByClass(
        classItem.id,
        tenantId
      );

      // Format batch info
      const batch = classDetails.batchId
        ? {
          id: (classDetails.batchId as any)._id?.toString() || "",
          batchName: (classDetails.batchId as any).batchName || "",
        }
        : null;

      // Format subjects
      const formattedSubjects = classItem.subjects.map((subject: any) => ({
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code || null,
      }));

      // Add class to classes array (without students)
      const classData = {
        classId: classItem.id,
        className: classItem.name || "",
        gradeLevel: classItem.grade || null,
        batch: batch,
        subjects: formattedSubjects,
        description: (classDetails as any).description || null,
        maxStudents: (classDetails as any).capacity || 0,
        status: (classDetails as any).isActive ? "active" : "inactive",
        classTeacherId: (classDetails as any).classTeacherId
          ? (classDetails as any).classTeacherId.toString()
          : null,
      };

      allClasses.push(classData);

      // Add students to studentMap, tracking their assigned classes
      students.forEach((student: any) => {
        const studentId = student._id?.toString() || student.id;

        // Prepare assigned class info for this student
        const assignedClassInfo = {
          classId: classItem.id,
          className: classItem.name || "",
          gradeLevel: classItem.grade || null,
          batch: batch,
        };

        if (studentMap.has(studentId)) {
          // Student already exists, add this class to their assigned classes
          const existingStudent = studentMap.get(studentId);
          // Check if this class is already in the assigned classes array
          const classExists = existingStudent.assignedClass.some(
            (cls: any) => cls.classId === classItem.id
          );
          if (!classExists) {
            existingStudent.assignedClass.push(assignedClassInfo);
          }
        } else {
          // New student, create entry with assigned class
          studentMap.set(studentId, {
            studentId: studentId,
            userId: student.userId, // Added userId to support chat functionality
            rollNumber: student.rollNumber || "",
            studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim(),
            status: student.isActive ? "active" : "inactive",
            assignedClass: [assignedClassInfo],
          });
        }
      });
    }

    // Convert studentMap to array
    allStudents.push(...Array.from(studentMap.values()));

    return {
      success: true,
      data: {
        classes: allClasses,
        students: allStudents,
      },
    };
  } catch (error: any) {
    console.error("Get my classes with students error:", error);
    throw new Error(`Failed to get classes with students: ${error.message}`);
  }
};

/**
 * Resend welcome email to teacher
 * @param teacherId - Teacher ID
 * @returns Promise with success message
 */
export const resendTeacherEmail = async (teacherId: string) => {
  try {
    // Fetch teacher data
    const teacher = await teacherRepository.findTeacherById(teacherId);
    if (!teacher) {
      throw new Error("Teacher not found");
    }

    // Check if teacher has email
    if (!teacher.email) {
      throw new Error("Teacher does not have an email address");
    }

    // Get tenant info
    const tenantId = teacher.tenantId?.toString();
    const tenantName = teacher.tenantName;

    if (!tenantId) {
      throw new Error("Teacher tenant ID is missing");
    }

    // Send welcome email
    await sendWelcomeEmail(
      teacher.email,
      teacher.firstName,
      teacher.lastName,
      "Teacher",
      tenantId,
      tenantName,
      teacher.userId?.toString()
    );

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  } catch (error: any) {
    console.error("Resend teacher email error:", error);
    throw new Error(`Failed to resend email: ${error.message}`);
  }
};

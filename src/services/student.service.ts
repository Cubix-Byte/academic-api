import * as studentRepository from "../repositories/student.repository";
import * as classStudentRepository from "../repositories/classStudent.repository";
import { IStudent } from "@/models";
import {
  CreateStudentRequest,
  UpdateStudentRequest,
  GetStudentPerformanceBreakdownResponse,
} from "@/types/student.types";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { STATUS } from "../utils/constants/status.constants";
import { HttpStatusCodes } from "@/utils/shared-lib-imports";
import { ClassRepository } from "@/repositories/class.repository";
import { Class, Subject, Student } from "../models";
import * as examRepository from "../repositories/exam.repository";
import * as examAttemptRepository from "../repositories/examAttempt.repository";
import ExamAttempt from "../models/examAttempt.schema";
import ExamStudent from "../models/examStudent.schema";
import mongoose, { SortOrder } from "mongoose";
import * as parentChildService from "./parentChild.service";
import * as studentTopicPerformanceService from "./studentTopicPerformance.service";
import * as studentExamsService from "./studentExams.service";
import { fetchUserNames } from "@/utils/activityLog.helper";
import * as notificationService from "./notification.service";
import { sendWelcomeEmail } from "@/utils/email.helper";
import { generateRandomPassword } from "@/utils/password.helper";
import { assertSeatAvailable } from "@/utils/seatsNlicense.helper";
import { getRoleDisplayNameForTenant } from "@/utils/email.helper";
import { allocateInitialCredits } from "./monetizationApiIntegration.service";
import * as tenantService from "./tenant.service";

/**
 * Student Service - Business logic for student management
 * Handles student CRUD operations with tenant-specific validation
 */

/**
 * Maps MongoDB duplicate key errors to user-friendly messages
 * @param error - MongoDB error object
 * @returns User-friendly error message or null if not a duplicate key error
 */
function getDuplicateKeyErrorMessage(error: any): string | null {
  // Check if it's a MongoDB duplicate key error (E11000)
  if (error.code !== 11000 && error.codeName !== "DuplicateKey") {
    return null;
  }

  const keyPattern = error.keyPattern || {};
  const keyValue = error.keyValue || {};

  // Check which field(s) caused the duplicate
  if (keyPattern.studentId) {
    return `A student with this student ID already exists. Please use a different student ID.`;
  }

  // Only show roll number error if rollNumber actually has a value (not null/undefined/empty)
  // This prevents false positives when rollNumber is not provided
  if (keyPattern.rollNumber && keyPattern.tenantId && keyPattern.classId) {
    // Check if rollNumber actually has a value in the error
    const rollNumberValue = keyValue.rollNumber;
    if (
      rollNumberValue !== null &&
      rollNumberValue !== undefined &&
      rollNumberValue !== ""
    ) {
      return `A student with this roll number already exists in this class. Please use a different roll number.`;
    }
    // If rollNumber is null/undefined/empty, skip this check and check other patterns
  }

  if (keyPattern.rollNumber && keyPattern.tenantId) {
    // Check if rollNumber actually has a value in the error
    const rollNumberValue = keyValue.rollNumber;
    if (
      rollNumberValue !== null &&
      rollNumberValue !== undefined &&
      rollNumberValue !== ""
    ) {
      return `A student with this roll number already exists. Please use a different roll number.`;
    }
    // If rollNumber is null/undefined/empty, skip this check and check other patterns
  }

  if (keyPattern.email && keyPattern.tenantId) {
    return `A student with this email already exists. Please use a different email.`;
  }

  if (keyPattern.userId) {
    return `This user account is already associated with a student.`;
  }

  // Generic duplicate key error message
  // Skip rollNumber in generic message if it's null/undefined/empty
  const duplicateField = Object.keys(keyPattern).find(
    (field) =>
      field !== "rollNumber" ||
      (keyValue.rollNumber !== null &&
        keyValue.rollNumber !== undefined &&
        keyValue.rollNumber !== "")
  );
  if (duplicateField) {
    // If the duplicate field is rollNumber, make sure it has a value
    if (duplicateField === "rollNumber") {
      const rollNumberValue = keyValue.rollNumber;
      if (
        rollNumberValue === null ||
        rollNumberValue === undefined ||
        rollNumberValue === ""
      ) {
        // Skip rollNumber, try to find another field
        const otherField = Object.keys(keyPattern).find(
          (f) => f !== "rollNumber"
        );
        if (otherField) {
          return `A student with this ${otherField} already exists. Please use a different value.`;
        }
        return `A student with these details already exists. Please check your input and try again.`;
      }
    }
    return `A student with this ${duplicateField} already exists. Please use a different value.`;
  }

  return `A student with these details already exists. Please check your input and try again.`;
}

// Create new student (simplified without transaction)
export const createStudent = async (
  data: CreateStudentRequest,
  tenantId: string,
  tenantName?: string,
  createdBy?: string,
  createdByRole?: string
) => {
  return await createStudentWithSession(data, tenantId, tenantName, undefined, createdBy, createdByRole);
};

// Create new student with session (for transaction support)
export const createStudentWithSession = async (
  data: CreateStudentRequest,
  tenantId: string,
  tenantName?: string,
  session?: mongoose.ClientSession,
  createdBy?: string,
  createdByRole?: string
) => {
  // Note: session parameter is not used here but kept for compatibility
  const finalTenantName = tenantName;

  if (!finalTenantName) {
    throw new Error("Tenant name is required");
  }

  try {
    // Generate random password if not provided
    if (!data.password || data.password.trim().length === 0) {
      data.password = generateRandomPassword();
    }

    // STEP 1: Validate everything upfront
    await validateStudentData(data, tenantId);

    // Enforce seats/quota (0 means unlimited)
    await assertSeatAvailable({ tenantId, type: "student", requested: 1 });

    // STEP 2: Create student in MongoDB transaction FIRST
    const sharedId = new mongoose.Types.ObjectId();
    const session = await mongoose.startSession();

    let student: IStudent | undefined;
    let storedSubjectIds: string[] = []; // Declare outside transaction to use after
    try {
      await session.withTransaction(async () => {
        student = await createStudentRecord(
          data,
          tenantId,
          finalTenantName,
          sharedId,
          session
        );

        // Add student to class if classId is provided and not empty
        if (data.classId && data.classId.trim().length > 0) {
          storedSubjectIds = await addStudentToClass(
            data.classId,
            student._id.toString(),
            tenantId,
            session,
            data.rollNumber,
            (student as any).stdId,
            finalTenantName,
            data.subjectIds
          );
          console.log(`📚 [createStudentWithSession] Stored subjectIds from addStudentToClass:`, storedSubjectIds);
        }
      });

      await session.endSession();
    } catch (error: any) {
      await session.endSession();

      // Check for duplicate key errors and provide user-friendly message
      const duplicateKeyMessage = getDuplicateKeyErrorMessage(error);
      if (duplicateKeyMessage) {
        const friendlyError: any = new Error(duplicateKeyMessage);
        friendlyError.isDuplicateKey = true;
        throw friendlyError;
      }

      throw new Error(`Student creation failed: ${error.message}`);
    }


    // STEP 3: Create user ONLY if student creation succeeded
    try {
      const user = await createUserInUserApi(
        data,
        tenantId,
        finalTenantName,
        sharedId
      );

      // ===== STEP 3.5: ALLOCATE INITIAL CREDITS TO STUDENT WALLET =====
      // Allocate free credits automatically when student is created
      // Credits are based on tenant's AiPracticeExamePerYear from seatsNlicense
      // This is done asynchronously - don't fail student creation if it fails
      // Use sharedId (same as student._id) to avoid TypeScript issues
      const studentIdForCredits = sharedId.toString();

      // Fetch tenant data to get AiPracticeExamePerYear
      tenantService
        .getTenantById(tenantId)
        .then((tenant) => {
          // Extract free credits from tenant's seatsNlicense.AiPracticeExamePerYear
          const freeCredits = tenant?.seatsNlicense?.AiPracticeExamePerYear ?? 0;

          // Only allocate credits if value is greater than 0
          if (freeCredits > 0) {
            allocateInitialCredits(
              studentIdForCredits,
              freeCredits, // Free credits from tenant.seatsNlicense.AiPracticeExamePerYear
              tenantId,
              finalTenantName,
              "system" // System allocation (not by parent)
            )
              .then(() => {
                console.log(
                  `✅ Initial ${freeCredits} credits allocated to student: ${studentIdForCredits} (from tenant AiPracticeExamePerYear)`
                );
              })
              .catch((creditError: any) => {
                // Log error but don't fail student creation
                console.error(
                  `⚠️ Failed to allocate initial credits to student ${studentIdForCredits}:`,
                  creditError.message
                );
                console.warn(
                  `⚠️ Student created successfully, but credits allocation failed. Credits can be allocated manually later if needed.`
                );
              });
          } else {
            console.log(
              `ℹ️ No free credits allocated to student ${studentIdForCredits} (AiPracticeExamePerYear is ${freeCredits} or not configured)`
            );
          }
        })
        .catch((tenantError: any) => {
          // Log error but don't fail student creation
          console.error(
            `⚠️ Failed to fetch tenant data for credit allocation:`,
            tenantError.message
          );
          console.warn(
            `⚠️ Student created successfully, but couldn't fetch tenant configuration for credits. Credits can be allocated manually later if needed.`
          );
        });

      // ===== STEP 4: SEND WELCOME EMAIL TO STUDENT =====
      // Send email asynchronously (don't block the response if email fails)
      // Only send email if email and password are provided
      if (data.email && data.password) {
        try {
          const { generateLoginUrl } = require("../utils/email.helper");
          const loginUrl = generateLoginUrl(finalTenantName);
          const userName = `${data.firstName} ${data.lastName}`;

          // Get partner name by querying database directly
          // Flow: tenantId -> query tenants collection -> get partnerId -> query partners collection -> get companyName
          let partnerName = finalTenantName || "Brighton AI"; // Fallback

          try {
            // Step 1: Query tenants collection directly to get partnerId
            const tenantsCollection =
              mongoose.connection.db?.collection("tenants");
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
            role: await getRoleDisplayNameForTenant({ tenantId, role: "Student" }),
            email: data.email,
            password: data.password, // Temporary password
            loginUrl: loginUrl,
            tenantName: finalTenantName || "Brighton AI Education", // For header
            partnerName: partnerName, // For footer - from partner.companyName
            features: [
              "View and submit assignments online",
              "Attempt exams and track your results",
              "Check grades and academic performance"
            ],
          };

          console.log("📧 Sending welcome email to student:", data.email);

          // Send email asynchronously - don't await to avoid blocking
          notificationService
            .sendEmailWithTemplate(
              data.email,
              "account-created",
              templateParams,
              tenantId,
              sharedId.toString()
            )
            .then(() => {
              console.log(
                `✅ Welcome email sent successfully to ${data.email}`
              );
            })
            .catch((emailError: any) => {
              // Log error but don't fail the student creation
              console.error(
                `⚠️ Failed to send welcome email to ${data.email}:`,
                emailError.message
              );
            });
        } catch (emailError: any) {
          // Log error but don't fail the student creation
          console.error(
            "⚠️ Error preparing welcome email:",
            emailError.message
          );
        }
      } else {
        console.warn(
          "⚠️ Email or password not provided, skipping welcome email for student"
        );
      }

      // ===== STEP 5: SEND NOTIFICATIONS =====
      // Send notifications asynchronously (don't block the response if notifications fail)
      // Only send notifications if student was successfully created
      if (!student) {
        console.warn("⚠️ Cannot send notifications: student record is not available");
      } else {
        try {
          // Use sharedId as the student's userId - this is what's used in the JWT token
          const studentUserIdString = sharedId.toString();
          const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
          const createdByString = createdBy ? (createdBy?.toString ? createdBy.toString() : String(createdBy)) : undefined;

          // Store student ID to avoid type narrowing issues
          const studentId = student._id.toString();

          console.log("📧 Preparing student notifications:", {
            studentUserId: studentUserIdString,
            sharedId: sharedId.toString(),
            tenantId: tenantIdString,
            createdBy: createdByString,
            createdByRole: createdByRole,
          });

          const studentName = `${data.firstName} ${data.lastName}`;
          const notifications: notificationService.INotificationRequest[] = [];

          // 1. Send notification to admin who created the student (if createdBy is provided)
          if (createdByString) {
            // Use the role from the request, or default to ADMIN
            const adminRole = createdByRole || "ADMIN";
            notifications.push({
              receiverId: createdByString,
              receiverRole: adminRole,
              title: "Student Created Successfully",
              content: `You have successfully created a new student account for ${studentName} (${data.email}).`,
              senderId: studentUserIdString,
              senderRole: "STUDENT",
              tenantId: tenantIdString,
              meta: {
                entityId: studentId,
                entityType: "Student",
                studentId: studentId,
                studentName: studentName,
                studentEmail: data.email,
              },
            });
            console.log(`📧 Prepared admin notification for: ${createdByString}`);
          }

          // 2. Send welcome notification to the newly created student
          notifications.push({
            receiverId: studentUserIdString,
            receiverRole: "STUDENT",
            title: "Welcome to the Platform!",
            content: `Welcome ${studentName}! Your student account has been successfully created. You can now log in and start accessing your classes, assignments, and exams.`,
            senderId: createdByString || "system",
            senderRole: createdByString ? (createdByRole || "ADMIN") : "SYSTEM",
            tenantId: tenantIdString,
            meta: {
              entityId: studentId,
              entityType: "Student",
              studentId: studentId,
              studentName: studentName,
            },
          });
          console.log(`📧 Prepared student welcome notification for: ${studentUserIdString}`);

          // Send all notifications
          if (notifications.length > 0) {
            console.log(`📤 Sending ${notifications.length} notification(s)...`);
            notificationService
              .sendNotifications(notifications)
              .then((result) => {
                console.log(
                  `✅ Successfully sent ${notifications.length} notification(s) for student creation:`,
                  result
                );
              })
              .catch((notificationError: any) => {
                // Log error but don't fail the student creation
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
          // Log error but don't fail the student creation
          console.error(
            "⚠️ Error preparing notifications:",
            notificationError.message,
            notificationError.stack
          );
        }
      }

      // Use subjectIds returned from addStudentToClass (already stored in class_students)
      // If not available, try to fetch from database as fallback
      let subjectIds: string[] = storedSubjectIds || [];

      if (subjectIds.length === 0 && student && data.classId && data.classId.trim().length > 0) {
        try {
          // Fallback: Fetch from database if not returned from addStudentToClass
          console.log(`🔍 [createStudent] Fallback: Fetching subjectIds from class_students table`);
          const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantId)
            ? new mongoose.Types.ObjectId(tenantId)
            : tenantId;

          const classStudentRecord = await classStudentRepository.findByClassAndStudent(
            tenantIdObj.toString(),
            data.classId,
            student._id.toString()
          );

          if (classStudentRecord && classStudentRecord.subjectIds && classStudentRecord.subjectIds.length > 0) {
            subjectIds = classStudentRecord.subjectIds.map((id: any) =>
              id.toString()
            );
            console.log(`✅ [createStudent] Found ${subjectIds.length} subjectId(s) from database:`, subjectIds);
          }
        } catch (error: any) {
          console.warn(
            `⚠️ [createStudent] Failed to fetch subjectIds from class_students (non-critical): ${error.message}`
          );
        }
      }

      console.log(`📚 [createStudent] Final subjectIds for response:`, subjectIds);

      // Add subjectIds to student object for response
      const studentResponse = student
        ? {
          ...student.toObject(),
          subjectIds: subjectIds,
        }
        : student;

      return {
        success: true,
        message: "Student created successfully with user account",
        data: {
          student: studentResponse,
          user: user,
        },
      };
    } catch (error: any) {
      // Clean up student if user creation fails
      await deleteStudentRecord(sharedId);
      throw new Error(`User creation failed: ${error.message}`);
    }
  } catch (error: any) {
    console.error("Create student error:", error);

    // If it's already a duplicate key error with user-friendly message, re-throw it
    if (error.isDuplicateKey) {
      throw error;
    }

    // Check if the nested error is a duplicate key error
    const duplicateKeyMessage = getDuplicateKeyErrorMessage(error);
    if (duplicateKeyMessage) {
      const friendlyError: any = new Error(duplicateKeyMessage);
      friendlyError.isDuplicateKey = true;
      throw friendlyError;
    }

    throw new Error(`Failed to create student: ${error.message}`);
  }
};

/**
 * Validate student data before creation
 */
async function validateStudentData(
  data: CreateStudentRequest,
  tenantId: string
): Promise<void> {
  // Basic required field validation
  if (!data.email) {
    throw new Error("Email is required for student creation");
  }
  if (!data.password) {
    throw new Error("Password is required for student creation");
  }
  if (!data.firstName) {
    throw new Error("First name is required for student creation");
  }
  if (!data.lastName) {
    throw new Error("Last name is required for student creation");
  }
  if (!data.gender) {
    throw new Error("Gender is required for student creation");
  }
  // Roll number is optional - only required if classId is provided
  if (
    data.classId &&
    (!data.rollNumber || data.rollNumber.trim().length === 0)
  ) {
    throw new Error("Roll number is required when classId is provided");
  }
  if (!data.phone) {
    throw new Error("Phone number is required for student creation");
  }

  // Format validations
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new Error("Invalid email format");
  }

  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  if (!/^[\+]?[0-9\-\s]{10,20}$/.test(data.phone)) {
    throw new Error(
      "Invalid phone number format. Must be 10-20 characters with optional + prefix"
    );
  }

  // Uniqueness validations - run in parallel for performance
  const validationPromises: Promise<any>[] = [
    studentRepository.findStudentByEmail(data.email, tenantId),
    UserApiIntegrationService.checkUserExists(
      data.email,
      data.email.toLowerCase(),
      tenantId
    ),
  ];

  // Only validate rollNumber if it's provided
  if (data.rollNumber && data.rollNumber.trim().length > 0) {
    validationPromises.push(
      studentRepository.findStudentByRollNumber(
        data.rollNumber,
        tenantId,
        data.classId
      )
    );
  }

  const results = await Promise.all(validationPromises);
  const existingEmail = results[0];
  const existingUser = results[1];
  const existingRollNumber =
    data.rollNumber && data.rollNumber.trim().length > 0 ? results[2] : null;

  if (existingEmail) {
    throw new Error(
      `Student with email ${data.email} already exists in this tenant`
    );
  }

  // Check roll number conflict only if rollNumber is provided
  if (data.rollNumber && data.rollNumber.trim().length > 0) {
    // Check roll number conflict in ClassStudent (source of truth for per-class uniqueness)
    if (data.classId && data.classId.trim().length > 0) {
      const existingClassRoll = await classStudentRepository.findByClassAndRoll(
        tenantId,
        data.classId,
        data.rollNumber
      );
      if (existingClassRoll) {
        throw new Error(
          `Student with roll number ${data.rollNumber} already exists in this class for this tenant`
        );
      }
    } else if (existingRollNumber) {
      // Fallback check on Student only when classId is not provided
      throw new Error(
        `Student with roll number ${data.rollNumber} already exists for this tenant`
      );
    }
  }

  if (existingUser.exists) {
    throw new Error(
      `User with email ${data.email} already exists in this tenant`
    );
  }
}

/**
 * Create student record in database with transaction support
 * Exported for bulk upload batch creation
 */
export async function createStudentRecord(
  data: CreateStudentRequest,
  tenantId: string,
  tenantName: string,
  sharedId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<IStudent> {
  const studentData: any = {
    _id: sharedId,
    userId: sharedId,
    // Only set studentId if explicitly provided; do NOT default to rollNumber
    ...(data.studentId ? { studentId: data.studentId } : {}),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    admissionDate: new Date(data.admissionDate || new Date()),
    tenantId: tenantId,
    tenantName: tenantName,

    // Optional fields
    address: data.address,
    gender: data.gender,
    spouseNumber: data.spouseNumber,
    className: data.className,
    currentGrade: data.currentGrade,
    section: data.section,
    academicYear: data.academicYear,
    status: data.status || "active",
    fatherName: data.fatherName,
    motherName: data.motherName,
    guardianName: data.guardianName,
    guardianPhone: data.guardianPhone,
    emergencyContact: data.emergencyContact,
    emergencyPhone: data.emergencyPhone,
    previousSchool: data.previousSchool,
    previousGrade: data.previousGrade,
    transferCertificate: data.transferCertificate,
    birthCertificate: data.birthCertificate,
    feeStructure: data.feeStructure,
    scholarship: data.scholarship,
    paymentStatus: data.paymentStatus || "pending",
    bloodGroup: data.bloodGroup,
    medicalConditions: data.medicalConditions,
    allergies: data.allergies,
    transportRequired: data.transportRequired || false,
    transportRoute: data.transportRoute,
    subjects: data.subjects || [],
    documents: data.documents || [],
    achievements: data.achievements || [],
    disciplinaryActions: data.disciplinaryActions || [],
    additionalInfo: data.additionalInfo || {},

    // Standard document fields
    isActive: data.isActive !== undefined ? data.isActive : true,
    isDeleted: false,
  };

  // Only include rollNumber if provided (optional for bulk upload)
  if (data.rollNumber && data.rollNumber.trim().length > 0) {
    studentData.rollNumber = data.rollNumber.trim();
  }

  // Only include classId if provided (optional for bulk upload)
  if (data.classId && data.classId.trim().length > 0) {
    studentData.classId = data.classId.trim();
  }

  // Final safety check: verify email doesn't exist (catches race conditions)
  const existingStudent = await studentRepository.findStudentByEmail(
    data.email!,
    tenantId
  );
  if (existingStudent) {
    throw new Error(
      `Student with email ${data.email} already exists in this tenant`
    );
  }

  return await studentRepository.createStudent(studentData, session);
}

/**
 * Create user in user-api
 */
async function createUserInUserApi(
  data: CreateStudentRequest,
  tenantId: string,
  tenantName: string,
  sharedId: mongoose.Types.ObjectId
): Promise<any> {
  const userData = {
    _id: sharedId,
    username: data.email!.toLowerCase(),
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    password: data.password,
    phoneNumber: data.phone,
    tenantId: tenantId,
    tenantName: tenantName,
    userType: "student",
    roleName: "STUDENT",
    userAccessType: "private",
    isEmailVerified: false,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdBy: "academic-api",
  };

  try {
    return await UserApiIntegrationService.createUser(userData);
  } catch (error: any) {
    if (
      error.message?.includes("USERNAME_EXISTS") ||
      error.message?.includes("USER_EXISTS") ||
      error.message?.includes("EMAIL_EXISTS") ||
      error.message?.includes("Duplicate key error")
    ) {
      return {
        success: false,
        message: "User account already exists for this email",
        data: null,
      };
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }
}

/**
 * Update robot avatar source for a student
 * @param userId - Auth user ID of the student
 * @param robotSrc - Source URL/path of the lottie file
 * @param tenantId - Tenant ID from JWT
 */
export async function updateRobotAvatar(
  userId: string,
  robotSrc: string,
  tenantId: string
) {
  // Find student by userId (which is same as _id/userId field) and tenantId
  const student = await studentRepository.findStudentById(userId);

  if (!student || student.tenantId !== tenantId) {
    throw new Error("Student not found or access denied");
  }

  // Update additionalInfo.robotSrc
  const additionalInfo = student.additionalInfo || {};
  additionalInfo.robotSrc = robotSrc;

  // Use studentRepository to update
  return await studentRepository.updateStudentById(student._id.toString(), {
    additionalInfo
  });
}

/**
 * Add student to class within transaction
 * Exported for bulk upload batch creation
 */
export async function addStudentToClass(
  classId: string,
  studentId: string,
  tenantId: string,
  session?: mongoose.ClientSession,
  rollNumber?: string,
  stdId?: string,
  tenantName?: string,
  subjectIds?: string[]
): Promise<string[]> {
  try {
    const classRepository = new ClassRepository();

    // Get the class to verify it exists
    const classData = await classRepository.findById(classId, tenantId);
    if (!classData) {
      console.warn(
        `⚠️ Class with ID ${classId} not found. Skipping class assignment.`
      );
      return []; // Return empty array since function now returns string[]
    }

    // Enforce class capacity if defined
    const currentStudentCount = classData.studentIds?.length || 0;
    if (
      typeof (classData as any).capacity === "number" &&
      (classData as any).capacity >= 0 &&
      currentStudentCount >= (classData as any).capacity
    ) {
      throw new Error("Class is at full capacity");
    }

    // Check if student already exists in class
    const studentExistsInClass = classData.studentIds.some(
      (id) => id.toString() === studentId
    );

    console.log(`🎯 [addStudentToClass] Starting process - Student: ${studentId}, Class: ${classId}`);
    console.log(`🔍 [addStudentToClass] Student exists in class: ${studentExistsInClass}`);

    let isNewlyAdded = false;
    if (!studentExistsInClass) {
      await classRepository.addStudent(classId, studentId, tenantId);
      console.log(`✅ [addStudentToClass] Student ${studentId} added to class ${classId}`);
      isNewlyAdded = true;
    } else {
      console.log(`ℹ️ [addStudentToClass] Student ${studentId} already exists in class ${classId}`);
    }

    // Create ClassStudent junction row (enforces per-class roll uniqueness)
    if (rollNumber && stdId) {
      // Convert tenantId to ObjectId if it's a string (it's stored as ObjectId in DB)
      const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

      const classStudentData: any = {
        classId: new mongoose.Types.ObjectId(classId),
        studentId: new mongoose.Types.ObjectId(studentId),
        stdId,
        rollNumber,
        tenantId: tenantIdObj,
        tenantName: tenantName || "",
        createdBy: "academy-api",
        isActive: true,
        isDeleted: false,
      };

      // Add subjectIds if provided
      if (subjectIds && Array.isArray(subjectIds) && subjectIds.length > 0) {
        classStudentData.subjectIds = subjectIds.map(
          (id) => new mongoose.Types.ObjectId(id)
        );
        console.log(
          `📚 [addStudentToClass] Adding ${subjectIds.length} subject(s) to class_students entry`
        );
      }

      await classStudentRepository.create(classStudentData, session);
      console.log(
        `✅ ClassStudent created for student ${studentId} in class ${classId} with roll ${rollNumber}${subjectIds && subjectIds.length > 0 ? ` and ${subjectIds.length} subject(s)` : ""}`
      );

      // Return subjectIds that were stored
      return subjectIds && Array.isArray(subjectIds) ? subjectIds : [];
    } else {
      console.warn(
        "⚠️ Missing rollNumber or stdId; skipping ClassStudent creation."
      );
      return [];
    }

    // Send notifications if student was newly added
    console.log(`🔔 [addStudentToClass] Checking if notifications should be sent. isNewlyAdded: ${isNewlyAdded}`);
    if (isNewlyAdded) {
      try {
        console.log(`📧 [addStudentToClass] Starting notification process for newly added student...`);
        const { sendNotifications } = await import("./notification.service");
        const { findStudentById } = await import("../repositories/student.repository");

        console.log(`🔍 [addStudentToClass] Fetching student details for ${studentId}...`);
        // Get student details for notification
        const student = await findStudentById(studentId);
        console.log(`📋 [addStudentToClass] Student found:`, {
          id: studentId,
          firstName: student?.firstName,
          lastName: student?.lastName,
          exists: !!student
        });

        const firstName = student?.firstName || "";
        const lastName = student?.lastName || "";
        const studentName = firstName && lastName
          ? `${firstName} ${lastName}`.trim()
          : firstName || lastName || "New student";

        console.log(`👤 [addStudentToClass] Student name: ${studentName}`);

        const notificationsToSend: any[] = [];
        console.log(`📝 [addStudentToClass] Preparing notifications...`);
        const className = classData?.name || "Unknown Class";
        console.log(`🏫 [addStudentToClass] Class details:`, {
          classId,
          className: className,
          tenantId
        });

        // 1. Notification to student
        const studentNotification = {
          receiverId: studentId,
          receiverRole: "STUDENT",
          title: "Added to Class",
          content: `You have been added to ${className}`,
          meta: {
            entityId: classId,
            entityType: "class",
            className: className,
          },
          tenantId: tenantId,
        };
        notificationsToSend.push(studentNotification);
        console.log(`✅ [addStudentToClass] Student notification prepared:`, studentNotification);

        // 2. Get all teachers assigned to this class and send notifications
        console.log(`🔍 [addStudentToClass] Fetching teachers for class ${classId}...`);
        const { TeacherAssignClassesRepository } = await import(
          "../repositories/teacherAssignClasses.repository"
        );
        const teacherAssignments =
          await TeacherAssignClassesRepository.findAssignmentsByClass(
            classId,
            tenantId
          );
        console.log(`📊 [addStudentToClass] Found ${teacherAssignments.length} teacher assignment(s)`);

        // Get unique teacher IDs
        const teacherIds = new Set<string>();
        teacherAssignments.forEach((assignment: any) => {
          if (assignment.teacherId) {
            // Handle both ObjectId and populated teacher object
            const teacherIdStr =
              typeof assignment.teacherId === "string"
                ? assignment.teacherId
                : assignment.teacherId._id
                  ? assignment.teacherId._id.toString()
                  : assignment.teacherId.toString();
            teacherIds.add(teacherIdStr);
            console.log(`👨‍🏫 [addStudentToClass] Found teacher: ${teacherIdStr}`);
          }
        });
        console.log(`📋 [addStudentToClass] Total unique teachers: ${teacherIds.size}`);

        // Add notification for each teacher
        teacherIds.forEach((teacherId) => {
          const teacherNotification = {
            receiverId: teacherId,
            receiverRole: "TEACHER",
            title: "New Student Added",
            content: `${studentName} has been added to ${className}`,
            meta: {
              entityId: classId,
              entityType: "class",
              className: className,
              studentId: studentId,
              studentName: studentName,
            },
            tenantId: tenantId,
          };
          notificationsToSend.push(teacherNotification);
          console.log(`✅ [addStudentToClass] Teacher notification prepared for ${teacherId}`);
        });

        // 3. Get all parents/guardians of the student and send notifications
        console.log(`🔍 [addStudentToClass] Fetching parents for student ${studentId}...`);
        const { findParentsByChildId } = await import("../repositories/parentChild.repository");
        const parentRelationships = await findParentsByChildId(studentId);
        console.log(`📊 [addStudentToClass] Found ${parentRelationships.length} parent/guardian relationship(s)`);

        // Add notification for each parent/guardian
        parentRelationships.forEach((relationship: any) => {
          if (relationship.parentId) {
            const parentIdStr =
              typeof relationship.parentId === "string"
                ? relationship.parentId
                : relationship.parentId._id
                  ? relationship.parentId._id.toString()
                  : relationship.parentId.toString();

            const parentNotification = {
              receiverId: parentIdStr,
              receiverRole: "PARENT",
              title: "Child Added to Class",
              content: `Your child ${studentName} has been added to ${className}`,
              meta: {
                entityId: classId,
                entityType: "class",
                className: className,
                studentId: studentId,
                studentName: studentName,
              },
              tenantId: tenantId,
            };
            notificationsToSend.push(parentNotification);
            console.log(`✅ [addStudentToClass] Parent notification prepared for ${parentIdStr}`);
          }
        });

        // Send all notifications in bulk
        if (notificationsToSend.length > 0) {
          console.log(
            `📤 [addStudentToClass] Sending ${notificationsToSend.length} notification(s)...`
          );
          console.log(`📦 [addStudentToClass] Notification payload:`, JSON.stringify(notificationsToSend, null, 2));

          const result = await sendNotifications(notificationsToSend);
          console.log(
            `✅ [addStudentToClass] Successfully sent ${notificationsToSend.length} notification(s) (1 student + ${teacherIds.size} teacher(s))`
          );
          console.log(`📬 [addStudentToClass] Notification API response:`, JSON.stringify(result, null, 2));
        } else {
          console.warn(`⚠️ [addStudentToClass] No notifications to send!`);
        }
      } catch (notificationError) {
        console.error(
          `❌ [addStudentToClass] Failed to send notifications:`,
          notificationError
        );
        console.error(`❌ [addStudentToClass] Error stack:`, (notificationError as Error).stack);
        // Non-fatal: continue even if notification fails
      }
    } else {
      console.log(`ℹ️ [addStudentToClass] Student was not newly added, skipping notifications`);
    }
  } catch (error: any) {
    // Log error but don't fail the transaction
    console.error("⚠️ Failed to add student to class:", error.message);
    throw error; // Re-throw to rollback transaction
  }
}

/**
 * Delete student record (cleanup if user creation fails)
 * Exported for bulk upload batch creation
 */
export async function deleteStudentRecord(
  studentId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await studentRepository.deleteStudentById(studentId.toString());
    console.log(`✅ Cleaned up student record: ${studentId}`);
  } catch (error: any) {
    // Log but don't throw - user creation already failed
    console.error(`⚠️ Failed to cleanup student ${studentId}:`, error.message);
  }
}

// Get all students
export const getAllStudents = async (
  tenantId: string,
  pageNo: number = 1,
  pageSize: number = 10,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const params = {
      pageNo,
      pageSize,
      tenantId,
      filters,
      sort,
    };

    const students = await studentRepository.findStudents(params);
    const total = await studentRepository.countStudents(params);

    // Get unique classIds from students
    const classIds = students
      .map((student: any) => {
        const classId = student.classId?.toString() || student.classId;
        return classId && classId !== "null" ? classId : null;
      })
      .filter((id: string | null) => id !== null) as string[];

    // Fetch classes in bulk to get class names
    const classMap = new Map<string, string>();
    if (classIds.length > 0) {
      try {
        const { ClassRepository } = await import(
          "../repositories/class.repository"
        );
        const classRepository = new ClassRepository();
        const uniqueClassIds = [...new Set(classIds)];

        // Fetch classes in bulk using findByIds for better performance
        const classes = await classRepository.findByIds(
          uniqueClassIds,
          tenantId
        );
        classes.forEach((classData) => {
          const classId = classData._id?.toString() || classData.id?.toString();
          if (classId) {
            classMap.set(classId, classData.name || "");
          }
        });
      } catch (err) {
        console.warn("Could not fetch class names:", err);
      }
    }

    // Fetch subjectIds from class_students table for all students in bulk
    const studentIds = students.map((student: any) => {
      const studentId = student._id?.toString() || student.id?.toString() || student._id;
      return studentId;
    }).filter((id: string | undefined) => id);

    console.log(`🔍 [getAllStudents] Fetching subjectIds for ${studentIds.length} students, tenantId: ${tenantId}`);

    const subjectIdsMap = new Map<string, string[]>(); // Map: studentId_classId -> subjectIds[]
    if (studentIds.length > 0) {
      try {
        const classStudentRecords = await classStudentRepository.findByStudentIds(
          studentIds,
          tenantId
        );

        console.log(`📚 [getAllStudents] Found ${classStudentRecords.length} class_students records`);

        // Map subjectIds by studentId and classId
        classStudentRecords.forEach((record: any) => {
          const studentId = record.studentId?.toString();
          const classId = record.classId?.toString();
          if (studentId && classId) {
            // Use studentId+classId as key to handle students in multiple classes
            const key = `${studentId}_${classId}`;
            const subjectIds = record.subjectIds && Array.isArray(record.subjectIds)
              ? record.subjectIds.map((id: any) => id.toString())
              : [];
            subjectIdsMap.set(key, subjectIds);
            console.log(`📚 [getAllStudents] Mapped ${key} -> ${subjectIds.length} subject(s):`, subjectIds);
          }
        });

        console.log(`📚 [getAllStudents] Total mappings created: ${subjectIdsMap.size}`);
      } catch (err: any) {
        console.error("❌ [getAllStudents] Could not fetch subjectIds from class_students:", err?.message || err);
      }
    }

    // Remove/comments out these fields from response: Teacher Name, Class Assign, Subject, Student Performance
    // Add className and subjectIds fields
    const cleanedStudents = students.map((student: any) => {
      const studentObj = student.toObject ? student.toObject() : student;

      // Normalize studentId - try multiple formats
      let studentId = studentObj._id?.toString() || studentObj.id?.toString();
      if (!studentId && studentObj._id) {
        studentId = typeof studentObj._id === 'string' ? studentObj._id : studentObj._id.toString();
      }

      // Normalize classId - try multiple formats
      let classId = studentObj.classId?.toString() || studentObj.classId;
      if (classId && typeof classId !== 'string') {
        classId = classId.toString();
      }

      // Remove null/undefined/empty classId
      if (!classId || classId === "null" || classId === "undefined" || classId === "") {
        classId = null;
      }

      // Add className
      if (classId) {
        studentObj.className =
          classMap.get(classId) || studentObj.className || "";
      } else {
        studentObj.className = studentObj.className || "";
      }

      // Add subjectIds from class_students table
      if (studentId && classId) {
        const key = `${studentId}_${classId}`;
        const subjectIds = subjectIdsMap.get(key) || [];
        studentObj.subjectIds = subjectIds;

        // Debug logging for missing subjectIds
        if (subjectIds.length === 0) {
          console.log(`⚠️ [getAllStudents] No subjectIds found for:`, {
            studentId,
            classId,
            key,
            keyExists: subjectIdsMap.has(key),
            totalKeysInMap: subjectIdsMap.size,
            sampleKeys: Array.from(subjectIdsMap.keys()).slice(0, 3)
          });
        }
      } else {
        studentObj.subjectIds = [];
        if (!studentId) {
          console.log(`⚠️ [getAllStudents] Missing studentId for student:`, studentObj.firstName, studentObj.lastName);
        }
        if (!classId) {
          console.log(`⚠️ [getAllStudents] Missing classId for student:`, studentObj.firstName, studentObj.lastName, `studentId: ${studentId}`);
        }
      }

      // Remove these fields if they exist
      delete studentObj.teacherName;
      delete studentObj.classAssign;
      delete studentObj.classAssignment;
      delete studentObj.subject;
      delete studentObj.subjects;
      delete studentObj.studentPerformance;
      delete studentObj.performance;
      delete studentObj.performanceStatus;
      return studentObj;
    });

    return {
      students: cleanedStudents,
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error: any) {
    console.error("Get all students error:", error);
    throw new Error(`Failed to get students: ${error.message}`);
  }
};

// Get student by ID
export const getStudentById = async (id: string) => {
  try {
    const student = await studentRepository.findStudentById(id);
    if (!student) {
      throw new Error("Student not found");
    }

    let classTeacher = "";
    let className = "";
    let section = "";
    let grade: number = NaN;
    let strongestSubject = { name: "N/A", percentage: 0 };
    let weakestSubject = { name: "N/A", percentage: 0 };
    let subjectIds: string[] = [];

    // Fetch subjectIds from class_students table
    try {
      const tenantId = student.tenantId?.toString() || "";
      if (tenantId && student.classId) {
        const classStudentRecord = await classStudentRepository.findByClassAndStudent(
          tenantId,
          student.classId.toString(),
          id
        );
        if (classStudentRecord && classStudentRecord.subjectIds && Array.isArray(classStudentRecord.subjectIds)) {
          subjectIds = classStudentRecord.subjectIds.map((id: any) => id.toString());
        }
      }
    } catch (err) {
      console.warn("Could not fetch subjectIds from class_students:", err);
    }

    if (student.classId) {
      const { Class } = await import("../models/class.schema");
      const classData = await Class.findOne({
        _id: student.classId,
        isDeleted: false,
      })
        .select("name grade section classTeacherId")
        .populate("classTeacherId", "firstName lastName")
        .lean();

      if (classData) {
        className = classData.name || "";
        grade = classData.grade || NaN;
        section = classData.section || "";
        if (classData.classTeacherId) {
          const teacher = classData.classTeacherId as any;
          classTeacher = `${teacher.firstName || ""} ${teacher.lastName || ""
            }`.trim();
        }
      }
    }

    // Get class rank
    const ExamAttempt = (await import("../models/examAttempt.schema")).default;
    let classRank = "N/A";
    if (student.classId) {
      const rankings = await ExamAttempt.aggregate([
        {
          $match: {
            classId: new mongoose.Types.ObjectId(student.classId),
            attemptStatus: "Graded",
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
        {
          $sort: { averagePercentage: -1 },
        },
      ]);

      const studentIdStr = student._id.toString();
      const rankIndex = rankings.findIndex(
        (r: any) => r._id.toString() === studentIdStr
      );
      if (rankIndex !== -1) {
        classRank = `${rankIndex + 1}/${rankings.length}`;
      }
    }

    // Get overall percentage
    const overallStats = await ExamAttempt.aggregate([
      {
        $match: {
          studentId: student._id,
          attemptStatus: "Graded",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalObtainedMarks: { $sum: "$obtainedMarks" },
          totalPossibleMarks: { $sum: "$totalMarks" },
        },
      },
      {
        $addFields: {
          overallAvg: {
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
    const overallPercentage =
      overallStats.length > 0
        ? Math.round(overallStats[0].overallAvg * 100) / 100
        : 0;

    // Get subject performance - ONLY for subjects assigned to this student
    let subjectPerformance: any[] = [];
    if (student.classId && subjectIds && subjectIds.length > 0) {
      const { Class } = await import("../models/class.schema");

      // 1. Get class with subjects populated
      const classWithSubjects = await Class.findOne({
        _id: student.classId,
        isDeleted: false,
      })
        .populate("subjectIds", "name")
        .lean();

      if (
        classWithSubjects?.subjectIds &&
        (classWithSubjects.subjectIds as any[]).length > 0
      ) {
        // Get all class subject IDs (for teacher assignment lookup)
        const classSubjectIds = (classWithSubjects.subjectIds as any[]).map(
          (s) => s._id
        );
        const section = (classWithSubjects as any).section || "";

        // 2. Get teacher assignments for assigned subjects only (single query)
        const TeacherAssignClasses = (
          await import("../models/teacherAssignClasses.schema")
        ).default;
        // Convert student's subjectIds to ObjectIds for query
        const studentSubjectObjectIds = subjectIds.map(
          (id: string) => new mongoose.Types.ObjectId(id)
        );
        const teacherAssignments = await TeacherAssignClasses.find({
          classId: student.classId,
          subjectId: { $in: studentSubjectObjectIds },
          status: "active",
          isDeleted: false,
        })
          .populate("teacherId", "firstName lastName")
          .lean();

        // Create teacher lookup map
        const teacherMap = new Map<string, string>();
        for (const ta of teacherAssignments) {
          const teacher = (ta as any).teacherId;
          if (teacher) {
            teacherMap.set(
              (ta as any).subjectId.toString(),
              `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim()
            );
          }
        }

        // 3. Get student's average score per subject (only for assigned subjects)
        const ExamAttempt = (await import("../models/examAttempt.schema"))
          .default;
        const subjectScores = await ExamAttempt.aggregate([
          {
            $match: {
              studentId: student._id,
              subjectId: { $in: studentSubjectObjectIds },
              attemptStatus: "Graded",
              isDeleted: false,
            },
          },
          {
            $group: {
              _id: "$subjectId",
              totalObtainedMarks: { $sum: "$obtainedMarks" },
              totalPossibleMarks: { $sum: "$totalMarks" },
            },
          },
          {
            $addFields: {
              avgScore: {
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

        // Create score lookup map
        const scoreMap = new Map<string, number>();
        for (const s of subjectScores) {
          scoreMap.set(s._id.toString(), Math.round(s.avgScore * 100) / 100);
        }

        // 4. Build subject performance array - ONLY for subjects assigned to this student
        // Filter to only include subjects in the student's subjectIds from class_students
        let maxScore = -Infinity;
        let minScore = Infinity;

        // Convert student's subjectIds to a Set for efficient lookup
        const studentSubjectIdsSet = new Set(subjectIds.map((id: string) => id.toString()));

        // Filter subjects to only those assigned to the student
        const assignedSubjects = (classWithSubjects.subjectIds as any[]).filter(
          (subject) => studentSubjectIdsSet.has(subject._id.toString())
        );

        subjectPerformance = assignedSubjects.map(
          (subject) => {
            const subjectId = subject._id.toString();
            const performance = scoreMap.get(subjectId);

            if (performance !== undefined) {
              if (performance > maxScore) {
                maxScore = performance;
                strongestSubject = {
                  name: subject.name || "Unknown",
                  percentage: performance,
                };
              }
              if (performance < minScore) {
                minScore = performance;
                weakestSubject = {
                  name: subject.name || "Unknown",
                  percentage: performance,
                };
              }
            }

            return {
              subjectId,
              subjectName: subject.name || "Unknown",
              teacherName: teacherMap.get(subjectId) || "TBA",
              room: section ? `Section ${section}` : "",
              performance: performance || 0,
            };
          }
        );

        // Apply thresholds: Strongest > 80%, Weakest < 50%
        if (strongestSubject.percentage <= 80) {
          strongestSubject = { name: "N/A", percentage: 0 };
        }
        if (weakestSubject.percentage >= 50) {
          weakestSubject = { name: "N/A", percentage: 0 };
        }
      }
    }

    // Get upcoming exams (published exams with future endOn date) - ONLY for assigned subjects
    let upcomingExams: any[] = [];
    if (student.classId && subjectIds && subjectIds.length > 0) {
      const Exam = (await import("../models/exam.schema")).default;
      const now = new Date();

      // Fetch potential upcoming exams (active or future)
      const candidates = await Exam.find({
        classId: student.classId,
        examStatus: "Published",
        endOn: { $gt: now },
        isDeleted: false,
      })
        .sort({ endOn: 1 }) // Closest deadline first
        .limit(20)
        .populate("subjectId", "name")
        .lean();

      // Check which ones are already completed by the student
      const { default: ExamAttempt } = await import(
        "../models/examAttempt.schema"
      );
      const candidateIds = candidates.map((c: any) => c._id);

      const completedAttempts = await ExamAttempt.find({
        studentId: student._id,
        examId: { $in: candidateIds },
        attemptStatus: { $in: ["Submitted", "Graded"] },
        isDeleted: false,
      })
        .select("examId")
        .lean();

      const completedExamIds = new Set(
        completedAttempts.map((a: any) => a.examId.toString())
      );

      // Filter to only include exams for subjects assigned to the student
      // Convert student's subjectIds to a Set for efficient lookup
      const studentSubjectIdsSet = new Set(subjectIds.map((id: string) => id.toString()));

      // Filter and map - only include exams for assigned subjects
      upcomingExams = candidates
        .filter((c: any) => {
          const examSubjectId = (c.subjectId as any)?._id?.toString() || (c.subjectId as any)?.toString();
          return !completedExamIds.has(c._id.toString()) &&
            studentSubjectIdsSet.has(examSubjectId);
        })
        .slice(0, 5)
        .map((e: any) => ({
          examId: e._id.toString(),
          examTitle: e.examTitle,
          subjectName: (e.subjectId as any)?.name || "Unknown",
          dueDate: e.endOn,
          examType: e.examType,
        }));
    }

    // Get achievements and counts
    const { ExamCredential } = await import("../models/examCredential.schema");

    const achievementsData = await ExamCredential.find({
      studentId: student._id,
      isActive: true,
      isDeleted: false,
    })
      .sort({ issuedDate: -1 })
      .lean();

    const totalAchievements = achievementsData.length;
    const badgeCount = achievementsData.filter(
      (a: any) => a.credentialType === "badge"
    ).length;
    const certificateCount = achievementsData.filter(
      (a: any) => a.credentialType === "certificate"
    ).length;

    const awardCount = achievementsData.filter(
      (a: any) => a.credentialType === "award"
    ).length;

    const recentAchievements = achievementsData.slice(0, 5).map((a: any) => ({
      achievementId: a._id.toString(),
      title: a.credentialName,
      description: a.description,
      type: a.credentialType,
      date: a.issuedDate,
      url: a.credentialUrl,
      code: a.verificationCode,
      examId: a.examId ? a.examId.toString() : null,
    }));

    // Calculate subject stats
    const totalSubjects = subjectPerformance.length;
    const subjectNames = subjectPerformance.map((s: any) => s.subjectName);

    // --- FEEDBACK LOGIC ---
    // Find latest graded exam attempt for this student
    let aiFeedback = "";
    let teacherFeedback = "";
    try {
      const ExamAttempt = (await import("../models/examAttempt.schema")).default;
      const latestAttempt = await ExamAttempt.findOne({
        studentId: student._id,
        attemptStatus: "Graded",
        isDeleted: false,
      })
        .sort({ gradedOn: -1 })
        .lean();
      if (latestAttempt) {
        // AI feedback: prefer overallAssessment, fallback to overallFeedback, aiFeedback, or a default string
        aiFeedback =
          latestAttempt.overallAssessment ||
          latestAttempt.overallFeedback ||
          latestAttempt.aiFeedback ||
          "No AI feedback available.";
        // Teacher feedback: use teacherFeedback or a default string
        teacherFeedback =
          latestAttempt.teacherFeedback ||
          "No teacher feedback available.";
      } else {
        aiFeedback = "No AI feedback available.";
        teacherFeedback = "No teacher feedback available.";
      }
    } catch (err) {
      aiFeedback = "No AI feedback available.";
      teacherFeedback = "No teacher feedback available.";
    }

    return {
      success: true,
      data: {
        ...student.toObject(),
        className,
        section: grade,
        overallPercentage,
        grade,
        classRank,
        classTeacher,
        totalSubjects,
        subjectNames,
        strongestSubject,
        weakestSubject,
        totalAchievements,
        badgeCount,
        certificateCount,
        awardCount,
        subjectPerformance,
        upcomingExams,
        recentAchievements,
        subjectIds, // Add subjectIds from class_students table
        aiFeedback,
        teacherFeedback,
      },
    };
  } catch (error: any) {
    console.error("Get student by ID error:", error);
    throw new Error(`Failed to get student: ${error.message}`);
  }
};

// Get currently logged-in student's profile by shared user ID
export const getMyProfile = async (userId: string) => {
  try {
    const student = await studentRepository.findStudentById(userId);
    if (!student) {
      throw new Error("Student not found");
    }
    return {
      success: true,
      data: student,
    };
  } catch (error: any) {
    console.error("Get my student profile error:", error);
    throw new Error(`Failed to get student profile: ${error.message}`);
  }
};

// Get my class details with subjects
export const getMyClassDetails = async (userId: string, tenantId: string) => {
  try {
    console.log(
      `🔍 Getting class details for userId: ${userId}, tenantId: ${tenantId}`
    );

    // Get student by userId
    const student = await studentRepository.findStudentById(userId);
    if (!student) {
      throw new Error("Student not found");
    }

    // console.log(
    //   `✅ Student found - classId: ${student.classId
    //   }, type: ${typeof student.classId}`
    // );

    // Check if student has classId
    if (!student.classId) {
      return {
        success: true,
        message: "Student is not assigned to any class",
        data: {
          class: null,
          subjects: [],
        },
      };
    }

    // Import Class model and ObjectId dynamically to avoid circular dependency
    const { Class } = await import("../models/class.schema");
    const mongoose = await import("mongoose");
    const ObjectId = mongoose.Types.ObjectId;

    // Validate and convert IDs
    const classId = student.classId?.toString().trim();
    if (!classId || !ObjectId.isValid(classId)) {
      throw new Error(`Invalid classId: ${classId}`);
    }

    // Convert tenantId to ObjectId (Class schema stores tenantId as ObjectId)
    if (!ObjectId.isValid(tenantId.trim())) {
      throw new Error(`Invalid tenantId format: ${tenantId}`);
    }
    const tenantIdObj = new ObjectId(tenantId.trim());

    console.log(
      `🔍 Getting class details - classId: ${classId}, tenantId: ${tenantId} (${tenantIdObj})`
    );

    // Get class details with populated subjects
    const classData = await Class.findOne({
      _id: new ObjectId(classId),
      tenantId: tenantIdObj,
      isDeleted: false,
    })
      .populate({
        path: "subjectIds",
        select: "_id name code type description",
        match: { isDeleted: false },
      })
      .select("_id name grade section academicYear description subjectIds")
      .lean();

    console.log(`📚 Class data found:`, classData ? "Yes" : "No");

    if (!classData) {
      // Try without tenantId to see if class exists
      const classWithoutTenant = await Class.findOne({
        _id: new ObjectId(classId),
        isDeleted: false,
      }).lean();

      if (classWithoutTenant) {
        const classTenantId =
          classWithoutTenant.tenantId?.toString() ||
          classWithoutTenant.tenantId;
        const studentTenantId =
          student.tenantId?.toString() || student.tenantId;

        console.log(`⚠️ Class exists but tenantId mismatch.`);
        console.log(`   Class tenantId: ${classTenantId}`);
        console.log(`   Student tenantId: ${studentTenantId}`);
        console.log(`   Request tenantId: ${tenantId}`);

        // Check if student's tenantId matches class tenantId (student might be from different tenant)
        if (
          studentTenantId &&
          classTenantId &&
          studentTenantId !== classTenantId
        ) {
          throw new Error(
            `Student is assigned to a class from a different tenant. Student tenant: ${studentTenantId}, Class tenant: ${classTenantId}`
          );
        }

        // If tenantId from JWT doesn't match, but student and class are from same tenant, use class data
        if (studentTenantId === classTenantId && tenantId !== classTenantId) {
          console.log(
            `⚠️ JWT tenantId doesn't match, but student and class are from same tenant. Using class data.`
          );
          // Use the class data anyway since student and class match
          const classDataWithMatchingTenant = await Class.findOne({
            _id: new ObjectId(classId),
            tenantId: new ObjectId(studentTenantId),
            isDeleted: false,
          })
            .populate({
              path: "subjectIds",
              select: "_id name code type description",
              match: { isDeleted: false },
            })
            .select(
              "_id name grade section academicYear description subjectIds"
            )
            .lean();

          if (classDataWithMatchingTenant) {
            // Use this class data
            const subjects = (classDataWithMatchingTenant.subjectIds || [])
              .filter(
                (subject: any) => subject !== null && subject !== undefined
              )
              .map((subject: any) => ({
                id: subject._id?.toString() || subject.id?.toString() || null,
                name: subject.name || "",
                code: subject.code || "",
                type: subject.type || "",
                description: subject.description || "",
              }));

            const classDetails = {
              id:
                classDataWithMatchingTenant._id?.toString() ||
                classDataWithMatchingTenant.id?.toString() ||
                null,
              name: classDataWithMatchingTenant.name || "",
              grade: classDataWithMatchingTenant.grade || null,
              section: classDataWithMatchingTenant.section || null,
              description: classDataWithMatchingTenant.description || "",
            };

            return {
              success: true,
              message: "Class details retrieved successfully",
              data: {
                class: classDetails,
                subjects: subjects,
              },
            };
          }
        }

        throw new Error("Class not found for this tenant");
      }
      throw new Error("Class not found");
    }

    // Format subjects
    const subjects = (classData.subjectIds || [])
      .filter((subject: any) => subject !== null && subject !== undefined)
      .map((subject: any) => ({
        id: subject._id?.toString() || subject.id?.toString() || null,
        name: subject.name || "",
        code: subject.code || "",
        type: subject.type || "",
        description: subject.description || "",
      }));

    // Format class details
    const classDetails = {
      id: classData._id?.toString() || classData.id?.toString() || null,
      name: classData.name || "",
      grade: classData.grade || null,
      section: classData.section || null,
      description: classData.description || "",
    };

    return {
      success: true,
      message: "Class details retrieved successfully",
      data: {
        class: classDetails,
        subjects: subjects,
      },
    };
  } catch (error: any) {
    console.error("Get my class details error:", error);
    throw new Error(`Failed to get class details: ${error.message}`);
  }
};

// Update student
export const updateStudent = async (
  id: string,
  data: UpdateStudentRequest,
  tenantId: string
) => {
  try {
    const student = await studentRepository.findStudentById(id);
    if (!student) {
      throw new Error("Student not found");
    }

    // Check if email is being updated and if it conflicts
    if (data.email && data.email !== student.email) {
      const existingStudent = await studentRepository.findStudentByEmail(
        data.email,
        tenantId
      );
      if (existingStudent && existingStudent._id.toString() !== id) {
        throw new Error(
          `Student with email ${data.email} already exists in this tenant`
        );
      }
    }

    // Check if roll number is being updated and if it conflicts
    if (data.rollNumber && data.rollNumber !== student.rollNumber) {
      // Use the classId from the update data, or fall back to existing student's classId
      const classIdToCheck = data.classId || student.classId;
      const existingStudent = await studentRepository.findStudentByRollNumber(
        data.rollNumber,
        tenantId,
        classIdToCheck
      );
      if (existingStudent && existingStudent._id.toString() !== id) {
        throw new Error(
          `Student with roll number ${data.rollNumber} already exists in this class for this tenant`
        );
      }
    }

    const updatedStudent = await studentRepository.updateStudentById(id, data);
    if (!updatedStudent) {
      throw new Error("Failed to update student");
    }

    // ===== STEP: SYNC WITH USER-API =====
    try {
      const { UserApiIntegrationService } = await import("./userApiIntegration.service");

      const userIdForUpdate = student.userId
        ? student.userId.toString()
        : id; // Fallback to id if userId is not present

      const userUpdateData: any = {};
      if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
      if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
      if (data.email !== undefined) userUpdateData.email = data.email;
      if (data.phone !== undefined) userUpdateData.phoneNumber = data.phone;

      // Handle isActive status sync
      // Map 'status' to 'isActive' if status is being updated
      if (data.status !== undefined) {
        userUpdateData.isActive = data.status === 'active';
      } else if (data.isActive !== undefined) {
        // Or if isActive is directly provided in data
        userUpdateData.isActive = data.isActive;
      }

      if (Object.keys(userUpdateData).length > 0) {
        console.log(`🔄 [updateStudent] Syncing user data to user-api for userId ${userIdForUpdate}:`, userUpdateData);
        await UserApiIntegrationService.updateUser(userIdForUpdate, userUpdateData);
        console.log("✅ [updateStudent] User entity updated successfully in user-api");
      }
    } catch (syncError: any) {
      console.warn(`⚠️ [updateStudent] Failed to sync with user-api: ${syncError.message}`);
      // We continue since the student record was already updated successfully in academic-api
    }

    // ===== STEP: SYNC STATUS WITH PARENTCHILDREN COLLECTION =====
    if (data.status !== undefined || data.isActive !== undefined) {
      try {
        const { updateStatusByChildId } = await import("../repositories/parentChild.repository");
        const newStatus = data.status || (data.isActive ? STATUS.ACTIVE : STATUS.INACTIVE);
        const newIsActive = data.isActive !== undefined ? data.isActive : (data.status === STATUS.ACTIVE);

        await updateStatusByChildId(id, newStatus as STATUS, newIsActive);
        console.log(`✅ [updateStudent] Synced status to parentChildren for student ${id}`);
      } catch (pcError: any) {
        console.warn(`⚠️ [updateStudent] Failed to sync with parentChildren: ${pcError.message}`);
      }
    }

    // ===== STEP: HANDLE CLASS ASSIGNMENT ON UPDATE =====
    const oldClassId = student.classId?.toString();
    const newClassId = data.classId?.toString();

    // If classId is being changed
    if (newClassId !== oldClassId) {
      try {
        const classRepository = new ClassRepository();
        const studentIdString = id;

        // Remove from old class if it exists
        if (oldClassId) {
          try {
            await classRepository.removeStudent(
              oldClassId,
              studentIdString,
              tenantId
            );
            console.log(
              `✅ Student ${studentIdString} removed from old class ${oldClassId}`
            );
          } catch (removeError: any) {
            console.warn(
              `⚠️ Failed to remove student from old class: ${removeError.message}`
            );
          }
        }

        // Add to new class if classId is provided
        if (newClassId) {
          console.log(`🎯 [updateStudent] Adding student ${studentIdString} to new class ${newClassId}...`);
          const classData = await classRepository.findById(
            newClassId,
            tenantId
          );
          if (!classData) {
            console.warn(
              `⚠️ Class with ID ${newClassId} not found. Skipping class assignment.`
            );
          } else {
            // Check if student ID already exists in the class's studentIds array
            const studentExistsInClass = classData.studentIds.some(
              (classStudentId) => classStudentId.toString() === studentIdString
            );
            console.log(`🔍 [updateStudent] Student exists in class: ${studentExistsInClass}`);

            let isNewlyAdded = false;
            if (!studentExistsInClass) {
              await classRepository.addStudent(
                newClassId,
                studentIdString,
                tenantId
              );
              console.log(
                `✅ [updateStudent] Student ${studentIdString} added to class ${newClassId}`
              );
              isNewlyAdded = true;
            } else {
              console.log(
                `ℹ️ [updateStudent] Student ${studentIdString} already exists in class ${newClassId}`
              );
            }

            // Send notifications if student was newly added
            if (isNewlyAdded) {
              try {
                console.log(`📧 [updateStudent] Starting notification process for newly added student...`);
                const { sendNotifications } = await import("./notification.service");
                const studentName = `${updatedStudent.firstName} ${updatedStudent.lastName}`.trim();
                console.log(`👤 [updateStudent] Student name: ${studentName}`);

                const notificationsToSend: any[] = [];
                console.log(`📝 [updateStudent] Preparing notifications...`);

                // 1. Notification to student
                const studentNotification = {
                  receiverId: studentIdString,
                  receiverRole: "STUDENT",
                  title: "Added to Class",
                  content: `You have been added to ${classData.name}`,
                  meta: {
                    entityId: newClassId,
                    entityType: "class",
                    className: classData.name,
                  },
                  tenantId: tenantId,
                };
                notificationsToSend.push(studentNotification);
                console.log(`✅ [updateStudent] Student notification prepared:`, studentNotification);

                // 2. Get all teachers assigned to this class and send notifications
                console.log(`🔍 [updateStudent] Fetching teachers for class ${newClassId}...`);
                const { TeacherAssignClassesRepository } = await import(
                  "../repositories/teacherAssignClasses.repository"
                );
                const teacherAssignments =
                  await TeacherAssignClassesRepository.findAssignmentsByClass(
                    newClassId,
                    tenantId
                  );
                console.log(`📊 [updateStudent] Found ${teacherAssignments.length} teacher assignment(s)`);

                // Get unique teacher IDs
                const teacherIds = new Set<string>();
                teacherAssignments.forEach((assignment: any) => {
                  if (assignment.teacherId) {
                    // Handle both ObjectId and populated teacher object
                    const teacherIdStr =
                      typeof assignment.teacherId === "string"
                        ? assignment.teacherId
                        : assignment.teacherId._id
                          ? assignment.teacherId._id.toString()
                          : assignment.teacherId.toString();
                    teacherIds.add(teacherIdStr);
                    console.log(`👨‍🏫 [updateStudent] Found teacher: ${teacherIdStr}`);
                  }
                });
                console.log(`📋 [updateStudent] Total unique teachers: ${teacherIds.size}`);

                // Add notification for each teacher
                teacherIds.forEach((teacherId) => {
                  const teacherNotification = {
                    receiverId: teacherId,
                    receiverRole: "TEACHER",
                    title: "New Student Added",
                    content: `${studentName} has been added to ${classData.name}`,
                    meta: {
                      entityId: newClassId,
                      entityType: "class",
                      className: classData.name,
                      studentId: studentIdString,
                      studentName: studentName,
                    },
                    tenantId: tenantId,
                  };
                  notificationsToSend.push(teacherNotification);
                  console.log(`✅ [updateStudent] Teacher notification prepared for ${teacherId}`);
                });

                // 3. Get all parents/guardians of the student and send notifications
                console.log(`🔍 [updateStudent] Fetching parents for student ${studentIdString}...`);
                const { findParentsByChildId } = await import("../repositories/parentChild.repository");
                const parentRelationships = await findParentsByChildId(studentIdString);
                console.log(`📊 [updateStudent] Found ${parentRelationships.length} parent/guardian relationship(s)`);

                // Add notification for each parent/guardian
                parentRelationships.forEach((relationship: any) => {
                  if (relationship.parentId) {
                    const parentIdStr =
                      typeof relationship.parentId === "string"
                        ? relationship.parentId
                        : relationship.parentId._id
                          ? relationship.parentId._id.toString()
                          : relationship.parentId.toString();

                    const parentNotification = {
                      receiverId: parentIdStr,
                      receiverRole: "PARENT",
                      title: "Child Added to Class",
                      content: `Your child ${studentName} has been added to ${classData.name}`,
                      meta: {
                        entityId: newClassId,
                        entityType: "class",
                        className: classData.name,
                        studentId: studentIdString,
                        studentName: studentName,
                      },
                      tenantId: tenantId,
                    };
                    notificationsToSend.push(parentNotification);
                    console.log(`✅ [updateStudent] Parent notification prepared for ${parentIdStr}`);
                  }
                });

                // Send all notifications in bulk
                if (notificationsToSend.length > 0) {
                  console.log(
                    `📤 [updateStudent] Sending ${notificationsToSend.length} notification(s)...`
                  );
                  console.log(`📦 [updateStudent] Notification payload:`, JSON.stringify(notificationsToSend, null, 2));

                  const result = await sendNotifications(notificationsToSend);
                  console.log(
                    `✅ [updateStudent] Successfully sent ${notificationsToSend.length} notification(s) (1 student + ${teacherIds.size} teacher(s))`
                  );
                  console.log(`📬 [updateStudent] Notification API response:`, JSON.stringify(result, null, 2));
                } else {
                  console.warn(`⚠️ [updateStudent] No notifications to send!`);
                }
              } catch (notificationError) {
                console.error(
                  `❌ [updateStudent] Failed to send notifications:`,
                  notificationError
                );
                console.error(`❌ [updateStudent] Error stack:`, (notificationError as Error).stack);
                // Non-fatal: continue even if notification fails
              }
            } else {
              console.log(`ℹ️ [updateStudent] Student was not newly added, skipping notifications`);
            }

            // Handle subjectIds for the new class
            if (data.subjectIds !== undefined && Array.isArray(data.subjectIds)) {
              try {
                // Validate subjectIds belong to the new class
                const classSubjectIds = (classData.subjectIds || []).map((id: any) =>
                  id.toString()
                );
                const validSubjectIds = data.subjectIds.filter((subId: string) =>
                  classSubjectIds.includes(subId)
                );

                if (validSubjectIds.length !== data.subjectIds.length) {
                  const invalidIds = data.subjectIds.filter(
                    (subId: string) => !classSubjectIds.includes(subId)
                  );
                  console.warn(
                    `⚠️ Some subjectIds were invalid and filtered out: ${invalidIds.join(", ")}`
                  );
                }

                // Check if class_students entry exists for the new class
                const classStudentRecord = await classStudentRepository.findByClassAndStudent(
                  tenantId,
                  newClassId,
                  studentIdString
                );

                if (classStudentRecord) {
                  // Update existing class_students entry with new subjectIds
                  await classStudentRepository.updateByStudentAndClass(
                    studentIdString,
                    newClassId,
                    {
                      subjectIds: validSubjectIds.map(
                        (id: string) => new mongoose.Types.ObjectId(id)
                      ),
                    }
                  );
                  console.log(
                    `✅ Updated subjectIds for student ${studentIdString} in new class ${newClassId}`
                  );
                } else {
                  // Create class_students entry with subjectIds if it doesn't exist
                  const student = await studentRepository.findStudentById(studentIdString);
                  if (student && student.rollNumber) {
                    await addStudentToClass(
                      newClassId,
                      studentIdString,
                      tenantId,
                      undefined,
                      student.rollNumber,
                      (student as any).stdId,
                      undefined,
                      validSubjectIds
                    );
                    console.log(
                      `✅ Created class_students entry with subjectIds for student ${studentIdString} in new class ${newClassId}`
                    );
                  }
                }
              } catch (subjectError: any) {
                console.warn(
                  `⚠️ Failed to update subjectIds for new class: ${subjectError.message}`
                );
                // Don't fail the entire update if subjectIds update fails
              }
            }
          }
        }
      } catch (classError: any) {
        // Log error but don't fail the student update
        console.error(
          "⚠️ Failed to update student class assignment:",
          classError.message
        );
        console.error(
          "⚠️ Student was updated successfully, but class assignment failed"
        );
      }
    } else if (newClassId && newClassId === oldClassId) {
      // classId is same, but verify student is in the class
      try {
        const classRepository = new ClassRepository();
        const classData = await classRepository.findById(newClassId, tenantId);
        if (classData) {
          const studentIdString = id;
          const studentExistsInClass = classData.studentIds.some(
            (classStudentId) => classStudentId.toString() === studentIdString
          );

          if (!studentExistsInClass) {
            // Student should be in this class but isn't, add them
            await classRepository.addStudent(
              newClassId,
              studentIdString,
              tenantId
            );
            console.log(
              `✅ Student ${studentIdString} added to class ${newClassId} (was missing)`
            );
          }

          // Update subjectIds in class_students if provided
          if (data.subjectIds !== undefined && Array.isArray(data.subjectIds)) {
            // Validate subjectIds belong to the class
            const classSubjectIds = (classData.subjectIds || []).map((id: any) =>
              id.toString()
            );
            const validSubjectIds = data.subjectIds.filter((subId: string) =>
              classSubjectIds.includes(subId)
            );

            if (validSubjectIds.length !== data.subjectIds.length) {
              const invalidIds = data.subjectIds.filter(
                (subId: string) => !classSubjectIds.includes(subId)
              );
              console.warn(
                `⚠️ Some subjectIds were invalid and filtered out: ${invalidIds.join(", ")}`
              );
            }

            // Update class_students record
            const classStudentRecord = await classStudentRepository.findByClassAndStudent(
              tenantId,
              newClassId,
              studentIdString
            );

            if (classStudentRecord) {
              await classStudentRepository.updateByStudentAndClass(
                studentIdString,
                newClassId,
                {
                  subjectIds: validSubjectIds.map(
                    (id: string) => new mongoose.Types.ObjectId(id)
                  ),
                }
              );
              console.log(
                `✅ Updated subjectIds for student ${studentIdString} in class ${newClassId}`
              );
            } else {
              // Create class_students entry if it doesn't exist
              const student = await studentRepository.findStudentById(studentIdString);
              if (student && student.rollNumber) {
                await addStudentToClass(
                  newClassId,
                  studentIdString,
                  tenantId,
                  undefined,
                  student.rollNumber,
                  (student as any).stdId,
                  undefined,
                  validSubjectIds
                );
                console.log(
                  `✅ Created class_students entry with subjectIds for student ${studentIdString}`
                );
              }
            }
          }
        }
      } catch (classError: any) {
        console.warn(
          `⚠️ Failed to verify class assignment: ${classError.message}`
        );
      }
    }

    return {
      success: true,
      message: "Student updated successfully",
      data: updatedStudent,
    };
  } catch (error: any) {
    console.error("Update student error:", error);
    throw new Error(`Failed to update student: ${error.message}`);
  }
};

// Delete student
export const deleteStudent = async (id: string, tenantId: string) => {
  try {
    const student = await studentRepository.findStudentById(id);
    if (!student) {
      throw new Error("Student not found");
    }

    const deletedStudent = await studentRepository.softDeleteStudentById(id);
    if (!deletedStudent) {
      throw new Error("Failed to delete student");
    }

    // Also delete the corresponding user in the User API
    try {
      await UserApiIntegrationService.deleteUser(id);
      console.log(`✅ Successfully deleted user ${id} in User API`);
    } catch (userApiError: any) {
      console.error(`⚠️ Failed to delete user ${id} in User API:`, userApiError.message);
      // Don't fail the entire operation if user API deletion fails
      // The student is already marked as deleted in academic-api
    }

    return {
      success: true,
      message: "Student deleted successfully",
      data: deletedStudent,
    };
  } catch (error: any) {
    console.error("Delete student error:", error);
    throw new Error(`Failed to delete student: ${error.message}`);
  }
};

// Get students by class
export const getStudentsByClass = async (
  classId: string,
  tenantId: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {},
  subjectIds?: string[] // Optional: filter by subjectId(s)
) => {
  try {
    let students: any[] = [];

    // If subjectIds filter is provided, query class_students first to get matching studentIds
    if (subjectIds && subjectIds.length > 0) {
      console.log(`🔍 [getStudentsByClass] Filtering by subjectIds:`, subjectIds);

      // Get studentIds that have the specified subject(s) in this class
      const filteredStudentIds = await classStudentRepository.findStudentIdsByClassAndSubject(
        classId,
        subjectIds
      );

      if (filteredStudentIds.length === 0) {
        // No students found with the specified subjects
        console.log(`📚 [getStudentsByClass] No students found with subjectIds ${subjectIds.join(", ")} in class ${classId}`);
        return {
          success: true,
          data: {
            students: [],
            pagination: {
              total: 0,
              pageNo: 1,
              pageSize: 0,
              totalPages: 0,
            },
          },
        };
      }

      // Fetch only the students that match the subject filter
      // Add studentId filter to existing filters
      const filtersWithStudentIds = {
        ...filters,
        _id: { $in: filteredStudentIds.map(id => new mongoose.Types.ObjectId(id)) }
      };

      students = await studentRepository.findStudentsByClass(
        classId,
        tenantId,
        filtersWithStudentIds,
        sort
      );

      console.log(`✅ [getStudentsByClass] Found ${students.length} students with subjectIds ${subjectIds.join(", ")} in class ${classId}`);
    } else {
      // No subject filter - use existing logic (backward compatible)
      students = await studentRepository.findStudentsByClass(
        classId,
        tenantId,
        filters,
        sort
      );
    }

    // Fetch subjectIds from class_students table for all students in bulk (same as getAllStudents)
    const studentIds = students.map((student: any) => {
      const studentId = student._id?.toString() || student.id?.toString() || student._id;
      return studentId;
    }).filter((id: string | undefined) => id);

    console.log(`🔍 [getStudentsByClass] Fetching subjectIds for ${studentIds.length} students in class ${classId}, tenantId: ${tenantId}`);

    const subjectIdsMap = new Map<string, string[]>(); // Map: studentId_classId -> subjectIds[]
    if (studentIds.length > 0) {
      try {
        const classStudentRecords = await classStudentRepository.findByStudentIds(
          studentIds,
          tenantId
        );

        console.log(`📚 [getStudentsByClass] Found ${classStudentRecords.length} class_students records`);

        // Map subjectIds by studentId and classId
        classStudentRecords.forEach((record: any) => {
          const recordStudentId = record.studentId?.toString();
          const recordClassId = record.classId?.toString();
          if (recordStudentId && recordClassId) {
            // Use studentId+classId as key to handle students in multiple classes
            const key = `${recordStudentId}_${recordClassId}`;
            const subjectIds = record.subjectIds && Array.isArray(record.subjectIds)
              ? record.subjectIds.map((id: any) => id.toString())
              : [];
            subjectIdsMap.set(key, subjectIds);
            console.log(`📚 [getStudentsByClass] Mapped ${key} -> ${subjectIds.length} subject(s):`, subjectIds);
          }
        });

        console.log(`📚 [getStudentsByClass] Total mappings created: ${subjectIdsMap.size}`);
      } catch (err: any) {
        console.error("❌ [getStudentsByClass] Could not fetch subjectIds from class_students:", err?.message || err);
      }
    }

    // Add subjectIds to each student object
    const studentsWithSubjectIds = students.map((student: any) => {
      const studentObj = student.toObject ? student.toObject() : student;

      // Normalize studentId
      let studentId = studentObj._id?.toString() || studentObj.id?.toString();
      if (!studentId && studentObj._id) {
        studentId = typeof studentObj._id === 'string' ? studentObj._id : studentObj._id.toString();
      }

      // Normalize classId
      let normalizedClassId = studentObj.classId?.toString() || studentObj.classId;
      if (normalizedClassId && typeof normalizedClassId !== 'string') {
        normalizedClassId = normalizedClassId.toString();
      }

      // Add subjectIds from class_students table
      if (studentId && normalizedClassId) {
        const key = `${studentId}_${normalizedClassId}`;
        const subjectIds = subjectIdsMap.get(key) || [];
        studentObj.subjectIds = subjectIds;

        if (subjectIds.length === 0) {
          console.log(`⚠️ [getStudentsByClass] No subjectIds found for:`, {
            studentId,
            classId: normalizedClassId,
            key,
            keyExists: subjectIdsMap.has(key),
          });
        }
      } else {
        studentObj.subjectIds = [];
      }

      return studentObj;
    });

    return {
      success: true,
      data: {
        students: studentsWithSubjectIds,
        pagination: {
          total: studentsWithSubjectIds.length,
          pageNo: 1,
          pageSize: studentsWithSubjectIds.length,
          totalPages: 1,
        },
      },
    };
  } catch (error: any) {
    console.error("Get students by class error:", error);
    throw new Error(`Failed to get students by class: ${error.message}`);
  }
};

// Get students by subject
export const getStudentsBySubject = async (
  subjectId: string,
  tenantId: string
) => {
  try {
    const students = await studentRepository.findStudentsBySubject(
      subjectId,
      tenantId
    );
    return {
      success: true,
      data: students,
    };
  } catch (error: any) {
    console.error("Get students by subject error:", error);
    throw new Error(`Failed to get students by subject: ${error.message}`);
  }
};

// Get student performance breakdown for a class and subject
// Get active students DDL (dropdown list) - simplified data for dropdowns
export const getActiveStudentsDDL = async (tenantId: string) => {
  try {
    // Validate tenantId before proceeding
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    const students = await studentRepository.getActiveStudentsDDL(tenantId);
    return {
      success: true,
      message: "Active students DDL retrieved successfully",
      data: students,
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

export const getStudentPerformanceBreakdown = async (
  studentId: string,
  classId: string,
  subjectId: string,
  tenantId: string,
  dateFilters?: { startDate?: Date; endDate?: Date }
): Promise<GetStudentPerformanceBreakdownResponse> => {
  try {
    // Validate classId and subjectId
    if (!classId || !subjectId) {
      throw new Error("Class ID and Subject ID are required");
    }

    // Get class and subject info
    const classInfo = await Class.findById(classId).lean();
    const subjectInfo = await Subject.findById(subjectId).lean();

    if (!classInfo) {
      throw new Error("Class not found");
    }
    if (!subjectInfo) {
      throw new Error("Subject not found");
    }

    // Get all exams matching classId and subjectId
    const exams = await examRepository.findExams({
      tenantId,
      classId,
      subjectId,
      startDate: dateFilters?.startDate,
      endDate: dateFilters?.endDate,
      pageNo: 1,
      pageSize: 1000,
    } as any);

    const examIds = exams.map((exam: any) => {
      return exam._id ? exam._id.toString() : exam.id || exam._id;
    });

    if (exams.length === 0) {
      return {
        success: true,
        data: {
          performanceBreakdown: [],
        },
      };
    }

    // Get class statistics for all exams (to get totalStudents and completedCount)
    const stats = await examAttemptRepository.getClassSubjectStatistics(
      classId,
      subjectId,
      tenantId,
      examIds
    );

    // Get student's own graded attempts for these exams
    const studentAttempts = await ExamAttempt.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      examId: { $in: examIds.map((id) => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      attemptStatus: "Graded",
      isDeleted: false,
    })
      .sort({ attemptNumber: -1 })
      .lean();

    // Create a map of examId to student's best attempt (highest percentage)
    const studentAttemptMap = new Map();
    studentAttempts.forEach((attempt: any) => {
      const examIdStr = attempt.examId
        ? attempt.examId.toString()
        : attempt.examId;
      const existing = studentAttemptMap.get(examIdStr);
      // Keep the attempt with highest percentage
      if (
        !existing ||
        (attempt.percentage && attempt.percentage > (existing.percentage || 0))
      ) {
        studentAttemptMap.set(examIdStr, attempt);
      }
    });

    // Build performance breakdown per exam
    const performanceBreakdown = exams.map((exam: any) => {
      const examId = exam._id ? exam._id.toString() : exam.id || exam._id;
      const examStat = stats.examStats.find((s) => s.examId === examId);
      const studentAttempt = studentAttemptMap.get(examId);

      // Use student's own score if available, otherwise 0
      const studentScore = studentAttempt
        ? Math.round(studentAttempt.percentage * 100) / 100
        : 0;

      return {
        examId: examId,
        examTitle: exam.examTitle,
        examType: exam.examType || "Official", // Default to "Official" if not set
        averageScore: studentScore, // Student's own score
        totalStudents: examStat?.totalStudents || 0,
        completedCount: examStat?.completedCount || 0,
      };
    });

    return {
      success: true,
      data: {
        performanceBreakdown,
      },
    };
  } catch (error: any) {
    console.error("Get student performance breakdown error:", error);
    throw new Error(
      `Failed to get student performance breakdown: ${error.message}`
    );
  }
};

/**
 * Get exams with completed grading for a student
 */
export const getStudentGradedExams = async (
  studentId: string,
  tenantId: string,
  options: {
    pageNo: number;
    pageSize: number;
    filters: Record<string, any>;
    sort: Record<string, any>;
  }
) => {
  try {
    const { pageNo, pageSize, filters, sort } = options;

    // Import repositories dynamically
    const mongoose = await import("mongoose");
    const { Class } = await import("../models/class.schema");

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

    // If student has no active/promoted classes, return empty result
    if (!activeAndPromotedRecords || activeAndPromotedRecords.length === 0) {
      return {
        success: true,
        data: {
          exams: [],
          statistics: {
            totalResults: 0,
            averageScore: 0,
            highestScore: 0,
            highestGrade: null,
          },
          pagination: {
            total: 0,
            pageNo: pageNo,
            pageSize: pageSize,
            totalPages: 0,
          },
        },
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

    // Verify classes belong to tenant
    const validClasses = await Class.find({
      _id: { $in: allValidClassIds.map(id => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).select("_id name").lean();

    const validClassIds = validClasses.map((cls: any) => cls._id.toString());
    const classNamesMap = new Map<string, string>();
    validClasses.forEach((cls: any) => {
      classNamesMap.set(cls._id.toString(), cls.name || "");
    });

    if (validClassIds.length === 0) {
      return {
        success: true,
        data: {
          exams: [],
          statistics: {
            totalResults: 0,
            averageScore: 0,
            highestScore: 0,
            highestGrade: null,
          },
          pagination: {
            total: 0,
            pageNo: pageNo,
            pageSize: pageSize,
            totalPages: 0,
          },
        },
      };
    }

    // Handle classId filter if provided in filters
    let filteredClassIds = validClassIds;
    let requestedClassId: string | null = null;

    if (filters.classId) {
      // Check if classId filter is provided (after buildQueryFromRequest processing)
      // It could be: filters.classId.$eq or filters.classId (direct value, string or ObjectId)
      if (filters.classId?.$eq) {
        // Handle $eq operator format
        const classIdValue = filters.classId.$eq;
        requestedClassId = classIdValue?.toString() || null;
      } else if (typeof filters.classId === 'string') {
        requestedClassId = filters.classId;
      } else if (filters.classId && typeof filters.classId === 'object' && 'toString' in filters.classId) {
        // Handle ObjectId or similar objects
        requestedClassId = filters.classId.toString();
      }

      // If classId filter is provided, validate and filter
      if (requestedClassId) {
        // Normalize to string for comparison
        const normalizedRequestedId = requestedClassId.toString();

        // Validate that the requested classId is one of the student's valid classes
        if (validClassIds.includes(normalizedRequestedId)) {
          filteredClassIds = [normalizedRequestedId];
        } else {
          // Requested classId is not in student's classes - return empty result
          return {
            success: true,
            data: {
              exams: [],
              statistics: {
                totalResults: 0,
                averageScore: 0,
                highestScore: 0,
                highestGrade: null,
              },
              pagination: {
                total: 0,
                pageNo: pageNo,
                pageSize: pageSize,
                totalPages: 0,
              },
            },
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
    const allClassIdsForQuery = [
      ...filteredActiveClassIds,
      ...filteredPromotedClassIdsWithDates.map((p) => p.classId),
    ];

    if (allClassIdsForQuery.length === 0) {
      return {
        success: true,
        data: {
          exams: [],
          statistics: {
            totalResults: 0,
            averageScore: 0,
            highestScore: 0,
            highestGrade: null,
          },
          pagination: {
            total: 0,
            pageNo: pageNo,
            pageSize: pageSize,
            totalPages: 0,
          },
        },
      };
    }

    // Remove classId from filters as it's used separately
    const { classId: _, ...queryFilters } = filters;

    // Separate filters for ExamStudent collection vs Exam collection
    const examStudentFilters: Record<string, any> = {};
    const examFilters: Record<string, any> = {};

    // Process query filters and separate them
    for (const [key, value] of Object.entries(queryFilters)) {
      // subjectId filter applies to Exam collection (examData.subjectId)
      if (key === 'subjectId') {
        // Convert subjectId to ObjectId for MongoDB comparison
        if (value && typeof value === 'object' && value.$eq) {
          examFilters['examData.subjectId'] = { $eq: new mongoose.Types.ObjectId(value.$eq) };
        } else if (typeof value === 'string') {
          examFilters['examData.subjectId'] = new mongoose.Types.ObjectId(value);
        } else {
          examFilters['examData.subjectId'] = value;
        }
      }
      // examModeId filter applies to Exam collection (examData.examModeId)
      else if (key === 'examModeId' || key === 'examModeId__eq') {
        const examModeIdVal = value;
        if (examModeIdVal && typeof examModeIdVal === 'object' && examModeIdVal.$eq) {
          examFilters['examData.examModeId'] = { $eq: new mongoose.Types.ObjectId(examModeIdVal.$eq) };
        } else if (typeof examModeIdVal === 'string') {
          examFilters['examData.examModeId'] = new mongoose.Types.ObjectId(examModeIdVal);
        } else {
          examFilters['examData.examModeId'] = examModeIdVal;
        }
      }
      // examType filter applies to Exam collection (examData.examType) - e.g. "Practice" | "Official"
      else if (key === 'examType' || key === 'examType__eq') {
        const examTypeVal = value && typeof value === 'object' && value.$eq !== undefined ? value.$eq : value;
        if (examTypeVal != null && examTypeVal !== '') {
          examFilters['examData.examType'] = examTypeVal;
        }
      }
      // examTitle filter applies to Exam collection (examData.examTitle)
      else if (key === 'examTitle') {
        // Handle regex search for exam title
        if (value && typeof value === 'object' && value.$regex) {
          examFilters['examData.examTitle'] = { $regex: value.$regex, $options: 'i' };
        } else if (typeof value === 'string') {
          examFilters['examData.examTitle'] = { $regex: value, $options: 'i' };
        } else {
          examFilters['examData.examTitle'] = value;
        }
      }
      // Handle $or array pattern (from __or__0 syntax)
      else if (key === '$or' && Array.isArray(value)) {
        // Extract examTitle from $or array if present
        const examTitleCondition = value.find((condition: any) => condition.examTitle);
        if (examTitleCondition?.examTitle?.$regex) {
          examFilters['examData.examTitle'] = {
            $regex: examTitleCondition.examTitle.$regex,
            $options: examTitleCondition.examTitle.$options || 'i'
          };
        }
      }
      // Date filters apply to ExamStudent collection
      else if (key === 'startDate' || key === 'endDate' || key === 'createdAt') {
        examStudentFilters[key] = value;
      }
      // Other filters - apply to ExamStudent by default
      else {
        examStudentFilters[key] = value;
      }
    }

    // Build base match stage WITHOUT optional filters (for unfiltered statistics)
    const baseMatchStage: any = {
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: { $in: allClassIdsForQuery.map(id => new mongoose.Types.ObjectId(id)) }, // Support multiple classes
      tenantId: new mongoose.Types.ObjectId(tenantId),
      gradingStatus: "Completed",
      isActive: true,
    };

    // Build aggregation pipeline for statistics (optionally filtered by exam-level filters like examType)
    const unfilteredStatsPipeline: any[] = [
      { $match: baseMatchStage },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "examData",
        },
      },
      { $unwind: { path: "$examData", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "examData.isDeleted": false,
          "examData.examStatus": "Released",
          ...examFilters, // e.g. examType so Practice tab stats match filtered list
        },
      },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          averageScore: { $avg: "$percentage" },
          highestScore: { $max: "$percentage" },
          grades: { $push: "$grade" },
        },
      },
    ];

    // Calculate unfiltered statistics
    const unfilteredStatsResult = await ExamStudent.aggregate(unfilteredStatsPipeline);
    const unfilteredStats = unfilteredStatsResult.length > 0 ? unfilteredStatsResult[0] : null;

    // Filter out null/undefined grades and find the highest (assuming A > B > C)
    const validGrades = unfilteredStats?.grades?.filter(Boolean) || [];
    const highestGrade = validGrades.length > 0 ? validGrades.sort()[0] : null;

    // Build aggregation pipeline WITH filters for pagination and filtered results
    const matchStage: any = {
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: { $in: allClassIdsForQuery.map(id => new mongoose.Types.ObjectId(id)) }, // Support multiple classes
      tenantId: new mongoose.Types.ObjectId(tenantId),
      gradingStatus: "Completed",
      isActive: true,
      ...examStudentFilters, // Apply ExamStudent filters
    };

    // Use aggregation to join with Exam collection and filter by examStatus
    const pipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "examData",
        },
      },
      { $unwind: { path: "$examData", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "examData.isDeleted": false,
          "examData.examStatus": "Released",
          ...examFilters, // Apply Exam filters (like subjectId) after $lookup
        },
      },
      // Sort must come after $lookup and $unwind to access examData fields
      {
        $sort: sort && Object.keys(sort).length > 0
          ? Object.fromEntries(
            Object.entries(sort).map(([key, value]) => {
              // If sorting by releaseDate, use examData.releasedAt
              if (key === 'releaseDate') {
                return ['examData.releasedAt', value];
              }
              // For other fields, check if they exist in examData
              return [key.startsWith('examData.') ? key : key, value];
            })
          )
          : { 'examData.releasedAt': -1 }
      },
    ];

    // Execute aggregation (get all results, we'll paginate after date filtering)
    // Note: We'll calculate total count after date filtering to ensure accuracy
    const allResults = await ExamStudent.aggregate(pipeline);

    console.log("🔍 [GRADED EXAMS] Found records before date filtering:", allResults.length);

    // Apply date restrictions for promoted classes
    const results = allResults.filter((record: any) => {
      const examClassId = record.classId?.toString() || record.classId;

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
        const completedDate = record.updatedAt || record.createdAt;
        const completedDateObj = completedDate instanceof Date
          ? completedDate
          : new Date(completedDate);

        return completedDateObj <= promotionDate;
      }

      // Exam is not from any valid class - exclude it
      return false;
    });

    console.log("🔍 [GRADED EXAMS] Found records after date filtering:", results.length);

    // Apply pagination after date filtering
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    // Total count is the length of all filtered results (before pagination)
    const totalCount = results.length;

    // Now populate subject details for each exam (use paginated results)
    const examIds = paginatedResults.map((r) => r.examData._id);
    const { Exam } = await import("../models");
    const examsWithSubjects = await Exam.find({ _id: { $in: examIds } })
      .populate("subjectId", "name")
      .lean();

    const examSubjectMap = new Map();
    examsWithSubjects.forEach((exam: any) => {
      examSubjectMap.set(exam._id.toString(), exam.subjectId);
    });

    // Get exam attempts for each record to fetch start/end times and result (Pass/Fail)
    const examAttempts = await ExamAttempt.find({
      examId: { $in: examIds },
      studentId: new mongoose.Types.ObjectId(studentId),
      isDeleted: false,
    })
      .select(
        "examId startedAt submittedAt timeTakenInSeconds aiFeedback overallFeedback attemptNumber result"
      )
      .lean();

    // Create a map for quick lookup: examId -> attempt
    const attemptMap = new Map<string, any>();
    for (const attempt of examAttempts) {
      const examIdStr = attempt.examId.toString();
      // If multiple attempts, use the latest one (by attemptNumber)
      if (
        !attemptMap.has(examIdStr) ||
        attempt.attemptNumber > attemptMap.get(examIdStr).attemptNumber
      ) {
        attemptMap.set(examIdStr, attempt);
      }
    }

    // Get total questions for each exam
    const { countExamQuestions } = await import(
      "../repositories/examQuestion.repository"
    );
    const questionCounts = await Promise.all(
      examIds.map(async (examId: any) => {
        const count = await countExamQuestions(examId.toString());
        return { examId: examId.toString(), totalQuestions: count };
      })
    );
    const questionCountMap = new Map<string, number>();
    for (const item of questionCounts) {
      questionCountMap.set(item.examId, item.totalQuestions);
    }

    // Get class name(s) - if single class filtered, use that; otherwise use first class or empty
    let className = "";
    if (filteredClassIds.length === 1) {
      className = classNamesMap.get(filteredClassIds[0]) || "";
    } else if (filteredClassIds.length > 0) {
      // Multiple classes - could show first class name or leave empty
      className = classNamesMap.get(filteredClassIds[0]) || "";
    }

    // Fetch teacher names in batch
    const teacherIds = [
      ...new Set(
        results
          .map((r: any) => r.examData?.teacherId?.toString())
          .filter(Boolean)
      ),
    ];
    const teacherNames = await fetchUserNames(teacherIds);

    // Transform response (use paginated results)
    const exams = paginatedResults.map((record: any) => {
      const examData = record.examData;
      const examIdStr = examData._id.toString();
      const attempt = attemptMap.get(examIdStr);
      const teacherId = examData.teacherId?.toString();
      const subjectData = examSubjectMap.get(examIdStr);

      // Get release date from exam (releasedAt field)
      const releaseDate = examData.releasedAt
        ? new Date(examData.releasedAt)
        : null;

      // Result (Pass/Fail): use attempt.result if set, else derive from percentage vs passingMarks
      let result: string | null = attempt?.result ?? null;
      if (result == null && record.percentage != null && examData.totalMarks) {
        const passingPct =
          examData.passingMarks != null
            ? (examData.passingMarks / examData.totalMarks) * 100
            : 0;
        result = record.percentage >= passingPct ? "Pass" : "Fail";
      }

      return {
        examId: examIdStr,
        examTitle: examData.examTitle || "Unknown",
        examType: examData.examType || "Official",
        totalMarks: examData.totalMarks || 0,
        totalQuestions: questionCountMap.get(examIdStr) || 0,
        durationInMinutes: examData.durationInMinutes || 0,
        startOn: examData.startOn,
        endOn: examData.endOn,
        createdBy: teacherId
          ? teacherNames[teacherId] || "Unknown Teacher"
          : null,
        studentScore: Math.round((record.percentage || 0) * 100) / 100,
        grade: record.grade || null,
        result,
        gradingStatus: record.gradingStatus,
        startedAt: attempt?.startedAt || null,
        submittedAt: attempt?.submittedAt || null,
        timeTakenInSeconds: attempt?.timeTakenInSeconds || null,
        completedAt: record.updatedAt,
        examStatus: examData.examStatus || null,
        releaseDate: releaseDate,
        className: className,
        subjectName: subjectData?.name || null,
        aiFeedback: attempt?.aiFeedback || null,
        teacherFeedback: attempt?.overallFeedback || null,
      };
    });


    // Use the unfiltered statistics calculated before filtration
    const statistics = {
      totalResults: unfilteredStats?.totalResults || 0,
      averageScore: unfilteredStats?.averageScore
        ? Math.round(unfilteredStats.averageScore * 100) / 100
        : 0,
      highestScore: unfilteredStats?.highestScore
        ? Math.round(unfilteredStats.highestScore * 100) / 100
        : 0,
      highestGrade: highestGrade,
    };


    return {
      success: true,
      data: {
        exams,
        statistics,
        pagination: {
          total: totalCount,
          pageNo: pageNo,
          pageSize: pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      },
    };
  } catch (error: any) {
    console.error("Get student graded exams error:", error);
    throw new Error(`Failed to get student graded exams: ${error.message}`);
  }
};

/**
 * Get statistics for student's graded exams (optionally filtered by examModeId and examType)
 * Returns total results, average score, highest score, and highest grade
 */
export const getStudentGradedExamsStatistics = async (
  studentId: string,
  tenantId: string,
  classId: string,
  examModeId?: string | null,
  examType?: string | null
) => {
  try {
    // Build base match stage WITHOUT optional filters (for unfiltered statistics)
    const baseMatchStage: any = {
      studentId: new mongoose.Types.ObjectId(studentId),
      classId: new mongoose.Types.ObjectId(classId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      gradingStatus: "Completed",
      isActive: true,
    };

    const examMatchAfterLookup: any = {
      "examData.isDeleted": false,
      "examData.examStatus": "Released",
    };
    if (examModeId && mongoose.Types.ObjectId.isValid(examModeId)) {
      examMatchAfterLookup["examData.examModeId"] = new mongoose.Types.ObjectId(examModeId);
    }
    if (examType) {
      examMatchAfterLookup["examData.examType"] = examType;
    }

    // Build aggregation pipeline for statistics (optionally by examModeId)
    const unfilteredStatsPipeline: any[] = [
      { $match: baseMatchStage },
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "examData",
        },
      },
      { $unwind: { path: "$examData", preserveNullAndEmptyArrays: false } },
      {
        $match: examMatchAfterLookup,
      },
      {
        $group: {
          _id: null,
          totalResults: { $sum: 1 },
          averageScore: { $avg: "$percentage" },
          highestScore: { $max: "$percentage" },
          grades: { $push: "$grade" },
        },
      },
    ];

    // Calculate unfiltered statistics
    const unfilteredStatsResult = await ExamStudent.aggregate(unfilteredStatsPipeline);
    const unfilteredStats = unfilteredStatsResult.length > 0 ? unfilteredStatsResult[0] : null;

    // Filter out null/undefined grades and find the highest (assuming A > B > C)
    const validGrades = unfilteredStats?.grades?.filter(Boolean) || [];
    const highestGrade = validGrades.length > 0 ? validGrades.sort()[0] : null;

    // Preserve null values when there are results but no valid scores
    // This is semantically correct - null means "no valid scores available"
    const statistics = {
      totalResults: unfilteredStats?.totalResults || 0,
      averageScore:
        unfilteredStats?.averageScore != null &&
          !isNaN(unfilteredStats.averageScore)
          ? Math.round(unfilteredStats.averageScore * 100) / 100
          : null,
      highestScore:
        unfilteredStats?.highestScore != null &&
          !isNaN(unfilteredStats.highestScore)
          ? Math.round(unfilteredStats.highestScore * 100) / 100
          : null,
      highestGrade: highestGrade,
    };

    return {
      success: true,
      message: "Graded exams statistics retrieved successfully",
      data: statistics,
    };
  } catch (error: any) {
    console.error("Get student graded exams statistics error:", error);
    throw new Error(`Failed to get student graded exams statistics: ${error.message}`);
  }
};

export const getAdminStudentCumulativeInsights = async ({
  studentId,
  classId,
  subjectId,
  tenantId,
}: {
  studentId: string;
  classId: string;
  subjectId: string;
  tenantId: string;
}) => {
  try {
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      throw new Error("Valid studentId is required");
    }

    if (!classId || !subjectId) {
      throw new Error("classId and subjectId are required");
    }

    if (!tenantId) {
      throw new Error("tenantId is required");
    }

    const [
      subjectsWithTeachers,
      topicStatisticsResult,
      performanceBreakdownResult,
      subjectStatsResult,
    ] = await Promise.all([
      parentChildService.getChildSubjectsWithTeachers(studentId, tenantId),
      studentTopicPerformanceService.getStudentTopicStatistics({
        studentId,
        classId,
        subjectId,
        tenantId,
      }),
      getStudentPerformanceBreakdown(studentId, classId, subjectId, tenantId),
      studentExamsService.getSubjectStats(studentId, tenantId, "all"),
    ]);

    return {
      success: true,
      message: "Student cumulative insights retrieved successfully",
      data: {
        studentId,
        classId,
        subjectId,
        subjects: subjectsWithTeachers?.subjects || [],
        subjectsSummary: {
          totalSubjects: subjectsWithTeachers?.totalSubjects || 0,
          totalTeachers: subjectsWithTeachers?.totalTeachers || 0,
        },
        topicStatistics: topicStatisticsResult?.data || {
          studentId,
          classId,
          subjectId,
          topics: [],
        },
        performanceBreakdown:
          performanceBreakdownResult?.data?.performanceBreakdown || [],
        subjectStats: subjectStatsResult?.data || [],
      },
    };
  } catch (error: any) {
    console.error("Get admin student cumulative insights error:", error);
    throw new Error(
      `Failed to get student cumulative insights: ${error.message}`
    );
  }
};

// Get top students ranked by average exam percentage
export const getTopStudents = async (
  classId: string,
  tenantId: string,
  subjectId?: string
) => {
  try {
    // Call repository method to get students with average percentages
    const studentsData = await studentRepository.getTopStudentsByClass(
      classId,
      tenantId,
      subjectId
    );

    // Get total count of all students in the class (not just those with exam data)
    const totalStudentsInClass = await studentRepository.countStudentsByClass(
      classId,
      tenantId
    );

    // Format response with ranks
    const students = studentsData.map((student, index) => ({
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      className: student.className,
      subjectName: student.subjectName,
      rank: index + 1, // Rank starts from 1
      overallScore: student.averagePercentage,
      totalStudentsInClass: totalStudentsInClass,
    }));

    return {
      success: true,
      message: "Top students retrieved successfully",
      data: {
        students,
      },
    };
  } catch (error: any) {
    console.error("Get top students error:", error);
    throw new Error(`Failed to get top students: ${error.message}`);
  }
};

// Get student profile details with statistics
export const getStudentProfileDetails = async (
  studentId: string,
  tenantId: string
) => {
  try {
    const profileData = await studentRepository.getStudentProfileDetails(
      studentId,
      tenantId
    );

    const {
      student,
      classAverage,
      totalSubjects,
      totalTeachers,
      currentRank,
      previousRank,
      rankChange,
      totalStudentsInClass,
      overallAverageScore,
      totalExamsCompleted,
      className,
      classTeacher,
      achievements,
      schoolRank,
      totalSchoolsInTenant,
    } = profileData;

    // Fetch the subjects (with teacher assignments) for the student
    let subjectsResult: Awaited<
      ReturnType<typeof parentChildService.getChildSubjectsWithTeachers>
    > | null = null;

    try {
      subjectsResult = await parentChildService.getChildSubjectsWithTeachers(
        studentId,
        tenantId
      );
    } catch (subjectsError) {
      console.warn(
        "Unable to load subjects for student profile:",
        (subjectsError as Error).message
      );
    }

    const normalizedTotalSubjects =
      subjectsResult?.totalSubjects ?? totalSubjects ?? 0;
    const normalizedTotalTeachers =
      subjectsResult?.totalTeachers ?? totalTeachers ?? 0;

    // Format rank display: "Out of X students in the class"
    // Always include rankDisplay if totalStudentsInClass is available
    let rankDisplay: string | undefined;
    if (totalStudentsInClass !== undefined && totalStudentsInClass > 0) {
      rankDisplay = `Out of ${totalStudentsInClass} student${totalStudentsInClass !== 1 ? "s" : ""
        } in the class`;
    }

    return {
      success: true,
      message: "Student profile details retrieved successfully",
      data: {
        studentId: student._id?.toString() || studentId,
        name: `${student.firstName} ${student.lastName}`,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        profileImage: student.profileImage,
        studentIdNumber: student.studentId || student.rollNumber,
        classId: student.classId,
        className: className || student.className,
        classAverage: classAverage,
        totalSubjects: normalizedTotalSubjects,
        totalTeachers: normalizedTotalTeachers,
        subjects: subjectsResult?.subjects || [],
        subjectsSummary: {
          totalSubjects: normalizedTotalSubjects,
          totalTeachers: normalizedTotalTeachers,
        },
        currentRank: currentRank ?? null, // Always include, null if not available
        previousRank: previousRank ?? null, // Rank from previous month
        rankChange: rankChange ?? null, // Positive = improved, negative = dropped
        rankDisplay: rankDisplay ?? null, // Always include, null if not available
        totalStudentsInClass: totalStudentsInClass ?? null,
        overallAverageScore: overallAverageScore,
        totalExamsCompleted: totalExamsCompleted,
        classTeacher: classTeacher ?? null,
        schoolRank: schoolRank ?? null, // School-wide rank
        totalSchoolsInTenant: totalSchoolsInTenant ?? null, // Total schools (classes) in tenant
        achievements: achievements ?? {
          badgesCount: 0,
          achievementsCount: 0,
          credentialsCount: 0,
        },
      },
    };
  } catch (error: any) {
    console.error("Get student profile details error:", error);
    throw new Error(`Failed to get student profile details: ${error.message}`);
  }
};

// Get student stats (total, active, inactive)
export const getActiveStats = async (tenantId: string, classId?: string) => {
  try {
    // Build filters with optional classId
    const baseFilters: Record<string, any> = { isActive: { $in: [true, false] } };
    const activeFilters: Record<string, any> = { isActive: true };

    if (classId) {
      baseFilters.classId = classId;
      activeFilters.classId = classId;
    }

    // Get total students count (active + inactive, not deleted)
    const totalStudentsCount = await studentRepository.countStudents({
      tenantId,
      filters: baseFilters,
    });

    // Get active students count
    const activeStudentsCount = await studentRepository.countStudents({
      tenantId,
      filters: activeFilters,
    });

    // Calculate inactive students
    const inactiveStudentsCount = totalStudentsCount - activeStudentsCount;

    // Calculate average score only when classId is provided
    let averageScore: number | undefined = undefined;
    if (classId) {
      try {
        // Get all student IDs in the class (both active and inactive)
        // Use direct query to include all students, not just active ones
        const students = await Student.find({
          classId: new mongoose.Types.ObjectId(classId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isDeleted: false,
          // Don't filter by isActive - include both active and inactive students
        }).select("_id").lean();

        const studentIds = students
          .map((student: any) => student._id)
          .filter((id: any) => id && mongoose.Types.ObjectId.isValid(id))
          .map((id: any) => new mongoose.Types.ObjectId(id));

        if (studentIds.length > 0) {
          // Aggregate average score from ExamStudent collection
          const classAverageResult = await ExamStudent.aggregate([
            {
              $match: {
                studentId: { $in: studentIds },
                status: "Completed",
                gradingStatus: "Completed",
                percentage: { $exists: true, $ne: null },
                tenantId: new mongoose.Types.ObjectId(tenantId),
                isActive: true,
              },
            },
            {
              $group: {
                _id: null,
                averageScore: { $avg: "$percentage" },
              },
            },
          ]);

          if (classAverageResult.length > 0 && classAverageResult[0].averageScore !== null) {
            averageScore = Math.round(classAverageResult[0].averageScore * 100) / 100;
          } else {
            averageScore = 0; // No completed exams for any student in the class
          }
        } else {
          averageScore = 0; // No students in the class
        }
      } catch (err: any) {
        console.error("Error calculating class average score:", err);
        // Don't fail the entire request if average score calculation fails
        averageScore = 0;
      }
    }

    const responseData: any = {
      total: totalStudentsCount,
      active: activeStudentsCount,
      inactive: inactiveStudentsCount,
    };

    // Only include averageScore when classId is provided
    if (classId && averageScore !== undefined) {
      responseData.averageScore = averageScore;
    }

    return {
      success: true,
      message: "Student statistics retrieved successfully",
      data: responseData,
    };
  } catch (error: any) {
    console.error("Get student stats error:", error);
    throw new Error(`Failed to get student stats: ${error.message}`);
  }
};

/**
 * Resend welcome email to student
 * @param studentId - Student ID
 * @returns Promise with success message
 */
export const resendStudentEmail = async (studentId: string) => {
  try {
    // Fetch student data
    const student = await studentRepository.findStudentById(studentId);
    if (!student) {
      throw new Error("Student not found");
    }

    // Check if student has email
    if (!student.email) {
      throw new Error("Student does not have an email address");
    }

    // Get tenant info
    const tenantId = student.tenantId?.toString();
    const tenantName = student.tenantName;

    if (!tenantId) {
      throw new Error("Student tenant ID is missing");
    }

    // Send welcome email
    await sendWelcomeEmail(
      student.email,
      student.firstName,
      student.lastName,
      "Student",
      tenantId,
      tenantName,
      student.userId?.toString()
    );

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  } catch (error: any) {
    console.error("Resend student email error:", error);
    throw new Error(`Failed to resend email: ${error.message}`);
  }
};

/**
 * Get all classes for a student (active and promoted) from ClassStudent junction table
 * Returns all class enrollments with full class details, subjects, and enrollment metadata
 * @param studentId - Student ID
 * @param tenantId - Tenant ID
 * @returns Promise with array of class enrollments
 */
export const getStudentClasses = async (
  studentId: string,
  tenantId: string
): Promise<any[]> => {
  try {
    // Validate inputs
    if (!studentId || typeof studentId !== "string") {
      throw new Error("Student ID is required");
    }

    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Tenant ID is required");
    }

    // Note: We skip direct student verification here to avoid timeout issues
    // Tenant ownership is verified through the Class relationship below
    // (Classes are filtered by tenantId, so only classes belonging to this tenant will be returned)

    // Get all ClassStudent records for this student (query by studentId only)
    // We'll verify tenantId through the Class relationship
    const classStudentRecords = await classStudentRepository.findByStudent(
      studentId,
      undefined // Don't filter by tenantId - verify through Class instead
    );

    console.log(`[getStudentClasses] Found ${classStudentRecords?.length || 0} ClassStudent records for student ${studentId}`);

    if (!classStudentRecords || classStudentRecords.length === 0) {
      return [];
    }

    // Filter to only include active and promoted enrollments
    const activeAndPromotedRecords = classStudentRecords.filter(
      (record) =>
        record.enrollmentStatus === "active" ||
        record.enrollmentStatus === "promoted"
    );

    console.log(`[getStudentClasses] After filtering, ${activeAndPromotedRecords.length} active/promoted records`);

    if (activeAndPromotedRecords.length === 0) {
      return [];
    }

    // Get class IDs (handle both ObjectId and string)
    const classIds = activeAndPromotedRecords.map((record) => {
      const classId = record.classId;
      return classId instanceof mongoose.Types.ObjectId
        ? classId
        : new mongoose.Types.ObjectId(classId);
    });

    // Get all classes (only name and grade needed)
    // Filter by tenantId here to ensure we only get classes belonging to this tenant
    const { Class } = await import("../models/class.schema");
    const classes = await Class.find({
      _id: { $in: classIds },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    })
      .select("_id name grade")
      .lean();

    console.log(`[getStudentClasses] Found ${classes.length} classes for classIds: ${classIds.map(id => id.toString()).join(', ')}`);

    // Create a map of classId to class data for quick lookup
    const classMap = new Map();
    classes.forEach((cls: any) => {
      classMap.set(cls._id.toString(), cls);
    });

    // Combine ClassStudent records with class details - simplified response
    const result = activeAndPromotedRecords
      .map((classStudentRecord) => {
        const classId = classStudentRecord.classId.toString();
        const classData = classMap.get(classId);

        if (!classData) {
          return null; // Skip if class not found
        }

        return {
          classId: classId,
          name: classData.name || "",
          grade: classData.grade || null,
          enrollmentStatus: classStudentRecord.enrollmentStatus,
        };
      })
      .filter((item) => item !== null) // Remove null entries
      .sort((a: any, b: any) => {
        // Sort by enrollment status (active first), then by grade (descending)
        if (a.enrollmentStatus !== b.enrollmentStatus) {
          if (a.enrollmentStatus === "active") return -1;
          if (b.enrollmentStatus === "active") return 1;
        }
        return (b.grade || 0) - (a.grade || 0);
      });

    return result;
  } catch (error: any) {
    console.error("Get student classes error:", error);
    throw new Error(`Failed to get student classes: ${error.message}`);
  }
};

/**
 * Bulk assign students to class with subjects
 * ALL-OR-NOTHING approach: If any validation fails, entire operation fails and rolls back
 * Optimized for performance: Uses batch queries and bulk operations
 */
export const bulkAssignStudentsToClass = async (
  classId: string,
  assignments: Array<{
    studentId: string;
    rollNumber: string;
    subjectIds: string[];
  }>,
  tenantId: string,
  tenantName?: string
): Promise<{
  success: boolean;
  assigned: number;
  message: string;
}> => {
  const session = await mongoose.startSession();
  const startTime = Date.now();

  try {
    await session.withTransaction(async () => {
      const classRepository = new ClassRepository();
      const { Student } = await import("../models/student.schema");

      // Validate class exists
      const classData = await classRepository.findById(classId, tenantId);
      if (!classData) {
        throw new Error(`Class with ID ${classId} not found`);
      }

      // Check class capacity
      const currentStudentCount = classData.studentIds?.length || 0;
      const requestedCount = assignments.length;
      if (
        typeof (classData as any).capacity === "number" &&
        (classData as any).capacity >= 0 &&
        currentStudentCount + requestedCount > (classData as any).capacity
      ) {
        throw new Error(
          `Class capacity exceeded. Current: ${currentStudentCount}, Requested: ${requestedCount}, Capacity: ${(classData as any).capacity}`
        );
      }

      // Get class subjectIds for validation
      const classSubjectIds = (classData.subjectIds || []).map((id: any) =>
        id.toString()
      );

      // Get all student IDs from assignments
      const studentIds = assignments.map((a) => a.studentId);

      // Fetch all students to get their stdId
      const students = await Student.find({
        _id: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: tenantId,
        isDeleted: false,
      }).lean();

      const studentMap = new Map<string, any>();
      students.forEach((student: any) => {
        studentMap.set(student._id.toString(), student);
      });

      // OPTIMIZATION: Batch check which students are already assigned to any class
      const assignedStudentIds = new Set<string>();
      if (studentIds.length > 0) {
        const ClassStudent = (await import("../models/class_student.schema")).default;
        const existingAssignments = await ClassStudent.find({
          studentId: { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) },
          tenantId: mongoose.Types.ObjectId.isValid(tenantId)
            ? new mongoose.Types.ObjectId(tenantId)
            : tenantId,
          isDeleted: false,
          enrollmentStatus: { $in: ["active", "promoted"] },
        }).select("studentId").lean();

        existingAssignments.forEach((assignment: any) => {
          assignedStudentIds.add(assignment.studentId.toString());
        });
      }

      // OPTIMIZATION: Batch check all roll numbers that already exist in this class
      const rollNumbersToCheck = assignments.map((a) => a.rollNumber);
      const ClassStudent = (await import("../models/class_student.schema")).default;
      const existingRollNumbers = await ClassStudent.find({
        classId: new mongoose.Types.ObjectId(classId),
        tenantId: mongoose.Types.ObjectId.isValid(tenantId)
          ? new mongoose.Types.ObjectId(tenantId)
          : tenantId,
        rollNumber: { $in: rollNumbersToCheck },
        isDeleted: false,
      }).select("rollNumber").lean();

      const existingRollNumberSet = new Set<string>();
      existingRollNumbers.forEach((record: any) => {
        existingRollNumberSet.add(record.rollNumber);
      });

      // 8. Validate all assignments upfront (ALL-OR-NOTHING)
      const validationErrors: string[] = [];
      const rollNumberSet = new Set<string>();

      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        const index = i + 1;

        // Check for duplicate roll numbers in request
        if (rollNumberSet.has(assignment.rollNumber)) {
          validationErrors.push(
            `Assignment ${index}: Roll number "${assignment.rollNumber}" is duplicated in the request`
          );
          continue;
        }
        rollNumberSet.add(assignment.rollNumber);

        // Check if roll number already exists in class
        if (existingRollNumberSet.has(assignment.rollNumber)) {
          validationErrors.push(
            `Assignment ${index} (Student: ${assignment.studentId}): Roll number "${assignment.rollNumber}" already exists in this class`
          );
        }

        // Check if student is already assigned to another class
        if (assignedStudentIds.has(assignment.studentId)) {
          validationErrors.push(
            `Assignment ${index} (Student: ${assignment.studentId}): Student is already assigned to another class`
          );
        }

        // Validate student exists
        if (!studentMap.has(assignment.studentId)) {
          validationErrors.push(
            `Assignment ${index}: Student with ID "${assignment.studentId}" not found`
          );
        }

        // Validate subjectIds belong to the class
        const invalidSubjectIds = assignment.subjectIds.filter(
          (subId) => !classSubjectIds.includes(subId)
        );
        if (invalidSubjectIds.length > 0) {
          validationErrors.push(
            `Assignment ${index} (Student: ${assignment.studentId}): Invalid subjectIds: ${invalidSubjectIds.join(", ")}. These subjects don't belong to the class`
          );
        }
      }

      // If any validation failed, throw error (ALL-OR-NOTHING)
      if (validationErrors.length > 0) {
        throw new Error(
          `Validation failed for ${validationErrors.length} assignment(s):\n${validationErrors.slice(0, 10).join("\n")}${validationErrors.length > 10 ? `\n... and ${validationErrors.length - 10} more error(s)` : ""}`
        );
      }

      // ===== PHASE 2: ALL VALIDATIONS PASSED - PERFORM BULK OPERATIONS =====
      console.log(`✅ All validations passed. Creating ${assignments.length} assignments...`);

      // 9. Prepare all ClassStudent entries
      const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

      const classStudentEntries = assignments.map((assignment) => {
        const student = studentMap.get(assignment.studentId);
        return {
          classId: new mongoose.Types.ObjectId(classId),
          studentId: new mongoose.Types.ObjectId(assignment.studentId),
          stdId: student?.stdId || `STD-${assignment.studentId.slice(-6)}`,
          rollNumber: assignment.rollNumber,
          subjectIds:
            assignment.subjectIds.length > 0
              ? assignment.subjectIds.map((id) => new mongoose.Types.ObjectId(id))
              : [],
          tenantId: tenantIdObj,
          tenantName: tenantName || "",
          createdBy: "academy-api",
          isActive: true,
          isDeleted: false,
          enrollmentStatus: "active" as const,
        };
      });

      // 10. OPTIMIZATION: Bulk insert all ClassStudent entries (1 operation)
      await classStudentRepository.createBulk(classStudentEntries, session);

      // 11. OPTIMIZATION: Bulk update all Student documents (1 bulkWrite operation)
      const studentUpdates = assignments.map((assignment) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(assignment.studentId) },
          update: {
            $set: {
              classId: classId,
              className: classData.name || "",
              rollNumber: assignment.rollNumber,
              updatedAt: new Date(),
            },
          },
        },
      }));

      await Student.bulkWrite(studentUpdates, { session });

      // 12. OPTIMIZATION: Add all students to class's studentIds array in one operation
      const newStudentIds = studentIds
        .filter((id) => !classData.studentIds.some((existingId: any) => existingId.toString() === id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (newStudentIds.length > 0) {
        const { Class } = await import("../models/class.schema");
        await Class.updateOne(
          { _id: new mongoose.Types.ObjectId(classId) },
          { $addToSet: { studentIds: { $each: newStudentIds } } },
          { session }
        );
      }
    });

    await session.endSession();
    const duration = Date.now() - startTime;
    console.log(`✅ Bulk assignment completed successfully in ${duration}ms`);

    return {
      success: true,
      assigned: assignments.length,
      message: `Successfully assigned ${assignments.length} student(s) to class`,
    };
  } catch (error: any) {
    await session.endSession();
    const duration = Date.now() - startTime;
    console.error(`❌ Bulk assignment failed after ${duration}ms:`, error.message);

    // Handle duplicate key errors with user-friendly messages
    if (error.code === 11000 || error.code === 11001) {
      const errorMessage = error.message || "";

      if (errorMessage.includes("tenantId_1_classId_1_rollNumber_1") ||
        errorMessage.includes("rollNumber")) {
        const rollMatch = errorMessage.match(/rollNumber: "([^"]+)"/);
        const rollNumber = rollMatch ? rollMatch[1] : "unknown";
        throw new Error(
          `Roll number "${rollNumber}" already exists in this class. Please use a different roll number.`
        );
      } else if (errorMessage.includes("tenantId_1_classId_1_studentId_1") ||
        errorMessage.includes("studentId")) {
        throw new Error(
          `One or more students are already assigned to this class. Please check the assignments and remove duplicate entries.`
        );
      } else {
        throw new Error(
          `Duplicate entry detected: One or more students or roll numbers already exist in this class. Please review your assignments.`
        );
      }
    }

    // Re-throw validation errors as-is (they're already user-friendly)
    throw error;
  }
};

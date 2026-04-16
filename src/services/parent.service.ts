import * as parentRepository from "../repositories/parent.repository";
import * as parentChildRepository from "../repositories/parentChild.repository";
import { CreateParentRequest, UpdateParentRequest } from "@/types/parent.types";
import mongoose, { SortOrder } from "mongoose";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { Parent } from "@/models";
import {
  GetAchievementsRequest,
  GetBadgesRequest,
  StudentAchievementResponse,
  StudentBadgeResponse,
} from "@/types/studentCredentials.types";
import * as studentCredentialsService from "./studentCredentials.service";
import * as studentRepository from "../repositories/student.repository";
import * as parentChildService from "./parentChild.service";
import * as notificationService from "./notification.service";
import { getRoleDisplayNameForTenant, sendWelcomeEmail } from "@/utils/email.helper";
import { generateRandomPassword } from "@/utils/password.helper";
import { bulkUpdateWalletsWithParent } from "./monetizationApiIntegration.service";
import { assertSeatAvailable } from "@/utils/seatsNlicense.helper";

/**
 * Parent Service - Business logic for parent management
 * Handles parent CRUD operations
 */

// Create new parent (simplified without transaction)
export const createParent = async (
  data: CreateParentRequest,
  tenantId: string,
  tenantName?: string,
  createdBy?: string,
  createdByRole?: string
) => {
  return await createParentWithSession(data, tenantId, tenantName, undefined, createdBy, createdByRole);
};

// Create new parent with session (for transaction support)
export const createParentWithSession = async (
  data: CreateParentRequest,
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
    console.log("✅ Using tenant name:", finalTenantName);

    // Enforce seats/quota (0 means unlimited)
    await assertSeatAvailable({ tenantId, type: "parent", requested: 1 });

    // ===== STEP 1: ALL VALIDATIONS FIRST =====
    console.log("🔍 Starting comprehensive validation...");

    // Basic required field validation
    if (!data.email) {
      throw new Error("Email is required for parent creation");
    }
    // Generate random password if not provided
    if (!data.password || data.password.trim().length === 0) {
      data.password = generateRandomPassword();
    }
    if (!data.firstName) {
      throw new Error("First name is required for parent creation");
    }
    if (!data.lastName) {
      throw new Error("Last name is required for parent creation");
    }
    if (!data.role) {
      throw new Error("Role is required for parent creation. Must be one of: father, mother, guardian");
    }
    // Validate role enum
    const validRoles = ['father', 'mother', 'guardian'];
    if (!validRoles.includes(data.role.toLowerCase())) {
      throw new Error(`Invalid role. Role must be one of: ${validRoles.join(', ')}`);
    }
    // Normalize role to lowercase
    data.role = data.role.toLowerCase() as 'father' | 'mother' | 'guardian';

    // Gender validation based on role
    // If role is "guardian", gender is REQUIRED
    // If role is "father" or "mother", gender should NOT be saved (remove it even if provided)
    if (data.role === 'guardian') {
      if (!data.gender || data.gender.trim().length === 0) {
        throw new Error("Gender is required when role is 'guardian'");
      }
      // Validate gender value is one of the allowed options
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];
      const normalizedGender = data.gender.toLowerCase().trim();
      if (!validGenders.includes(normalizedGender)) {
        throw new Error(`Gender must be one of: ${validGenders.join(", ")}`);
      }
      // Normalize gender
      data.gender = normalizedGender as "male" | "female" | "other" | "prefer_not_to_say";
    } else {
      // For father or mother, remove gender (don't save it)
      delete data.gender;
    }

    // Children/Student IDs validation - required field
    const childrenIdsForValidation = data.studentIds || data.childrenIds || data.children;
    if (!childrenIdsForValidation || !Array.isArray(childrenIdsForValidation) || childrenIdsForValidation.length === 0) {
      throw new Error("At least one child (student) must be assigned to the parent. Please provide studentIds, childrenIds, or children field with at least one student ID.");
    }

    // Validate that each child doesn't already have a parent with the same role
    // Each child can have max 1 father, 1 mother, and 1 guardian
    const parentRole = data.role.toLowerCase(); // Normalize to lowercase
    const roleConflicts: Array<{ childId: string; childName?: string; existingParentName?: string }> = [];

    for (const childId of childrenIdsForValidation) {
      try {
        // Validate child ID format
        if (!mongoose.Types.ObjectId.isValid(childId)) {
          roleConflicts.push({
            childId,
            childName: "Invalid ID format"
          });
          continue;
        }

        // Get all existing parents for this child
        const existingParents = await parentChildRepository.findParentsByChildId(childId);

        // Check if any existing parent has the same role
        for (const existingParentChild of existingParents) {
          const existingParent = existingParentChild.parentId as any;

          // Check parent's role field (if populated) or relationship field
          const existingRole = existingParent?.role?.toLowerCase() ||
            existingParentChild.relationship?.toLowerCase();

          if (existingRole === parentRole) {
            // Get child name for better error message
            const child = await studentRepository.findStudentById(childId);
            const childName = child ? `${child.firstName} ${child.lastName}` : childId;
            const existingParentName = existingParent
              ? `${existingParent.firstName} ${existingParent.lastName}`
              : "Unknown";

            roleConflicts.push({
              childId,
              childName,
              existingParentName
            });
            break; // Found conflict, no need to check other parents
          }
        }
      } catch (error: any) {
        console.error(`Error checking role conflict for child ${childId}:`, error);
        // Continue checking other children even if one fails
      }
    }

    // If any conflicts found, throw error with details
    if (roleConflicts.length > 0) {
      const conflictMessages = roleConflicts.map(conflict => {
        if (conflict.childName && conflict.existingParentName) {
          const roleDisplay = parentRole.charAt(0).toUpperCase() + parentRole.slice(1);
          return `Child "${conflict.childName}" already has a ${roleDisplay} parent (${conflict.existingParentName})`;
        } else if (conflict.childName) {
          const roleDisplay = parentRole.charAt(0).toUpperCase() + parentRole.slice(1);
          return `Child "${conflict.childName}" already has a ${roleDisplay} parent`;
        } else {
          const roleDisplay = parentRole.charAt(0).toUpperCase() + parentRole.slice(1);
          return `Child with ID "${conflict.childId}" already has a ${roleDisplay} parent`;
        }
      });

      // Simplified error message
      if (conflictMessages.length === 1) {
        throw new Error(conflictMessages[0]);
      } else {
        throw new Error(conflictMessages.join("; "));
      }
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

    // Check for existing parent with same email
    console.log(
      "🔍 Checking for existing parent with email:",
      data.email,
      "tenantId:",
      tenantId
    );
    const existingParentByEmail = await parentRepository.findParentByEmail(
      data.email,
      tenantId
    );
    console.log(
      "🔍 Existing parent found:",
      existingParentByEmail ? "YES" : "NO"
    );
    if (existingParentByEmail) {
      throw new Error(
        `Parent with email ${data.email} already exists in this tenant`
      );
    }

    // Check for existing parent with same parentId
    if (data.parentId) {
      console.log(
        "🔍 Checking for existing parent with parent ID:",
        data.parentId
      );
      const existingParentByParentId =
        await parentRepository.findParentByParentId(data.parentId, tenantId);
      if (existingParentByParentId) {
        throw new Error(
          `Parent with parent ID ${data.parentId} already exists in this tenant`
        );
      }
    }

    // Check if user already exists in user-api BEFORE creating
    // This is the initial check - we'll do a final check right before creation
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
    // This ensures no user is created if there are any conflicts
    console.log(
      "🔍 Final validation check before creation (to catch race conditions)..."
    );

    // Re-check parent email
    const finalCheckParentByEmail = await parentRepository.findParentByEmail(
      data.email,
      tenantId
    );
    if (finalCheckParentByEmail) {
      throw new Error(
        `Parent with email ${data.email} already exists in this tenant (race condition detected)`
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
        `User with email ${data.email} already exists in user-api for this tenant (race condition detected)`
      );
    }

    console.log("✅ Final validation passed - safe to proceed with creation");

    // ===== STEP 3: GENERATE ID AFTER VALIDATION =====
    let sharedId = new mongoose.Types.ObjectId();
    console.log(
      "🆔 Generated shared ID for user and parent:",
      sharedId.toString()
    );

    // Check if this ID already exists in the database (should be very rare)
    console.log("🔍 Checking if shared ID already exists in database...");
    const existingParentWithId = await parentRepository.findParentById(
      sharedId.toString()
    );
    if (existingParentWithId) {
      console.log(
        "⚠️ Shared ID already exists in database - generating new one"
      );
      sharedId = new mongoose.Types.ObjectId();
      console.log("🆔 Generated new shared ID:", sharedId.toString());
    }

    // ===== STEP 4: CREATE USER RECORD IN USER-API =====
    // Only create user AFTER all validations pass (both initial and final)
    console.log("👤 Creating user record in user-api...");
    // Only include gender if role is guardian (gender is required for guardian, not saved for father/mother)
    const userData: any = {
      _id: sharedId, // Keep as ObjectId, not string
      username: data.email.toLowerCase(), // Use email as username
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password, // Use provided password (now mandatory)
      phoneNumber: data.phoneNumber,
      tenantId: tenantId, // Keep as is (might already be ObjectId or string)
      tenantName: finalTenantName,
      userType: "parent",
      roleName: "PARENT", // Will be resolved to role ID in user-api
      userAccessType: "private",
      isEmailVerified: false,
      isActive: true,
      createdBy: "academic-api", // Add required createdBy field
    };

    // Only add gender if role is guardian
    if (data.role === 'guardian' && data.gender) {
      userData.gender = data.gender;
    }

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

    // ===== STEP 5: CREATE PARENT RECORD WITH RETRY LOGIC =====
    // All validations already completed above (both initial and final checks)
    // Use retry logic for parentId conflicts
    console.log("📝 Creating parent record...");
    let parent;
    let parentRetryCount = 0;
    const maxParentRetries = 3;
    let currentParentId = data.parentId;

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

    while (parentRetryCount < maxParentRetries) {
      const parentData: any = {
        _id: sharedId, // Use the same shared ID
        userId: new mongoose.Types.ObjectId(userId), // Set userId to match user record
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role, // Required role field
        phoneNumber: data.phoneNumber,
        // Only include gender if role is guardian (gender is required for guardian, not saved for father/mother)
        ...(data.role === 'guardian' && data.gender ? { gender: data.gender } : {}),
        demoPassword: data.password, // Use the mandatory password
        status: "active" as const,
        tenantId: tenantId,
        tenantName: finalTenantName,
        createdBy: "academy-api",
        isActive: true,
        isDeleted: false,
      };

      // Only include optional fields if they are provided
      if (data.address !== undefined) parentData.address = data.address;
      if (data.profilePicture !== undefined)
        parentData.profilePicture = data.profilePicture;
      if (currentParentId !== undefined) parentData.parentId = currentParentId;
      if (data.occupation !== undefined)
        parentData.occupation = data.occupation;
      if (data.relationship !== undefined)
        parentData.relationship = data.relationship;
      if (data.maritalStatus !== undefined)
        parentData.maritalStatus = data.maritalStatus;
      if (data.emergencyContact !== undefined)
        parentData.emergencyContact = data.emergencyContact;
      if (data.emergencyPhone !== undefined)
        parentData.emergencyPhone = data.emergencyPhone;
      if (data.emergencyRelation !== undefined)
        parentData.emergencyRelation = data.emergencyRelation;
      if (data.permanentAddress !== undefined)
        parentData.permanentAddress = data.permanentAddress;
      if (data.paymentMethod !== undefined)
        parentData.paymentMethod = data.paymentMethod;
      if (data.workplace !== undefined) parentData.workplace = data.workplace;
      if (data.workPhone !== undefined) parentData.workPhone = data.workPhone;
      if (data.workAddress !== undefined)
        parentData.workAddress = data.workAddress;
      if (data.alternatePhone !== undefined)
        parentData.alternatePhone = data.alternatePhone;
      if (data.alternateEmail !== undefined)
        parentData.alternateEmail = data.alternateEmail;
      if (data.currentAddress !== undefined)
        parentData.currentAddress = data.currentAddress;
      if (data.monthlyIncome !== undefined)
        parentData.monthlyIncome = data.monthlyIncome;
      if (data.bankDetails !== undefined)
        parentData.bankDetails = data.bankDetails;
      if (data.notes !== undefined) parentData.notes = data.notes;
      if (data.preferences !== undefined) {
        parentData.preferences = data.preferences;
      } else {
        parentData.preferences = {
          communicationMethod: "email",
          language: "en",
          receiveNotifications: true,
        };
      }

      console.log("📝 Parent _id being used:", parentData._id);
      console.log("📝 User ID for verification:", userId);
      console.log("📝 Parent userId being set:", parentData.userId);

      try {
        parent = await parentRepository.createParent(parentData, session);
        console.log("✅ Parent created successfully:", parent._id);
        console.log(
          "✅ ID verification successful - user and parent have matching IDs"
        );
        break; // Success, exit retry loop
      } catch (parentError: any) {
        parentRetryCount++;
        console.error("❌ Parent creation failed:", parentError.message);
        console.error("❌ Parent creation error details:", {
          message: parentError.message,
          code: parentError.code,
          keyPattern: parentError.keyPattern,
          keyValue: parentError.keyValue,
        });

        // Detect specific error types
        let errorMessage = parentError.message;
        const isEmailConflict =
          parentError.code === 11000 &&
          (parentError.keyPattern?.email || parentError.keyValue?.email);
        const isParentIdConflict =
          parentError.code === 11000 &&
          (parentError.keyPattern?.parentId || parentError.keyValue?.parentId);

        if (isEmailConflict) {
          errorMessage = `Parent with email ${parentError.keyValue?.email || data.email
            } already exists (database constraint violation)`;
          // Email conflicts cannot be retried - cleanup and throw
          console.log(
            "🧹 Starting cleanup of user record due to parent creation failure..."
          );
          try {
            const cleanupUserId = userIdForCleanup || userId;
            if (cleanupUserId && cleanupUserId !== "undefined") {
              await UserApiIntegrationService.deleteUser(cleanupUserId);
              console.log(
                "✅ Successfully cleaned up user record (ID:",
                cleanupUserId,
                ") due to parent creation failure"
              );
            } else {
              console.warn(
                "⚠️ Cannot cleanup user record - user ID is undefined"
              );
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
          throw new Error(`Failed to create parent record: ${errorMessage}`);
        } else if (isParentIdConflict) {
          // ParentId conflict - retry with unique parentId
          if (parentRetryCount < maxParentRetries) {
            const timestamp = Date.now();
            currentParentId = `${data.parentId || "PARENT"}_${timestamp}`;
            console.log(
              `🔄 Retrying with unique parentId: ${currentParentId} (attempt ${parentRetryCount + 1
              }/${maxParentRetries})`
            );
            // Wait before retry
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * parentRetryCount)
            );
            continue; // Try again with new parentId
          } else {
            errorMessage = `Parent with parent ID ${parentError.keyValue?.parentId || data.parentId
              } already exists (database constraint violation)`;
          }
        }

        // If max retries reached, cleanup and throw
        if (parentRetryCount >= maxParentRetries) {
          console.log("❌ Parent creation failed after all retries");
          // CRITICAL: Always cleanup user record if parent creation fails
          // This prevents orphaned users and "username already exists" errors on retry
          console.log(
            "🧹 Starting cleanup of user record due to parent creation failure..."
          );
          try {
            const cleanupUserId = userIdForCleanup || userId;
            if (cleanupUserId && cleanupUserId !== "undefined") {
              await UserApiIntegrationService.deleteUser(cleanupUserId);
              console.log(
                "✅ Successfully cleaned up user record (ID:",
                cleanupUserId,
                ") due to parent creation failure"
              );
            } else {
              console.warn(
                "⚠️ Cannot cleanup user record - user ID is undefined"
              );
            }
          } catch (cleanupError: any) {
            // Log cleanup failure but don't throw - we want to throw the original error
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
          throw new Error(`Failed to create parent record: ${errorMessage}`);
        }

        // Wait before retry for other errors
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * parentRetryCount)
        );
      }
    }

    if (!parent) {
      // If parent creation fails, clean up the user record
      console.log(
        "🧹 Starting cleanup of user record after parent creation failure..."
      );
      try {
        const cleanupUserId = userIdForCleanup || userId;
        if (cleanupUserId && cleanupUserId !== "undefined") {
          await UserApiIntegrationService.deleteUser(cleanupUserId);
          console.log(
            "✅ Successfully cleaned up user record (ID:",
            cleanupUserId,
            ") after parent creation failure"
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
      throw new Error("Failed to create parent after all retry attempts");
    }

    // Verify that both records have the same ID
    const finalUserId = userIdForCleanup || userId;
    console.log("🔍 Verifying ID consistency:");
    console.log("  User ID:", finalUserId);
    console.log("  Parent ID:", parent._id.toString());
    console.log("  Parent userId:", parent.userId?.toString());

    console.log("✅ Both user and parent records created with matching IDs");

    // ===== STEP 6: ADD CHILDREN IF studentIds, childrenIds, OR children PROVIDED =====
    // Support multiple field names: studentIds, childrenIds, or children
    const childrenToLink =
      data.studentIds || data.childrenIds || (data as any).children || [];
    const createdRelationships = [];
    const failedRelationships = [];

    if (childrenToLink.length > 0) {
      console.log(
        `👨‍👩‍👧‍👦 Creating parent-child relationships for ${childrenToLink.length} child(ren)...`
      );

      // Final validation check before creating relationships (to catch race conditions)
      const parentRole = parent.role.toLowerCase();
      for (const childId of childrenToLink) {
        try {
          if (mongoose.Types.ObjectId.isValid(childId)) {
            const existingParents = await parentChildRepository.findParentsByChildId(childId);
            for (const existingParentChild of existingParents) {
              const existingParent = existingParentChild.parentId as any;
              const existingRole = existingParent?.role?.toLowerCase() ||
                existingParentChild.relationship?.toLowerCase();

              if (existingRole === parentRole) {
                const child = await studentRepository.findStudentById(childId);
                const childName = child ? `${child.firstName} ${child.lastName}` : childId;
                const existingParentName = existingParent
                  ? `${existingParent.firstName} ${existingParent.lastName}`
                  : "Unknown";

                const roleDisplay = parentRole.charAt(0).toUpperCase() + parentRole.slice(1);
                throw new Error(
                  `Child "${childName}" already has a ${roleDisplay} parent (${existingParentName})`
                );
              }
            }
          }
        } catch (error: any) {
          // If it's our validation error, throw it
          if (error.message.includes("already has a") || error.message.includes("only one")) {
            throw error;
          }
          // For other errors, log and continue (will be caught in the loop below)
          console.warn(`Warning checking child ${childId} before relationship creation:`, error.message);
        }
      }

      for (const childId of childrenToLink) {
        try {
          // Validate child ID format
          if (!mongoose.Types.ObjectId.isValid(childId)) {
            console.error(`❌ Invalid child ID format: ${childId}`);
            failedRelationships.push({
              childId,
              error: "Invalid child ID format",
            });
            continue;
          }

          // Verify child exists and belongs to the same tenant
          const child = await studentRepository.findStudentById(childId);
          if (!child) {
            console.error(`❌ Child not found: ${childId}`);
            failedRelationships.push({
              childId,
              error: "Child not found",
            });
            continue;
          }

          // Verify child belongs to the same tenant
          if (
            child.tenantId &&
            child.tenantId.toString() !== tenantId.toString()
          ) {
            console.error(`❌ Child ${childId} belongs to a different tenant`);
            failedRelationships.push({
              childId,
              error: "Child belongs to a different tenant",
            });
            continue;
          }

          // Check if relationship already exists
          const existingRelationship =
            await parentChildRepository.findParentChildRelationship(
              parent._id.toString(),
              childId
            );

          if (existingRelationship) {
            console.log(`⚠️ Relationship already exists for child: ${childId}`);
            createdRelationships.push({
              childId,
              relationship: existingRelationship,
              status: "already_exists",
            });
            continue;
          }

          // Use parent's role as the relationship (ensures consistency)
          // parent.role should match ParentChild.relationship
          const relationship = parent.role.toLowerCase() as "father" | "mother" | "guardian";

          // Create parent-child relationship using service method
          const relationshipResult =
            await parentChildService.createParentChildRelationship(
              parent._id.toString(),
              childId,
              relationship,
              tenantId,
              finalTenantName,
              false, // isPrimary
              undefined // notes
            );

          console.log(`✅ Created relationship for child: ${childId}`);
          createdRelationships.push({
            childId,
            relationship: relationshipResult.data,
            status: "created",
          });

          // Update student wallet with parentId (fire-and-forget, don't block parent creation)
          try {
            await bulkUpdateWalletsWithParent(
              [{ studentId: childId, parentId: parent._id.toString() }],
              tenantId
            );
            console.log(`✅ Updated wallet for student ${childId} with parentId ${parent._id.toString()}`);
          } catch (walletError: any) {
            // Log error but don't fail parent creation
            console.warn(`⚠️ Failed to update wallet for student ${childId}:`, walletError.message);
          }
        } catch (relationshipError: any) {
          // Handle case where relationship already exists (service throws error)
          if (
            relationshipError.message.includes("already exists") ||
            relationshipError.message.includes(
              "Parent-child relationship already exists"
            )
          ) {
            console.log(`⚠️ Relationship already exists for child: ${childId}`);
            // Try to fetch the existing relationship
            try {
              const existingRelationship =
                await parentChildRepository.findParentChildRelationship(
                  parent._id.toString(),
                  childId
                );
              if (existingRelationship) {
                createdRelationships.push({
                  childId,
                  relationship: existingRelationship,
                  status: "already_exists",
                });
                continue;
              }
            } catch (fetchError) {
              // If we can't fetch it, treat as failed
            }
          }

          console.error(
            `❌ Failed to create relationship for child ${childId}:`,
            relationshipError.message
          );
          failedRelationships.push({
            childId,
            error: relationshipError.message,
          });
        }
      }

      console.log(
        `✅ Parent-child relationships processed: ${createdRelationships.length} created, ${failedRelationships.length} failed`
      );
    }

    // ===== STEP 7: SEND WELCOME EMAIL TO PARENT =====
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
        const tenantsCollection = mongoose.connection.db?.collection('tenants');
        if (tenantsCollection) {
          const tenantDoc = await tenantsCollection.findOne({
            _id: new mongoose.Types.ObjectId(tenantId),
            isActive: true,
            isDeleted: false
          });

          const partnerId = tenantDoc?.partnerId;

          if (partnerId) {
            // Step 2: Query partners collection directly to get companyName
            const partnersCollection = mongoose.connection.db?.collection('partners');
            if (partnersCollection) {
              const partnerDoc = await partnersCollection.findOne({
                _id: new mongoose.Types.ObjectId(partnerId),
                isActive: true,
                isDeleted: false
              });

              if (partnerDoc?.companyName) {
                partnerName = partnerDoc.companyName;
                console.log("📋 Partner name from database:", partnerName);
              } else {
                console.warn("⚠️ No companyName found in partner document, using tenant name as fallback");
              }
            } else {
              console.warn("⚠️ Partners collection not available, using tenant name as fallback");
            }
          } else {
            console.warn("⚠️ No partnerId found in tenant document, using tenant name as fallback");
          }
        } else {
          console.warn("⚠️ Tenants collection not available, using tenant name as fallback");
        }
      } catch (partnerError: any) {
        console.warn("⚠️ Could not fetch partner data from database, using tenant name as fallback:", partnerError.message);
      }

      const templateParams = {
        title: "Welcome onboard",
        userName: userName,
        role: await getRoleDisplayNameForTenant({ tenantId, role: "Parent" }),
        email: data.email,
        password: data.password, // Temporary password
        loginUrl: loginUrl,
        tenantName: finalTenantName || "Brighton AI Education", // For header
        partnerName: partnerName, // For footer - from partner.companyName
        features: [
          "View your child's academic performance and grades",
          "Track assignments and exam progress",
          "Stay informed about your child's school activities"
        ],
      };

      console.log("📧 Sending welcome email to parent:", data.email);

      // Send email asynchronously - don't await to avoid blocking
      notificationService.sendEmailWithTemplate(
        data.email,
        "account-created",
        templateParams,
        tenantId,
        userId
      ).then(() => {
        console.log(`✅ Welcome email sent successfully to ${data.email}`);
      }).catch((emailError: any) => {
        // Log error but don't fail the parent creation
        console.error(`⚠️ Failed to send welcome email to ${data.email}:`, emailError.message);
      });
    } catch (emailError: any) {
      // Log error but don't fail the parent creation
      console.error("⚠️ Error preparing welcome email:", emailError.message);
    }

    // ===== STEP 8: SEND NOTIFICATIONS =====
    // Send notifications asynchronously (don't block the response if notifications fail)
    try {
      // Use sharedId as the parent's userId - this is what's used in the JWT token
      const parentUserIdString = sharedId.toString();
      const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
      const createdByString = createdBy ? (createdBy?.toString ? createdBy.toString() : String(createdBy)) : undefined;

      console.log("📧 Preparing parent notifications:", {
        parentUserId: parentUserIdString,
        sharedId: sharedId.toString(),
        extractedUserId: userId,
        tenantId: tenantIdString,
        createdBy: createdByString,
        createdByRole: createdByRole,
      });

      const parentName = `${data.firstName} ${data.lastName}`;
      const notifications: notificationService.INotificationRequest[] = [];

      // 1. Send notification to admin who created the parent (if createdBy is provided)
      if (createdByString) {
        // Use the role from the request, or default to ADMIN
        const adminRole = createdByRole || "ADMIN";
        notifications.push({
          receiverId: createdByString,
          receiverRole: adminRole,
          title: "Parent Created Successfully",
          content: `You have successfully created a new parent account for ${parentName} (${data.email}).`,
          senderId: parentUserIdString,
          senderRole: "PARENT",
          tenantId: tenantIdString,
          meta: {
            entityId: parent._id.toString(),
            entityType: "Parent",
            parentId: parent._id.toString(),
            parentName: parentName,
            parentEmail: data.email,
            parentRole: data.role,
          },
        });
        console.log(`📧 Prepared admin notification for: ${createdByString}`);
      }

      // 2. Send welcome notification to the newly created parent
      notifications.push({
        receiverId: parentUserIdString,
        receiverRole: "PARENT",
        title: "Welcome to the Platform!",
        content: `Welcome ${parentName}! Your parent account has been successfully created. You can now log in and start viewing your child's academic progress, assignments, and exam results.`,
        senderId: createdByString || "system",
        senderRole: createdByString ? (createdByRole || "ADMIN") : "SYSTEM",
        tenantId: tenantIdString,
        meta: {
          entityId: parent._id.toString(),
          entityType: "Parent",
          parentId: parent._id.toString(),
          parentName: parentName,
          parentRole: data.role,
        },
      });
      console.log(`📧 Prepared parent welcome notification for: ${parentUserIdString}`);

      // Send all notifications
      if (notifications.length > 0) {
        console.log(`📤 Sending ${notifications.length} notification(s)...`);
        notificationService
          .sendNotifications(notifications)
          .then((result) => {
            console.log(
              `✅ Successfully sent ${notifications.length} notification(s) for parent creation:`,
              result
            );
          })
          .catch((notificationError: any) => {
            // Log error but don't fail the parent creation
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
      // Log error but don't fail the parent creation
      console.error(
        "⚠️ Error preparing notifications:",
        notificationError.message,
        notificationError.stack
      );
    }

    // Return the created parent with user information and relationship status
    return {
      success: true,
      message: "Parent and user created successfully",
      data: {
        parent: parent,
        user: user,
        sharedId: sharedId.toString(),
        children: {
          linked: createdRelationships.length,
          failed: failedRelationships.length,
          relationships: createdRelationships,
          errors:
            failedRelationships.length > 0 ? failedRelationships : undefined,
        },
      },
    };
  } catch (error: any) {
    console.error("Create parent error:", error);

    // CRITICAL: If we have a user ID stored and parent creation failed, cleanup user record
    // This handles any errors that occur after user creation but before successful parent creation
    if (userIdForCleanup) {
      console.log(
        "🧹 Starting cleanup of user record due to error in parent creation process..."
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
    throw new Error(`Failed to create parent: ${error.message}`);
  }
};

// Get all parents
export const getAllParents = async (
  tenantId: string,
  page: number = 1,
  limit: number = 10,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const parents = await parentRepository.findParents({
      pageNo: page,
      pageSize: limit,
      tenantId,
      filters,
      sort,
    });

    // Fetch children for each parent
    const parentsWithChildren = await Promise.all(
      parents.map(async (parent: any) => {
        try {
          const children = await parentChildRepository.findChildrenByParentId(
            parent._id.toString()
          );

          // Extract children names and basic info
          const childrenList = children
            .map((rel: any) => {
              const child = rel.childId;
              if (!child) return null;

              return {
                id: child._id?.toString() || "",
                firstName: child.firstName || "",
                lastName: child.lastName || "",
                fullName:
                  `${child.firstName || ""} ${child.lastName || ""}`.trim() ||
                  "N/A",
                rollNumber: child.rollNumber || "",
                email: child.email || "",
                relationship: rel.relationship || "other",
                isPrimary: rel.isPrimary || false,
                isActive: child.isActive !== undefined ? child.isActive : true,
              };
            })
            .filter((child: any) => child !== null);

          return {
            ...parent,
            id: parent._id.toString(),
            profilePicture: parent.profilePicture || null,
            children: childrenList,
            childrenCount: childrenList.length,
          };
        } catch (error: any) {
          console.error(
            `Error fetching children for parent ${parent._id}:`,
            error
          );
          return {
            ...parent,
            id: parent._id.toString(),
            profilePicture: parent.profilePicture || null,
            children: [],
            childrenCount: 0,
          };
        }
      })
    );

    // Get total count for pagination using the same filters as findParents
    const totalCount = await parentRepository.countParents({
      tenantId,
      filters,
    });

    return {
      success: true,
      message: "Parents retrieved successfully",
      data: parentsWithChildren,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  } catch (error: any) {
    console.error("Get all parents error:", error);
    throw new Error(`Failed to get parents: ${error.message}`);
  }
};

// Get parent by ID
export const getParentById = async (parentId: string) => {
  try {
    const parent = await parentRepository.findParentById(parentId);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Fetch children for the parent
    try {
      const children = await parentChildRepository.findChildrenByParentId(
        parentId
      );

      // Extract children names and basic info
      const childrenList = children
        .map((rel: any) => {
          const child = rel.childId;
          if (!child) return null;

          return {
            id: child._id?.toString() || "",
            firstName: child.firstName || "",
            lastName: child.lastName || "",
            fullName:
              `${child.firstName || ""} ${child.lastName || ""}`.trim() ||
              "N/A",
            rollNumber: child.rollNumber || "",
            email: child.email || "",
            relationship: rel.relationship || "other",
            isPrimary: rel.isPrimary || false,
            isActive: child.isActive !== undefined ? child.isActive : true,
          };
        })
        .filter((child: any) => child !== null);

      // Convert parent to plain object
      const parentObj = parent.toObject ? parent.toObject() : parent;

      return {
        success: true,
        message: "Parent retrieved successfully",
        data: {
          ...parentObj,
          id: parent._id
            ? parent._id.toString()
            : parentObj._id?.toString() || parentObj.id,
          children: childrenList,
          childrenCount: childrenList.length,
        },
      };
    } catch (childrenError: any) {
      console.error(
        `Error fetching children for parent ${parentId}:`,
        childrenError
      );
      // Return parent even if children fetch fails
      const parentObj = parent.toObject ? parent.toObject() : parent;
      return {
        success: true,
        message: "Parent retrieved successfully",
        data: {
          ...parentObj,
          id: parent._id
            ? parent._id.toString()
            : parentObj._id?.toString() || parentObj.id,
          children: [],
          childrenCount: 0,
        },
      };
    }
  } catch (error: any) {
    console.error("Get parent by ID error:", error);
    throw new Error(`Failed to get parent: ${error.message}`);
  }
};

// Update parent
export const updateParent = async (
  parentId: string,
  data: UpdateParentRequest,
  tenantId: string
) => {
  try {
    // Get existing parent to retrieve userId for user-api sync
    const existingParent = await parentRepository.findParentById(parentId);
    if (!existingParent) {
      throw new Error("Parent not found");
    }

    // Handle password update if provided
    if (data.password !== undefined) {
      // Validate password length
      if (data.password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      // Update password in user-api
      if (existingParent.userId) {
        try {
          await UserApiIntegrationService.updateUser(
            existingParent.userId.toString(),
            { password: data.password }
          );
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
      } else {
        console.warn(
          "⚠️ Parent has no userId, cannot update password in user-api"
        );
      }

      // Also update demoPassword in parent record
      data.demoPassword = data.password;
    }

    // Handle status update - automatically set isActive based on status
    if (data.status !== undefined) {
      if (data.status === "active") {
        data.isActive = true;
      } else if (data.status === "inactive") {
        data.isActive = false;
      }
    }

    // Prepare user update data (only fields that exist in User entity)
    const userUpdateData: any = {};
    if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
    if (data.email !== undefined) userUpdateData.email = data.email;
    if (data.phoneNumber !== undefined)
      userUpdateData.phoneNumber = data.phoneNumber;
    if (data.isActive !== undefined) userUpdateData.isActive = data.isActive;

    // Update User entity if there are fields to update (excluding password which is handled above)
    if (Object.keys(userUpdateData).length > 0 && existingParent.userId) {
      try {
        await UserApiIntegrationService.updateUser(
          existingParent.userId.toString(),
          userUpdateData
        );
        console.log("✅ User entity updated successfully");
      } catch (userUpdateError: any) {
        console.error(
          "⚠️ Failed to update user entity:",
          userUpdateError.message
        );
        // Log warning but continue with parent update
      }
    }

    // Sync isActive and status fields
    // If isActive is being updated, ensure status is also updated accordingly
    console.log("🔍 DEBUG - Before sync:", {
      isActive: data.isActive,
      status: data.status,
    });
    if (data.isActive !== undefined) {
      data.status = data.isActive ? "active" : "inactive";
      console.log("✅ Synced status based on isActive:", data.status);
    }
    // If status is being updated, ensure isActive is also updated accordingly
    if (data.status !== undefined) {
      data.isActive = data.status === "active";
      console.log("✅ Synced isActive based on status:", data.isActive);
    }
    console.log("🔍 DEBUG - After sync:", {
      isActive: data.isActive,
      status: data.status,
    });

    // Update parent basic information
    const parent = await parentRepository.updateParentById(parentId, data);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Handle children updates if provided
    // Support multiple field names: studentIds, childrenIds, or children
    const studentIds =
      data.studentIds || data.childrenIds || (data as any).children || [];
    const removeChildIds = data.removeChildIds || [];
    const addedRelationships = [];
    const removedRelationships = [];
    const failedAdditions = [];
    const failedRemovals = [];

    // Get tenant name for relationship creation
    const tenantName = parent.tenantName;

    // Remove children if removeChildIds provided
    if (removeChildIds.length > 0) {
      console.log(
        `🔗 Removing ${removeChildIds.length} children from parent...`
      );
      for (const childId of removeChildIds) {
        try {
          // Find the relationship
          const relationship =
            await parentChildRepository.findParentChildRelationship(
              parentId,
              childId
            );

          if (relationship) {
            // Soft delete the relationship
            await parentChildService.deleteParentChildRelationship(
              relationship._id.toString()
            );
            removedRelationships.push({ childId });
            console.log(`✅ Child ${childId} removed successfully`);
          } else {
            console.warn(`⚠️ Relationship not found for child ${childId}`);
          }
        } catch (removeError: any) {
          console.error(
            `⚠️ Failed to remove child ${childId}:`,
            removeError.message
          );
          failedRemovals.push({
            childId,
            error: removeError.message,
          });
        }
      }
    }

    // Add new children if studentIds provided
    if (studentIds.length > 0) {
      console.log(`🔗 Adding ${studentIds.length} children to parent...`);
      for (const childId of studentIds) {
        try {
          // Check if relationship already exists
          const existingRelationship =
            await parentChildRepository.findParentChildRelationship(
              parentId,
              childId
            );

          if (existingRelationship) {
            console.log(
              `ℹ️ Relationship already exists for child ${childId}, skipping`
            );
            continue;
          }

          // Use the relationship from data, or default to 'other'
          const relationship = data.relationship || "other";

          const relationshipResult =
            await parentChildService.createParentChildRelationship(
              parentId,
              childId,
              relationship as "father" | "mother" | "guardian" | "other",
              tenantId,
              tenantName,
              false, // isPrimary
              undefined // notes
            );

          addedRelationships.push({
            childId,
            relationship: relationshipResult.data,
          });
          console.log(`✅ Child ${childId} added successfully`);

          // Update student wallet with parentId (fire-and-forget, don't block parent update)
          try {
            await bulkUpdateWalletsWithParent(
              [{ studentId: childId, parentId: parentId }],
              tenantId
            );
            console.log(`✅ Updated wallet for student ${childId} with parentId ${parentId}`);
          } catch (walletError: any) {
            // Log error but don't fail parent update
            console.warn(`⚠️ Failed to update wallet for student ${childId}:`, walletError.message);
          }
        } catch (addError: any) {
          console.error(`⚠️ Failed to add child ${childId}:`, addError.message);
          failedAdditions.push({
            childId,
            error: addError.message,
          });
        }
      }
    }

    // Fetch updated children list
    const children = await parentChildRepository.findChildrenByParentId(
      parentId
    );
    const childrenList = children
      .map((rel: any) => {
        const child = rel.childId;
        if (!child) return null;

        return {
          id: child._id?.toString() || "",
          firstName: child.firstName || "",
          lastName: child.lastName || "",
          fullName:
            `${child.firstName || ""} ${child.lastName || ""}`.trim() || "N/A",
          rollNumber: child.rollNumber || "",
          email: child.email || "",
          relationship: rel.relationship || "other",
          isPrimary: rel.isPrimary || false,
          isActive: child.isActive !== undefined ? child.isActive : true,
        };
      })
      .filter((child: any) => child !== null);

    // Convert parent to plain object
    const parentObj = parent.toObject ? parent.toObject() : parent;

    return {
      success: true,
      message: "Parent updated successfully",
      data: {
        ...parentObj,
        id: parent._id
          ? parent._id.toString()
          : parentObj._id?.toString() || parentObj.id,
        children: childrenList,
        childrenCount: childrenList.length,
        childrenUpdate: {
          added: addedRelationships.length,
          removed: removedRelationships.length,
          failedAdditions: failedAdditions.length,
          failedRemovals: failedRemovals.length,
          addedRelationships:
            addedRelationships.length > 0 ? addedRelationships : undefined,
          removedRelationships:
            removedRelationships.length > 0 ? removedRelationships : undefined,
          errors:
            failedAdditions.length > 0 || failedRemovals.length > 0
              ? {
                additions:
                  failedAdditions.length > 0 ? failedAdditions : undefined,
                removals:
                  failedRemovals.length > 0 ? failedRemovals : undefined,
              }
              : undefined,
        },
      },
    };
  } catch (error: any) {
    console.error("Update parent error:", error);
    throw new Error(`Failed to update parent: ${error.message}`);
  }
};

// Delete parent
export const deleteParent = async (parentId: string, tenantId: string) => {
  try {
    const parent = await parentRepository.softDeleteParentById(parentId);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Also delete the corresponding user in the User API
    try {
      await UserApiIntegrationService.deleteUser(parentId);
      console.log(`✅ Successfully deleted user ${parentId} in User API`);
    } catch (userApiError: any) {
      console.error(`⚠️ Failed to delete user ${parentId} in User API:`, userApiError.message);
      // Don't fail the entire operation if user API deletion fails
      // The parent is already marked as deleted in academic-api
    }

    return {
      success: true,
      message: "Parent deleted successfully",
      data: parent,
    };
  } catch (error: any) {
    console.error("Delete parent error:", error);
    throw new Error(`Failed to delete parent: ${error.message}`);
  }
};

// Get parent statistics
export const getParentStatistics = async (tenantId: string) => {
  try {
    const statistics = await parentRepository.getParentStatistics(tenantId);
    return {
      success: true,
      message: "Parent statistics retrieved successfully",
      data: statistics,
    };
  } catch (error: any) {
    console.error("Get parent statistics error:", error);
    throw new Error(`Failed to get parent statistics: ${error.message}`);
  }
};

// Get currently logged-in parent's profile by shared user ID
export const getMyProfile = async (userId: string) => {
  try {
    const parent = await parentRepository.findParentById(userId);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Fetch children for the parent
    try {
      const children = await parentChildRepository.findChildrenByParentId(
        userId
      );

      // Extract children names and basic info
      const childrenList = children
        .map((rel: any) => {
          const child = rel.childId;
          if (!child) return null;

          return {
            id: child._id?.toString() || "",
            firstName: child.firstName || "",
            lastName: child.lastName || "",
            fullName:
              `${child.firstName || ""} ${child.lastName || ""}`.trim() ||
              "N/A",
            rollNumber: child.rollNumber || "",
            email: child.email || "",
            relationship: rel.relationship || "other",
            isPrimary: rel.isPrimary || false,
            isActive: child.isActive !== undefined ? child.isActive : true,
          };
        })
        .filter((child: any) => child !== null);

      // Convert parent to plain object
      const parentObj = parent.toObject ? parent.toObject() : parent;

      return {
        success: true,
        message: "Parent profile retrieved successfully",
        data: {
          ...parentObj,
          id: parent._id
            ? parent._id.toString()
            : parentObj._id?.toString() || parentObj.id,
          children: childrenList,
          childrenCount: childrenList.length,
        },
      };
    } catch (childrenError: any) {
      console.error(
        `Error fetching children for parent ${userId}:`,
        childrenError
      );
      // Return parent even if children fetch fails
      const parentObj = parent.toObject ? parent.toObject() : parent;
      return {
        success: true,
        message: "Parent profile retrieved successfully",
        data: {
          ...parentObj,
          id: parent._id
            ? parent._id.toString()
            : parentObj._id?.toString() || parentObj.id,
          children: [],
          childrenCount: 0,
        },
      };
    }
  } catch (error: any) {
    console.error("Get my parent profile error:", error);
    throw new Error(`Failed to get parent profile: ${error.message}`);
  }
};

// Update currently logged-in parent's profile (syncs with user-api)
export const updateMyProfile = async (
  userId: string,
  data: UpdateParentRequest,
  tenantId: string
) => {
  try {
    // Get existing parent to retrieve userId for user-api sync
    const existingParent = await parentRepository.findParentById(userId);
    if (!existingParent) {
      throw new Error("Parent not found");
    }

    // Handle password update if provided
    if (data.password !== undefined) {
      // Validate password length
      if (data.password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      // Update password in user-api
      if (existingParent.userId) {
        try {
          await UserApiIntegrationService.updateUser(
            existingParent.userId.toString(),
            { password: data.password }
          );
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
      } else {
        console.warn(
          "⚠️ Parent has no userId, cannot update password in user-api"
        );
      }

      // Also update demoPassword in parent record
      data.demoPassword = data.password;
    }

    // Prepare user update data (only fields that exist in User entity)
    const userUpdateData: any = {};
    if (data.firstName !== undefined) userUpdateData.firstName = data.firstName;
    if (data.lastName !== undefined) userUpdateData.lastName = data.lastName;
    if (data.email !== undefined) userUpdateData.email = data.email;
    if (data.phoneNumber !== undefined)
      userUpdateData.phoneNumber = data.phoneNumber;

    // Update User entity if there are fields to update (excluding password which is handled above)
    if (Object.keys(userUpdateData).length > 0 && existingParent.userId) {
      try {
        await UserApiIntegrationService.updateUser(
          existingParent.userId.toString(),
          userUpdateData
        );
        console.log("✅ User entity updated successfully");
      } catch (userUpdateError: any) {
        console.error(
          "⚠️ Failed to update user entity:",
          userUpdateError.message
        );
        // Log warning but continue with parent update
      }
    }

    // Update parent entity
    const parent = await parentRepository.updateParentById(userId, data);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Fetch updated children list
    const children = await parentChildRepository.findChildrenByParentId(userId);
    const childrenList = children
      .map((rel: any) => {
        const child = rel.childId;
        if (!child) return null;

        return {
          id: child._id?.toString() || "",
          firstName: child.firstName || "",
          lastName: child.lastName || "",
          fullName:
            `${child.firstName || ""} ${child.lastName || ""}`.trim() || "N/A",
          rollNumber: child.rollNumber || "",
          email: child.email || "",
          relationship: rel.relationship || "other",
          isPrimary: rel.isPrimary || false,
          isActive: rel.isActive,
        };
      })
      .filter((child: any) => child !== null);

    // Convert parent to plain object
    const parentObj = parent.toObject ? parent.toObject() : parent;

    return {
      success: true,
      message: "Parent profile updated successfully",
      data: {
        ...parentObj,
        id: parent._id
          ? parent._id.toString()
          : parentObj._id?.toString() || parentObj.id,
        children: childrenList,
        childrenCount: childrenList.length,
      },
    };
  } catch (error: any) {
    console.error("Update my parent profile error:", error);
    throw new Error(`Failed to update parent profile: ${error.message}`);
  }
};

/**
 * Get child's achievements for a parent
 */
export const getChildAchievements = async (
  parentId: string,
  childId: string,
  params: Omit<GetAchievementsRequest, "studentId">
): Promise<{
  achievements: StudentAchievementResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    totalAchievements: number;
    unlockedAchievements: number;
    unlockedPercentage: number;
  };
}> => {
  // First verify the parent-child relationship
  const isChild = await parentRepository.verifyParentChildRelationship(
    parentId,
    childId
  );
  if (!isChild) {
    throw new Error("Not authorized to view this child's achievements");
  }

  // If relationship is verified, get the achievements
  return await studentCredentialsService.getStudentAchievements({
    ...params,
    studentId: childId,
  });
};

/**
 * Get child's badges for a parent
 */
export const getChildBadges = async (
  parentId: string,
  childId: string,
  params: Omit<GetBadgesRequest, "studentId">
): Promise<{
  badges: StudentBadgeResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    totalBadges: number;
    earnedBadges: number;
    earnedPercentage: number;
  };
}> => {
  // First verify the parent-child relationship
  const isChild = await parentRepository.verifyParentChildRelationship(
    parentId,
    childId
  );
  if (!isChild) {
    throw new Error("Not authorized to view this child's badges");
  }

  // If relationship is verified, get the badges
  return await studentCredentialsService.getStudentBadges({
    ...params,
    studentId: childId,
  });
};

/**
 * Get aggregated achievements from all children for parent dashboard
 */
export const getAllChildrenAchievements = async (
  parentId: string,
  params: Omit<GetAchievementsRequest, "studentId"> = {}
): Promise<{
  achievements: (StudentAchievementResponse & {
    childName: string;
    childId: string;
  })[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    totalAchievements: number;
    unlockedAchievements: number;
    unlockedPercentage: number;
    byCategory: {
      badges: { total: number; unlocked: number };
      certificates: { total: number; unlocked: number };
      awards: { total: number; unlocked: number };
    };
    byChild: Array<{
      childId: string;
      childName: string;
      totalAchievements: number;
      unlockedAchievements: number;
    }>;
  };
}> => {
  try {
    // Get all children for this parent
    const parentChildRelationships =
      await parentChildRepository.findChildrenByParentId(parentId);

    if (!parentChildRelationships || parentChildRelationships.length === 0) {
      return {
        achievements: [],
        pagination: {
          total: 0,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: 0,
        },
        summary: {
          totalAchievements: 0,
          unlockedAchievements: 0,
          unlockedPercentage: 0,
          byCategory: {
            badges: { total: 0, unlocked: 0 },
            certificates: { total: 0, unlocked: 0 },
            awards: { total: 0, unlocked: 0 },
          },
          byChild: [],
        },
      };
    }

    // Fetch achievements for all children
    let allAchievements: (StudentAchievementResponse & {
      childName: string;
      childId: string;
    })[] = [];
    const childStats: Array<{
      childId: string;
      childName: string;
      totalAchievements: number;
      unlockedAchievements: number;
    }> = [];

    for (const relationship of parentChildRelationships) {
      const childId =
        (relationship.childId as any)?._id?.toString() ||
        (relationship.childId as any)?.toString();
      const childName = `${(relationship.childId as any)?.firstName || ""} ${(relationship.childId as any)?.lastName || ""
        }`.trim();

      try {
        const childAchievements =
          await studentCredentialsService.getStudentAchievements({
            pageNo: 1,
            pageSize: 1000, // Get all achievements for aggregation
            studentId: childId,
            category: params.category,
            isUnlocked: params.isUnlocked,
          });

        // Enrich each achievement with child information
        const enrichedAchievements = childAchievements.achievements.map(
          (ach) => ({
            ...ach,
            childName,
            childId,
          })
        );

        allAchievements = [...allAchievements, ...enrichedAchievements];

        // Collect per-child statistics
        childStats.push({
          childId,
          childName,
          totalAchievements: childAchievements.summary.totalAchievements,
          unlockedAchievements: childAchievements.summary.unlockedAchievements,
        });
      } catch (error) {
        console.error(
          `Error fetching achievements for child ${childId}:`,
          error
        );
        // Continue with other children
      }
    }

    // Calculate category breakdown
    const categoryBreakdown = {
      badges: { total: 0, unlocked: 0 },
      certificates: { total: 0, unlocked: 0 },
      awards: { total: 0, unlocked: 0 },
    };

    allAchievements.forEach((ach) => {
      const category = ach.category?.toLowerCase() || "awards";
      if (category === "badges") {
        categoryBreakdown.badges.total++;
        if (ach.isUnlocked) categoryBreakdown.badges.unlocked++;
      } else if (category === "certificates") {
        categoryBreakdown.certificates.total++;
        if (ach.isUnlocked) categoryBreakdown.certificates.unlocked++;
      } else {
        categoryBreakdown.awards.total++;
        if (ach.isUnlocked) categoryBreakdown.awards.unlocked++;
      }
    });

    // Apply pagination
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const startIndex = (pageNo - 1) * pageSize;
    const paginatedAchievements = allAchievements.slice(
      startIndex,
      startIndex + pageSize
    );

    // Sort by unlocked date descending (most recent first)
    paginatedAchievements.sort((a, b) => {
      const dateA = new Date(a.unlockedDate).getTime();
      const dateB = new Date(b.unlockedDate).getTime();
      return dateB - dateA;
    });

    const totalAchievements = allAchievements.length;
    const unlockedAchievements = allAchievements.filter(
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
        totalAchievements,
        unlockedAchievements,
        unlockedPercentage:
          totalAchievements > 0
            ? (unlockedAchievements / totalAchievements) * 100
            : 0,
        byCategory: categoryBreakdown,
        byChild: childStats,
      },
    };
  } catch (error: any) {
    console.error("Get all children achievements error:", error);
    throw new Error(
      `Failed to get all children achievements: ${error.message}`
    );
  }
};

// Get parent counts (total, active, inactive)
export const getParentCounts = async (tenantId: string) => {
  try {
    // Get total parents count (not deleted)
    const totalParent = await Parent.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    });

    // Get active parents count (isActive: true, isDeleted: false)
    const totalActiveParent = await Parent.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false,
    });

    // Get inactive parents count (isActive: false, isDeleted: false)
    const totalInactiveParent = await Parent.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: false,
      isDeleted: false,
    });

    return {
      success: true,
      message: "Parent counts retrieved successfully",
      data: {
        totalParent,
        totalActiveParent,
        totalInactiveParent,
      },
    };
  } catch (error: any) {
    console.error("Get parent counts error:", error);
    throw new Error(`Failed to get parent counts: ${error.message}`);
  }
};

/**
 * Resend welcome email to parent
 * @param parentId - Parent ID
 * @returns Promise with success message
 */
export const resendParentEmail = async (parentId: string) => {
  try {
    // Fetch parent data
    const parent = await parentRepository.findParentById(parentId);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Check if parent has email
    if (!parent.email) {
      throw new Error("Parent does not have an email address");
    }

    // Get tenant info
    const tenantId = parent.tenantId?.toString();
    const tenantName = parent.tenantName;

    if (!tenantId) {
      throw new Error("Parent tenant ID is missing");
    }

    // Send welcome email
    await sendWelcomeEmail(
      parent.email,
      parent.firstName,
      parent.lastName,
      "Parent",
      tenantId,
      tenantName,
      parent.userId?.toString()
    );

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  } catch (error: any) {
    console.error("Resend parent email error:", error);
    throw new Error(`Failed to resend email: ${error.message}`);
  }
};

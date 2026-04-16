import * as tenantRepository from "../repositories/tenant.repository";
import * as adminService from "./admin.service";
import * as gradingSystemService from "./gradingSystem.service";
import * as notificationService from "./notification.service";
import { ITenant } from "../models";
import mongoose, { SortOrder } from "mongoose";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import { sendWelcomeEmail } from "../utils/email.helper";

const formatLocalDate = (dateUtc: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateUtc);

/**
 * Tenant Service
 * Business logic for Tenant management
 */

// export const createTenant = async (
//   data: { tenant: Partial<ITenant>; admin: any },
//   token?: string,
//   createdById?: string,
//   createdByRole?: string
// ) => {
//   let { tenant: tenantData, admin: adminData } = data;

//   // Support flat structure if tenant object is missing
//   if (!tenantData) {
//     tenantData = data as Partial<ITenant>;
//     adminData = data;
//   }

//   // Ensure partnerId is captured if it's at the root level
//   if ((data as any).partnerId && !tenantData.partnerId) {
//     tenantData.partnerId = (data as any).partnerId;
//   }

//   // Ensure gradeRanges is captured if it's at the root level
//   if ((data as any).gradeRanges && !tenantData.gradeRanges) {
//     tenantData.gradeRanges = (data as any).gradeRanges;
//   }

//   // Ensure maxSchoolLevel is captured if it's at the root level
//   if ((data as any).maxSchoolLevel !== undefined && tenantData.maxSchoolLevel === undefined) {
//     tenantData.maxSchoolLevel = (data as any).maxSchoolLevel;
//   }

//   // Check if tenant name or school name already exists
//   if (tenantData.tenantName) {
//     const existingTenant = await tenantRepository.findTenantByTenantName(
//       tenantData.tenantName
//     );
//     if (existingTenant) {
//       throw new Error(`Tenant name "${tenantData.tenantName}" already exists`);
//     }
//   }

//   if (tenantData.schoolName) {
//     const existingSchool = await tenantRepository.findTenantBySchoolName(
//       tenantData.schoolName
//     );
//     if (existingSchool) {
//       throw new Error(`School name "${tenantData.schoolName}" already exists`);
//     }
//   }

//   // Initialize trial tracking fields on creation
//   const tenantTimeZone = tenantData.timeZone || "UTC";
//   if (tenantData.isTrial) {
//     const totalDays = tenantData.trialDaysTotal ?? tenantData.trialDaysRemaining ?? 0;
//     tenantData.trialDaysTotal = totalDays;
//     tenantData.trialDaysRemaining = totalDays;
//     tenantData.lastTrialDecrementDate = formatLocalDate(new Date(), tenantTimeZone);
//   }

//   // 1. Create in academic-api
//   const tenant = await tenantRepository.createTenant(tenantData);

//   // 2. Generate shared ID for admin and user (same entity)
//   const sharedAdminUserId = new mongoose.Types.ObjectId();

//   // 3. Create Admin in academic-api with shared ID
//   const admin = await adminService.createAdminRecord({
//     _id: sharedAdminUserId,
//     username: adminData.username,
//     firstName: adminData.firstName,
//     lastName: adminData.lastName,
//     email: adminData.email,
//     password: adminData.password, // Stored for reference
//     phoneNumber: adminData.phoneNumber || tenant.schoolPhone, // Use provided phoneNumber or fallback to tenant.schoolPhone
//     address: adminData.address, // Add address field if provided
//     tenantId: tenant._id,
//     createdBy: "academic-api",
//   });

//   // 4. Create admin user in user-api with same shared ID
//   try {
//     const adminUserData = {
//       _id: sharedAdminUserId.toString(),
//       username: adminData.username.toLowerCase(),
//       firstName: adminData.firstName,
//       lastName: adminData.lastName,
//       email: adminData.email,
//       password: adminData.password,
//       phoneNumber: adminData.phoneNumber || tenant.schoolPhone, // Use provided phoneNumber or fallback to tenant.schoolPhone
//       tenantId: tenant._id.toString(),
//       tenantName: tenant.tenantName,
//       userType: "admin", // Use "admin" as accepted by user-api
//       roleName: "PRIMARYADMIN", // Primary admin created with tenant
//       userAccessType: "private",
//       isEmailVerified: false,
//       isActive: true,
//       createdBy: "academic-api",
//     };

//     try {
//       await UserApiIntegrationService.createUser(adminUserData);
//       console.log("✅ PRIMARYADMIN user created successfully in user-api");
//     } catch (error: any) {
//       if (
//         error.message?.includes("USERNAME_EXISTS") ||
//         error.message?.includes("EMAIL_EXISTS") ||
//         error.message?.includes("Duplicate key error")
//       ) {
//         throw new Error(
//           `User with email ${adminUserData.email} already exists in this tenant`
//         );
//       }
//       throw new Error(`Failed to create user in user-api: ${error.message}`);
//     }
//   } catch (error: any) {
//     console.error("Failed to create tenant admin in user-api:", error);
//     // We might want to handle this better, but for now we log it
//   }

//   // 5. Create default grading system for the tenant
//   try {
//     const defaultGradingSystemData = {
//       systemName: "Default Grading System",
//       description: "Default grading system created automatically for this tenant",
//       gradeRanges: [
//         { grade: "A", minPercentage: 90, maxPercentage: 100 },
//         { grade: "B", minPercentage: 80, maxPercentage: 89 },
//         { grade: "C", minPercentage: 70, maxPercentage: 79 },
//         { grade: "D", minPercentage: 60, maxPercentage: 69 },
//         { grade: "E", minPercentage: 50, maxPercentage: 59 },
//         { grade: "F", minPercentage: 0, maxPercentage: 49 },
//       ],
//       isActive: true,
//       isDefault: true,
//     };

//     await gradingSystemService.createGradingSystem(
//       defaultGradingSystemData,
//       tenant._id.toString(),
//       tenant.tenantName || tenantData.tenantName || "Unknown Tenant"
//     );
//     console.log(`✅ Default grading system created successfully for tenant: ${tenant._id}`);
//   } catch (error: any) {
//     // Log error but don't fail the tenant creation
//     console.error(
//       `⚠️ Failed to create default grading system for tenant ${tenant._id}:`,
//       error.message
//     );
//   }

//   // 6. Send welcome email to PRIMARYADMIN
//   // Send email asynchronously (don't block the response if email fails)
//   sendWelcomeEmail(
//     adminData.email,
//     adminData.firstName,
//     adminData.lastName,
//     "PRIMARYADMIN",
//     tenant._id.toString(),
//     tenant.tenantName,
//     sharedAdminUserId.toString(),
//     adminData.password // Pass the password that was set during creation
//   )
//     .then(() => {
//       console.log(`✅ Welcome email sent successfully to PRIMARYADMIN: ${adminData.email}`);
//     })
//     .catch((emailError: any) => {
//       // Log error but don't fail the tenant creation
//       console.error(
//         `⚠️ Failed to send welcome email to PRIMARYADMIN ${adminData.email}:`,
//         emailError.message
//       );
//     });

//   // ===== SEND NOTIFICATIONS FOR TENANT CREATION =====
//   // Send notifications to newly created PRIMARYADMIN and superadmin who created the tenant
//   try {
//     const tenantIdString = tenant._id?.toString ? tenant._id.toString() : String(tenant._id);
//     const adminIdString = sharedAdminUserId.toString();
//     const adminName = `${adminData.firstName} ${adminData.lastName}`;
//     const tenantName = tenant.tenantName || "Tenant";

//     // Validate IDs are valid ObjectIds
//     if (!mongoose.Types.ObjectId.isValid(tenantIdString) || !mongoose.Types.ObjectId.isValid(adminIdString)) {
//       console.warn("⚠️ Invalid tenantId or adminId, skipping tenant creation notifications");
//     } else {
//       const notifications: notificationService.INotificationRequest[] = [];

//       // 1. Send welcome notification to the newly created PRIMARYADMIN
//       notifications.push({
//         receiverId: adminIdString,
//         receiverRole: "PRIMARYADMIN",
//         title: "Welcome to the Platform!",
//         content: `Welcome ${adminName}! Your tenant "${tenantName}" has been successfully created. You can now log in and start managing your school.`,
//         senderId: createdById && mongoose.Types.ObjectId.isValid(createdById) ? createdById : undefined,
//         senderRole: createdById ? (createdByRole || "SUPERADMIN") : "SYSTEM",
//         tenantId: tenantIdString,
//         meta: {
//           entityId: tenantIdString,
//           entityType: "Tenant",
//           tenantId: tenantIdString,
//           tenantName: tenantName,
//           adminId: adminIdString,
//           adminName: adminName,
//           adminEmail: adminData.email,
//         },
//       });

//       // 2. Send notification to superadmin who created the tenant (if createdById is provided)
//       if (createdById && mongoose.Types.ObjectId.isValid(createdById)) {
//         notifications.push({
//           receiverId: createdById,
//           receiverRole: createdByRole || "SUPERADMIN",
//           title: "Tenant Created Successfully",
//           content: `You have successfully created a new tenant "${tenantName}" with PRIMARYADMIN ${adminName} (${adminData.email}).`,
//           senderId: adminIdString,
//           senderRole: "PRIMARYADMIN",
//           tenantId: tenantIdString,
//           meta: {
//             entityId: tenantIdString,
//             entityType: "Tenant",
//             tenantId: tenantIdString,
//             tenantName: tenantName,
//             adminId: adminIdString,
//             adminName: adminName,
//             adminEmail: adminData.email,
//           },
//         });
//       }

//       // Send all notifications
//       if (notifications.length > 0) {
//         console.log(`📤 Sending ${notifications.length} notification(s) for tenant creation...`);
//         notificationService
//           .sendNotifications(notifications)
//           .then((result) => {
//             console.log(
//               `✅ Successfully sent notification(s) for tenant creation:`,
//               result
//             );
//           })
//           .catch((notificationError: any) => {
//             console.error(
//               "⚠️ Failed to send tenant creation notifications:",
//               notificationError.message
//             );
//           });
//       }
//     }
//   } catch (notificationError: any) {
//     // Log error but don't fail the tenant creation
//     console.error(
//       "⚠️ Error preparing tenant creation notifications:",
//       notificationError.message
//     );
//   }

//   // Convert tenant to plain object if it's a Mongoose document
//   const tenantObj = (tenant as any).toObject
//     ? (tenant as any).toObject()
//     : { ...tenant };

//   // Convert admin to plain object and remove sensitive fields
//   const adminObj = admin
//     ? (admin as any).toObject
//       ? (admin as any).toObject()
//       : { ...admin }
//     : null;
//   if (adminObj) {
//     // Remove password from admin response
//     delete adminObj.password;
//   }

//   // Append admin details to tenant response
//   return {
//     ...tenantObj,
//     admin: adminObj,
//   };
// };




export const createTenant = async (
  data: { tenant: Partial<ITenant>; admin: any },
  token?: string,
  createdById?: string,
  createdByRole?: string
) => {
  let { tenant: tenantData, admin: adminData } = data;

  // Support flat structure if tenant object is missing
  if (!tenantData) {
    tenantData = data as Partial<ITenant>;
    adminData = data;
  }

  // Ensure partnerId is captured if it's at the root level
  if ((data as any).partnerId && !tenantData.partnerId) {
    tenantData.partnerId = (data as any).partnerId;
  }

  // Ensure gradeRanges is captured if it's at the root level
  if ((data as any).gradeRanges && !tenantData.gradeRanges) {
    tenantData.gradeRanges = (data as any).gradeRanges;
  }

  // Ensure maxSchoolLevel is captured if it's at the root level
  if ((data as any).maxSchoolLevel !== undefined && tenantData.maxSchoolLevel === undefined) {
    tenantData.maxSchoolLevel = (data as any).maxSchoolLevel;
  }

  // Check if tenant name or school name already exists
  if (tenantData.tenantName) {
    const existingTenant = await tenantRepository.findTenantByTenantName(
      tenantData.tenantName
    );
    if (existingTenant) {
      throw new Error(`Tenant name "${tenantData.tenantName}" already exists`);
    }
  }

  if (tenantData.schoolName) {
    const existingSchool = await tenantRepository.findTenantBySchoolName(
      tenantData.schoolName
    );
    if (existingSchool) {
      throw new Error(`School name "${tenantData.schoolName}" already exists`);
    }
  }

  // Check if admin email already exists in Tenant, Admin, or User collection
  if (tenantData.adminEmail) {
    // 1. Check Tenant Collection
    const existingTenantByEmail = await tenantRepository.findTenantByAdminEmail(
      tenantData.adminEmail
    );
    if (existingTenantByEmail) {
      throw new Error(
        `Tenant with admin email "${tenantData.adminEmail}" already exists`
      );
    }

    // 2. Check Admin Collection
    const existingAdmin = await adminService.getAdminByEmail(adminData.email);
    if (existingAdmin) {
      throw new Error(`Admin with email "${adminData.email}" already exists`);
    }

    // 3. Check User Collection
    const userExists = await UserApiIntegrationService.checkUserExists(
      adminData.email,
    );
    if (userExists.exists) {
      throw new Error(`User with email "${adminData.email}" already exists`);
    }
  }

  // Initialize trial tracking fields on creation
  const tenantTimeZone = tenantData.timeZone || "UTC";
  if (tenantData.isTrial) {
    const totalDays = tenantData.trialDaysTotal ?? tenantData.trialDaysRemaining ?? 0;
    tenantData.trialDaysTotal = totalDays;
    tenantData.trialDaysRemaining = totalDays;
    tenantData.lastTrialDecrementDate = formatLocalDate(new Date(), tenantTimeZone);
  }

  // SAGA TRANSACTION STARTS
  let tenant: any = null;
  let admin: any = null;
  let sharedAdminUserId: any = null;
  let userCreated = false;

  try {
    // 1. Create in academic-api
    tenant = await tenantRepository.createTenant(tenantData);

    // 2. Generate shared ID for admin and user (same entity)
    sharedAdminUserId = new mongoose.Types.ObjectId();

    // 3. Create Admin in academic-api with shared ID
    admin = await adminService.createAdminRecord({
      _id: sharedAdminUserId,
      username: adminData.username,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      password: adminData.password, // Stored for reference
      phoneNumber: adminData.phoneNumber || tenant.schoolPhone,
      address: adminData.address,
      tenantId: tenant._id,
      createdBy: "academic-api",
    });

    // 4. Create admin user in user-api with same shared ID
    const adminUserData = {
      _id: sharedAdminUserId.toString(),
      username: adminData.username.toLowerCase(),
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      password: adminData.password,
      phoneNumber: adminData.phoneNumber || tenant.schoolPhone,
      tenantId: tenant._id.toString(),
      tenantName: tenant.tenantName,
      userType: "admin",
      roleName: "PRIMARYADMIN",
      userAccessType: "private",
      isEmailVerified: false,
      isActive: true,
      createdBy: "academic-api",
    };

    await UserApiIntegrationService.createUser(adminUserData);
    userCreated = true;

    console.log("✅ PRIMARYADMIN user created successfully in user-api");

  } catch (error: any) {
    console.error("❌ SAGA FAILURE:", error.message);

    // ===========================
    // COMPENSATING TRANSACTIONS
    // ===========================

    // If user created in user-api => delete user
    if (userCreated && sharedAdminUserId) {
      try {
        await UserApiIntegrationService.deleteUser(sharedAdminUserId.toString());
        console.log("🔁 Rolled back user record");
      } catch (e) {
        console.error("⚠️ Failed to rollback user record", e);
      }
    }

    // If admin created => delete admin
    if (admin) {
      try {
        await adminService.deleteAdmin(admin._id);
        console.log("🔁 Rolled back admin record");
      } catch (e) {
        console.error("⚠️ Failed to rollback admin record", e);
      }
    }

    // If tenant created => delete tenant
    if (tenant) {
      try {
        await tenantRepository.deleteTenant(tenant._id);
        console.log("🔁 Rolled back tenant record");
      } catch (e) {
        console.error("⚠️ Failed to rollback tenant record", e);
      }
    }

    // Finally throw error to controller
    throw new Error(`Tenant creation failed: ${error.message}`);
  }

  // ===========================
  // POST SUCCESS TASKS (Non-Blocking)
  // ===========================

  // 5. Create default grading system for the tenant
  try {
    const defaultGradingSystemData = {
      systemName: "Default Grading System",
      description: "Default grading system created automatically for this tenant",
      gradeRanges: [
        { grade: "A", minPercentage: 90, maxPercentage: 100, color: "#10B981" },
        { grade: "B", minPercentage: 80, maxPercentage: 89, color: "#14B8A6" },
        { grade: "C", minPercentage: 70, maxPercentage: 79, color: "#F59E0B" },
        { grade: "D", minPercentage: 60, maxPercentage: 69, color: "#F97316" },
        { grade: "E", minPercentage: 50, maxPercentage: 59, color: "#EF4444" },
        { grade: "F", minPercentage: 0, maxPercentage: 49, color: "#EF4444" },
      ],
      isActive: true,
      isDefault: true,
    };

    await gradingSystemService.createGradingSystem(
      defaultGradingSystemData,
      tenant._id.toString(),
      tenant.tenantName || tenantData.tenantName || "Unknown Tenant"
    );
    console.log(`✅ Default grading system created successfully for tenant: ${tenant._id}`);
  } catch (error: any) {
    console.error(
      `⚠️ Failed to create default grading system for tenant ${tenant._id}:`,
      error.message
    );
  }

  // 6. Send welcome email to PRIMARYADMIN
  sendWelcomeEmail(
    adminData.email,
    adminData.firstName,
    adminData.lastName,
    "PRIMARYADMIN",
    tenant._id.toString(),
    tenant.tenantName,
    sharedAdminUserId.toString(),
    adminData.password // Pass the password that was set during creation
  )
    .then(() => {
      console.log(`✅ Welcome email sent successfully to PRIMARYADMIN: ${adminData.email}`);
    })
    .catch((emailError: any) => {
      console.error(
        `⚠️ Failed to send welcome email to PRIMARYADMIN ${adminData.email}:`,
        emailError.message
      );
    });

  // ===== SEND NOTIFICATIONS FOR TENANT CREATION =====
  try {
    const tenantIdString = tenant._id?.toString ? tenant._id.toString() : String(tenant._id);
    const adminIdString = sharedAdminUserId.toString();
    const adminName = `${adminData.firstName} ${adminData.lastName}`;
    const tenantName = tenant.tenantName || "Tenant";

    if (!mongoose.Types.ObjectId.isValid(tenantIdString) || !mongoose.Types.ObjectId.isValid(adminIdString)) {
      console.warn("⚠️ Invalid tenantId or adminId, skipping tenant creation notifications");
    } else {
      const notifications: notificationService.INotificationRequest[] = [];

      // 1. Send welcome notification to the newly created PRIMARYADMIN
      notifications.push({
        receiverId: adminIdString,
        receiverRole: "PRIMARYADMIN",
        title: "Welcome to the Platform!",
        content: `Welcome ${adminName}! Your tenant "${tenantName}" has been successfully created. You can now log in and start managing your school.`,
        senderId: createdById && mongoose.Types.ObjectId.isValid(createdById) ? createdById : undefined,
        senderRole: createdById ? (createdByRole || "SUPERADMIN") : "SYSTEM",
        tenantId: tenantIdString,
        meta: {
          entityId: tenantIdString,
          entityType: "Tenant",
          tenantId: tenantIdString,
          tenantName: tenantName,
          adminId: adminIdString,
          adminName: adminName,
          adminEmail: adminData.email,
        },
      });

      // 2. Send notification to superadmin who created the tenant (if createdById is provided)
      if (createdById && mongoose.Types.ObjectId.isValid(createdById)) {
        notifications.push({
          receiverId: createdById,
          receiverRole: createdByRole || "SUPERADMIN",
          title: "Tenant Created Successfully",
          content: `You have successfully created a new tenant "${tenantName}" with PRIMARYADMIN ${adminName} (${adminData.email}).`,
          senderId: adminIdString,
          senderRole: "PRIMARYADMIN",
          tenantId: tenantIdString,
          meta: {
            entityId: tenantIdString,
            entityType: "Tenant",
            tenantId: tenantIdString,
            tenantName: tenantName,
            adminId: adminIdString,
            adminName: adminName,
            adminEmail: adminData.email,
          },
        });
      }

      // Send all notifications
      if (notifications.length > 0) {
        notificationService
          .sendNotifications(notifications)
          .then((result) => {
            console.log(
              `✅ Successfully sent notification(s) for tenant creation:`,
              result
            );
          })
          .catch((notificationError: any) => {
            console.error(
              "⚠️ Failed to send tenant creation notifications:",
              notificationError.message
            );
          });
      }
    }
  } catch (notificationError: any) {
    console.error(
      "⚠️ Error preparing tenant creation notifications:",
      notificationError.message
    );
  }

  // Convert tenant to plain object if it's a Mongoose document
  const tenantObj = (tenant as any).toObject
    ? (tenant as any).toObject()
    : { ...tenant };

  // Convert admin to plain object and remove sensitive fields
  const adminObj = admin
    ? (admin as any).toObject
      ? (admin as any).toObject()
      : { ...admin }
    : null;
  if (adminObj) {
    delete adminObj.password;
  }

  return {
    ...tenantObj,
    admin: adminObj,
  };
};



export const getTenants = async (options: {
  pageNo?: number;
  pageSize?: number;
  filters?: any;
  sort?: Record<string, SortOrder>;
}) => {
  const result = await tenantRepository.findTenants(options);

  // Enrich each tenant with its PRIMARYADMIN (stored in Admin collection)
  const tenantIds = (result.tenants || [])
    .map((t: any) => (t?._id?.toString?.() ? t._id.toString() : t?.id))
    .filter(Boolean) as string[];

  if (tenantIds.length === 0) return result;

  const admins = await adminService.getAdminsByTenantIds(tenantIds);
  const adminByTenantId = new Map<string, any>();

  for (const admin of admins) {
    const tId =
      (admin as any).tenantId?.toString?.() || (admin as any).tenantId;
    if (!tId) continue;
    // Convert to plain object and ensure password isn't exposed
    const adminObj = (admin as any).toObject ? (admin as any).toObject() : { ...admin };
    delete adminObj.password;
    adminByTenantId.set(String(tId), adminObj);
  }

  result.tenants = (result.tenants || []).map((t: any) => {
    const tenantId =
      t?._id?.toString?.() ? t._id.toString() : t?.id;
    return {
      ...t,
      admin: adminByTenantId.get(String(tenantId)) || null,
    };
  });

  return result;
};

export const getTenantById = async (id: string) => {
  const tenant = await tenantRepository.findTenantById(id);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Fetch admin details for this tenant
  let admin = null;
  try {
    admin = await adminService.getAdminByTenantId(id);
  } catch (error: any) {
    // Admin might not exist, continue without admin details
    console.log("Admin not found for tenant:", id);
  }

  // Convert tenant to plain object if it's a Mongoose document
  const tenantObj = (tenant as any).toObject
    ? (tenant as any).toObject()
    : { ...tenant };

  // Convert admin to plain object and remove sensitive fields
  const adminObj = admin
    ? (admin as any).toObject
      ? (admin as any).toObject()
      : { ...admin }
    : null;
  if (adminObj) {
    // Remove password from admin response
    delete adminObj.password;
  }

  // Append admin details to tenant response
  return {
    ...tenantObj,
    admin: adminObj,
  };
};

export const getTenantByTenantName = async (tenantName: string) => {
  const tenant = await tenantRepository.findTenantByTenantName(tenantName);
  if (!tenant) {
    throw new Error("Tenant not found");
  }
  return tenant;
};

export const updateTenant = async (
  id: string,
  data: any,
  token?: string,
  updatedById?: string,
  updatedByRole?: string
) => {
  // Get old tenant data before updating to track changes
  const oldTenant = await tenantRepository.findTenantById(id);
  if (!oldTenant) {
    throw new Error("Tenant not found");
  }

  // Get old admin data before updating
  let oldAdmin = null;
  try {
    oldAdmin = await adminService.getAdminByTenantId(id);
  } catch (error: any) {
    console.log("Admin not found for tenant (before update):", id);
  }

  // Support hybrid payload: tenant fields at root, admin fields nested (or vice versa)
  let tenantUpdateData = data.tenant ? { ...data.tenant } : null;
  let adminUpdateData = data.admin ? { ...data.admin } : null;

  // If tenant fields are not nested, they must be at the root
  if (!tenantUpdateData) {
    tenantUpdateData = { ...data };
    delete tenantUpdateData.admin; // Remove nested admin if present
    delete tenantUpdateData.tenant; // Remove nested tenant if present
  }

  // If admin fields are not nested, check if they are at the root (fallback)
  if (!adminUpdateData) {
    // Check for typical admin fields or prefixed admin fields at root
    if (
      data.firstName ||
      data.lastName ||
      data.username ||
      data.email ||
      data.adminFirstName ||
      data.adminLastName ||
      data.adminEmail ||
      data.demoPassword
    ) {
      adminUpdateData = { ...data };
      delete adminUpdateData.tenant;
      delete adminUpdateData.admin;
    } else {
      adminUpdateData = {};
    }
  }

  // Map prefixed admin fields to their proper names in adminUpdateData
  if (adminUpdateData) {
    if (adminUpdateData.adminFirstName && !adminUpdateData.firstName)
      adminUpdateData.firstName = adminUpdateData.adminFirstName;
    if (adminUpdateData.adminLastName && !adminUpdateData.lastName)
      adminUpdateData.lastName = adminUpdateData.adminLastName;
    if (adminUpdateData.adminEmail && !adminUpdateData.email)
      adminUpdateData.email = adminUpdateData.adminEmail;
    if (adminUpdateData.demoPassword && !adminUpdateData.password)
      adminUpdateData.password = adminUpdateData.demoPassword;
    if (adminUpdateData.adminPhoneNumber && !adminUpdateData.phoneNumber)
      adminUpdateData.phoneNumber = adminUpdateData.adminPhoneNumber;
    if (adminUpdateData.adminAddress && !adminUpdateData.address)
      adminUpdateData.address = adminUpdateData.adminAddress;
    if (adminUpdateData.adminUsername && !adminUpdateData.username)
      adminUpdateData.username = adminUpdateData.adminUsername;
  }

  // Cleanup fields from tenantUpdateData that might be admin-only or internal
  const fieldsToRemoveFromTenant = [
    "adminFirstName",
    "adminLastName",
    "adminUsername",
    "adminPhoneNumber",
    "adminAddress",
    "demoPassword",
    "primaryAdminEmail",
    "admin",
  ];
  if (tenantUpdateData) {
    fieldsToRemoveFromTenant.forEach((f) => delete tenantUpdateData[f]);
  }

  // Cleanup fields that should not be updated manually or might cause Mongoose errors
  const fieldsToStrip = [
    "_id",
    "id",
    "createdAt",
    "updatedAt",
    "__v",
    "createdBy",
  ];
  fieldsToStrip.forEach((field) => {
    if (tenantUpdateData) delete tenantUpdateData[field];
    if (adminUpdateData) delete adminUpdateData[field];
  });

  // Filter out empty/null fields to avoid overwriting with undefined if they were missing from payload
  // but we only want to do this for fields that weren't explicitly intended to be null
  // For now, let's keep it simple and just ensure we don't have empty objects
  if (tenantUpdateData && Object.keys(tenantUpdateData).length === 0)
    tenantUpdateData = null;
  if (adminUpdateData && Object.keys(adminUpdateData).length === 0)
    adminUpdateData = null;

  // Cross-map adminEmail (Tenant) and email (Admin) for consistency if one is present and other isn't
  if (
    tenantUpdateData &&
    tenantUpdateData.adminEmail &&
    adminUpdateData &&
    !adminUpdateData.email
  ) {
    adminUpdateData.email = tenantUpdateData.adminEmail;
  }
  if (
    adminUpdateData &&
    adminUpdateData.email &&
    tenantUpdateData &&
    !tenantUpdateData.adminEmail
  ) {
    tenantUpdateData.adminEmail = adminUpdateData.email;
  }

  // Cross-map schoolPhone (Tenant) and phoneNumber (Admin)
  if (
    tenantUpdateData &&
    tenantUpdateData.schoolPhone &&
    adminUpdateData &&
    !adminUpdateData.phoneNumber
  ) {
    adminUpdateData.phoneNumber = tenantUpdateData.schoolPhone;
  }
  if (
    adminUpdateData &&
    adminUpdateData.phoneNumber &&
    tenantUpdateData &&
    !tenantUpdateData.schoolPhone
  ) {
    tenantUpdateData.schoolPhone = adminUpdateData.phoneNumber;
  }

  let tenant = null;

  // 1. Update Tenant in academic-api
  if (tenantUpdateData && Object.keys(tenantUpdateData).length > 0) {
    // Check for unique constraints manually for better error messages
    if (tenantUpdateData.schoolName) {
      const existing = await tenantRepository.findTenantBySchoolName(
        tenantUpdateData.schoolName
      );
      if (existing && existing._id.toString() !== id) {
        throw new Error(
          `School name "${tenantUpdateData.schoolName}" already exists`
        );
      }
    }

    if (tenantUpdateData.tenantName) {
      const existing = await tenantRepository.findTenantByTenantName(
        tenantUpdateData.tenantName
      );
      if (existing && existing._id.toString() !== id) {
        throw new Error(
          `Tenant name "${tenantUpdateData.tenantName}" already exists`
        );
      }
    }

    if (tenantUpdateData.gradeRanges) {
      tenantUpdateData.gradeRanges = tenantUpdateData.gradeRanges;
    }

    // Keep trial tracking consistent on updates
    if (tenantUpdateData.isTrial) {
      const tz = tenantUpdateData.timeZone || "UTC";
      const existingTenant = await tenantRepository.findTenantById(id);

      if (!existingTenant) {
        throw new Error("Tenant not found");
      }

      // Initialize missing trial fields from existing data or defaults
      if (!tenantUpdateData.trialDaysTotal && !existingTenant.trialDaysTotal) {
        // Calculate from trialEndDate if available, otherwise use 30 days default
        if (tenantUpdateData.trialEndDate || existingTenant.trialEndDate) {
          const endDate = new Date(tenantUpdateData.trialEndDate || existingTenant.trialEndDate!);
          const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          tenantUpdateData.trialDaysTotal = Math.max(1, daysLeft);
        } else {
          tenantUpdateData.trialDaysTotal = 30;
        }
      }

      if (
        (tenantUpdateData.trialDaysTotal !== undefined || existingTenant.trialDaysTotal) &&
        tenantUpdateData.trialDaysRemaining === undefined &&
        !existingTenant.trialDaysRemaining
      ) {
        tenantUpdateData.trialDaysRemaining = tenantUpdateData.trialDaysTotal || existingTenant.trialDaysTotal || 30;
      }

      if (!tenantUpdateData.lastTrialDecrementDate && !existingTenant.lastTrialDecrementDate) {
        tenantUpdateData.lastTrialDecrementDate = formatLocalDate(new Date(), tz);
      }
    }

    console.log("*****tenantUpdateData: ", tenantUpdateData)

    tenant = await tenantRepository.updateTenant(id, tenantUpdateData);
    if (!tenant) {
      throw new Error("Tenant not found or failed to update");
    }
  } else {
    tenant = await tenantRepository.findTenantById(id);
  }

  if (!tenant) throw new Error("Tenant not found");

  // 2. Update Admin in academic-api
  let updatedAdmin = null;
  if (adminUpdateData && Object.keys(adminUpdateData).length > 0) {
    try {
      updatedAdmin = await adminService.updateAdmin(id, adminUpdateData);
    } catch (error: any) {
      console.warn(`Admin update failed for tenant ${id}:`, error.message);
      // If admin doesn't exist, we skip updating it instead of failing the whole tenant update
    }
  }

  // 3. Update admin user in user-api
  try {
    const userUpdateData: any = {};

    // Map tenant-related fields for user-api
    if (tenantUpdateData && tenantUpdateData.tenantName) {
      userUpdateData.tenantName = tenantUpdateData.tenantName;
    }

    // Map admin-related fields for user-api
    if (adminUpdateData) {
      if (adminUpdateData.firstName)
        userUpdateData.firstName = adminUpdateData.firstName;
      if (adminUpdateData.lastName)
        userUpdateData.lastName = adminUpdateData.lastName;
      if (adminUpdateData.email) {
        userUpdateData.email = adminUpdateData.email;
        userUpdateData.username = adminUpdateData.email.toLowerCase();
      }
      if (adminUpdateData.username)
        userUpdateData.username = adminUpdateData.username.toLowerCase();
      if (adminUpdateData.password)
        userUpdateData.password = adminUpdateData.password;
      if (adminUpdateData.phoneNumber)
        userUpdateData.phoneNumber = adminUpdateData.phoneNumber;
    }

    if (Object.keys(userUpdateData).length > 0) {
      // Find admin again to get the proper shared ID (_id) for user-api
      const adminForUserApi = await adminService.getAdminByTenantId(id);
      if (adminForUserApi && adminForUserApi._id) {
        await UserApiIntegrationService.updateTenantInUserApi(
          adminForUserApi._id.toString(),
          userUpdateData,
          token
        );
      } else {
        console.warn(
          `Admin NOT found for tenant ${id}, skipping user-api update`
        );
      }
    }
  } catch (error: any) {
    console.error("Failed to update tenant admin in user-api:", error);
  }

  // Fetch admin details if not already updated
  let admin = updatedAdmin;
  if (!admin) {
    try {
      admin = await adminService.getAdminByTenantId(id);
    } catch (error: any) {
      // Admin might not exist, continue without admin details
      console.log("Admin not found for tenant:", id);
    }
  }

  // Convert tenant to plain object if it's a Mongoose document
  const tenantObj = (tenant as any).toObject
    ? (tenant as any).toObject()
    : { ...tenant };

  // Convert admin to plain object and remove sensitive fields
  const adminObj = admin
    ? (admin as any).toObject
      ? (admin as any).toObject()
      : { ...admin }
    : null;
  if (adminObj) {
    // Remove password from admin response
    delete adminObj.password;
  }

  // ===== SEND NOTIFICATIONS FOR TENANT UPDATE =====
  // Send notifications to superadmin and PRIMARYADMIN with details of what changed
  try {
    const tenantIdString = tenant._id?.toString ? tenant._id.toString() : String(tenant._id);
    const tenantName = tenant.tenantName || "Tenant";

    // Validate tenantId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(tenantIdString)) {
      console.warn("⚠️ Invalid tenantId, skipping tenant update notifications");
    } else {
      // Build list of changes
      const changes: string[] = [];

      // Track tenant field changes
      if (tenantUpdateData && Object.keys(tenantUpdateData).length > 0) {
        const tenantFields: Record<string, string> = {
          tenantName: "Tenant Name",
          schoolName: "School Name",
          schoolPhone: "School Phone",
          schoolEmail: "School Email",
          address: "Address",
          city: "City",
          state: "State",
          country: "Country",
          zipCode: "Zip Code",
          maxSchoolLevel: "Max School Level",
          gradeRanges: "Grade Ranges",
          adminEmail: "Admin Email",
        };

        for (const [key, displayName] of Object.entries(tenantFields)) {
          if (tenantUpdateData[key] !== undefined) {
            const oldValue = (oldTenant as any)[key];
            const newValue = tenantUpdateData[key];
            if (oldValue !== newValue) {
              if (key === "gradeRanges" && Array.isArray(newValue)) {
                changes.push(`${displayName}: Updated to ${newValue.length} grade range(s)`);
              } else {
                changes.push(`${displayName}: "${oldValue || "N/A"}" → "${newValue || "N/A"}"`);
              }
            }
          }
        }
      }

      // Track admin field changes
      if (adminUpdateData && Object.keys(adminUpdateData).length > 0) {
        const adminFields: Record<string, string> = {
          firstName: "Admin First Name",
          lastName: "Admin Last Name",
          email: "Admin Email",
          username: "Admin Username",
          phoneNumber: "Admin Phone Number",
          address: "Admin Address",
        };

        for (const [key, displayName] of Object.entries(adminFields)) {
          if (adminUpdateData[key] !== undefined) {
            const oldValue = oldAdmin ? (oldAdmin as any)[key] : null;
            const newValue = adminUpdateData[key];
            if (oldValue !== newValue) {
              changes.push(`${displayName}: "${oldValue || "N/A"}" → "${newValue || "N/A"}"`);
            }
          }
        }
      }

      // Only send notifications if there are actual changes
      if (changes.length > 0) {
        const changesText = changes.join(", ");
        const changesCount = changes.length;

        // Get PRIMARYADMIN ID for this tenant
        let primaryAdminId: string | null = null;
        if (admin && admin._id) {
          primaryAdminId = admin._id.toString();
        } else if (oldAdmin && oldAdmin._id) {
          primaryAdminId = oldAdmin._id.toString();
        }

        const notifications: notificationService.INotificationRequest[] = [];

        // 1. Send notification to PRIMARYADMIN of the tenant
        if (primaryAdminId && mongoose.Types.ObjectId.isValid(primaryAdminId)) {
          notifications.push({
            receiverId: primaryAdminId,
            receiverRole: "PRIMARYADMIN",
            title: "Tenant Information Updated",
            content: `Your tenant "${tenantName}" has been updated. ${changesCount} change(s) made: ${changesText}.`,
            senderId: updatedById && mongoose.Types.ObjectId.isValid(updatedById) ? updatedById : undefined,
            senderRole: updatedById ? (updatedByRole || "SUPERADMIN") : "SYSTEM",
            tenantId: tenantIdString,
            meta: {
              entityId: tenantIdString,
              entityType: "Tenant",
              tenantId: tenantIdString,
              tenantName: tenantName,
              changesCount: changesCount,
              changes: changes,
            },
          });
        }

        // 2. Send notification to superadmin who updated the tenant (if updatedById is provided)
        if (updatedById && mongoose.Types.ObjectId.isValid(updatedById)) {
          notifications.push({
            receiverId: updatedById,
            receiverRole: updatedByRole || "SUPERADMIN",
            title: "Tenant Updated Successfully",
            content: `You have successfully updated tenant "${tenantName}". ${changesCount} change(s) made: ${changesText}.`,
            senderId: primaryAdminId && mongoose.Types.ObjectId.isValid(primaryAdminId) ? primaryAdminId : undefined,
            senderRole: "PRIMARYADMIN",
            tenantId: tenantIdString,
            meta: {
              entityId: tenantIdString,
              entityType: "Tenant",
              tenantId: tenantIdString,
              tenantName: tenantName,
              changesCount: changesCount,
              changes: changes,
            },
          });
        }

        // Send all notifications
        if (notifications.length > 0) {
          console.log(`📤 Sending ${notifications.length} notification(s) for tenant update...`);
          notificationService
            .sendNotifications(notifications)
            .then((result) => {
              console.log(
                `✅ Successfully sent notification(s) for tenant update:`,
                result
              );
            })
            .catch((notificationError: any) => {
              console.error(
                "⚠️ Failed to send tenant update notifications:",
                notificationError.message
              );
            });
        }
      } else {
        console.log("ℹ️ No changes detected, skipping tenant update notifications");
      }
    }
  } catch (notificationError: any) {
    // Log error but don't fail the tenant update
    console.error(
      "⚠️ Error preparing tenant update notifications:",
      notificationError.message
    );
  }

  // Append admin details to tenant response
  return {
    ...tenantObj,
    admin: adminObj,
  };
};

export const deleteTenant = async (id: string) => {
  // 1. Delete Tenant
  const tenant = await tenantRepository.deleteTenant(id);
  if (!tenant) {
    throw new Error("Tenant not found or failed to delete");
  }

  // 2. Delete Admin
  await adminService.deleteAdmin(id);

  return tenant;
};

export const getTenantsDDL = async () => {
  return await tenantRepository.getTenantsDDL();
};

export const getTenantStats = async () => {
  return await tenantRepository.getTenantStats();
};

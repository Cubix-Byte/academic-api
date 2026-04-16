import {
  JWTHelper,
  createAuthMiddleware,
  sendErrorResponse,
} from "../utils/shared-lib-imports";

// Initialize JWT Helper with environment configuration
// Note: Using same JWT secret as user-api to validate tokens issued by user-api

export const jwtHelper = new JWTHelper({
  jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || "your-super-secret-refresh-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "2h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  issuer: "user-api",
  audience: "user-api-users",
});

// Create authentication middleware with academy-api specific logic
export const authenticateJWT = createAuthMiddleware({
  jwtHelper,

  // For academy-api, we don't store users locally
  // User authentication is handled by user-api
  // We just verify the JWT token and extract data from it
  getUserById: async (userId: string) => {
    // Try to fetch user data from user-api to get tenantName
    try {
      const userApiUrl = process.env.USER_API_URL || "http://localhost:3002";
      const internalApiKey =
        process.env.INTERNAL_API_KEY || "your-internal-api-key-here";

      const response = await fetch(
        `${userApiUrl}/user/internal/validate-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": internalApiKey,
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (response.ok) {
        const userData = await response.json();
        console.log(
          "🔍 DEBUG - Fetched user data from user-api:",
          JSON.stringify(userData, null, 2)
        );
        return userData.data || userData;
      }
    } catch (error) {
      console.log("⚠️ Failed to fetch user data from user-api:", error);
    }

    // Fallback: Return a basic user object structure
    return {
      _id: userId,
      userId: userId,
      tenantId: null, // Will be set by extractUserData
      tenantName: null,
      role: null,
      roleName: null,
      permissions: [],
      isActive: true,
      isDeleted: false,
      isLocked: false,
    };
  },

  // Error response handler
  sendErrorResponse,

  // Check if user is active (always true for JWT-based auth)
  checkUserActive: (user: any) => {
    return true; // JWT tokens are already validated
  },

  // Check if user is locked (always false for JWT-based auth)
  checkUserLocked: (user: any) => {
    return false; // JWT tokens are already validated
  },

  // Extract permissions from JWT token
  extractPermissions: (user: any) => {
    return user.permissions || [];
  },

  // Extract additional user data from JWT token
  extractUserData: async (user: any, decoded: any) => {
    // Global function to get tenantId - prioritize user object from user-api (it has tenantId field)
    const getTenantId = (): string | undefined => {
      // Priority 1: Get tenantId from user object fetched from user-api (users table has tenantId field)
      if (user?.tenantId) {
        return typeof user.tenantId === 'string' 
          ? user.tenantId 
          : user.tenantId?.toString();
      }
      
      // Priority 2: Fallback to JWT token (decoded payload)
      if (decoded.tenantId) {
        return typeof decoded.tenantId === 'string' 
          ? decoded.tenantId 
          : decoded.tenantId?.toString();
      }
      
      return undefined;
    };

    // Global function to get tenantName
    const getTenantName = (tenantId: string | undefined): string | undefined => {
      // Priority 1: From user object (users table has tenantName field)
      if (user?.tenantName) {
        return user.tenantName;
      }
      
      // Priority 2: From JWT token
      if (decoded.tenantName) {
        return decoded.tenantName;
      }
      
      return undefined;
    };

    // Get tenantId using global function (prioritize user object from user-api)
    let tenantId = getTenantId();
    let tenantName = getTenantName(tenantId);

    // Priority 3: Final fallback - if still missing and user is ADMIN/PRIMARYADMIN, fetch from admin record in academic-api
    if (!tenantId && (decoded.roleName === "ADMIN" || decoded.roleName === "PRIMARYADMIN") && (decoded.userId || decoded.sub || user?._id)) {
      try {
        const userId = decoded.userId || decoded.sub || user?._id;
        const adminRepository = await import("../repositories/admin.repository");
        const admin = await adminRepository.findAdminById(userId);
        if (admin && admin.tenantId) {
          // Convert tenantId to string if it's an ObjectId
          const adminTenantId = admin.tenantId;
          tenantId = typeof adminTenantId === 'string' 
            ? adminTenantId 
            : adminTenantId?.toString();
          
          // Fetch tenant name from tenant record if still missing
          if (tenantId && !tenantName) {
            const tenantService = await import("../services/tenant.service");
            const tenant = await tenantService.getTenantById(tenantId);
            tenantName = tenant?.tenantName || tenantName;
          }
        }
      } catch (adminError) {
        console.error("Failed to fetch tenantId from admin record:", adminError);
      }
    }

    // Final fallback for tenantName
    if (!tenantName && tenantId) {
      tenantName = `Tenant-${tenantId}`;
    }

    const extractedData = {
      id: decoded.userId || decoded.sub || user?._id,
      userId: decoded.userId || decoded.sub || user?._id,
      tenantId: tenantId, // This is critical - must be present
      tenantName: tenantName,
      role: decoded.role,
      roleName: decoded.roleName,
      permissions: decoded.permissions || [],
      email: decoded.email || user?.email,
      username: decoded.username || user?.username,
      firstName: decoded.firstName || user?.firstName,
      lastName: decoded.lastName || user?.lastName,
    };

    console.log(
      "🔍 DEBUG - extracted user data (tenantId included):",
      JSON.stringify({ tenantId, tenantName, userId: extractedData.userId, roleName: extractedData.roleName }, null, 2)
    );

    // Ensure tenantId is always a string if present
    if (extractedData.tenantId && typeof extractedData.tenantId !== 'string') {
      extractedData.tenantId = String(extractedData.tenantId);
    }

    return extractedData;
  },
});

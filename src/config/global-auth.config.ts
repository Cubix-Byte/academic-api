import { Request, Response, NextFunction } from "express";
import {
  createRouteAccessMiddleware,
  sendErrorResponse,
  RouteAccessLevel,
} from "../utils/shared-lib-imports";
import { jwtHelper } from "./auth.config";
import { routeAccessConfig } from "./route-access.config";
import { authenticateJWT } from "./auth.config";
import mongoose from "mongoose";
import Tenant from "../models/tenant.schema";

/**
 * Check if tenant's trial period has expired
 */
const checkTrialExpiry = async (tenantId: string) => {
  try {
    const tenant = await Tenant.findById(tenantId)
      .select('isTrial trialEndDate')
      .lean();
    
    if (!tenant) return { expired: false };
    
    if (tenant.isTrial && tenant.trialEndDate) {
      const now = new Date();
      const endDate = new Date(tenant.trialEndDate);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return { 
        expired: now > endDate,
        daysLeft: daysLeft > 0 ? daysLeft : 0
      };
    }
    
    return { expired: false };
  } catch (error) {
    console.error('Error checking trial expiry:', error);
    return { expired: false };
  }
};

/**
 * Global Route Access Middleware Configuration
 *
 * This middleware automatically handles authentication and authorization
 * for all routes based on the routeAccessConfig.
 *
 * It validates:
 * 1. JWT token authentication
 * 2. tenantId presence and validity (must be a valid ObjectId)
 * 3. Role-based access control for ROLE_BASED and ADMIN routes
 *
 * No need to add authenticateJWT or authorizeRoles to individual routes!
 */
const baseMiddleware = createRouteAccessMiddleware({
  routeAccessMap: routeAccessConfig,
  jwtHelper,
  internalApiKey: process.env.INTERNAL_API_KEY || "your-internal-api-key-here",
  sendErrorResponse,

  // Fetch user from user-api (same as authenticateJWT)
  getUserById: async (userId: string) => {
    try {
      const userApiUrl = process.env.USER_API_URL || "http://localhost:3002";
      const internalApiKey =
        process.env.INTERNAL_API_KEY || "your-internal-api-key-here";

      console.log("🔍 [getUserById] Fetching user from user-api:", {
        userId,
        url: `${userApiUrl}/user/internal/validate-user`,
      });

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
        // Response structure: { data: { user: {...}, isValid: true } } or { data: {...} }
        const user = userData.data?.user || userData.data || userData;

        console.log("✅ [getUserById] User fetched from user-api:", {
          userId,
          hasRoleName: !!user?.roleName,
          roleName: user?.roleName,
          hasRole: !!user?.role,
          roleObject: user?.role,
          userKeys: user ? Object.keys(user) : [],
          fullResponse: JSON.stringify(userData, null, 2),
        });

        return user;
      } else {
        console.error("❌ [getUserById] Failed to fetch user:", {
          status: response.status,
          statusText: response.statusText,
          userId,
        });
      }
    } catch (error) {
      console.error(
        "❌ [getUserById] Error fetching user data from user-api:",
        error
      );
    }

    console.warn(
      "⚠️ [getUserById] Returning fallback user object for userId:",
      userId
    );
    return {
      _id: userId,
      userId: userId,
      tenantId: null,
      tenantName: null,
      role: null,
      roleName: null,
      permissions: [],
      isActive: true,
      isDeleted: false,
      isLocked: false,
    };
  },

  // Extract role from user object
  extractUserRole: (user: any) => {
    // Priority: roleName from user-api response > role.name (populated) > role (string/ObjectId)
    const roleName = user?.roleName || user?.role?.name || user?.role;
    console.log("🔍 [extractUserRole] Extracted role:", {
      roleName,
      hasRoleName: !!user?.roleName,
      hasRoleObject: !!user?.role,
      roleObjectName: user?.role?.name,
      userKeys: user ? Object.keys(user) : [],
    });
    return roleName;
  },

  // Extract additional user data (same logic as authenticateJWT)
  // Priority: user object from user-api (users table has tenantId) > JWT token > admin record
  extractUserData: async (user: any, decoded: any) => {
    // Global function to get tenantId - prioritize user object from user-api (users table has tenantId field)
    const getTenantId = (): string | undefined => {
      // Priority 1: Get tenantId from user object fetched from user-api (users table has tenantId field)
      if (user?.tenantId) {
        return typeof user.tenantId === "string"
          ? user.tenantId
          : user.tenantId?.toString();
      }

      // Priority 2: Fallback to JWT token (decoded payload)
      if (decoded.tenantId) {
        return typeof decoded.tenantId === "string"
          ? decoded.tenantId
          : decoded.tenantId?.toString();
      }

      return undefined;
    };

    // Global function to get tenantName
    const getTenantName = (
      tenantId: string | undefined
    ): string | undefined => {
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
    if (
      !tenantId &&
      (decoded.roleName === "ADMIN" || decoded.roleName === "PRIMARYADMIN") &&
      (decoded.userId || decoded.sub || user?._id)
    ) {
      try {
        const userId = decoded.userId || decoded.sub || user?._id;
        const adminRepository = await import(
          "../repositories/admin.repository"
        );
        const admin = await adminRepository.findAdminById(userId);
        if (admin && admin.tenantId) {
          // Convert tenantId to string if it's an ObjectId
          const adminTenantId = admin.tenantId;
          tenantId =
            typeof adminTenantId === "string"
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
        console.error(
          "Failed to fetch tenantId from admin record:",
          adminError
        );
      }
    }

    // Final fallback for tenantName
    if (!tenantName && tenantId) {
      tenantName = `Tenant-${tenantId}`;
    }

    // Extract roleName with priority: user object from user-api > JWT token > role object
    const roleName =
      user?.roleName || decoded.roleName || user?.role?.name || decoded.role;

    console.log("🔍 [extractUserData] Role extraction:", {
      userRoleName: user?.roleName,
      decodedRoleName: decoded.roleName,
      userRoleObject: user?.role,
      userRoleObjectName: user?.role?.name,
      finalRoleName: roleName,
      userId: decoded.userId || decoded.sub || user?._id,
    });

    const extractedData = {
      id: decoded.userId || decoded.sub || user?._id,
      userId: decoded.userId || decoded.sub || user?._id,
      tenantId: tenantId, // This is critical - must be present
      tenantName: tenantName,
      role: decoded.role || user?.role,
      roleName: roleName, // Use extracted roleName with priority
      permissions: decoded.permissions || [],
      email: decoded.email || user?.email,
      username: decoded.username || user?.username,
      firstName: decoded.firstName || user?.firstName,
      lastName: decoded.lastName || user?.lastName,
    };

    // Ensure tenantId is always a string if present
    if (extractedData.tenantId && typeof extractedData.tenantId !== "string") {
      extractedData.tenantId = String(extractedData.tenantId);
    }

    // Check trial expiry (skip for SuperAdmin role)
    const userRole = roleName || user?.role?.name || decoded.roleName;
    if (tenantId && userRole !== 'SuperAdmin') {
      const trialCheck = await checkTrialExpiry(tenantId);
      if (trialCheck.expired) {
        return {
          ...extractedData,
          __trialExpired: true,
        };
      }
    }

    return extractedData;
  },

  // Default access level for routes not in config (PRIVATE = requires auth)
  defaultAccess: undefined, // Will use PRIVATE as default from middleware
});

/**
 * Helper function to find route configuration
 * Matches exact routes and parameterized routes (e.g., /users/:id)
 */
const findRouteConfig = (
  method: string,
  path: string
): { config: any; routeKey: string } | null => {
  const normalizedPath = path.replace(/\/$/, "");
  const routeKey = `${method.toUpperCase()} ${normalizedPath}`;

  // Try exact match first
  if (routeAccessConfig[routeKey]) {
    return { config: routeAccessConfig[routeKey], routeKey };
  }

  // Try with trailing slash
  const routeKeyWithSlash = `${method.toUpperCase()} ${normalizedPath}/`;
  if (routeAccessConfig[routeKeyWithSlash]) {
    return {
      config: routeAccessConfig[routeKeyWithSlash],
      routeKey: routeKeyWithSlash,
    };
  }

  // Try pattern matching for parameterized routes
  for (const [key, config] of Object.entries(routeAccessConfig)) {
    const [configMethod, configPath] = key.split(" ");
    if (configMethod !== method.toUpperCase()) continue;

    const normalizedConfigPath = configPath.replace(/\/$/, "");
    if (normalizedConfigPath.includes(":")) {
      const pattern = normalizedConfigPath.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(normalizedPath)) {
        return { config, routeKey: key };
      }
    }
  }

  return null;
};

/**
 * Validation middleware that runs after baseMiddleware
 * Validates tenantId and roles for ROLE_BASED and ADMIN routes
 */
const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Find route config
    const routeMatch = findRouteConfig(req.method, req.path);
    const routeConfig = routeMatch?.config;

    // If no config or route is PUBLIC/INTERNAL, skip validation
    if (
      !routeConfig ||
      routeConfig.level === RouteAccessLevel.PUBLIC ||
      routeConfig.level === RouteAccessLevel.INTERNAL
    ) {
      return next();
    }

    // For authenticated routes, req.user should be set by baseMiddleware
    if (!req.user) {
      return sendErrorResponse(res, "Authentication required", 401);
    }

    // Check if trial has expired
    if (req.user.__trialExpired) {
      return sendErrorResponse(
        res,
        'Trial period has expired. Please upgrade your subscription to continue.',
        403,
        { errorCode: 'TRIAL_EXPIRED', action: 'UPGRADE_REQUIRED' }
      );
    }


    // Validate tenantId for all authenticated routes (except SUPERADMIN)
    const userRole = req.user?.roleName;
    if (userRole !== "SUPERADMIN") {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return sendErrorResponse(res, "Tenant ID is required", 403);
      }

      // Validate tenantId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        return sendErrorResponse(res, "Invalid Tenant ID format", 403);
      }
    }

    // Handle ROLE_BASED access - validate specific role(s)
    if (
      routeConfig.level === RouteAccessLevel.ROLE_BASED &&
      routeConfig.roles &&
      routeConfig.roles.length > 0
    ) {
      const userRole = req.user?.roleName;

      if (!userRole) {
        return sendErrorResponse(res, "User role not found", 403);
      }

      // Check if user's role is in the allowed roles list
      const hasRequiredRole = routeConfig.roles.some((requiredRole: string) => {
        // Normalize role names for comparison (case-insensitive)
        return userRole.toUpperCase() === requiredRole.toUpperCase();
      });

      if (!hasRequiredRole) {
        return sendErrorResponse(
          res,
          `Access denied. Required role: ${routeConfig.roles.join(" or ")}`,
          403
        );
      }
    }

    // Handle ADMIN access - require ADMIN, SUPERADMIN, or PRIMARYADMIN role
    if (routeConfig.level === RouteAccessLevel.ADMIN) {
      const userRole = req.user?.roleName;

      console.log("🔍 [validationMiddleware] ADMIN route check:", {
        route: `${req.method} ${req.path}`,
        userRole,
        reqUserKeys: req.user ? Object.keys(req.user) : [],
        reqUserFull: JSON.stringify(req.user, null, 2),
      });

      if (!userRole) {
        console.error(
          "❌ [validationMiddleware] User role not found in req.user"
        );
        return sendErrorResponse(res, "User role not found", 403);
      }

      const normalizedRole = userRole.toUpperCase();
      console.log("🔍 [validationMiddleware] Normalized role:", normalizedRole);

      if (
        normalizedRole !== "ADMIN" &&
        normalizedRole !== "SUPERADMIN" &&
        normalizedRole !== "PRIMARYADMIN"
      ) {
        console.error("❌ [validationMiddleware] Role not allowed:", {
          normalizedRole,
          allowedRoles: ["ADMIN", "SUPERADMIN", "PRIMARYADMIN"],
        });
        return sendErrorResponse(res, "Admin access required", 403);
      }

      console.log(
        "✅ [validationMiddleware] ADMIN access granted for role:",
        normalizedRole
      );
    }

    // All validations passed, continue to route handler
    next();
  } catch (error) {
    console.error("Global auth middleware validation error:", error);
    sendErrorResponse(res, "Authentication validation failed", 500);
  }
};

/**
 * Enhanced global auth middleware with tenantId and role validation
 * This combines baseMiddleware (authentication) with validationMiddleware (authorization)
 */
export const globalAuthMiddleware = [baseMiddleware, validationMiddleware];

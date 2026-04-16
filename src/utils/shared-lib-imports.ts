// Centralized imports from shared-lib
// This file ensures we only need to update one place when shared-lib version changes

export {
  // HTTP utilities
  HttpStatusCodes,
  ResponseMessages,
  sendSuccessResponse,
  sendErrorResponse,

  // User enums and constants
  USER_TYPES,
  USER_TYPE_ARRAY,
  USER_ACCESS_TYPES,
  USER_ACCESS_TYPE_ARRAY,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_ARRAY,
  PROFILE_STATUS,
  PROFILE_STATUS_ARRAY,
  ROLE_NAMES,
  ROLE_DISPLAY_NAMES,
  canManageTenants,

  // Permission enums and constants
  PERMISSION_RESOURCES,
  PERMISSION_RESOURCE_ARRAY,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_ARRAY,
  PERMISSIONS,

  // Security constants
  PASSWORD_CONFIG,

  // Models
  IBaseDocument,
  BaseDocumentSchema,

  // JWT & Auth
  JWTHelper,
  JWTPayload,
  TokenPair,
  createAuthMiddleware,
  createSimpleAuthMiddleware,

  // Route Access
  RouteAccessLevel,
  RouteAccessMap,
  RouteAccessConfig,
  createRouteAccessMiddleware,
  routeKey,

  // Other utilities
  getCurrentISO8601DateTime,
  getTimeStamp,
  getRemainingDuration,
  getOtpExpiryTime,

  // Query Parameters Helper
  buildQueryFromRequest,
  // ---
  TransactionHelper,
  buildQuery,
} from "shared-lib";

// Version constant for easy tracking
export const SHARED_LIB_VERSION = "1.0.29";

// Temporary exam enums until shared-lib provides official ones
// Centralizing strings here avoids drift across repositories
export const ExamEnums = {
  ExamStatus: [
    "Draft",
    "Unpublished",
    "Published",
    "Released",
    "In Progress",
    "Completed",
    "Cancelled",
  ] as const,
  ExamType: ["Official", "Practice", "Exam Repository"] as const,
};

import axios from "axios";
/**
 * User API Integration Service
 * Handles communication with user-api for user management
 */

// User API configuration
const USER_API_BASE_URL = process.env.USER_API_URL || "http://localhost:3002";
const INTERNAL_API_KEY =
  process.env.INTERNAL_API_KEY || "your-internal-api-key-here";

// Axios instance for user-api communication
const userApiClient = axios.create({
  baseURL: `${USER_API_BASE_URL}/user/internal`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": INTERNAL_API_KEY,
  },
});

/**
 * Extract detailed error message from axios error
 */
const extractErrorMessage = (
  error: any,
  operation: string,
  url?: string
): string => {
  let errorMessage = "Unknown error";

  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const status = error.response.status;
    const statusText = error.response.statusText;
    const data = error.response.data;

    errorMessage = `HTTP ${status} ${statusText}`;
    if (data?.message) {
      errorMessage += `: ${data.message}`;
    } else if (data?.error) {
      errorMessage += `: ${data.error}`;
    } else if (typeof data === "string") {
      errorMessage += `: ${data}`;
    } else if (data) {
      errorMessage += `: ${JSON.stringify(data)}`;
    }
  } else if (error.request) {
    // The request was made but no response was received
    const baseUrl = url || `${USER_API_BASE_URL}/user/internal`;
    errorMessage = `No response received from user-api. URL: ${baseUrl}`;
    if (error.code === "ECONNREFUSED") {
      errorMessage = `Connection refused. User API might be down at ${USER_API_BASE_URL}`;
    } else if (error.code === "ETIMEDOUT") {
      errorMessage = `Request timeout connecting to user-api at ${USER_API_BASE_URL}`;
    } else if (error.code) {
      errorMessage = `Network error (${error.code}): ${error.message}`;
    }
  } else {
    // Something happened in setting up the request that triggered an Error
    errorMessage = error.message || "Unknown error";
  }

  console.error(`Detailed error for ${operation}:`, {
    message: errorMessage,
    operation,
    url: url || `${USER_API_BASE_URL}/user/internal`,
    hasApiKey: !!INTERNAL_API_KEY,
    errorCode: error.code,
    status: error.response?.status,
    responseData: error.response?.data,
  });

  return errorMessage;
};

/**
 * User API Integration Service
 */
export class UserApiIntegrationService {
  /**
   * Check if user exists by email or username and tenantId
   */
  static async checkUserExists(
    email?: string,
    username?: string,
    tenantId?: string
  ): Promise<{ exists: boolean; user?: any }> {
    try {
      if (!email && !username) {
        throw new Error(
          "Email or username is required for checking user existence"
        );
      }

      const params = new URLSearchParams();
      if (email) params.append("email", email);
      if (username) params.append("username", username);
      if (tenantId) params.append("tenantId", tenantId);

      // Use the dedicated /check-user-exists endpoint
      const response = await userApiClient.get(
        `/check-user-exists?${params.toString()}`
      );

      // Transform response to match expected format
      if (response.data?.data?.exists) {
        return {
          exists: true,
          user: response.data.data.user || null,
        };
      }

      return { exists: false };
    } catch (error: any) {
      // If user not found (404), return exists: false
      if (error.response?.status === 404) {
        return { exists: false };
      }

      // If bad request (400), might be missing params - return exists: false to be safe
      if (error.response?.status === 400) {
        console.warn(
          "⚠️ Bad request when checking user existence, assuming user doesn't exist:",
          error.message
        );
        return { exists: false };
      }

      const errorMessage = extractErrorMessage(
        error,
        "checkUserExists",
        "/check-user-exists"
      );
      throw new Error(`Failed to check user existence: ${errorMessage}`);
    }
  }

  /**
   * Batch check which emails already exist as users in this tenant (for bulk upload validation).
   * Returns array of existing emails (lowercase).
   */
  static async checkUsersExistBatch(
    emails: string[],
    tenantId: string
  ): Promise<string[]> {
    if (emails.length === 0) return [];
    try {
      const response = await userApiClient.post("/check-existing-emails", {
        emails,
        tenantId,
      });
      const data = response.data?.data ?? response.data;
      const list = data?.existingEmails ?? [];
      return Array.isArray(list) ? list : [];
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "checkUsersExistBatch",
        "/check-existing-emails"
      );
      throw new Error(`Failed to batch check existing emails: ${errorMessage}`);
    }
  }

  /**
   * Create user in user-api
   */
  static async createUser(userData: any): Promise<any> {
    try {
      const response = await userApiClient.post("/user/create", userData);
      return response.data;
    } catch (error: any) {
      // Preserve the original error for better handling upstream
      // This allows the caller to check error.response.status
      if (error.response) {
        // Preserve axios error structure
        error.originalError = error;
        error.message = extractErrorMessage(
          error,
          "createUser",
          "/user/create"
        );
      } else {
        const errorMessage = extractErrorMessage(
          error,
          "createUser",
          "/user/create"
        );
        error.message = errorMessage;
      }
      throw error;
    }
  }

  /**
   * Get user by ID from user-api
   */
  static async getUserById(userId: string): Promise<any> {
    try {
      const response = await userApiClient.get(`/user/${userId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getUserById",
        `/user/${userId}`
      );
      throw new Error(`Failed to get user: ${errorMessage}`);
    }
  }

  /**
   * Update user in user-api
   */
  static async updateUser(userId: string, updateData: any): Promise<any> {
    try {
      const response = await userApiClient.put(
        `/user/${userId}/update`,
        updateData
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "updateUser",
        `/user/${userId}/update`
      );
      throw new Error(`Failed to update user: ${errorMessage}`);
    }
  }

  /**
   * Delete user from user-api
   */
  static async deleteUser(userId: string): Promise<any> {
    try {
      const response = await userApiClient.delete(`/user/${userId}/delete`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "deleteUser",
        `/user/${userId}/delete`
      );
      throw new Error(`Failed to delete user: ${errorMessage}`);
    }
  }

  /**
   * Validate user in user-api
   */
  static async validateUser(userId: string): Promise<any> {
    try {
      const response = await userApiClient.get(
        `/validate-user?userId=${userId}`
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "validateUser",
        `/validate-user?userId=${userId}`
      );
      throw new Error(`Failed to validate user: ${errorMessage}`);
    }
  }

  /**
   * Get user role from user-api
   */
  static async getUserRole(userId: string): Promise<any> {
    try {
      const response = await userApiClient.get(`/user/${userId}/role`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getUserRole",
        `/user/${userId}/role`
      );
      throw new Error(`Failed to get user role: ${errorMessage}`);
    }
  }

  /**
   * Get user permissions from user-api
   */
  static async getUserPermissions(userId: string): Promise<any> {
    try {
      const response = await userApiClient.get(`/user/${userId}/permissions`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getUserPermissions",
        `/user/${userId}/permissions`
      );
      throw new Error(`Failed to get user permissions: ${errorMessage}`);
    }
  }

  /**
   * Validate tenant in user-api
   */
  static async validateTenant(tenantId: string): Promise<any> {
    try {
      const response = await userApiClient.post("/validate-tenant", {
        tenantId,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "validateTenant",
        "/validate-tenant"
      );
      throw new Error(`Failed to validate tenant: ${errorMessage}`);
    }
  }

  /**
   * Get tenant by ID from user-api
   */
  static async getTenantById(tenantId: string): Promise<any> {
    try {
      const response = await userApiClient.get(`/tenant/${tenantId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getTenantById",
        `/tenant/${tenantId}`
      );
      throw new Error(`Failed to get tenant: ${errorMessage}`);
    }
  }

  /**
   * Get partner by ID from user-api
   */
  static async getPartnerById(partnerId: string): Promise<any> {
    try {
      const response = await userApiClient.get(`/partner/${partnerId}`);
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getPartnerById",
        `/partner/${partnerId}`
      );
      throw new Error(`Failed to get partner: ${errorMessage}`);
    }
  }

  /**
   * Create tenant admin user in user-api (Using unifyied user route)
   */
  static async createTenant(userData: any, token?: string): Promise<any> {
    try {
      const headers: any = {};
      if (token) {
        headers["Authorization"] = token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;
      }

      // Use the same route as teachers/students/parents
      const response = await userApiClient.post("/user/create", userData, {
        headers,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "createTenant",
        "/user/create"
      );
      throw new Error(`Failed to create tenant admin: ${errorMessage}`);
    }
  }

  /**
   * Update tenant admin user in user-api (Using unified user route)
   */
  static async updateTenantInUserApi(
    userId: string,
    updateData: any,
    token?: string
  ): Promise<any> {
    try {
      const headers: any = {};
      if (token) {
        headers["Authorization"] = token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;
      }

      // Use the same route as teachers/students/parents
      const response = await userApiClient.put(
        `/user/${userId}/update`,
        updateData,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "updateTenantInUserApi",
        `/user/${userId}/update`
      );
      throw new Error(`Failed to update tenant admin: ${errorMessage}`);
    }
  }

  /**
   * Bulk create users in user-api
   * Uses dynamic timeout based on number of users (1 second per user, minimum 30s, maximum 120s)
   */
  static async bulkCreateUsers(usersData: any[]): Promise<any> {
    try {
      // Calculate dynamic timeout based on user count
      // Formula: 1 second per user, minimum 30 seconds, maximum 120 seconds
      // This ensures bulk operations have enough time to complete
      const userCount = usersData.length;
      const calculatedTimeout = Math.max(30000, Math.min(userCount * 1000, 120000));

      console.log(`⏱️ Bulk creating ${userCount} users with dynamic timeout: ${calculatedTimeout}ms (${calculatedTimeout / 1000}s)`);

      // Create a one-time axios request with custom timeout for this bulk operation
      const response = await axios.post(
        `${USER_API_BASE_URL}/user/internal/users/bulk-create`,
        { users: usersData },
        {
          timeout: calculatedTimeout,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": INTERNAL_API_KEY,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "bulkCreateUsers",
        "/users/bulk-create"
      );
      throw new Error(`Failed to bulk create users: ${errorMessage}`);
    }
  }

  /**
   * Bulk update users in user-api
   */
  static async bulkUpdateUsers(updates: any[]): Promise<any> {
    try {
      const response = await userApiClient.post("/users/bulk-update", {
        updates,
      });
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "bulkUpdateUsers",
        "/users/bulk-update"
      );
      throw new Error(`Failed to bulk update users: ${errorMessage}`);
    }
  }

  /**
   * Get users by IDs from user-api
   */
  static async getUsersByIds(userIds: string[]): Promise<any> {
    try {
      const response = await userApiClient.post("/users/batch", { userIds });
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "getUsersByIds",
        "/users/batch"
      );
      throw new Error(`Failed to get users by IDs: ${errorMessage}`);
    }
  }

  /**
   * Health check for user-api
   */
  static async healthCheck(): Promise<any> {
    try {
      const response = await userApiClient.get("/health");
      return response.data;
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error, "healthCheck", "/health");
      throw new Error(`User API health check failed: ${errorMessage}`);
    }
  }

  /**
   * Test user login to verify user creation
   */
  static async testUserLogin(
    username: string,
    password: string,
    tenantName: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${USER_API_BASE_URL.replace("/internal", "")}/api/v1/auth/login`,
        {
          username,
          password,
          tenantName,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      const errorMessage = extractErrorMessage(
        error,
        "testUserLogin",
        `${USER_API_BASE_URL}/api/v1/auth/login`
      );
      return {
        success: false,
        message: errorMessage,
      };
    }
  }
}

// Export individual functions for easier use
export const {
  checkUserExists,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  validateUser,
  getUserRole,
  getUserPermissions,
  validateTenant,
  getTenantById,
  createTenant,
  updateTenantInUserApi,
  bulkCreateUsers,
  bulkUpdateUsers,
  getUsersByIds,
  healthCheck,
  testUserLogin,
} = UserApiIntegrationService;

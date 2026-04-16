import axios from "axios";

/**
 * Monetization API Integration Service
 * Handles communication with monetization-api for credit operations
 */

// Monetization API configuration
const MONETIZATION_API_BASE_URL = "https://dev.cognify.education";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "dev-internal-key";
console.log("MONETIZATION_API_BASE_URL", MONETIZATION_API_BASE_URL);
// Axios instance for monetization-api communication
const monetizationApiClient = axios.create({
  baseURL: `${MONETIZATION_API_BASE_URL}/monetization/api/v1/internal`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "x-internal-api-key": INTERNAL_API_KEY, // monetization-api expects x-internal-api-key header
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
    errorMessage = `No response received from monetization-api for ${operation}`;
    if (url) {
      errorMessage += ` at ${url}`;
    }
  } else {
    errorMessage = `Error setting up request for ${operation}: ${error.message}`;
  }

  return errorMessage;
};

/**
 * Get student wallet balance from Monetization-API
 */
export const getStudentWalletBalance = async (
  studentId: string,
  tenantId: string
): Promise<{
  balance: number;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
}> => {
  try {
    const response = await monetizationApiClient.get(
      `/student-wallets/${studentId}/balance?tenantId=${tenantId}`
    );

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "get student wallet balance",
      `/student-wallets/${studentId}/balance`
    );

    console.error(`❌ [Academic API] Failed to get wallet balance:`, {
      studentId,
      tenantId,
      errorMessage,
    });

    // Return default values if wallet not found
    if (error.response?.status === 404) {
      return {
        balance: 0,
        totalCreditsPurchased: 0,
        totalCreditsUsed: 0,
      };
    }

    throw new Error(`Failed to get student wallet balance: ${errorMessage}`);
  }
};

/**
 * Get wallets for multiple students from Monetization-API
 */
export const getStudentWalletsBatch = async (
  studentIds: string[],
  tenantId: string
): Promise<Array<{
  studentId: string;
  balance: number;
  totalCreditsPurchased: number;
  totalCreditsUsed: number;
  lastTopupDate?: Date;
}>> => {
  try {
    const response = await monetizationApiClient.post(
      `/student-wallets/batch`,
      { studentIds, tenantId }
    );

    const responseData = response.data?.data || response.data;
    return responseData.wallets || [];
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "get student wallets batch",
      `/student-wallets/batch`
    );

    console.error(`❌ [Academic API] Failed to get wallets batch:`, {
      studentIds,
      tenantId,
      errorMessage,
    });

    throw new Error(`Failed to get student wallets: ${errorMessage}`);
  }
};

/**
 * Consume credits from student wallet via Monetization-API
 */
export const consumeStudentWalletCredits = async (
  studentId: string,
  amount: number,
  tenantId: string
): Promise<{
  studentId: string;
  balance: number;
  totalCreditsUsed: number;
}> => {
  try {
    const response = await monetizationApiClient.post(
      `/student-wallets/${studentId}/consume`,
      { amount, tenantId }
    );

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "consume student wallet credits",
      `/student-wallets/${studentId}/consume`
    );

    console.error(`❌ [Academic API] Failed to consume credits:`, {
      studentId,
      amount,
      tenantId,
      errorMessage,
    });

    throw new Error(`Failed to consume credits: ${errorMessage}`);
  }
};

/**
 * Allocate initial credits to student wallet (called when student is created)
 * This creates the wallet and adds 2 credits automatically
 */
export const allocateInitialCredits = async (
  studentId: string,
  credits: number,
  tenantId: string,
  tenantName: string,
  createdBy: string = "system"
): Promise<{
  studentId: string;
  balance: number;
  totalCreditsPurchased: number;
}> => {
  try {
    const response = await monetizationApiClient.post(
      `/student-wallets/${studentId}/allocate-initial-credits`,
      {
        credits,
        tenantId,
        tenantName,
        createdBy,
      }
    );

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "allocate initial credits",
      `/student-wallets/${studentId}/allocate-initial-credits`
    );

    console.error(`❌ [Academic API] Failed to allocate initial credits:`, {
      studentId,
      credits,
      tenantId,
      tenantName,
      errorMessage,
    });

    // Re-throw error so it can be caught by the calling code
    // The calling code will handle it gracefully (log and continue)
    throw new Error(`Failed to allocate initial credits: ${errorMessage}`);
  }
};

/**
 * Bulk allocate initial credits to multiple student wallets (optimized for bulk upload)
 * Uses bulk operations for better performance with large batches
 * All-or-nothing: If any fails, all fail
 */
export const bulkAllocateInitialCredits = async (
  allocations: Array<{
    studentId: string;
    credits: number;
  }>,
  tenantId: string,
  tenantName: string,
  createdBy: string = "system"
): Promise<{
  created: Array<{
    studentId: string;
    balance: number;
    totalCreditsPurchased: number;
  }>;
  failed: Array<{
    studentId: string;
    error: string;
  }>;
}> => {
  try {
    // Calculate dynamic timeout based on number of allocations (1 second per allocation, min 30s, max 120s)
    const allocationCount = allocations.length;
    const calculatedTimeout = Math.max(30000, Math.min(allocationCount * 1000, 120000));
    
    console.log(`⏱️ Bulk allocating credits to ${allocationCount} students with dynamic timeout: ${calculatedTimeout}ms (${calculatedTimeout / 1000}s)`);

    const response = await axios.post(
      `${MONETIZATION_API_BASE_URL}/monetization/api/v1/internal/student-wallets/bulk-allocate-initial-credits`,
      {
        allocations,
        tenantId,
        tenantName,
        createdBy,
      },
      {
        timeout: calculatedTimeout,
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": INTERNAL_API_KEY,
        },
      }
    );

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "bulk allocate initial credits",
      `/student-wallets/bulk-allocate-initial-credits`
    );

    console.error(`❌ [Academic API] Failed to bulk allocate initial credits:`, {
      allocationCount: allocations.length,
      tenantId,
      tenantName,
      errorMessage,
    });

    // Re-throw error so it can be caught by the calling code
    throw new Error(`Failed to bulk allocate initial credits: ${errorMessage}`);
  }
};

/**
 * Bulk update student wallets with parentId (optimized for bulk parent upload)
 * Updates parentId for multiple student wallets when parent is assigned
 * Uses bulk operations for better performance with large batches
 * All-or-nothing: If any fails, all fail
 */
export const bulkUpdateWalletsWithParent = async (
  updates: Array<{
    studentId: string;
    parentId: string;
  }>,
  tenantId: string
): Promise<{
  updated: Array<{
    studentId: string;
    parentId: string;
  }>;
  failed: Array<{
    studentId: string;
    error: string;
  }>;
}> => {
  try {
    // Calculate dynamic timeout based on number of updates (1 second per update, min 30s, max 120s)
    const updateCount = updates.length;
    const calculatedTimeout = Math.max(30000, Math.min(updateCount * 1000, 120000));
    
    console.log(`⏱️ Bulk updating ${updateCount} student wallets with parentId with dynamic timeout: ${calculatedTimeout}ms (${calculatedTimeout / 1000}s)`);

    const response = await axios.post(
      `${MONETIZATION_API_BASE_URL}/monetization/api/v1/internal/student-wallets/bulk-update-parent`,
      {
        updates,
        tenantId,
      },
      {
        timeout: calculatedTimeout,
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": INTERNAL_API_KEY,
        },
      }
    );

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "bulk update wallets with parent",
      `/student-wallets/bulk-update-parent`
    );

    console.error(`❌ [Academic API] Failed to bulk update wallets with parent:`, {
      updateCount: updates.length,
      tenantId,
      errorMessage,
    });

    // Re-throw error so it can be caught by the calling code
    throw new Error(`Failed to bulk update wallets with parent: ${errorMessage}`);
  }
};

/**
 * Get credit transactions by parentId from Monetization-API
 * @param studentId - Optional: filter transactions for a specific student
 */
export const getTransactionsByParentId = async (
  parentId: string,
  tenantId: string,
  pageNo: number = 1,
  pageSize: number = 50,
  studentId?: string
): Promise<{
  transactions: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> => {
  try {
    // Monetization-API expects 'page' and 'limit' query params
    let url = `/transactions/parent/${parentId}?tenantId=${tenantId}&page=${pageNo}&limit=${pageSize}`;
    if (studentId) {
      url += `&studentId=${studentId}`;
    }

    const response = await monetizationApiClient.get(url);

    const responseData = response.data?.data || response.data;
    return responseData;
  } catch (error: any) {
    const errorMessage = extractErrorMessage(
      error,
      "get transactions by parentId",
      `/transactions/parent/${parentId}`
    );

    console.error(`❌ [Academic API] Failed to get transactions:`, {
      parentId,
      tenantId,
      studentId,
      errorMessage,
    });

    // Return empty result if not found
    if (error.response?.status === 404) {
      return {
        transactions: [],
        pagination: {
          page: pageNo,
          limit: pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }

    throw new Error(`Failed to get transactions: ${errorMessage}`);
  }
};

export const monetizationApiIntegration = {
  getStudentWalletBalance,
  getStudentWalletsBatch,
  consumeStudentWalletCredits,
  allocateInitialCredits,
  bulkAllocateInitialCredits,
  bulkUpdateWalletsWithParent,
  getTransactionsByParentId,
};


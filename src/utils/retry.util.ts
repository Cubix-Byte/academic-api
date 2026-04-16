/**
 * Retry utility for handling MongoDB write conflicts and transient errors
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Checks if an error is a MongoDB write conflict error
 */
export const isWriteConflictError = (error: any): boolean => {
  if (!error) return false;

  // MongoDB error code 251 indicates write conflict
  if (error.code === 251) return true;

  // Check error message for write conflict indicators
  const errorMessage = error.message || String(error);
  if (
    typeof errorMessage === "string" &&
    errorMessage.toLowerCase().includes("write conflict")
  ) {
    return true;
  }

  // Check for specific MongoDB write conflict error names
  if (
    error.name === "MongoWriteConflictError" ||
    error.name === "WriteConflict"
  ) {
    return true;
  }

  return false;
};

/**
 * Retries a function with exponential backoff when encountering write conflicts
 * @param fn - The function to retry
 * @param options - Retry configuration options
 * @returns The result of the function
 */
export const retryOnWriteConflict = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 2000,
    backoffMultiplier = 2,
  } = options;

  let lastError: any;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Only retry on write conflict errors
      if (!isWriteConflictError(error)) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt >= maxRetries) {
        console.error(
          `❌ Retry failed after ${attempt + 1} attempts:`,
          error.message
        );
        throw error;
      }

      // Log retry attempt
      console.warn(
        `⚠️ Write conflict detected (attempt ${attempt + 1}/${
          maxRetries + 1
        }). Retrying in ${delay}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
};

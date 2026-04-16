import fs from "fs/promises";

/**
 * File Cleanup Utility
 * Safely removes temporary files created during bulk upload processing
 */

/**
 * Cleanup temporary file
 * @param filePath - Path to file to delete
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
    console.log(`✅ Cleaned up temp file: ${filePath}`);
  } catch (error: any) {
    // File might already be deleted, ignore error
    // Only log if it's not a "file not found" error
    if (error.code !== "ENOENT") {
      console.warn(`⚠️ Failed to delete temp file ${filePath}:`, error.message);
    }
  }
}

/**
 * Cleanup temporary file with error handling
 * Use this in try/catch blocks to ensure cleanup happens
 */
export async function safeCleanup(filePath: string | undefined): Promise<void> {
  if (filePath) {
    await cleanupTempFile(filePath);
  }
}


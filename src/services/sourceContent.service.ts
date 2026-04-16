import * as examContentRepository from "../repositories/examContent.repository";
import axios from "axios";
import { IExamContent } from "@/models";

/**
 * Source Content Service - Get file references for AI grading
 * AI API will handle content extraction from files
 */
export class SourceContentService {
  /**
   * Get file references (fileIds/filePaths) from exam contents
   * @param examId - Exam ID
   * @returns Array of fileIds (or filePaths if fileId not available)
   */
  async getExamFileReferences(examId: string): Promise<{
    fileIds: string[];
    filePaths: string[];
  }> {
    try {
      const examContents = await examContentRepository.findContentByExamId(
        examId
      );

      if (!examContents || examContents.length === 0) {
        console.warn(`No exam content found for exam ${examId}`);
        return { fileIds: [], filePaths: [] };
      }

      const fileIds: string[] = [];
      const filePaths: string[] = [];

      for (const content of examContents) {
        // Try to extract fileId from filePath
        // Common patterns: filePath might be a fileId directly, or contain it
        // For now, we'll extract fileId if we can, otherwise use filePath

        // If filePath looks like a MongoDB ObjectId (24 hex chars, no slashes), use it as fileId
        if (/^[0-9a-fA-F]{24}$/.test(content.filePath)) {
          fileIds.push(content.filePath);
        } else {
          // Store filePath for AI API to handle
          filePaths.push(content.filePath);
        }
      }

      console.log(
        `📄 Found ${fileIds.length} fileIds and ${filePaths.length} filePaths for exam ${examId}`
      );

      return { fileIds, filePaths };
    } catch (error: any) {
      console.error("Error getting exam file references:", error);
      return { fileIds: [], filePaths: [] };
    }
  }

  /**
   * Get all source content from exam files (legacy method - kept for backward compatibility)
   * @deprecated Use getExamFileReferences instead - AI API handles extraction
   * @param examId - Exam ID
   * @returns Combined text content from all exam files
   */
  async getExamSourceContent(examId: string): Promise<string> {
    // Return empty - AI API will extract from files directly
    console.warn(
      "getExamSourceContent is deprecated - use getExamFileReferences instead"
    );
    return "";
  }

  /**
   * Extract relevant content excerpt for a specific question
   * This is a simplified version - in production, you might use vector search
   * @param questionText - The question text
   * @param fullContent - Full source content
   * @returns Relevant excerpt (or full content if excerpt extraction fails)
   */
  getRelevantContentForQuestion(
    questionText: string,
    fullContent: string
  ): string {
    if (!fullContent || !questionText) {
      return fullContent;
    }

    // Simple keyword-based extraction
    const questionKeywords = questionText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3); // Filter short words

    // Find sentences containing question keywords
    const sentences = fullContent.split(/[.!?]\s+/);
    const relevantSentences: string[] = [];

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      const hasKeyword = questionKeywords.some((keyword) =>
        sentenceLower.includes(keyword)
      );

      if (hasKeyword) {
        relevantSentences.push(sentence);
      }
    }

    // If we found relevant sentences, combine them with context
    if (relevantSentences.length > 0) {
      // Get context around relevant sentences (previous and next sentence)
      const combined = relevantSentences.join(". ");
      const maxLength = 10000; // Limit excerpt length
      return combined.length > maxLength
        ? combined.substring(0, maxLength) + "..."
        : combined;
    }

    // Fallback: return first portion of full content
    const maxContextLength = 10000;
    return fullContent.length > maxContextLength
      ? fullContent.substring(0, maxContextLength) + "..."
      : fullContent;
  }

  /**
   * Extract text content from file using filePath (S3 path)
   * Note: This assumes filePath can be accessed via storage-api or directly from S3
   */
  private async extractContentFromFilePath(
    examContent: IExamContent
  ): Promise<string> {
    try {
      // Try to extract fileId from filePath or use storage-api to download
      // For now, we'll try to use the storage-api if available
      // Otherwise, return empty string (grading can proceed without it)

      // Option 1: If filePath contains fileId, use it
      // Option 2: Download from S3 directly (requires S3 configuration)
      // Option 3: Call storage-api if it has an endpoint to extract by path

      // For MVP, we'll return empty and log - this can be enhanced later
      console.log(
        `📄 Note: Content extraction from filePath not yet implemented for ${examContent.filePath}`
      );
      console.log(
        `   To enable: Implement S3 direct access or storage-api filePath lookup`
      );

      // TODO: Implement actual content extraction
      // This could involve:
      // 1. Finding fileId from filePath via storage-api
      // 2. Calling storage-api extractFileContent(fileId)
      // 3. Or direct S3 access with file processing

      return "";
    } catch (error: any) {
      console.error(
        `Error extracting content from ${examContent.filePath}:`,
        error
      );
      return "";
    }
  }

  /**
   * Get file content via storage-api using fileId
   * This is a helper if we have fileId instead of filePath
   */
  async getFileContentFromStorageApi(
    fileId: string,
    authToken?: string
  ): Promise<string> {
    try {
      const storageApiUrl =
        process.env.STORAGE_API_URL || "http://localhost:3004";

      // Call storage-api to extract file content
      // Note: This assumes storage-api has an endpoint for content extraction
      // If not available, this would need to be added to storage-api

      const response = await axios.get(
        `${storageApiUrl}/storage/api/v1/files/${fileId}/content`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          timeout: 30000,
        }
      );

      if (response.data.success && response.data.data.content) {
        return response.data.data.content;
      }

      return "";
    } catch (error: any) {
      console.error(`Error getting file content from storage-api:`, error);
      return "";
    }
  }
}

// Export singleton instance
export const sourceContentService = new SourceContentService();

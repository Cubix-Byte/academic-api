import { ContentLibraryRepository } from "@/repositories/contentLibrary.repository";
import { ContentLibraryContentRepository } from "@/repositories/contentLibraryContent.repository";
import { SubjectRepository } from "@/repositories/subject.repository";
import { ClassRepository } from "@/repositories/class.repository";
import { IContentLibraryContent } from "@/models";
import mongoose, { SortOrder } from "mongoose";
import axios from "axios";
import { ObjectId } from "mongodb";
import * as notificationService from "./notification.service";
import * as studentRepository from "../repositories/student.repository";
import { SYLLABUS_FOLDER_NAME, INGEST_TYPES } from "../utils/constants/contentLibrary.constants";

export class ContentLibraryService {
  private folders: ContentLibraryRepository;
  private contents: ContentLibraryContentRepository;
  private subjects: SubjectRepository;
  private classRepository: ClassRepository;
  private aiApiUrl: string;
  private aiApiEndpoint: string;
  private aiApiIngestEndpoint: string;
  private internalApiKey: string;

  constructor() {
    this.folders = new ContentLibraryRepository();
    this.contents = new ContentLibraryContentRepository();
    this.subjects = new SubjectRepository();
    this.classRepository = new ClassRepository();
    this.aiApiUrl = process.env.BASE_URL || "https://dev.cognify.education";
    this.aiApiEndpoint =
      process.env.AI_API_CONTENT_LIBRARY_ENDPOINT ||
      "ai-llm/api/v1/files/register-for-embedding";
    this.aiApiIngestEndpoint = process.env.AI_API_INGEST_ENDPOINT || "ai-llm/api/v1/files/ingest";
    this.internalApiKey = process.env.INTERNAL_API_KEY || "";
  }

  private isObjectIdLike(value: unknown): value is string {
    return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
  }

  private async enrichContentItemMeta(params: {
    item: any;
    tenantId: string;
    ClassModel: any;
    cache: {
      subjectNameById: Map<string, string | null>;
      subjectGradeById: Map<string, string | null>;
      classGradeById: Map<string, string | null>;
    };
  }): Promise<any> {
    const { item, tenantId, ClassModel, cache } = params;
    const enriched = { ...item };

    // Resolve subject: if stored as Subject _id, replace with Subject.name
    if (this.isObjectIdLike(enriched.subject)) {
      const subjectId = enriched.subject;
      let subjectName = cache.subjectNameById.get(subjectId);
      let subjectGrade = cache.subjectGradeById.get(subjectId);

      if (subjectName === undefined || subjectGrade === undefined) {
        const subject = await this.subjects.findById(subjectId, tenantId);
        subjectName = subject?.name ?? null;
        subjectGrade = subject?.grade != null ? String(subject.grade) : null;
        cache.subjectNameById.set(subjectId, subjectName);
        cache.subjectGradeById.set(subjectId, subjectGrade);
      }

      if (subjectName) {
        enriched.subject = subjectName;
      }

      // If grade is missing or clearly an ID (bad data), derive it from subject.grade when available
      if (
        (!enriched.grade || this.isObjectIdLike(enriched.grade)) &&
        subjectGrade
      ) {
        enriched.grade = subjectGrade;
      }
    }

    // Resolve grade: sometimes UI may have stored a Class _id in "grade" (bad data)
    if (this.isObjectIdLike(enriched.grade)) {
      const gradeId = enriched.grade;
      let gradeValue = cache.classGradeById.get(gradeId);

      if (gradeValue === undefined) {
        try {
          const classData = await ClassModel.findById(gradeId).lean();
          gradeValue =
            classData?.grade != null ? String(classData.grade) : null;
        } catch {
          gradeValue = null;
        }
        cache.classGradeById.set(gradeId, gradeValue);
      }

      if (gradeValue) {
        enriched.grade = gradeValue;
      }
    }

    return enriched;
  }

  /**
   * Helper method to format content item and add classCount
   */
  private formatContentItem(content: any): any {
    const plainContent = { ...content };
    if (plainContent._id && !plainContent.id) {
      plainContent.id = plainContent._id.toString();
      delete plainContent._id;
    }
    delete plainContent.__v;
    // Ensure isEmbedded defaults to false if not set
    if (plainContent.isEmbedded === undefined) {
      plainContent.isEmbedded = false;
    }
    // Normalize subjectId for API response: always include as string or null (old docs may not have it)
    if (plainContent.subjectId != null) {
      plainContent.subjectId =
        typeof plainContent.subjectId === "string"
          ? plainContent.subjectId
          : (plainContent.subjectId?.toString?.() ?? null);
    } else {
      plainContent.subjectId = null;
    }
    // Add classCount based on assignedClassIds array length
    plainContent.classCount = Array.isArray(plainContent.assignedClassIds)
      ? plainContent.assignedClassIds.length
      : 0;

    return plainContent;
  }

  // Folder CRUD
  async createFolder(data: {
    name: string;
    tenantId: string;
    teacherId: string;
    createdBy?: string;
    isSyllabus?: boolean;
  }) {
    if (
      !data.isSyllabus &&
      data.name &&
      data.name.trim().toLowerCase() === SYLLABUS_FOLDER_NAME.toLowerCase()
    ) {
      const err: any = new Error(
        `Cannot create a folder named '${SYLLABUS_FOLDER_NAME}'`
      );
      err.statusCode = 400;
      throw err;
    }

    try {
      return await this.folders.create({
        name: data.name,
        tenantId: data.tenantId as any,
        teacherId: data.teacherId as any,
        createdBy: data.createdBy || "system",
        isSyllabus: data.isSyllabus || false,
      } as any);
    } catch (e: any) {
      if (e && e.code === 11000) {
        const err: any = new Error("A folder with this name already exists");
        err.statusCode = 409;
        throw err;
      }
      throw e;
    }
  }

  async listFolders(
    tenantId: string,
    teacherId: string,
    params: {
      pageNo?: number;
      pageSize?: number;
      query?: Record<string, any>;
      sort?: Record<string, SortOrder>;
    }
  ) {
    const result = await this.folders.findAllPaged(tenantId, teacherId, params);

    // Add contentCount to each folder
    const foldersWithContentCount = await Promise.all(
      result.items.map(async (folder: any) => {
        // Get folder ID - handle both Mongoose document and plain object
        const folderId = (folder as any)._id
          ? (folder as any)._id.toString()
          : (folder as any).id || folder.id;

        // Count contents in this folder
        const contentCount = await this.contents.countByFolder(
          folderId,
          tenantId,
          teacherId
        );

        // Convert folder to plain object and add contentCount
        const folderObj = folder.toObject ? folder.toObject() : folder;
        return {
          ...folderObj,
          contentCount,
        };
      })
    );

    return {
      ...result,
      items: foldersWithContentCount,
    };
  }

  async listFoldersWithContents(
    tenantId: string,
    teacherId: string,
    params: {
      pageNo?: number;
      pageSize?: number;
      query?: Record<string, any>;
      sort?: Record<string, SortOrder>;
      contentSearch?: string;
    },
    authToken?: string
  ) {
    // Fetch paginated folders
    const foldersResult = await this.folders.findAllPaged(tenantId, teacherId, {
      pageNo: params.pageNo,
      pageSize: params.pageSize,
      query: params.query,
      sort: params.sort,
    });

    // Fetch contents for all folders in parallel
    const { Class } = await import("../models");
    const cache = {
      subjectNameById: new Map<string, string | null>(),
      subjectGradeById: new Map<string, string | null>(),
      classGradeById: new Map<string, string | null>(),
    };
    const foldersWithContents = await Promise.all(
      foldersResult.items.map(async (folder) => {
        // Get folder ID - handle both Mongoose document and plain object
        const folderId = (folder as any)._id
          ? (folder as any)._id.toString()
          : (folder as any).id || folder.id;

        // Fetch all contents for this folder
        const contents = await this.contents.findAllByFolder(
          folderId,
          tenantId,
          teacherId,
          params.contentSearch
        );

        // Format contents with classCount
        const formattedContents = await Promise.all(
          contents.map(async (content: any) => {
            const formatted = this.formatContentItem(content);
            return await this.enrichContentItemMeta({
              item: formatted,
              tenantId,
              ClassModel: Class,
              cache,
            });
          })
        );

        // Convert folder to plain object and add contents
        const folderObj = folder.toObject ? folder.toObject() : folder;
        return {
          ...folderObj,
          contents: formattedContents,
        };
      })
    );

    return {
      items: foldersWithContents,
      total: foldersResult.total,
      pageNo: foldersResult.pageNo,
      pageSize: foldersResult.pageSize,
    };
  }

  async getFolder(id: string, tenantId: string, teacherId: string) {
    const folder = await this.folders.findById(id, tenantId, teacherId);
    if (!folder) throw new Error("Folder not found");
    return folder;
  }

  async renameFolder(
    id: string,
    tenantId: string,
    teacherId: string,
    name: string
  ) {
    // Check if folder is Syllabus folder - prevent renaming
    const folder = await this.folders.findById(id, tenantId, teacherId);
    if (!folder) throw new Error("Folder not found");

    if (
      folder.isSyllabus ||
      (folder.name &&
        folder.name.trim().toLowerCase() === SYLLABUS_FOLDER_NAME.toLowerCase())
    ) {
      const err: any = new Error(
        `${SYLLABUS_FOLDER_NAME} folder cannot be renamed`
      );
      err.statusCode = 400;
      throw err;
    }

    if (
      name &&
      name.trim().toLowerCase() === SYLLABUS_FOLDER_NAME.toLowerCase()
    ) {
      const err: any = new Error(
        `Cannot rename a folder to '${SYLLABUS_FOLDER_NAME}'`
      );
      err.statusCode = 400;
      throw err;
    }

    const updated = await this.folders.updateById(id, tenantId, teacherId, {
      name,
    });
    if (!updated) throw new Error("Folder not found");
    return updated;
  }

  async deleteFolder(id: string, tenantId: string, teacherId: string) {
    // Check if folder is Syllabus folder - prevent deletion
    const folder = await this.folders.findById(id, tenantId, teacherId);
    if (!folder) throw new Error("Folder not found");

    if (
      folder.isSyllabus ||
      (folder.name &&
        folder.name.trim().toLowerCase() === SYLLABUS_FOLDER_NAME.toLowerCase())
    ) {
      const err: any = new Error(
        `${SYLLABUS_FOLDER_NAME} folder cannot be deleted`
      );
      err.statusCode = 400;
      throw err;
    }

    const deleted = await this.folders.deleteById(id, tenantId, teacherId);
    if (!deleted) throw new Error("Folder not found");
    return deleted;
  }

  /**
   * Register file for embedding with AI API
   * This is called asynchronously after content is created and should not block the response
   */
  private async registerFileForEmbedding(
    fileId: string,
    fileName: string,
    s3Url: string,
    grade?: string,
    subject?: string,
    authToken?: string
  ): Promise<void> {
    console.log("[ACADEMIC API] registerFileForEmbedding - START", {
      fileId,
      fileName,
      s3Url,
      grade,
      subject,
      aiApiUrl: this.aiApiUrl,
      aiApiEndpoint: this.aiApiEndpoint,
      timestamp: new Date().toISOString(),
    });

    try {
      // Construct full URL - ensure BASE_URL doesn't have trailing slash and endpoint doesn't have leading slash
      const baseUrl = this.aiApiUrl.endsWith("/")
        ? this.aiApiUrl.slice(0, -1)
        : this.aiApiUrl;
      const endpoint = this.aiApiEndpoint.startsWith("/")
        ? this.aiApiEndpoint
        : `/${this.aiApiEndpoint}`;
      const url = `${baseUrl}${endpoint}`;

      const payload: {
        file_id: string;
        file_name: string;
        s3_url: string;
        grade?: string;
        subject?: string;
      } = {
        file_id: fileId,
        file_name: fileName,
        s3_url: s3Url,
      };

      if (grade) {
        payload.grade = grade;
      }

      if (subject) {
        payload.subject = subject;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add internal API key if available
      if (this.internalApiKey) {
        headers["x-api-key"] = this.internalApiKey;
      }

      // Add auth token if available
      if (authToken) {
        headers["Authorization"] = authToken.startsWith("Bearer ")
          ? authToken
          : `Bearer ${authToken}`;
      }

      console.log("[ACADEMIC API] registerFileForEmbedding - Calling AI API", {
        url,
        payload,
        hasAuthToken: !!authToken,
        hasInternalApiKey: !!this.internalApiKey,
        timestamp: new Date().toISOString(),
      });

      const response = await axios.post(url, payload, {
        headers,
        timeout: 30000, // 30 second timeout for embedding registration
      });

      console.log("[ACADEMIC API] registerFileForEmbedding - SUCCESS", {
        status: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // Log error but don't throw - embedding registration failure shouldn't block content creation
      console.error("[ACADEMIC API] registerFileForEmbedding - ERROR", {
        error: error?.message || String(error),
        response: error?.response?.data,
        status: error?.response?.status,
        fileId,
        fileName,
        timestamp: new Date().toISOString(),
      });

      // Don't throw - embedding registration failure shouldn't block content creation
      // The file can be registered later if needed
    }
  }

  /**
   * Ingest file with AI API
   * This is called asynchronously after content is created and should not block the response
   */
  private async ingestFile(
    fileId: string,
    fileName: string,
    s3Url: string,
    grade?: string,
    subject?: string,
    authToken?: string,
    targetLanguage?: string,
    ingestType?: string
  ): Promise<void> {
    console.log("[ACADEMIC API] ingestFile - START", {
      fileId,
      fileName,
      s3Url,
      grade,
      subject,
      targetLanguage,
      aiApiUrl: this.aiApiUrl,
      aiApiEndpoint: this.aiApiIngestEndpoint,
      timestamp: new Date().toISOString(),
    });

    try {
      // Construct full URL - ensure BASE_URL doesn't have trailing slash and endpoint doesn't have leading slash
      const baseUrl = this.aiApiUrl.endsWith("/")
        ? this.aiApiUrl.slice(0, -1)
        : this.aiApiUrl;
      const endpoint = this.aiApiIngestEndpoint.startsWith("/")
        ? this.aiApiIngestEndpoint
        : `/${this.aiApiIngestEndpoint}`;
      const url = `${baseUrl}${endpoint}`;

      // Construct metadata object
      const fileMetadataItem: any = {
        file_id: fileId,
        file_name: fileName,
        s3_url: s3Url,
        grade,
        subject
      };

      const payload = {
        fileMetadata: [fileMetadataItem],
        target_language: targetLanguage || "English",
        ingest_type: ingestType || INGEST_TYPES.TEXTBOOK,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add internal API key if available
      if (this.internalApiKey) {
        headers["x-api-key"] = this.internalApiKey;
      }

      // Add auth token if available
      if (authToken) {
        headers["Authorization"] = authToken.startsWith("Bearer ")
          ? authToken
          : `Bearer ${authToken}`;
      }

      console.log("[ACADEMIC API] ingestFile - Calling AI API", {
        url,
        payload,
        hasAuthToken: !!authToken,
        hasInternalApiKey: !!this.internalApiKey,
        timestamp: new Date().toISOString(),
      });

      const response = await axios.post(url, payload, {
        headers,
      });

      console.log("[ACADEMIC API] ingestFile - SUCCESS", {
        status: response.status,
        responseData: response.data,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[ACADEMIC API] ingestFile - ERROR", {
        error: error?.message || String(error),
        response: error?.response?.data,
        status: error?.response?.status,
        fileId,
        fileName,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Content CRUD
  async addContent(
    data: {
      tenantId: string;
      teacherId: string;
      contentLibraryId: string;
      contentId?: string;
      fileName: string;
      filePath: string;
      fileType?: string;
      fileSizeInBytes?: number;
      subject?: string;
      subjectId?: string;
      grade?: string;
      title?: string;
      description?: string;
      isEmbedded?: boolean;
      videoId?: string;
      videoPath?: string;
      targetLanguage?: string;
      createdBy?: string;
      ingestType?: string;
    },
    authToken?: string
  ) {
    console.log("[ACADEMIC API] addContent - Service START", {
      data: {
        ...data,
        // Don't log sensitive data
      },
      hasAuthToken: !!authToken,
      timestamp: new Date().toISOString(),
    });

    try {
      // Fetch folder to check if it's a syllabus folder
      const folder = await this.folders.findById(
        data.contentLibraryId,
        data.tenantId,
        data.teacherId
      );

      // Validate allowed file types for syllabus folders
      if (folder?.isSyllabus) {
        const fileType = data.fileType || "application/octet-stream";
        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "image/png",
          "image/jpeg",
          "image/tiff",
          "image/bmp",
          "text/plain",
          "text/markdown",
          "text/x-markdown",
        ];

        if (!allowedTypes.includes(fileType)) {
          const error: any = new Error(
            `Allowed in syllabus: PDF, Word, PowerPoint, images (PNG, JPG, TIFF, BMP), and text (TXT, MD). File type ${fileType} is not allowed.`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      // Build content object, only including optional fields if they have values
      const contentToCreate: any = {
        ...data,
        createdBy: data.createdBy || "system",
      };

      // Normalize subject/grade if UI sent IDs
      const { Class } = await import("../models");
      const cache = {
        subjectNameById: new Map<string, string | null>(),
        subjectGradeById: new Map<string, string | null>(),
        classGradeById: new Map<string, string | null>(),
      };
      const normalizedMeta = await this.enrichContentItemMeta({
        item: { subject: contentToCreate.subject, grade: contentToCreate.grade },
        tenantId: data.tenantId,
        ClassModel: Class,
        cache,
      });
      contentToCreate.subject = normalizedMeta.subject;
      contentToCreate.grade = normalizedMeta.grade;

      // Set subjectId when provided (so content is filterable by subject)
      // Backward‑compat: if UI sent subjectId in the "subject" field, use that as a fallback
      {
        const rawSubjectId =
          (data.subjectId && data.subjectId.trim() !== ""
            ? data.subjectId
            : typeof data.subject === "string"
              ? data.subject
              : ""
          ) || "";

        if (rawSubjectId.trim() !== "") {
          const mongoose = await import("mongoose");
          if (mongoose.Types.ObjectId.isValid(rawSubjectId)) {
            contentToCreate.subjectId = new mongoose.Types.ObjectId(rawSubjectId);
          }
        }
      }

      // Only add optional fields if they exist and have values
      if (data.title && data.title.trim() !== "") {
        contentToCreate.title = data.title.trim();
      }
      if (data.description && data.description.trim() !== "") {
        contentToCreate.description = data.description.trim();
      }
      if (data.videoId && data.videoId.trim() !== "") {
        contentToCreate.videoId = data.videoId.trim();
      }
      if (data.videoPath && data.videoPath.trim() !== "") {
        contentToCreate.videoPath = data.videoPath.trim();
      }
      if (data.targetLanguage && data.targetLanguage.trim() !== "") {
        contentToCreate.targetLanguage = data.targetLanguage.trim();
      }

      const result = await this.contents.create(contentToCreate);

      console.log("[ACADEMIC API] addContent - Service SUCCESS", {
        resultId: result.id || result._id,
        fileName: result.fileName,
        contentLibraryId: result.contentLibraryId,
        contentId: result.contentId,
        filePath: result.filePath,
        targetLanguage: result.targetLanguage,
        timestamp: new Date().toISOString(),
      });

      // Register file for embedding with AI API ONLY if folder is Syllabus folder
      // Use the folder already fetched above
      if (result.contentId && result.filePath && folder?.isSyllabus) {
        console.log(
          "[ACADEMIC API] addContent - Triggering embedding registration (Syllabus folder)",
          {
            contentId: result.contentId,
            filePath: result.filePath,
            fileName: result.fileName,
            grade: result.grade,
            subject: result.subject,
            folderId: data.contentLibraryId,
            folderName: folder.name,
          }
        );

        // Call ingestion - await if it's a live flow
        const ingestPromise = this.ingestFile(
          result.contentId,
          result.fileName,
          result.filePath,
          result.grade,
          result.subject,
          authToken,
          result.targetLanguage || data.targetLanguage,
          data.ingestType
        );

        if (data.ingestType === INGEST_TYPES.TEXTBOOK_LIVE) {
          console.log("[ACADEMIC API] addContent - Waiting for live ingestion response");
          await ingestPromise;
        } else {
          ingestPromise.catch((error) => {
            console.error(
              "[ACADEMIC API] addContent - Ingestion failed (non-blocking)",
              {
                error: error?.message || String(error),
                contentId: result.contentId,
                fileName: result.fileName,
                timestamp: new Date().toISOString(),
              }
            );
          });
        }
      } else {
        const skipReason = !result.contentId
          ? "No contentId"
          : !result.filePath
            ? "No filePath"
            : !folder?.isSyllabus
              ? "Not a Syllabus folder"
              : "Unknown";
        console.log(
          "[ACADEMIC API] addContent - Skipping embedding registration",
          {
            reason: skipReason,
            contentId: result.contentId,
            filePath: result.filePath,
            folderId: data.contentLibraryId,
            isSyllabus: folder?.isSyllabus || false,
            timestamp: new Date().toISOString(),
          }
        );
      }

      return result;
    } catch (error) {
      console.error("[ACADEMIC API] addContent - Service ERROR", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        data: {
          ...data,
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async bulkAddContent(
    data: {
      tenantId: string;
      teacherId: string;
      contentLibraryId: string;
      contents: Array<{
        contentId?: string;
        fileName: string;
        filePath: string;
        fileType?: string;
        fileSizeInBytes?: number;
        subject?: string;
        subjectId?: string;
        grade?: string;
        title?: string;
        description?: string;
        isEmbedded?: boolean;
        videoId?: string;
        videoPath?: string;
        targetLanguage?: string;
      }>;
      createdBy?: string;
    },
    authToken?: string
  ) {
    console.log("[ACADEMIC API] bulkAddContent - Service START", {
      contentLibraryId: data.contentLibraryId,
      contentsCount: data.contents.length,
      hasAuthToken: !!authToken,
      timestamp: new Date().toISOString(),
    });

    try {
      const results = [];
      const errors = [];

      // Fetch folder once to check if it's a Syllabus folder
      const folder = await this.folders.findById(
        data.contentLibraryId,
        data.tenantId,
        data.teacherId
      );
      const isSyllabusFolder = folder?.isSyllabus || false;

      // Process each content item
      for (let i = 0; i < data.contents.length; i++) {
        const contentData = data.contents[i];
        try {
          // Validate allowed file types for syllabus folders
          if (isSyllabusFolder) {
            const fileType = contentData.fileType || "application/octet-stream";
            const allowedTypes = [
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.ms-powerpoint",
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "image/png",
              "image/jpeg",
              "image/tiff",
              "image/bmp",
              "text/plain",
              "text/markdown",
              "text/x-markdown",
            ];

            if (!allowedTypes.includes(fileType)) {
              const error: any = new Error(
                `Allowed in syllabus: PDF, Word, PowerPoint, images (PNG, JPG, TIFF, BMP), and text (TXT, MD). File type ${fileType} is not allowed for file: ${contentData.fileName}`
              );
              error.statusCode = 400;
              throw error;
            }
          }

          // Build content object, only including optional fields if they have values
          const contentToCreate: any = {
            tenantId: data.tenantId,
            teacherId: data.teacherId,
            contentLibraryId: data.contentLibraryId,
            contentId: contentData.contentId,
            fileName: contentData.fileName,
            filePath: contentData.filePath,
            fileType: contentData.fileType,
            fileSizeInBytes: contentData.fileSizeInBytes,
            subject: contentData.subject,
            grade: contentData.grade,
            isEmbedded: contentData.isEmbedded,
            createdBy: data.createdBy || "system",
          };
          if (contentData.subjectId && contentData.subjectId.trim() !== "") {
            const mongoose = await import("mongoose");
            if (mongoose.Types.ObjectId.isValid(contentData.subjectId)) {
              contentToCreate.subjectId = new mongoose.Types.ObjectId(contentData.subjectId);
            }
          }

          // Only add optional fields if they exist and have values
          if (contentData.title && contentData.title.trim() !== "") {
            contentToCreate.title = contentData.title.trim();
          }
          if (
            contentData.description &&
            contentData.description.trim() !== ""
          ) {
            contentToCreate.description = contentData.description.trim();
          }
          if (contentData.videoId && contentData.videoId.trim() !== "") {
            contentToCreate.videoId = contentData.videoId.trim();
          }
          if (contentData.videoPath && contentData.videoPath.trim() !== "") {
            contentToCreate.videoPath = contentData.videoPath.trim();
          }
          if (contentData.targetLanguage && contentData.targetLanguage.trim() !== "") {
            contentToCreate.targetLanguage = contentData.targetLanguage.trim();
          }

          const result = await this.contents.create(contentToCreate);

          results.push(result);

          // Register file for embedding with AI API ONLY if folder is Syllabus folder (fire and forget)
          if (result.contentId && result.filePath && isSyllabusFolder) {
            console.log(
              `[ACADEMIC API] bulkAddContent - Triggering embedding registration (Syllabus folder) for ${result.fileName}`,
              {
                contentId: result.contentId,
                fileName: result.fileName,
                folderId: data.contentLibraryId,
                folderName: folder?.name,
              }
            );
            this.ingestFile(
              result.contentId,
              result.fileName,
              result.filePath,
              result.grade,
              result.subject,
              authToken,
              result.targetLanguage || contentData.targetLanguage
            ).catch((error) => {
              console.error(
                `[ACADEMIC API] bulkAddContent - Embedding registration failed for ${result.fileName}`,
                {
                  error: error?.message || String(error),
                  contentId: result.contentId,
                  fileName: result.fileName,
                  timestamp: new Date().toISOString(),
                }
              );
            });
          } else {
            const skipReason = !result.contentId
              ? "No contentId"
              : !result.filePath
                ? "No filePath"
                : !isSyllabusFolder
                  ? "Not a Syllabus folder"
                  : "Unknown";
            console.log(
              `[ACADEMIC API] bulkAddContent - Skipping embedding registration for ${result.fileName}`,
              {
                reason: skipReason,
                fileName: result.fileName,
                folderId: data.contentLibraryId,
                isSyllabus: isSyllabusFolder,
              }
            );
          }
        } catch (error: any) {
          console.error(
            `[ACADEMIC API] bulkAddContent - Failed to add content ${i + 1}`,
            {
              error: error?.message || String(error),
              fileName: contentData.fileName,
              timestamp: new Date().toISOString(),
            }
          );
          errors.push({
            index: i,
            fileName: contentData.fileName,
            error: error?.message || String(error),
          });
        }
      }

      console.log("[ACADEMIC API] bulkAddContent - Service SUCCESS", {
        successCount: results.length,
        errorCount: errors.length,
        timestamp: new Date().toISOString(),
      });

      return {
        successCount: results.length,
        errorCount: errors.length,
        results: results.map((r: any) => ({
          id: r.id || r._id?.toString(),
          fileName: r.fileName,
          contentId: r.contentId,
          filePath: r.filePath,
        })),
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("[ACADEMIC API] bulkAddContent - Service ERROR", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async listContents(
    contentLibraryId: string,
    tenantId: string,
    teacherId: string,
    search?: string,
    authToken?: string
  ) {
    const contents = await this.contents.findAllByFolder(
      contentLibraryId,
      tenantId,
      teacherId,
      search
    );
    // Format all content items with classCount and className
    const { Class } = await import("../models");
    const cache = {
      subjectNameById: new Map<string, string | null>(),
      subjectGradeById: new Map<string, string | null>(),
      classGradeById: new Map<string, string | null>(),
    };
    const formattedContents = await Promise.all(
      contents.map(async (content: any) => {
        let formatted = this.formatContentItem(content);

        formatted = await this.enrichContentItemMeta({
          item: formatted,
          tenantId,
          ClassModel: Class,
          cache,
        });

        // Fetch className if assignedClassIds exists
        if (
          Array.isArray(formatted.assignedClassIds) &&
          formatted.assignedClassIds.length > 0
        ) {
          const firstClassId = formatted.assignedClassIds[0];
          try {
            const classData = await Class.findById(firstClassId).lean();
            formatted.className = classData?.name || null;
          } catch (error) {
            formatted.className = null;
          }
        } else {
          formatted.className = null;
        }
        return formatted;
      })
    );
    return formattedContents;
  }

  async getContent(
    id: string,
    tenantId: string,
    teacherId: string,
    authToken?: string
  ) {
    const item = await this.contents.findById(id, tenantId, teacherId);
    if (!item) throw new Error("Content not found");
    return this.formatContentItem(item);
  }

  async renameContent(
    id: string,
    tenantId: string,
    teacherId: string,
    fileName: string
  ) {
    const updated = await this.contents.updateById(id, tenantId, teacherId, {
      fileName,
    });
    if (!updated) throw new Error("Content not found");
    return updated;
  }

  async updateContentMeta(
    id: string,
    tenantId: string,
    teacherId: string,
    update: {
      fileType?: string;
      fileSizeInBytes?: number;
      filePath?: string;
      subject?: string;
      grade?: string;
      isEmbedded?: boolean;
    }
  ) {
    const updated = await this.contents.updateById(
      id,
      tenantId,
      teacherId,
      update as any
    );
    if (!updated) throw new Error("Content not found");
    return updated;
  }

  async deleteContent(id: string, tenantId: string, teacherId: string) {
    const deleted = await this.contents.deleteById(id, tenantId, teacherId);
    if (!deleted) throw new Error("Content not found");
    return deleted;
  }

  /**
   * Update isEmbedded status by contentId (for internal API)
   */
  async updateEmbeddedStatusByContentId(
    contentId: string,
    isEmbedded: boolean
  ) {
    const updated = await this.contents.updateByContentId(contentId, {
      isEmbedded,
    });
    if (!updated) throw new Error("Content not found");
    return updated;
  }

  /**
   * Assign content to one or multiple classes
   * Replaces all existing class assignments with the provided classIds
   */
  async assignContentToClasses(
    contentId: string,
    classIds: string[],
    tenantId: string,
    teacherId: string
  ) {
    // First, verify the content exists and belongs to the teacher
    const content = await this.contents.findById(
      contentId,
      tenantId,
      teacherId
    );
    if (!content) {
      throw new Error("Content not found");
    }

    // Convert incoming classIds to ObjectIds (remove duplicates)
    const uniqueClassIds = [...new Set(classIds)];
    const newClassIds = uniqueClassIds.map((id) => new ObjectId(id));

    // Update content with new assigned classes (replaces all existing)
    const updated = await this.contents.updateById(
      contentId,
      tenantId,
      teacherId,
      {
        assignedClassIds: newClassIds,
        isAssigned: newClassIds.length > 0,
      } as any
    );

    if (!updated) {
      throw new Error("Content not found");
    }

    // ===== SEND NOTIFICATIONS FOR CONTENT ASSIGNMENT =====
    // Send notifications to students and teacher when content is assigned to classes
    if (uniqueClassIds.length > 0) {
      try {
        const tenantIdString = tenantId?.toString ? tenantId.toString() : String(tenantId);
        const teacherIdString = teacherId?.toString ? teacherId.toString() : String(teacherId);
        const contentTitle = updated.title || updated.fileName || "Content";
        const notifications: notificationService.INotificationRequest[] = [];

        // Validate teacherId is a valid ObjectId
        if (!teacherIdString || !mongoose.Types.ObjectId.isValid(teacherIdString)) {
          console.warn("⚠️ Invalid teacherId, skipping notifications:", teacherIdString);
          return updated;
        }

        // Validate tenantId is a valid ObjectId
        if (!tenantIdString || !mongoose.Types.ObjectId.isValid(tenantIdString)) {
          console.warn("⚠️ Invalid tenantId, skipping notifications:", tenantIdString);
          return updated;
        }

        // Collect all students from all assigned classes
        const allStudentIds = new Set<string>();
        const classNames: string[] = [];

        // Get students from each class and collect class names
        for (const classId of uniqueClassIds) {
          try {
            // Validate classId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(classId)) {
              console.warn(`⚠️ Invalid classId format, skipping: ${classId}`);
              continue;
            }

            // Get class name
            const classData = await this.classRepository.findById(classId, tenantId);
            if (classData) {
              classNames.push(classData.name || `Class ${classId}`);
            }

            // Get all students in this class
            const students = await studentRepository.findStudentsByClass(
              classId,
              tenantId
            );

            // Collect student user IDs (validate they are valid ObjectIds)
            students.forEach((student) => {
              const studentUserId = student.userId?.toString() || student._id.toString();
              // Only add if it's a valid ObjectId format
              if (studentUserId && mongoose.Types.ObjectId.isValid(studentUserId)) {
                allStudentIds.add(studentUserId);
              } else {
                console.warn(`⚠️ Invalid student userId format, skipping: ${studentUserId}`);
              }
            });
          } catch (classError: any) {
            console.warn(`⚠️ Could not fetch students for class ${classId}:`, classError.message);
          }
        }

        const classesText = classNames.length > 0
          ? classNames.join(", ")
          : `${uniqueClassIds.length} class(es)`;

        // 1. Send notifications to all students in assigned classes
        allStudentIds.forEach((studentUserId) => {
          notifications.push({
            receiverId: studentUserId,
            receiverRole: "STUDENT",
            title: "New Content Assigned",
            content: `New content "${contentTitle}" has been assigned to your class(es): ${classesText}.`,
            senderId: teacherIdString,
            senderRole: "TEACHER",
            tenantId: tenantIdString,
            meta: {
              entityId: contentId,
              entityType: "Content",
              contentId: contentId,
              contentTitle: contentTitle,
              classIds: uniqueClassIds,
              classNames: classNames,
            },
          });
        });

        // 2. Send notification to teacher who assigned the content
        notifications.push({
          receiverId: teacherIdString,
          receiverRole: "TEACHER",
          title: "Content Assigned Successfully",
          content: `You have successfully assigned "${contentTitle}" to ${uniqueClassIds.length} class(es): ${classesText}. ${allStudentIds.size} student(s) have been notified.`,
          senderId: undefined, // No sender for system notifications
          senderRole: "SYSTEM",
          tenantId: tenantIdString,
          meta: {
            entityId: contentId,
            entityType: "Content",
            contentId: contentId,
            contentTitle: contentTitle,
            classIds: uniqueClassIds,
            classNames: classNames,
            studentCount: allStudentIds.size,
          },
        });

        // Send all notifications in batches (API limit is 100)
        if (notifications.length > 0) {
          console.log(`📤 Sending ${notifications.length} notification(s) for content assignment...`);
          const batchSize = 100;
          for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);
            notificationService
              .sendNotifications(batch)
              .then((result) => {
                console.log(
                  `✅ Successfully sent notification batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(notifications.length / batchSize)}`
                );
              })
              .catch((notificationError: any) => {
                console.error(
                  `⚠️ Failed to send notification batch ${Math.floor(i / batchSize) + 1}:`,
                  notificationError.message
                );
              });
          }
        }
      } catch (notificationError: any) {
        // Log error but don't fail the content assignment
        console.error(
          "⚠️ Error preparing content assignment notifications:",
          notificationError.message
        );
      }
    }

    return updated;
  }

  /**
   * Unassign content from one or multiple classes
   */
  async unassignContentFromClasses(
    contentId: string,
    classIds: string[],
    tenantId: string,
    teacherId: string
  ) {
    // First, verify the content exists and belongs to the teacher
    const content = await this.contents.findById(
      contentId,
      tenantId,
      teacherId
    );
    if (!content) {
      throw new Error("Content not found");
    }

    // Get current assigned classes - normalize to strings for comparison
    const currentAssignedClassIds = (content.assignedClassIds || []).map(
      (id: any) => {
        // Handle both ObjectId and string formats
        if (id && typeof id === "object" && id.toString) {
          return id.toString();
        }
        return String(id);
      }
    );

    // Filter out the classes to be unassigned
    const remainingClassIds = currentAssignedClassIds.filter(
      (id) => !classIds.includes(id)
    );

    // Convert remaining IDs to ObjectIds - get original ObjectIds from content
    const updatedClassIds = (content.assignedClassIds || [])
      .filter((id: any) => {
        const idStr =
          id && typeof id === "object" && id.toString
            ? id.toString()
            : String(id);
        return remainingClassIds.includes(idStr);
      })
      .map((id: any) => {
        // Ensure we return ObjectId instances
        if (id instanceof ObjectId) {
          return id;
        }
        if (id && typeof id === "object" && id.toString) {
          return new ObjectId(id.toString());
        }
        return new ObjectId(String(id));
      });

    // Update content - remove classes and update isAssigned status
    const updated = await this.contents.updateById(
      contentId,
      tenantId,
      teacherId,
      {
        assignedClassIds: updatedClassIds,
        isAssigned: updatedClassIds.length > 0,
      } as any
    );

    if (!updated) {
      throw new Error("Content not found");
    }

    return updated;
  }

  /**
   * Get assigned content for a student
   * Returns content that is assigned to all of the student's active/promoted classes
   */
  async getStudentAssignedContent(
    studentId: string,
    tenantId: string,
    params: {
      pageNo?: number;
      pageSize?: number;
      query?: Record<string, any>;
      sort?: Record<string, SortOrder>;
    }
  ) {
    // Import repositories dynamically to avoid circular dependency
    const classStudentRepository = await import(
      "../repositories/classStudent.repository"
    );
    const mongoose = await import("mongoose");

    // Get all ClassStudent records for this student (query by studentId only)
    // We'll verify tenantId through the Class relationship
    const classStudentRecords = await classStudentRepository.findByStudent(
      studentId,
      undefined // Don't filter by tenantId - verify through Class instead
    );

    // Filter to only include active and promoted enrollments
    const activeAndPromotedRecords = classStudentRecords.filter(
      (record) =>
        record.enrollmentStatus === "active" ||
        record.enrollmentStatus === "promoted"
    );

    // If student has no active/promoted classes, return empty result
    if (!activeAndPromotedRecords || activeAndPromotedRecords.length === 0) {
      return {
        items: [],
        total: 0,
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 10,
      };
    }

    // Separate active and promoted records for different date filtering logic
    const activeRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "active"
    );
    const promotedRecords = activeAndPromotedRecords.filter(
      (record) => record.enrollmentStatus === "promoted"
    );

    // Get class IDs (handle both ObjectId and string)
    const classIds = activeAndPromotedRecords.map((record) => {
      const classId = record.classId;
      return classId instanceof mongoose.Types.ObjectId
        ? classId.toString()
        : classId.toString();
    });

    // Verify classes belong to the tenant by querying Class collection
    const { Class } = await import("../models/class.schema");
    const validClasses = await Class.find({
      _id: { $in: classIds.map(id => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    }).select("_id").lean();

    // Extract valid classIds (only those belonging to the tenant)
    const validClassIds = validClasses.map((cls: any) => cls._id.toString());

    // If no valid classes found, return empty result
    if (validClassIds.length === 0) {
      return {
        items: [],
        total: 0,
        pageNo: params.pageNo || 1,
        pageSize: params.pageSize || 10,
      };
    }

    // Handle classId filter if provided in query params
    let filteredClassIds = validClassIds;
    if (params.query) {
      // Check if classId filter is provided (after buildQueryFromRequest processing)
      // It could be: query.classId.$eq or query.classId (direct value, string or ObjectId)
      let requestedClassId: string | null = null;

      if (params.query.classId?.$eq) {
        // Handle $eq operator format
        const classIdValue = params.query.classId.$eq;
        requestedClassId = classIdValue?.toString() || null;
      } else if (params.query.classId) {
        // Handle direct value (could be string, ObjectId, or other)
        const classIdValue = params.query.classId;
        if (typeof classIdValue === 'string') {
          requestedClassId = classIdValue;
        } else if (classIdValue && typeof classIdValue === 'object' && 'toString' in classIdValue) {
          // Handle ObjectId or similar objects
          requestedClassId = classIdValue.toString();
        }
      }

      // If classId filter is provided, validate and filter
      if (requestedClassId) {
        // Normalize to string for comparison
        const normalizedRequestedId = requestedClassId.toString();

        // Validate that the requested classId is one of the student's valid classes
        if (validClassIds.includes(normalizedRequestedId)) {
          filteredClassIds = [normalizedRequestedId];
        } else {
          // Requested classId is not in student's classes - return empty result
          return {
            items: [],
            total: 0,
            pageNo: params.pageNo || 1,
            pageSize: params.pageSize || 10,
          };
        }
      }

      // Remove classId from query params since we're filtering at the classIds level
      // This prevents it from being applied again in the repository
      const { classId, ...queryWithoutClassId } = params.query;
      params.query = queryWithoutClassId;
    }

    // Separate filtered classIds into active and promoted
    const activeClassIds = activeRecords
      .map((record) => {
        const classId = record.classId;
        return classId instanceof mongoose.Types.ObjectId
          ? classId.toString()
          : classId.toString();
      })
      .filter((id) => validClassIds.includes(id) && filteredClassIds.includes(id));

    const promotedClassIdsWithDates = promotedRecords
      .map((record) => {
        const classId = record.classId;
        const classIdStr = classId instanceof mongoose.Types.ObjectId
          ? classId.toString()
          : classId.toString();
        return {
          classId: classIdStr,
          promotionDate: record.updatedAt || record.createdAt, // Use updatedAt (when status changed) or createdAt as fallback
        };
      })
      .filter((item) => validClassIds.includes(item.classId) && filteredClassIds.includes(item.classId));

    // Query content for active classes (no date restriction)
    let activeContentResult: {
      items: IContentLibraryContent[];
      total: number;
      pageNo: number;
      pageSize: number;
    } = { items: [], total: 0, pageNo: params.pageNo || 1, pageSize: params.pageSize || 10 };
    if (activeClassIds.length > 0) {
      activeContentResult = await this.contents.findAllByAssignedClassIds(
        activeClassIds,
        tenantId,
        params
      );
    }

    // Query content for promoted classes (with date restriction)
    let promotedContentResults: any[] = [];
    if (promotedClassIdsWithDates.length > 0) {
      // Query each promoted class separately with date filter
      const promotedQueries = promotedClassIdsWithDates.map(({ classId, promotionDate }) => {
        // Ensure promotionDate is a Date object
        const promotionDateObj = promotionDate instanceof Date
          ? promotionDate
          : new Date(promotionDate);

        // Create a modified params with date filter for this specific class
        const promotedParams = {
          ...params,
          query: {
            ...params.query,
            createdAt: { $lte: promotionDateObj }, // Only content created before/at promotion date
          },
        };
        return this.contents.findAllByAssignedClassIds(
          [classId],
          tenantId,
          promotedParams
        );
      });

      const promotedResults = await Promise.all(promotedQueries);
      promotedContentResults = promotedResults.flatMap((result) => result.items);
    }

    // Combine active and promoted content, then deduplicate
    const allContentItems = [...activeContentResult.items, ...promotedContentResults];

    // Deduplicate by content _id (in case same content appears in multiple classes)
    const seenContentIds = new Set<string>();
    const uniqueContentItems = allContentItems.filter((item: any) => {
      const contentId = item._id?.toString() || item.id?.toString();
      if (!contentId || seenContentIds.has(contentId)) {
        return false;
      }
      seenContentIds.add(contentId);
      return true;
    });

    // Apply sorting to combined results
    const hasSort = params.sort && Object.keys(params.sort).length > 0;
    const sort: Record<string, SortOrder> = hasSort
      ? params.sort!
      : ({ createdAt: -1 } as Record<string, SortOrder>);

    // Sort the combined results
    uniqueContentItems.sort((a: any, b: any) => {
      for (const [key, direction] of Object.entries(sort)) {
        const aValue = a[key];
        const bValue = b[key];
        if (aValue === undefined && bValue === undefined) continue;
        if (aValue === undefined) return direction === 1 ? 1 : -1;
        if (bValue === undefined) return direction === 1 ? -1 : 1;

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        if (comparison !== 0) {
          return direction === 1 || direction === "asc" || direction === "ascending"
            ? comparison
            : -comparison;
        }
      }
      return 0;
    });

    // Apply pagination to sorted results
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;
    const skip = (pageNo - 1) * pageSize;
    const paginatedItems = uniqueContentItems.slice(skip, skip + pageSize);

    // Create result object
    const result = {
      items: paginatedItems,
      total: uniqueContentItems.length,
      pageNo,
      pageSize,
    };

    // Get set of content IDs that are in one or more student folders (for isFolder)
    const studentFolderRepository = await import("../repositories/studentFolder.repository");
    const folders = await studentFolderRepository.findByStudent(studentId, tenantId);
    const contentIdsInFolders = new Set<string>();
    for (const f of folders) {
      for (const cid of f.contentIds || []) {
        contentIdsInFolders.add(
          cid instanceof mongoose.Types.ObjectId ? cid.toString() : String(cid)
        );
      }
    }

    // Get set of content IDs the student has read (for isRead badge)
    const contentIdsForRead = result.items.map(
      (c: any) => c._id?.toString?.() ?? c.id?.toString?.() ?? ""
    ).filter(Boolean);
    const { StudentContentReadRepository } = await import("../repositories/studentContentRead.repository");
    const readRepo = new StudentContentReadRepository();
    const readContentIds = await readRepo.getReadContentIds(studentId, contentIdsForRead);

    // Convert _id to id for all items (Mongoose lean() returns _id)
    const formattedItems = result.items.map((content: any) => {
      const plainContent = { ...content };
      const contentId = plainContent._id?.toString?.() ?? plainContent.id;
      if (plainContent._id && !plainContent.id) {
        plainContent.id = contentId;
        delete plainContent._id;
      }
      delete plainContent.__v;
      // Ensure isEmbedded defaults to false if not set
      if (plainContent.isEmbedded === undefined) {
        plainContent.isEmbedded = false;
      }
      // Ensure isAssigned defaults to true if not set (since we're querying assigned content)
      if (plainContent.isAssigned === undefined) {
        plainContent.isAssigned = true;
      }
      // isFolder: true if content is in one or more student folders
      plainContent.isFolder = contentIdsInFolders.has(contentId ?? "");
      // isRead: true if student has opened this content (from student_content_reads)
      plainContent.isRead = readContentIds.has(contentId ?? "");
      return plainContent;
    });

    return {
      items: formattedItems,
      total: result.total,
      pageNo: result.pageNo,
      pageSize: result.pageSize,
    };
  }

  /**
   * Get assigned-content stats for a student (total, by subject, by file type).
   * Uses same class/subject filtering as getStudentAssignedContent but returns aggregates only.
   */
  async getStudentAssignedContentStats(
    studentId: string,
    tenantId: string,
    params?: { query?: Record<string, any> }
  ): Promise<{
    totalContents: number;
    totalSubjects: number;
    bySubject: Array<{
      subjectId: string;
      subjectName: string | null;
      count: number;
      unreadCount?: number;
      totalSizeInBytes: number;
      teachers: Array<{ id: string; name: string }>;
      byFileType: {
        pdf: number;
        doc: number;
        ppt: number;
        other: { images: number; txt: number; md: number; all: number };
      };
    }>;
    byFileType: {
      pdf: number;
      doc: number;
      ppt: number;
      other: { images: number; txt: number; md: number; all: number };
    };
  }> {
    const emptyOther = { images: 0, txt: 0, md: 0, all: 0 };
    const classStudentRepository = await import("../repositories/classStudent.repository");
    const mongoose = await import("mongoose");

    const classStudentRecords = await classStudentRepository.findByStudent(studentId, undefined);
    const activeAndPromotedRecords = classStudentRecords.filter(
      (r) => r.enrollmentStatus === "active" || r.enrollmentStatus === "promoted"
    );

    if (!activeAndPromotedRecords.length) {
      return {
        totalContents: 0,
        totalSubjects: 0,
        bySubject: [],
        byFileType: { pdf: 0, doc: 0, ppt: 0, other: emptyOther },
      };
    }

    const classIds = activeAndPromotedRecords.map((r) =>
      r.classId instanceof mongoose.Types.ObjectId ? r.classId.toString() : r.classId.toString()
    );

    const { Class } = await import("../models/class.schema");
    const validClasses = await Class.find({
      _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    })
      .select("_id")
      .lean();

    const validClassIds = validClasses.map((cls: any) => cls._id.toString());
    if (validClassIds.length === 0) {
      return {
        totalContents: 0,
        totalSubjects: 0,
        bySubject: [],
        byFileType: { pdf: 0, doc: 0, ppt: 0, other: emptyOther },
      };
    }

    let filteredClassIds = validClassIds;
    const query = params?.query || {};
    let requestedClassId: string | null = null;
    if (query.classId?.$eq) requestedClassId = query.classId.$eq?.toString() ?? null;
    else if (query.classId) requestedClassId = typeof query.classId === "string" ? query.classId : query.classId?.toString?.() ?? null;
    if (requestedClassId && validClassIds.includes(requestedClassId)) {
      filteredClassIds = [requestedClassId];
    }

    const statsQuery: Record<string, unknown> = {};
    if (query.subjectId?.$eq) statsQuery.subjectId = query.subjectId.$eq;
    else if (query.subjectId) statsQuery.subjectId = query.subjectId;
    if (query.subject?.$eq) statsQuery.subject = query.subject.$eq;
    else if (query.subject) statsQuery.subject = query.subject;

    const { total, totalUnread, bySubject, byFileType } = await this.contents.getAssignedContentStats(
      filteredClassIds,
      tenantId,
      { query: Object.keys(statsQuery).length ? statsQuery : undefined, studentId }
    );

    // When not filtering by subjectId, include all subjects for the class(es) with 0 counts where nothing is assigned
    const isFilteringBySubject = !!(query.subjectId || query.subjectId__eq);
    if (!isFilteringBySubject) {
      const { Class: ClassModel } = await import("../models/class.schema");
      const { Subject } = await import("../models/subject.schema");
      const classesWithSubjects = await ClassModel.find({
        _id: { $in: filteredClassIds.map((id) => new mongoose.Types.ObjectId(id)) },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .select("_id subjectIds")
        .lean();
      const classStudentMap = new Map<string, { subjectIds?: unknown[] }>();
      activeAndPromotedRecords.forEach((rec) => {
        const cid = rec.classId instanceof mongoose.Types.ObjectId ? rec.classId.toString() : (rec.classId as any)?.toString?.();
        if (cid && filteredClassIds.includes(cid)) classStudentMap.set(cid, rec);
      });
      const allSubjectIds = new Set<string>();
      for (const cls of classesWithSubjects) {
        const classIdStr = (cls as any)._id?.toString?.();
        const classStudentRec = classIdStr ? classStudentMap.get(classIdStr) : null;
        const subjectIds = (classStudentRec?.subjectIds && Array.isArray(classStudentRec.subjectIds) && classStudentRec.subjectIds.length > 0)
          ? classStudentRec.subjectIds
          : (cls as any).subjectIds;
        if (Array.isArray(subjectIds)) {
          subjectIds.forEach((sid: any) => allSubjectIds.add(sid?.toString?.() ?? sid));
        }
      }
      const subjectIdList = Array.from(allSubjectIds).filter((id) => id && mongoose.Types.ObjectId.isValid(id));
      const subjectsList =
        subjectIdList.length > 0
          ? await Subject.find({
              _id: { $in: subjectIdList.map((id) => new mongoose.Types.ObjectId(id)) },
              isDeleted: false,
            })
              .select("_id name")
              .lean()
          : [];
      const subjectNameById = new Map<string, string | null>();
      subjectsList.forEach((s: any) => {
        const id = s._id?.toString?.();
        if (id) subjectNameById.set(id, s.name ?? null);
      });

      const bySubjectMap = new Map<string, typeof bySubject[0]>();
      bySubject.forEach((s) => bySubjectMap.set(s.subjectId, s));
      const zeroByFileType = {
        pdf: 0,
        doc: 0,
        ppt: 0,
        other: emptyOther,
      };
      const mergedBySubject: typeof bySubject = [];
      for (const subjectId of subjectIdList) {
        const existing = bySubjectMap.get(subjectId);
        if (existing) {
          mergedBySubject.push(existing);
        } else {
          mergedBySubject.push({
            subjectId,
            subjectName: subjectNameById.get(subjectId) ?? null,
            count: 0,
            unreadCount: 0,
            totalSizeInBytes: 0,
            teachers: [],
            byFileType: zeroByFileType,
          });
        }
      }
      mergedBySubject.sort((a, b) => (a.subjectName ?? "").localeCompare(b.subjectName ?? ""));

      return {
        totalContents: total,
        totalSubjects: mergedBySubject.length,
        ...(totalUnread !== undefined && { totalUnread }),
        bySubject: mergedBySubject,
        byFileType,
      };
    }

    return {
      totalContents: total,
      totalSubjects: bySubject.length,
      ...(totalUnread !== undefined && { totalUnread }),
      bySubject,
      byFileType,
    };
  }

  /**
   * Check if a content item is in the student's assigned content (by class assignment).
   * Used when adding content to student folders.
   */
  async isContentAssignedToStudent(
    studentId: string,
    tenantId: string,
    contentId: string
  ): Promise<boolean> {
    const classStudentRepository = await import(
      "../repositories/classStudent.repository"
    );
    const mongoose = await import("mongoose");
    const { ContentLibraryContent } = await import("../models/contentLibraryContent.schema");
    const { Class } = await import("../models/class.schema");

    const classStudentRecords = await classStudentRepository.findByStudent(studentId, undefined);
    const activeAndPromoted = classStudentRecords.filter(
      (r) => r.enrollmentStatus === "active" || r.enrollmentStatus === "promoted"
    );
    if (activeAndPromoted.length === 0) return false;

    const classIds = activeAndPromoted.map((r) =>
      r.classId instanceof mongoose.Types.ObjectId ? r.classId.toString() : (r.classId as any).toString()
    );
    const validClasses = await Class.find({
      _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    })
      .select("_id")
      .lean();
    const validClassIds = validClasses.map((c: any) => c._id);
    if (validClassIds.length === 0) return false;

    const content = await ContentLibraryContent.findOne({
      _id: new mongoose.Types.ObjectId(contentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      assignedClassIds: { $in: validClassIds },
      isAssigned: true,
      isDeleted: false,
    })
      .select("_id")
      .lean();
    return !!content;
  }

  /**
   * Mark assigned content as read for a student (upsert into student_content_reads).
   * Only allowed if the content is actually assigned to the student.
   */
  async markAssignedContentAsRead(
    studentId: string,
    contentId: string,
    tenantId: string
  ): Promise<{ marked: boolean; message: string }> {
    const assigned = await this.isContentAssignedToStudent(studentId, tenantId, contentId);
    if (!assigned) {
      return { marked: false, message: "Content is not assigned to this student" };
    }
    const { StudentContentReadRepository } = await import("../repositories/studentContentRead.repository");
    const readRepo = new StudentContentReadRepository();
    await readRepo.upsertRead(studentId, contentId, tenantId);
    return { marked: true, message: "Content marked as read" };
  }
}

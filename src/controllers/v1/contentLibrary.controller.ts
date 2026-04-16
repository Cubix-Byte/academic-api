import { Request, Response } from "express";
import { ContentLibraryService } from "@/services/contentLibrary.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
  buildQueryFromRequest,
} from "shared-lib";
import { defaultPageLimit } from "shared-lib";

export class ContentLibraryController {
  private service: ContentLibraryService;

  constructor() {
    this.service = new ContentLibraryService();
  }

  // Folders
  createFolder = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      if (!tenantId || !teacherId) {
        sendErrorResponse(
          res,
          "Tenant/Teacher missing",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }
      const createdBy = req.user?.email || req.user?.username || "system";
      const result = await this.service.createFolder({
        name: req.body.name,
        tenantId,
        teacherId,
        createdBy,
      });
      sendSuccessResponse(res, "Folder created", result);
    } catch (e) {
      const statusCode =
        (e as any)?.statusCode || HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to create folder",
        statusCode
      );
    }
  };

  listFolders = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;

      // Extract pagination parameters - Using defaultPageLimit from shared-lib
      const pageNo = Number(req.query.pageNo) || defaultPageLimit;
      const pageSize = Number(req.query.pageSize) || defaultPageLimit;

      // Build a dynamic query and sort from filter parameter
      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return;

      let { query, sort } = queryResult;

      const result = await this.service.listFolders(tenantId, teacherId, {
        pageNo,
        pageSize,
        query,
        sort,
      });
      sendSuccessResponse(res, "Folders fetched", result);
    } catch (e) {
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to fetch folders",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  listFoldersWithContents = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const authToken = req.headers.authorization;

      // Extract pagination parameters - Using defaultPageLimit from shared-lib
      const pageNo = Number(req.query.pageNo) || defaultPageLimit;
      const pageSize = Number(req.query.pageSize) || defaultPageLimit;

      // Extract content search parameter
      const contentSearch = req.query.contentSearch as string | undefined;

      // Build a dynamic query and sort from filter parameter
      const queryResult = buildQueryFromRequest(req, res);
      if (!queryResult) return;

      let { query, sort } = queryResult;

      const result = await this.service.listFoldersWithContents(
        tenantId,
        teacherId,
        {
          pageNo,
          pageSize,
          query,
          sort,
          contentSearch,
        },
        authToken
      );
      sendSuccessResponse(res, "Folders with contents fetched", result);
    } catch (e) {
      sendErrorResponse(
        res,
        e instanceof Error
          ? e.message
          : "Failed to fetch folders with contents",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  getFolder = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const result = await this.service.getFolder(id, tenantId, teacherId);
      sendSuccessResponse(res, "Folder fetched", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to get folder",
        code
      );
    }
  };

  renameFolder = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const result = await this.service.renameFolder(
        id,
        tenantId,
        teacherId,
        name
      );
      sendSuccessResponse(res, "Folder renamed", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to rename folder",
        code
      );
    }
  };

  deleteFolder = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      await this.service.deleteFolder(id, tenantId, teacherId);
      sendSuccessResponse(res, "Folder deleted");
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to delete folder",
        code
      );
    }
  };

  // Contents
  addContent = async (req: Request, res: Response) => {
    console.log("[ACADEMIC API] addContent - Controller START", {
      body: req.body,
      user: {
        tenantId: req.user?.tenantId,
        teacherId: req.user?.id || (req.user as any)?.userId,
        email: req.user?.email,
      },
      timestamp: new Date().toISOString(),
    });

    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const createdBy = req.user?.email || req.user?.username || "system";
      const authToken = req.headers.authorization; // Get auth token for AI API call

      const payload = {
        tenantId,
        teacherId,
        contentLibraryId: req.body.contentLibraryId,
        contentId: req.body.contentId,
        fileName: req.body.fileName,
        filePath: req.body.filePath,
        fileType: req.body.fileType,
        fileSizeInBytes: req.body.fileSizeInBytes,
        subject: req.body.subject,
        subjectId: req.body.subjectId,
        grade: req.body.grade,
        title: req.body.title,
        description: req.body.description,
        isEmbedded: req.body.isEmbedded,
        videoId: req.body.videoId,
        videoPath: req.body.videoPath,
        targetLanguage: req.body.targetLanguage,
        createdBy,
        ingestType: req.body.ingestType,
      };

      console.log("[ACADEMIC API] addContent - Calling service", {
        payload: {
          ...payload,
        },
        hasAuthToken: !!authToken,
        targetLanguageFromPayload: payload.targetLanguage,
        timestamp: new Date().toISOString(),
      });

      const result = await this.service.addContent(payload, authToken);

      console.log("[ACADEMIC API] addContent - Service response", {
        resultId: result.id || result._id,
        fileName: result.fileName,
        contentId: result.contentId,
        timestamp: new Date().toISOString(),
      });

      sendSuccessResponse(res, "Content added", result);
    } catch (e) {
      console.error("[ACADEMIC API] addContent - ERROR", {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to add content",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  listContents = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const { contentLibraryId } = req.query as any;
      const authToken = req.headers.authorization;
      const result = await this.service.listContents(
        contentLibraryId,
        tenantId,
        teacherId,
        req.query.search as string,
        authToken
      );
      sendSuccessResponse(res, "Contents fetched", result);
    } catch (e) {
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to list contents",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  getContent = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const authToken = req.headers.authorization;
      const result = await this.service.getContent(
        req.params.id,
        tenantId,
        teacherId,
        authToken
      );
      sendSuccessResponse(res, "Content fetched", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to get content",
        code
      );
    }
  };

  renameContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { fileName } = req.body;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const result = await this.service.renameContent(
        id,
        tenantId,
        teacherId,
        fileName
      );
      sendSuccessResponse(res, "Content renamed", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to rename content",
        code
      );
    }
  };

  updateContentMeta = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const result = await this.service.updateContentMeta(
        id,
        tenantId,
        teacherId,
        req.body
      );
      sendSuccessResponse(res, "Content updated", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to update content",
        code
      );
    }
  };

  deleteContent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      await this.service.deleteContent(id, tenantId, teacherId);
      sendSuccessResponse(res, "Content deleted");
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to delete content",
        code
      );
    }
  };

  assignContentToClasses = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { classIds } = req.body;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;

      // Allow classIds to be null/undefined or empty array - normalize to empty array
      // If provided, it must be an array
      let normalizedClassIds: string[] = [];
      if (classIds !== null && classIds !== undefined) {
        if (!Array.isArray(classIds)) {
          sendErrorResponse(
            res,
            "Class IDs must be an array",
            HttpStatusCodes.BAD_REQUEST
          );
          return;
        }
        normalizedClassIds = classIds;
      }

      const result = await this.service.assignContentToClasses(
        id,
        normalizedClassIds,
        tenantId,
        teacherId
      );
      const message =
        normalizedClassIds.length === 0
          ? "All class assignments removed from content"
          : "Content assigned to classes";
      sendSuccessResponse(res, message, result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to assign content to classes",
        code
      );
    }
  };

  unassignContentFromClasses = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { classIds } = req.body;
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;

      if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
        sendErrorResponse(
          res,
          "Class IDs array is required and must not be empty",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.service.unassignContentFromClasses(
        id,
        classIds,
        tenantId,
        teacherId
      );
      sendSuccessResponse(res, "Content unassigned from classes", result);
    } catch (e) {
      const code =
        e instanceof Error && e.message.includes("not found")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      sendErrorResponse(
        res,
        e instanceof Error
          ? e.message
          : "Failed to unassign content from classes",
        code
      );
    }
  };

  bulkAddContent = async (req: Request, res: Response) => {
    console.log("[ACADEMIC API] bulkAddContent - Controller START", {
      body: req.body,
      user: {
        tenantId: req.user?.tenantId,
        teacherId: req.user?.id || (req.user as any)?.userId,
        email: req.user?.email,
      },
      timestamp: new Date().toISOString(),
    });

    try {
      const tenantId = req.user?.tenantId as string;
      const teacherId = req.user?.id || (req.user as any)?.userId;
      const createdBy = req.user?.email || req.user?.username || "system";
      const authToken = req.headers.authorization;

      const { contentLibraryId, contents } = req.body;

      if (!contentLibraryId) {
        sendErrorResponse(
          res,
          "contentLibraryId is required",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      if (!contents || !Array.isArray(contents) || contents.length === 0) {
        sendErrorResponse(
          res,
          "contents array is required and must not be empty",
          HttpStatusCodes.BAD_REQUEST
        );
        return;
      }

      const result = await this.service.bulkAddContent(
        {
          tenantId,
          teacherId,
          contentLibraryId,
          contents: contents,
          createdBy,
        },
        authToken
      );

      console.log("[ACADEMIC API] bulkAddContent - Controller SUCCESS", {
        successCount: result.successCount,
        errorCount: result.errorCount,
        timestamp: new Date().toISOString(),
      });

      sendSuccessResponse(
        res,
        `${result.successCount} content(s) added successfully${
          result.errorCount > 0 ? `, ${result.errorCount} failed` : ""
        }`,
        result
      );
    } catch (e) {
      console.error("[ACADEMIC API] bulkAddContent - Controller ERROR", {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      sendErrorResponse(
        res,
        e instanceof Error ? e.message : "Failed to add contents",
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}

export default new ContentLibraryController();

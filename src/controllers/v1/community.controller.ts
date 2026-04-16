import { Request, Response } from "express";
import {
  sendSuccessResponse,
  sendErrorResponse,
  HttpStatusCodes,
} from "../../utils/shared-lib-imports";
import * as communityService from "../../services/community.service";
import * as communityPostService from "../../services/communityPost.service";
import * as communityCommentService from "../../services/communityComment.service";
import mongoose from "mongoose";

export const getMyCommunities = async (req: Request, res: Response) => {
  try {
    const {
      _id,
      id,
      userId: tokenUserId,
      tenantId,
      userType,
      userRole,
      roleName,
    } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";
    const role = (userRole || roleName || userType || "USER").toUpperCase();

    const communities = await communityService.getMyCommunities(
      userId,
      tenantId?.toString() || "",
      role,
    );
    return sendSuccessResponse(
      res,
      "Communities fetched successfully",
      communities,
    );
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const createClubCommunity = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const { _id, id, userId, tenantId, userType, userRole, roleName } =
      (req.user || {}) as any;

    const role = (userRole || roleName || userType || "").toUpperCase();

    if (!["PRIMARYADMIN", "ADMIN", "ACADEMICADMIN"].includes(role)) {
      return sendErrorResponse(
        res,
        "Only admins can create communities.",
        HttpStatusCodes.FORBIDDEN,
      );
    }

    const newClub = await communityService.createClubCommunity({
      name,
      description,
      tenantId: tenantId?.toString() || "",
      createdById:
        (_id || id || userId)?.toString() ||
        new mongoose.Types.ObjectId().toString(),
    });

    return sendSuccessResponse(res, "Community created successfully", newClub);
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const getCommunityMembers = async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const { tenantId, userType, userRole, roleName } = (req.user || {}) as any;
    const role = (userRole || roleName || userType || "USER").toUpperCase();

    const members = await communityService.getCommunityMembers(
      communityId,
      tenantId?.toString() || "",
      role,
    );
    return sendSuccessResponse(res, "Members fetched successfully", members);
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.FORBIDDEN);
  }
};

export const addClubMember = async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const {
      userId,
      firstName,
      lastName,
      userType: memberType,
      profilePicture,
    } = req.body;
    const {
      _id,
      id,
      userId: tokenUserId,
      tenantId,
      userType,
      userRole,
      roleName,
    } = (req.user || {}) as any;
    const role = (userRole || roleName || userType || "").toUpperCase();

    if (!["PRIMARYADMIN", "ADMIN", "ACADEMICADMIN"].includes(role)) {
      return sendErrorResponse(
        res,
        "Only admins can add members to a club.",
        HttpStatusCodes.FORBIDDEN,
      );
    }

    const member = await communityService.addClubMember(
      communityId,
      userId,
      tenantId?.toString() || "",
      (_id || id || tokenUserId)?.toString() || "",
      { firstName, lastName, userType: memberType, profilePicture },
    );
    return sendSuccessResponse(res, "Member added successfully", member);
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const removeClubMember = async (req: Request, res: Response) => {
  try {
    const { id: communityId, userId } = req.params;
    const { userType, userRole, roleName } = (req.user || {}) as any;
    const role = (userRole || roleName || userType || "").toUpperCase();

    if (!["PRIMARYADMIN", "ADMIN", "ACADEMICADMIN"].includes(role)) {
      return sendErrorResponse(
        res,
        "Only admins can remove members.",
        HttpStatusCodes.FORBIDDEN,
      );
    }

    await communityService.removeClubMember(communityId, userId);
    return sendSuccessResponse(res, "Member removed successfully");
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

/**
 * ==========================================
 * POST MANAGEMENT
 * ==========================================
 */

export const getCommunityFeed = async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const { _id, id, userId: tokenUserId } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";
    const pageNo = parseInt(req.query.pageNo as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const data = await communityPostService.getCommunityFeed(
      communityId,
      userId,
      { pageNo, pageSize },
    );
    return sendSuccessResponse(res, "Feed fetched successfully", data);
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const { id: communityId } = req.params;
    const {
      content,
      attachments,
      firstName: bodyFirstName,
      lastName: bodyLastName,
      profilePicture: bodyProfilePicture,
    } = req.body;
    const {
      _id,
      id,
      userId: tokenUserId,
      tenantId,
      firstName,
      lastName,
      userType,
      roleName,
      profilePicture,
    } = (req.user || {}) as any;
    const authorId = (_id || id || tokenUserId)?.toString() || "";

    const post = await communityPostService.createPost({
      communityId,
      authorId,
      tenantId: tenantId?.toString() || "",
      content,
      attachments,
      authorFirstName: bodyFirstName || firstName || "",
      authorLastName: bodyLastName || lastName || "",
      authorUserType: userType || roleName || "ADMIN",
      authorProfilePicture: bodyProfilePicture || profilePicture || "",
    });
    return sendSuccessResponse(res, "Post created successfully", post);
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.BAD_REQUEST);
  }
};

export const toggleLike = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { _id, id, userId: tokenUserId, tenantId } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";

    const result = await communityPostService.toggleLike(
      postId,
      userId,
      tenantId?.toString() || "",
    );
    return sendSuccessResponse(res, "Like toggled successfully", result);
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.BAD_REQUEST);
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const {
      _id,
      id,
      userId: tokenUserId,
      userType,
      userRole,
      roleName,
    } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";
    const role = (userRole || roleName || userType || "USER").toUpperCase();

    await communityPostService.deletePost(postId, userId, role);
    return sendSuccessResponse(res, "Post deleted successfully");
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.FORBIDDEN);
  }
};

export const editPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content, attachments } = req.body;
    const { _id, id, userId: tokenUserId } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";

    const post = await communityPostService.editPost(postId, userId, {
      content,
      attachments,
    });
    return sendSuccessResponse(res, "Post updated successfully", post);
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.FORBIDDEN);
  }
};

/**
 * ==========================================
 * COMMENT MANAGEMENT
 * ==========================================
 */

export const getComments = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { parentId } = req.query;
    const { _id, id, userId: tokenUserId } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";

    const comments = await communityCommentService.getComments(
      postId,
      parentId as string,
      userId,
    );
    return sendSuccessResponse(res, "Comments fetched successfully", comments);
  } catch (error: any) {
    return sendErrorResponse(
      res,
      error.message,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const {
      content,
      parentId,
      firstName: bodyFirstName,
      lastName: bodyLastName,
      profilePicture: bodyProfilePicture,
    } = req.body;
    const {
      _id,
      id,
      userId: tokenUserId,
      tenantId,
      firstName,
      lastName,
      userType,
      roleName,
      profilePicture,
    } = (req.user || {}) as any;
    const authorId = (_id || id || tokenUserId)?.toString() || "";

    const comment = await communityCommentService.createComment({
      postId,
      authorId,
      tenantId: tenantId?.toString() || "",
      content,
      parentId,
      authorFirstName: bodyFirstName || firstName || "",
      authorLastName: bodyLastName || lastName || "",
      authorUserType: userType || roleName || "ADMIN",
      authorProfilePicture: bodyProfilePicture || profilePicture || "",
    });
    return sendSuccessResponse(res, "Comment added successfully", comment);
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.BAD_REQUEST);
  }
};

export const toggleCommentLike = async (req: Request, res: Response) => {
  try {
    const { postId, commentId } = req.params;
    const { _id, id, userId: tokenUserId } = (req.user || {}) as any;
    const userId = (_id || id || tokenUserId)?.toString() || "";

    if (!userId) {
      return sendErrorResponse(
        res,
        "User validation failed.",
        HttpStatusCodes.UNAUTHORIZED,
      );
    }

    const { liked, likesCount } =
      await communityCommentService.toggleCommentLike(
        postId,
        commentId,
        userId,
      );

    return sendSuccessResponse(res, "Comment like toggled successfully", {
      liked,
      likesCount,
    });
  } catch (error: any) {
    return sendErrorResponse(res, error.message, HttpStatusCodes.BAD_REQUEST);
  }
};

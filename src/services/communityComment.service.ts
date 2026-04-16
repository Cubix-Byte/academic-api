import { CommunityComment, ICommunityComment, User } from "../models";
import { CommunityPost } from "../models";
import mongoose from "mongoose";

/**
 * Resolve author display details.
 */
async function resolveAuthorSnapshot(
  authorId: string,
  opts: {
    firstName?: string;
    lastName?: string;
    userType?: string;
    profilePicture?: string;
  },
) {
  const first = (opts.firstName || "").trim();
  const last = (opts.lastName || "").trim();

  if (first || last) {
    return {
      firstName: first,
      lastName: last,
      userType: opts.userType || "",
      profilePicture: opts.profilePicture || "",
    };
  }

  // Fallback: query the local User model
  try {
    if (mongoose.Types.ObjectId.isValid(authorId)) {
      const userDoc = (await User.findById(authorId)
        .select("firstName lastName userType profilePicture")
        .lean()) as any;
      if (userDoc) {
        return {
          firstName: (userDoc.firstName || "").trim(),
          lastName: (userDoc.lastName || "").trim(),
          userType: userDoc.userType || opts.userType || "",
          profilePicture: userDoc.profilePicture || opts.profilePicture || "",
        };
      }
    }
  } catch {
    // Ignore
  }

  return {
    firstName: "",
    lastName: "",
    userType: opts.userType || "",
    profilePicture: opts.profilePicture || "",
  };
}

/**
 * Adds a new comment (or reply) to a specific post.
 */
export const createComment = async (params: {
  postId: string;
  authorId: string;
  tenantId: string;
  content: string;
  parentId?: string;
  authorFirstName?: string;
  authorLastName?: string;
  authorUserType?: string;
  authorProfilePicture?: string;
}): Promise<ICommunityComment> => {
  const {
    postId,
    authorId,
    tenantId,
    content,
    parentId,
    authorFirstName,
    authorLastName,
    authorUserType,
    authorProfilePicture,
  } = params;

  const post = await CommunityPost.findById(postId);
  if (!post) throw new Error("Post not found.");

  const snap = await resolveAuthorSnapshot(authorId, {
    firstName: authorFirstName,
    lastName: authorLastName,
    userType: authorUserType,
    profilePicture: authorProfilePicture,
  });

  const newComment = await CommunityComment.create({
    postId,
    authorId,
    tenantId,
    content,
    parentId: parentId || null,
    createdBy: authorId,
    authorSnapshot: snap,
  });

  await CommunityPost.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } });

  const created = (await CommunityComment.findById(
    newComment._id,
  ).lean()) as any;
  const first = (snap.firstName || "").trim();
  const last = (snap.lastName || "").trim();
  const fullName = first || last ? `${first} ${last}`.trim() : "Unknown User";

  return {
    ...created,
    id: created._id.toString(),
    author: {
      id: authorId,
      firstName: first,
      lastName: last,
      fullName,
      userType: snap.userType,
      profilePicture: snap.profilePicture || undefined,
    },
  } as unknown as ICommunityComment;
};

/**
 * Retrieves comments for a specific post.
 */
export const getComments = async (
  postId: string,
  parentId?: string | null,
  userId?: string,
) => {
  const query: any = { postId, isActive: true };

  if (parentId !== undefined && parentId !== null) {
    query.parentId = parentId;
  }
  // If parentId is not provided, we fetch all comments for the post
  // so the frontend can build the nested thread tree.

  const comments = await CommunityComment.find(query)
    .sort({ createdAt: 1 })
    .lean();

  // Get all unique author IDs to fetch fresh profile pictures and data
  // Even if a snapshot exists, profile pictures might have been updated
  const authorIds = [
    ...new Set((comments as any[]).map((c) => c.authorId).filter((id) => id)),
  ];

  let userMap: Record<string, any> = {};
  if (authorIds.length > 0) {
    try {
      const users = (await User.find({ _id: { $in: authorIds } })
        .select("firstName lastName userType profilePicture")
        .lean()) as any[];
      for (const u of users) {
        userMap[u._id.toString()] = u;
      }
    } catch {
      /* Ignore */
    }
  }

  return (comments as any[]).map((comment) => {
    const snap = comment.authorSnapshot;
    const authorIdStr = comment.authorId?.toString();
    const u = userMap[authorIdStr ?? ""];

    const first = ((snap?.firstName || u?.firstName) ?? "").trim();
    const last = ((snap?.lastName || u?.lastName) ?? "").trim();
    const userType = snap?.userType || u?.userType || "member";
    const profilePicture = snap?.profilePicture || u?.profilePicture || "";
    const fullName = first || last ? `${first} ${last}`.trim() : "Unknown User";

    return {
      ...comment,
      id: comment._id.toString(),
      isLiked: userId
        ? (comment.likes || []).some((id: any) => id.toString() === userId)
        : false,
      likesCount: comment.likesCount || 0,
      author: {
        id: authorIdStr,
        firstName: first,
        lastName: last,
        fullName,
        userType,
        profilePicture,
      },
    };
  });
};

/**
 * Toggles a like on a given comment.
 */
export const toggleCommentLike = async (
  postId: string,
  commentId: string,
  userId: string,
) => {
  const comment = await CommunityComment.findOne({
    _id: commentId,
    postId,
    isActive: true,
  });
  if (!comment) {
    throw new Error("Comment not found");
  }

  const likes = comment.likes || [];
  const userLikeIndex = likes.findIndex((id) => id.toString() === userId);
  let isLiked = false;

  if (userLikeIndex > -1) {
    // User already liked it, so unlike
    likes.splice(userLikeIndex, 1);
  } else {
    // User hasn't liked it, so like
    likes.push(userId as any);
    isLiked = true;
  }

  comment.likes = likes;
  comment.likesCount = Math.max(0, likes.length);
  await comment.save();

  return { liked: isLiked, likesCount: comment.likesCount };
};

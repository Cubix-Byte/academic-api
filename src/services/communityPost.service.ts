import { CommunityPost, ICommunityPost, IAttachment, User } from "../models";
import mongoose from "mongoose";

/**
 * Resolve author display details.
 * Priority:
 *   1. Names passed directly from the controller (extracted from req.user after user-api lookup)
 *   2. Local User model lookup by authorId (users mirror in this DB)
 *   3. Fallback to empty strings
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
    // Names already resolved by the auth middleware (user-api lookup) — use them
    return {
      firstName: first,
      lastName: last,
      userType: opts.userType || "",
      profilePicture: opts.profilePicture || "",
    };
  }

  // Fallback: query the local User model (works when User collection is in the same DB)
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
    // Ignore — we'll use the fallback below
  }

  return {
    firstName: "",
    lastName: "",
    userType: opts.userType || "",
    profilePicture: opts.profilePicture || "",
  };
}

/**
 * Creates a new post in a specified community.
 */
export const createPost = async (params: {
  communityId: string;
  authorId: string;
  tenantId: string;
  content?: string;
  attachments?: IAttachment[];
  authorFirstName?: string;
  authorLastName?: string;
  authorUserType?: string;
  authorProfilePicture?: string;
}): Promise<ICommunityPost> => {
  const {
    communityId,
    authorId,
    tenantId,
    content,
    attachments,
    authorFirstName,
    authorLastName,
    authorUserType,
    authorProfilePicture,
  } = params;

  if (!content && (!attachments || attachments.length === 0)) {
    throw new Error(
      "A post must contain either text content or an attachment.",
    );
  }

  const snap = await resolveAuthorSnapshot(authorId, {
    firstName: authorFirstName,
    lastName: authorLastName,
    userType: authorUserType,
    profilePicture: authorProfilePicture,
  });

  const newPost = await CommunityPost.create({
    communityId,
    authorId,
    tenantId,
    content,
    attachments: attachments || [],
    likes: [],
    commentCount: 0,
    createdBy: authorId,
    authorSnapshot: snap,
  });

  const created = (await CommunityPost.findById(newPost._id).lean()) as any;
  const first = (snap.firstName || "").trim();
  const last = (snap.lastName || "").trim();
  const fullName = first || last ? `${first} ${last}`.trim() : "Unknown User";

  return {
    ...created,
    id: created._id.toString(),
    isLiked: false,
    likesCount: 0,
    author: {
      id: authorId,
      firstName: first,
      lastName: last,
      fullName,
      userType: snap.userType,
      profilePicture: snap.profilePicture || undefined,
    },
  } as unknown as ICommunityPost;
};

/**
 * Fetches the feed for a specific community in descending order (newest first).
 */
export const getCommunityFeed = async (
  communityId: string,
  userId: string,
  options: { pageNo: number; pageSize: number },
) => {
  const { pageNo, pageSize } = options;
  const skip = (pageNo - 1) * pageSize;

  const [posts, total] = await Promise.all([
    CommunityPost.find({ communityId, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    CommunityPost.countDocuments({ communityId, isActive: true }),
  ]);

  const formattedPosts = await (async () => {
    // Collect authorIds for posts lacking a stored snapshot (legacy data)
    const missingAuthorIds = (posts as any[])
      .filter(
        (p) =>
          !p.authorSnapshot?.firstName &&
          !p.authorSnapshot?.lastName &&
          p.authorId,
      )
      .map((p) => p.authorId);

    let userMap: Record<string, any> = {};
    if (missingAuthorIds.length > 0) {
      try {
        const users = (await User.find({ _id: { $in: missingAuthorIds } })
          .select("firstName lastName userType profilePicture")
          .lean()) as any[];
        for (const u of users) {
          userMap[u._id.toString()] = u;
        }
      } catch {
        /* User collection unreachable — userMap stays empty */
      }
    }

    return (posts as any[]).map((post) => {
      const snap = post.authorSnapshot;
      const authorIdStr = post.authorId?.toString();
      const u = userMap[authorIdStr ?? ""];

      const first = ((snap?.firstName || u?.firstName) ?? "").trim();
      const last = ((snap?.lastName || u?.lastName) ?? "").trim();
      const userType = snap?.userType || u?.userType || "";
      const profilePicture =
        snap?.profilePicture || u?.profilePicture || undefined;
      const fullName =
        first || last ? `${first} ${last}`.trim() : "Unknown User";

      return {
        ...post,
        id: post._id.toString(),
        isLiked: post.likes.some(
          (id: any) => id.toString() === userId.toString(),
        ),
        likesCount: post.likes.length,
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
  })();

  return { posts: formattedPosts, total };
};

/**
 * Toggles a user's single like on a post.
 */
export const toggleLike = async (
  postId: string,
  userId: string,
  tenantId: string,
) => {
  const post = await CommunityPost.findOne({ _id: postId, tenantId });
  if (!post) throw new Error("Post not found.");

  const userIdStr = userId.toString();
  const index = post.likes.findIndex((id: any) => id.toString() === userIdStr);

  let liked = false;
  if (index === -1) {
    post.likes.push(new mongoose.Types.ObjectId(userIdStr));
    liked = true;
  } else {
    post.likes.splice(index, 1);
    liked = false;
  }

  await post.save();
  return { liked, likesCount: post.likes.length };
};

/**
 * Deletes a post. Permitted only to the Author OR a System Admin.
 */
export const deletePost = async (
  postId: string,
  userId: string,
  userRole: string,
) => {
  const post = await CommunityPost.findById(postId);
  if (!post) throw new Error("Post not found.");

  const authorIdStr = post.authorId?.toString();
  const isAdmin = ["PRIMARYADMIN", "ADMIN"].includes(userRole);

  if (authorIdStr !== userId.toString() && !isAdmin) {
    throw new Error("You do not have permission to delete this post.");
  }

  await CommunityPost.findByIdAndDelete(postId);
};

/**
 * Edits an existing post. Permitted only to the Author.
 */
export const editPost = async (
  postId: string,
  userId: string,
  updates: { content?: string; attachments?: IAttachment[] },
) => {
  const post = await CommunityPost.findById(postId);
  if (!post) throw new Error("Post not found.");

  const authorIdStr = post.authorId?.toString();

  if (authorIdStr !== userId.toString()) {
    throw new Error("You do not have permission to edit this post.");
  }

  if (updates.content !== undefined) post.content = updates.content;
  if (updates.attachments !== undefined)
    post.attachments = updates.attachments as any;

  await post.save();
  return post;
};

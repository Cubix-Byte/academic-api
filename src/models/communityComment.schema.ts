import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface ICommunityComment extends IBaseDocument {
  postId: string | mongoose.Types.ObjectId;
  authorId: string | mongoose.Types.ObjectId;
  tenantId: string | mongoose.Types.ObjectId;
  content: string;
  parentId?: string | mongoose.Types.ObjectId; // For threading
  authorSnapshot?: {
    firstName?: string;
    lastName?: string;
    userType?: string;
    profilePicture?: string;
  };
  likes?: (string | mongoose.Types.ObjectId)[];
  likesCount?: number;
}

const AuthorSnapshotSchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    userType: { type: String, trim: true },
    profilePicture: { type: String, trim: true },
  },
  { _id: false },
);

const CommunityCommentSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [1000, "Content cannot exceed 1000 characters"],
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityComment",
      default: null,
      index: true,
    },
    authorSnapshot: {
      type: AuthorSnapshotSchema,
      default: undefined,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

CommunityCommentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });

export default mongoose.model<ICommunityComment>(
  "CommunityComment",
  CommunityCommentSchema,
);

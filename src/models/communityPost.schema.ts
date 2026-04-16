import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface IAttachment {
  type: "IMAGE" | "FILE" | "LINK";
  url: string;
  name?: string;
  size?: number; // purely for frontend display purposes (e.g. 2MB PDF)
}

export interface IAuthorSnapshot {
  firstName?: string;
  lastName?: string;
  userType?: string;
  profilePicture?: string;
}

export interface ICommunityPost extends IBaseDocument {
  communityId: string | mongoose.Types.ObjectId;
  authorId: string | mongoose.Types.ObjectId;
  tenantId: string | mongoose.Types.ObjectId;
  content?: string; // Optional if there are attachments
  attachments: IAttachment[];
  likes: (string | mongoose.Types.ObjectId)[]; // Array of User IDs who liked the post
  commentCount: number;
  authorSnapshot?: IAuthorSnapshot; // Embedded at creation — avoids cross-DB populate
}

const AttachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["IMAGE", "FILE", "LINK"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
    },
  },
  { _id: false },
);

const AuthorSnapshotSchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    userType: { type: String, trim: true },
    profilePicture: { type: String, trim: true },
  },
  { _id: false },
);

const CommunityPostSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxLength: [2000, "Content cannot exceed 2000 characters"],
      required: function (this: ICommunityPost) {
        return !this.attachments || this.attachments.length === 0;
      },
    },
    attachments: [AttachmentSchema],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    commentCount: {
      type: Number,
      default: 0,
    },
    // Embedded author name/type snapshot — written once at creation to avoid
    // cross-database populate() failures in the microservice architecture.
    authorSnapshot: {
      type: AuthorSnapshotSchema,
      default: undefined,
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

CommunityPostSchema.index({ communityId: 1, createdAt: -1 });

export default mongoose.model<ICommunityPost>(
  "CommunityPost",
  CommunityPostSchema,
);

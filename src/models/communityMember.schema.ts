import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface ICommunityMember extends IBaseDocument {
  communityId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  tenantId: string | mongoose.Types.ObjectId;
  isActive: boolean;
  addedBy?: string | mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  userType?: string;
  profilePicture?: string;
}

const CommunityMemberSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    userId: {
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
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    userType: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
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

CommunityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
CommunityMemberSchema.index({ userId: 1 });

export default mongoose.model<ICommunityMember>(
  "CommunityMember",
  CommunityMemberSchema,
);

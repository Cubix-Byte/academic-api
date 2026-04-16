import mongoose, { Schema, Document } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

export interface IColourTheme {
  key: string;
  value: string;
}

export interface IPartner extends IBaseDocument {
  partnersField: string;
  partnerLogo?: string;
  companyName: string;
  supportEmail: string;
  colourTheme: IColourTheme[];
  sidebarGradient?: string;
  isDefault: boolean;
}

const PartnerSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    partnersField: {
      type: String,
      required: [true, "Partners field is required"],
      trim: true,
    },
    partnerLogo: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    supportEmail: {
      type: String,
      required: [true, "Support email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    colourTheme: [
      {
        key: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    sidebarGradient: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return {
          id: (_id as any).toString(),
          ...rest,
          partnerLogo: ret.partnerLogo ?? null,
          sidebarGradient: ret.sidebarGradient ?? null,
        };
      },
    },
    toObject: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return {
          id: (_id as any).toString(),
          ...rest,
          partnerLogo: ret.partnerLogo ?? null,
          sidebarGradient: ret.sidebarGradient ?? null,
        };
      },
    },
  }
);

// Indexes for better performance
PartnerSchema.index({ companyName: 1 });
PartnerSchema.index({ isActive: 1 });
PartnerSchema.index({ isDeleted: 1 });
PartnerSchema.index({ isDefault: 1 });

export default mongoose.model<IPartner>("Partner", PartnerSchema);
export { PartnerSchema };

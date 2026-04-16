import mongoose, { Schema, Document } from "mongoose";
import {
  CredentialType,
  ValidationPeriod,
  CredentialGeneratedBy,
} from "../utils/constants/credentialEnums";

/**
 * CredentialTemplate Interface - Reusable credential templates
 */
export interface ICredentialTemplate extends Document {
  meritBadge: string; // Credential name/title
  credentialType: CredentialType;
  validationPeriod: ValidationPeriod;
  subjectId?: mongoose.Types.ObjectId;
  classId?: mongoose.Types.ObjectId;
  issuingCriteria: string;
  credentialInfo: string;
  fileUrl?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
  createdBy: mongoose.Types.ObjectId; // Teacher/Admin who created it
  generatedBy: CredentialGeneratedBy;
  tenantId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CredentialTemplate Schema
 */
const CredentialTemplateSchema = new Schema(
  {
    meritBadge: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    credentialType: {
      type: String,
      enum: Object.values(CredentialType),
      required: true,
      index: true,
    },
    validationPeriod: {
      type: String,
      enum: Object.values(ValidationPeriod),
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },
    issuingCriteria: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    credentialInfo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    fileUrl: {
      type: String,
      maxlength: 500,
    },
    fileName: {
      type: String,
      maxlength: 255,
    },
    filePath: {
      type: String,
      maxlength: 500,
    },
    mimeType: {
      type: String,
      maxlength: 100,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    generatedBy: {
      type: String,
      enum: Object.values(CredentialGeneratedBy),
      required: true,
      default: CredentialGeneratedBy.MANUAL,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "credential_templates",
  }
);

// Indexes for high performance queries
CredentialTemplateSchema.index({
  tenantId: 1,
  isDeleted: 1,
  credentialType: 1,
});
CredentialTemplateSchema.index({ tenantId: 1, createdBy: 1, isDeleted: 1 });
CredentialTemplateSchema.index({ tenantId: 1, subjectId: 1, isDeleted: 1 });
CredentialTemplateSchema.index({ tenantId: 1, classId: 1, isDeleted: 1 });
CredentialTemplateSchema.index({ tenantId: 1, generatedBy: 1, isDeleted: 1 });
CredentialTemplateSchema.index({ tenantId: 1, createdAt: -1 });

export const CredentialTemplate = mongoose.model<ICredentialTemplate>(
  "CredentialTemplate",
  CredentialTemplateSchema
);
export default CredentialTemplate;

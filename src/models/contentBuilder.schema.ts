import mongoose, { Schema, Document } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

/**
 * ContentBuilder Interface - Content builder form data management
 */
export interface IContentBuilder extends Omit<IBaseDocument, 'createdBy'> {
  contentTitle: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  contentType: string; // From form contentType field
  tenantId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * ContentBuilder Schema - Manages content builder form data
 */
const ContentBuilderSchema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    contentTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "content_builders",
  }
);

// Indexes for better performance
ContentBuilderSchema.index({ tenantId: 1, teacherId: 1 });
ContentBuilderSchema.index({ tenantId: 1, contentTitle: 1 });
ContentBuilderSchema.index({ tenantId: 1, classId: 1, subjectId: 1, batchId: 1 });
ContentBuilderSchema.index({ tenantId: 1, createdAt: -1 });
ContentBuilderSchema.index({ tenantId: 1, contentType: 1 });

// Text index for search
ContentBuilderSchema.index({
  contentTitle: "text",
  description: "text",
});

// Ensure virtual fields are serialized
ContentBuilderSchema.set("toJSON", { virtuals: true });
ContentBuilderSchema.set("toObject", { virtuals: true });

export const ContentBuilder = mongoose.model<IContentBuilder>(
  "ContentBuilder",
  ContentBuilderSchema
);
export default ContentBuilder;

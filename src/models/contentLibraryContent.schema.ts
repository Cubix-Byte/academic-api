import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

// Individual content file metadata under a Content Library (folder)
export interface IContentLibraryContent extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  contentLibraryId: mongoose.Types.ObjectId; // parent folder
  contentId?: string; // optional external storage reference id
  fileName: string;
  filePath: string; // URL or path from storage-api
  fileType?: string; // mime or extension
  fileSizeInBytes?: number;
  subject?: string; // optional subject name
  subjectId?: mongoose.Types.ObjectId; // optional subject reference (for filtering/assignment)
  grade?: string; // optional grade level
  title?: string; // optional title for the content
  description?: string; // optional description for the content
  isEmbedded?: boolean; // whether the file has been embedded/vectorized
  targetLanguage?: string; // target language for syllabus ingestion
  assignedClassIds?: mongoose.Types.ObjectId[]; // array of class IDs where content is assigned
  isAssigned?: boolean; // status indicating if content is assigned to any class
  videoId?: string; // optional storage API file ID for associated video
  videoPath?: string; // optional S3 URL/path to associated video
}

const ContentLibraryContentSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
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
    contentLibraryId: {
      type: Schema.Types.ObjectId,
      ref: "ContentLibrary",
      required: true,
      index: true,
    },
    contentId: { type: String, trim: true },
    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    filePath: { type: String, required: true, trim: true },
    fileType: { type: String, trim: true },
    fileSizeInBytes: { type: Number },
    isEmbedded: { type: Boolean, default: false },
    subject: { type: String, trim: true, default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    grade: { type: String, trim: true, default: null },
    title: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    targetLanguage: { type: String, trim: true, default: null },
    assignedClassIds: [
      { type: Schema.Types.ObjectId, ref: "Class", index: true },
    ],
    isAssigned: { type: Boolean, default: false, index: true },
    videoId: { type: String, trim: true, default: null },
    videoPath: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
    toObject: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
  }
);

ContentLibraryContentSchema.index({
  tenantId: 1,
  teacherId: 1,
  contentLibraryId: 1,
  fileName: 1,
});
ContentLibraryContentSchema.index({ isActive: 1, isDeleted: 1 });

const ContentLibraryContent = mongoose.model<IContentLibraryContent>(
  "ContentLibraryContent",
  ContentLibraryContentSchema
);
export default ContentLibraryContent;
export { ContentLibraryContent };

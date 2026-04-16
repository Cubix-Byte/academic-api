import mongoose, { Schema } from 'mongoose';
import { IBaseDocument, BaseDocumentSchema } from '../utils/shared-lib-imports';

// Content Library (parent folder) created by a teacher
export interface IContentLibrary extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  name: string;
  isSyllabus?: boolean;
}

const ContentLibrarySchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    isSyllabus: { type: Boolean, default: false, index: true },
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

ContentLibrarySchema.index({ tenantId: 1, teacherId: 1, name: 1 }, { unique: true });
ContentLibrarySchema.index({ isActive: 1, isDeleted: 1 });

const ContentLibrary = mongoose.model<IContentLibrary>('ContentLibrary', ContentLibrarySchema);
export default ContentLibrary;
export { ContentLibrary };



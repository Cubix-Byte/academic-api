import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

// Subject model interface - represents a subject/course in the academy
export interface ISubject extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId; // Reference to school/tenant
  name: string; // e.g., "Mathematics", "Physics", "English"
  code: string; // Unique subject code, e.g., "MATH101"
  grade?: number; // Optional grade level
}

// Subject schema definition with validation rules and relationships
const SubjectSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    // Reference to Tenant (school) - REQUIRED
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"],
      index: true,
    },
    // Subject name
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      maxlength: [100, "Subject name cannot exceed 100 characters"],
    },
    // Subject code (unique per tenant)
    code: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
      maxlength: [20, "Subject code cannot exceed 20 characters"],
    },
    // Grade level - OPTIONAL
    grade: {
      type: Number,
      required: false,
      min: [1, "Grade must be at least 1"],
      max: [100, "Grade cannot exceed 100"],
    },
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

// Database indexes for better query performance
SubjectSchema.index({ tenantId: 1, code: 1 }, { unique: true }); // Unique subject code per tenant
SubjectSchema.index({ tenantId: 1, name: 1 }); // Query by subject name
SubjectSchema.index({ tenantId: 1, grade: 1 }); // Query by grade
SubjectSchema.index({ isActive: 1, isDeleted: 1 }); // Active/deleted status

// Export Subject model
const Subject = mongoose.model<ISubject>("Subject", SubjectSchema);
export default Subject;
export { Subject };

import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

// Class model interface - represents a class/grade in the academy
export interface IClass extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId; // Reference to school/tenant
  name: string; // e.g., "Grade 10", "Class 5-A"
  grade: number; // e.g., 1, 2, 3, ..., 12
  section?: string; // e.g., "A", "B", "C"
  capacity: number; // Maximum number of students
  classTeacherId?: mongoose.Types.ObjectId; // Reference to teacher (from user-api)
  batchId?: mongoose.Types.ObjectId; // Reference to batch (nullable foreign key)
  subjectIds: mongoose.Types.ObjectId[]; // References to subjects
  studentIds: mongoose.Types.ObjectId[]; // References to students (from user-api)
  description?: string;
}

// Class schema definition with validation rules and relationships
const ClassSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    // Reference to Tenant (school) - REQUIRED
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"],
      index: true,
    },
    // Class name
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      maxlength: [100, "Class name cannot exceed 100 characters"],
    },
    // Grade level (1-12)
    grade: {
      type: Number,
      required: [true, "Grade is required"],
      min: [1, "Grade must be at least 1"],
      max: [100, "Grade cannot exceed 100"],
    },
    // Section (optional)
    section: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, "Section cannot exceed 10 characters"],
    },
    // Maximum capacity
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    // Class teacher (from user-api)
    classTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
    },
    // Batch reference (nullable foreign key)
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },
    // Subjects assigned to this class
    subjectIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    // Students enrolled in this class (from user-api)
    studentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    // Optional description
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
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
ClassSchema.index({ tenantId: 1, name: 1 }); // Unique class name per tenant
ClassSchema.index({ tenantId: 1, grade: 1, section: 1 }); // Query by grade and section
ClassSchema.index({ tenantId: 1, name: 1, grade: 1, section: 1 }); // Compound index for duplicate check
ClassSchema.index({ classTeacherId: 1 }); // Query by class teacher
ClassSchema.index({ batchId: 1 }); // Query by batch
ClassSchema.index({ isActive: 1, isDeleted: 1 }); // Active/deleted status

// Export Class model
const Class = mongoose.model<IClass>("Class", ClassSchema);
export default Class;
export { Class };

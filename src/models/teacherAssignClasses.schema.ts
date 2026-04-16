import mongoose, { Schema, Document } from 'mongoose';
import { IBaseDocument, BaseDocumentSchema } from '../utils/shared-lib-imports';

/**
 * TeacherAssignClasses Interface - Junction table for teacher-class-subject assignments
 * This table stores the specific subject assignments for teachers in each class
 */
export interface ITeacherAssignClasses extends IBaseDocument {
  teacherId: mongoose.Types.ObjectId; // Reference to Teacher
  classId: mongoose.Types.ObjectId;  // Reference to Class
  subjectId: mongoose.Types.ObjectId; // Reference to Subject
  tenantId: string;                   // Tenant/School ID
  tenantName: string;                 // Tenant/School Name
  assignedBy: mongoose.Types.ObjectId; // Who assigned this (Admin ID)
  assignedAt: Date;                   // When it was assigned
  status: 'active' | 'inactive';      // Assignment status
  notes?: string;                     // Optional notes
}

/**
 * TeacherAssignClasses Schema - Junction table for teacher assignments
 */
const TeacherAssignClassesSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    // Teacher reference
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher ID is required'],
      index: true
    },
    // Class reference
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class ID is required'],
      index: true
    },
    // Subject reference
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject ID is required'],
      index: true
    },
    // Tenant information
    tenantId: {
      type: String,
      required: [true, 'Tenant ID is required'],
      trim: true,
      index: true
    },
    tenantName: {
      type: String,
      required: [true, 'Tenant name is required'],
      trim: true
    },
    // Assignment details
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned by is required']
    },
    assignedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    // Status
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true,
      index: true
    },
    // Optional notes
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true,
    collection: 'teacher_assign_classes',
    toJSON: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      }
    },
    toObject: {
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      }
    }
  }
);

// Compound indexes for better performance
TeacherAssignClassesSchema.index({ teacherId: 1, classId: 1, subjectId: 1 }, { unique: true });
TeacherAssignClassesSchema.index({ classId: 1, subjectId: 1 });
TeacherAssignClassesSchema.index({ teacherId: 1, status: 1 });
TeacherAssignClassesSchema.index({ tenantId: 1, status: 1 });
TeacherAssignClassesSchema.index({ assignedBy: 1 });

export default mongoose.model<ITeacherAssignClasses>('TeacherAssignClasses', TeacherAssignClassesSchema);

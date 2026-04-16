import mongoose, { Document, Schema } from 'mongoose';
import { IBaseDocument, BaseDocumentSchema } from '../utils/shared-lib-imports';
import { STATUS } from '../utils/constants/status.constants';

// Parent-Child relationship model interface
export interface IParentChild extends IBaseDocument {
  // Parent reference
  parentId: mongoose.Types.ObjectId; // Reference to Parent

  // Child reference (Student)
  childId: mongoose.Types.ObjectId; // Reference to Student

  // Relationship details
  relationship: 'father' | 'mother' | 'guardian' | 'other';
  isPrimary: boolean; // Primary parent for the child

  // Additional information
  notes?: string;

  // Status
  status: STATUS;

  // Tenant Information
  tenantId: string;
  tenantName: string;
}

const ParentChildSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    // Parent reference
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      required: [true, 'Parent ID is required']
    },

    // Child reference (Student)
    childId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Child ID is required']
    },

    // Relationship details
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      enum: ['father', 'mother', 'guardian', 'other'],
      lowercase: true
    },

    isPrimary: {
      type: Boolean,
      default: false,
      required: true
    },

    // Additional information
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },

    // Status
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.ACTIVE,
      required: true
    },

    // Tenant Information
    tenantId: {
      type: String,
      required: [true, 'Tenant ID is required'],
      trim: true
    },
    tenantName: {
      type: String,
      required: [true, 'Tenant name is required'],
      trim: true
    }
  },
  {
    timestamps: true,
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

// Indexes for better performance
ParentChildSchema.index({ parentId: 1 });
ParentChildSchema.index({ childId: 1 });
ParentChildSchema.index({ parentId: 1, childId: 1 }, { unique: true }); // Unique parent-child relationship
ParentChildSchema.index({ relationship: 1 });
ParentChildSchema.index({ isPrimary: 1 });
ParentChildSchema.index({ status: 1 });
ParentChildSchema.index({ isActive: 1 });
ParentChildSchema.index({ isDeleted: 1 });
ParentChildSchema.index({ tenantId: 1 });

export default mongoose.model<IParentChild>('ParentChild', ParentChildSchema);

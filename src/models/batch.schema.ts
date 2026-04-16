import mongoose, { Schema, Document } from 'mongoose';

/**
 * Batch Interface - Batch management for classes
 */
export interface IBatch extends Document {
  // REQUIRED FIELDS
  batchName: string;
  totalClasses: number;
  tenantId: string; // for multi-tenant mapping
  
  // OPTIONAL FIELDS
  description?: string;
  startFrom?: Date;
  endTill?: Date;
  
  // Standard document fields
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isDeleted: boolean;
}

/**
 * Batch Schema - Batch management for classes
 */
const BatchSchema = new Schema({
  // REQUIRED FIELDS
  batchName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  totalClasses: { 
    type: Number, 
    required: false,
    default: 0,
    min: 0,
    max: 1000
  },
  tenantId: { 
    type: String, 
    required: true,
    index: true
  },
  
  // OPTIONAL FIELDS
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  startFrom: { 
    type: Date,
    default: null
  },
  endTill: { 
    type: Date,
    default: null
  },
  
  // Standard document fields
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'batches'
});

// Indexes for better performance
BatchSchema.index({ batchName: 1, tenantId: 1 }, { unique: true });
BatchSchema.index({ isActive: 1, isDeleted: 1, tenantId: 1 });

// Ensure virtual fields are serialized
BatchSchema.set('toJSON', { virtuals: true });
BatchSchema.set('toObject', { virtuals: true });

export const Batch = mongoose.model<IBatch>('Batch', BatchSchema);
export default Batch;

import mongoose, { Schema, Document } from "mongoose";

/**
 * Credit Usage Transaction Interface
 * Represents a credit usage transaction when student uses credits for AI practice exam
 */
export interface ICreditUsageTransaction extends Document {
  studentId: string; // Student ID
  examId?: string; // Exam ID if used for exam
  amount: number; // Number of credits used (always positive, stored as 1)
  balanceBefore: number; // Balance before usage
  balanceAfter: number; // Balance after usage
  reason: string; // Reason for usage (e.g., "ai_practice_exam")
  
  // Tenant information
  tenantId: string;
  tenantName: string;
  
  // Metadata
  usedAt: Date; // When credits were used
  
  // Standard document fields
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isDeleted: boolean;
}

/**
 * Credit Usage Transaction Schema
 */
const CreditUsageTransactionSchema = new Schema(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      trim: true,
      index: true,
    },
    examId: {
      type: String,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be at least 1"],
      default: 1,
    },
    balanceBefore: {
      type: Number,
      required: [true, "Balance before is required"],
      min: [0, "Balance before cannot be negative"],
    },
    balanceAfter: {
      type: Number,
      required: [true, "Balance after is required"],
      min: [0, "Balance after cannot be negative"],
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
      default: "ai_practice_exam",
    },
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
      trim: true,
      index: true,
    },
    tenantName: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes for better query performance
CreditUsageTransactionSchema.index({ studentId: 1, usedAt: -1 });
CreditUsageTransactionSchema.index({ examId: 1 });
CreditUsageTransactionSchema.index({ tenantId: 1 });
CreditUsageTransactionSchema.index({ createdAt: -1 });

export default mongoose.model<ICreditUsageTransaction>("CreditUsageTransaction", CreditUsageTransactionSchema);


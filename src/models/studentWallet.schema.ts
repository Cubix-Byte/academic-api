// ============================================================================
// COMMENTED OUT: Student Wallet collection moved to Monetization-API
// Wallet data is now stored in monetization-api database with collection name "student_wallets"
// Academic-API now calls Monetization-API to read wallet data
// ============================================================================

// import mongoose, { Schema, Document } from "mongoose";

// /**
//  * Student Wallet Interface
//  * Represents a student's credit wallet for AI practice exams
//  */
// export interface IStudentWallet extends Document {
//   studentId: string; // Student ID (string for cross-service reference)
//   parentId?: string; // Parent ID who manages this wallet (optional)
  
//   // Balance information
//   balance: number; // Current credit balance
//   totalCreditsPurchased: number; // Lifetime total credits purchased
//   totalCreditsUsed: number; // Lifetime total credits consumed
  
//   // Tenant information
//   tenantId: string;
//   tenantName: string;
  
//   // Wallet status
//   status: "active" | "suspended" | "closed"; // Wallet status
  
//   // Metadata
//   lastTransactionDate?: Date; // Date of last transaction (purchase or usage)
//   lastTopupDate?: Date; // Date of last topup
  
//   // Standard document fields
//   createdAt: Date;
//   updatedAt: Date;
//   isActive: boolean;
//   isDeleted: boolean;
// }

// /**
//  * Student Wallet Schema
//  */
// const StudentWalletSchema = new Schema(
//   {
//     studentId: {
//       type: String,
//       required: [true, "Student ID is required"],
//       trim: true,
//       index: true,
//     },
//     parentId: {
//       type: String,
//       trim: true,
//       index: true,
//     },
//     balance: {
//       type: Number,
//       required: [true, "Balance is required"],
//       default: 0,
//       min: [0, "Balance cannot be negative"],
//       index: true,
//     },
//     totalCreditsPurchased: {
//       type: Number,
//       default: 0,
//       min: [0, "Total credits purchased cannot be negative"],
//     },
//     totalCreditsUsed: {
//       type: Number,
//       default: 0,
//       min: [0, "Total credits used cannot be negative"],
//     },
//     tenantId: {
//       type: String,
//       required: [true, "Tenant ID is required"],
//       trim: true,
//       index: true,
//     },
//     tenantName: {
//       type: String,
//       required: [true, "Tenant name is required"],
//       trim: true,
//     },
//     status: {
//       type: String,
//       enum: ["active", "suspended", "closed"],
//       required: [true, "Status is required"],
//       default: "active",
//       index: true,
//     },
//     lastTransactionDate: {
//       type: Date,
//       index: true,
//     },
//     lastTopupDate: {
//       type: Date,
//       index: true,
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//     isDeleted: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//   },
//   {
//     timestamps: true,
//     toJSON: {
//       transform: function (doc, ret) {
//         const { _id, __v, ...rest } = ret;
//         return { id: (_id as any).toString(), ...rest };
//       },
//     },
//     toObject: {
//       transform: function (doc, ret) {
//         const { _id, __v, ...rest } = ret;
//         return { id: (_id as any).toString(), ...rest };
//       },
//     },
//   }
// );

// // Indexes for better query performance
// StudentWalletSchema.index({ studentId: 1, tenantId: 1 }, { unique: true }); // One wallet per student per tenant
// StudentWalletSchema.index({ parentId: 1 });
// StudentWalletSchema.index({ tenantId: 1, status: 1 });
// StudentWalletSchema.index({ balance: 1 });
// StudentWalletSchema.index({ createdAt: -1 });

// export default mongoose.model<IStudentWallet>("StudentWallet", StudentWalletSchema);


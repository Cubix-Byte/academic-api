// ============================================================================
// COMMENTED OUT: Student Wallet write operations moved to Monetization-API
// Wallet data is now stored in monetization-api database
// Add credits is now handled in monetization-api after payment confirmation
// ============================================================================

import { CreditUsageTransaction } from "../models";
import { monetizationApiIntegration } from "./monetizationApiIntegration.service";

/**
 * Student Wallet Service
 * Handles student wallet operations for credit management
 * NOTE: Wallet data is now stored in Monetization-API database
 * This service now calls Monetization-API for wallet operations
 */

// COMMENTED OUT: getOrCreateWallet - no longer needed, handled in Monetization-API
// /**
//  * Get or create student wallet
//  */
// export const getOrCreateWallet = async (
//   studentId: string,
//   tenantId: string,
//   tenantName: string
// ) => {
//   let wallet = await StudentWallet.findOne({
//     studentId,
//     tenantId,
//     isActive: true,
//     isDeleted: false,
//   });
//
//   if (!wallet) {
//     wallet = new StudentWallet({
//       studentId,
//       tenantId,
//       tenantName,
//       balance: 0,
//       totalCreditsPurchased: 0,
//       totalCreditsUsed: 0,
//       status: "active",
//       isActive: true,
//       isDeleted: false,
//     });
//     await wallet.save();
//   }
//
//   return wallet;
// };

// COMMENTED OUT: addCredits - now handled in Monetization-API after payment confirmation
// /**
//  * Add credits to student wallet
//  */
// export const addCredits = async (
//   studentId: string,
//   amount: number,
//   purchaseTransactionId: string,
//   parentId: string,
//   tenantId: string,
//   tenantName: string
// ) => {
//   const wallet = await getOrCreateWallet(studentId, tenantId, tenantName);
//
//   // Update wallet
//   wallet.balance += amount;
//   wallet.totalCreditsPurchased += amount;
//   wallet.lastTopupDate = new Date();
//   wallet.lastTransactionDate = new Date();
//   wallet.parentId = parentId; // Update parent who purchased
//
//   await wallet.save();
//
//   return wallet;
// };

/**
 * Consume credits from student wallet
 * Now calls Monetization-API to consume credits
 */
export const consumeCredits = async (
  studentId: string,
  amount: number,
  examId: string | undefined,
  reason: string,
  tenantId: string,
  tenantName: string
) => {
  // Get current balance from Monetization-API
  const balanceBeforeData = await monetizationApiIntegration.getStudentWalletBalance(studentId, tenantId);
  const balanceBefore = balanceBeforeData.balance;

  // Consume credits via Monetization-API
  const result = await monetizationApiIntegration.consumeStudentWalletCredits(
    studentId,
    amount,
    tenantId
  );

  const balanceAfter = result.balance;

  // Record usage transaction in Academic-API (this is still stored here)
  await CreditUsageTransaction.create({
    studentId,
    examId,
    amount,
    balanceBefore,
    balanceAfter,
    reason,
    tenantId,
    tenantName,
    usedAt: new Date(),
    isActive: true,
    isDeleted: false,
  });

  // Return wallet-like object for compatibility
  return {
    studentId: result.studentId,
    balance: result.balance,
    totalCreditsUsed: result.totalCreditsUsed,
  };
};

/**
 * Get wallet balance
 * Now calls Monetization-API to get wallet data
 */
export const getBalance = async (studentId: string, tenantId: string) => {
  return await monetizationApiIntegration.getStudentWalletBalance(studentId, tenantId);
};

/**
 * Get wallets for multiple students
 * Now calls Monetization-API to get wallet data
 */
export const getWalletsForStudents = async (
  studentIds: string[],
  tenantId: string
) => {
  return await monetizationApiIntegration.getStudentWalletsBatch(studentIds, tenantId);
};


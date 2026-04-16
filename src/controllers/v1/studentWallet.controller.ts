import { Request, Response, NextFunction } from "express";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/shared-lib-imports";
import * as studentWalletService from "../../services/studentWallet.service";
import * as parentChildRepository from "../../repositories/parentChild.repository";
import { CreditUsageTransaction } from "../../models";
import * as studentRepository from "../../repositories/student.repository";

/**
 * Student Wallet Controller
 * Handles wallet operations for parents and students
 */

/**
 * Get children's wallet balances for a parent
 * GET /parents/:parentId/children/wallets
 */
export const getChildrenWallets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { parentId } = req.params;
    const tenantId = (req as any).tenantId;

    if (!parentId) {
      sendErrorResponse(res, "Parent ID is required", 400);
      return;
    }

    if (!tenantId) {
      sendErrorResponse(res, "Tenant ID is required", 400);
      return;
    }

    // Get children for the parent
    const relationships = await parentChildRepository.findChildrenByParentId(parentId);
    
    if (!relationships || relationships.length === 0) {
      sendSuccessResponse(res, "No children found", { children: [] });
      return;
    }

    // Extract student IDs
    const studentIds = relationships
      .map((rel: any) => {
        const child = rel.childId;
        return child?._id ? child._id.toString() : null;
      })
      .filter((id: string | null) => id !== null) as string[];

    if (studentIds.length === 0) {
      sendSuccessResponse(res, "No valid student IDs found", { children: [] });
      return;
    }

    // Get wallets for all children
    const wallets = await studentWalletService.getWalletsForStudents(studentIds, tenantId);

    // Combine with child information
    const children = relationships.map((rel: any) => {
      const child = rel.childId;
      const studentId = child?._id ? child._id.toString() : "";
      const wallet = wallets.find((w: any) => w.studentId === studentId) || {
        balance: 0,
        totalCreditsPurchased: 0,
        totalCreditsUsed: 0,
      };

      return {
        studentId,
        studentName: child
          ? `${child.firstName || ""} ${child.lastName || ""}`.trim()
          : "N/A",
        firstName: child?.firstName || "",
        lastName: child?.lastName || "",
        email: child?.email || "",
        rollNumber: child?.rollNumber || "",
        balance: wallet.balance,
        totalPurchased: wallet.totalCreditsPurchased,
        totalUsed: wallet.totalCreditsUsed,
        relationship: rel.relationship || "other",
        isPrimary: rel.isPrimary || false,
      };
    });

    sendSuccessResponse(res, "Children wallets retrieved successfully", {
      children,
    });
  } catch (error: any) {
    console.error("Get children wallets error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve children wallets", 500);
  }
};

/**
 * Get wallet balance for a specific student
 * GET /students/:studentId/wallet
 */
export const getStudentWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId } = req.params;
    const tenantId = (req as any).tenantId;

    if (!studentId) {
      sendErrorResponse(res, "Student ID is required", 400);
      return;
    }

    if (!tenantId) {
      sendErrorResponse(res, "Tenant ID is required", 400);
      return;
    }

    // Get wallet balance
    const wallet = await studentWalletService.getBalance(studentId, tenantId);

    sendSuccessResponse(res, "Wallet balance retrieved successfully", wallet);
  } catch (error: any) {
    console.error("Get student wallet error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve wallet balance", 500);
  }
};

/**
 * Get credit usage history for a student
 * GET /students/:studentId/credit-usage-history
 */
export const getCreditUsageHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { studentId } = req.params;
    const tenantId = (req as any).tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!studentId) {
      sendErrorResponse(res, "Student ID is required", 400);
      return;
    }

    if (!tenantId) {
      sendErrorResponse(res, "Tenant ID is required", 400);
      return;
    }

    const skip = (page - 1) * limit;

    const transactions = await CreditUsageTransaction.find({
      studentId,
      tenantId,
      isActive: true,
      isDeleted: false,
    })
      .sort({ usedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await CreditUsageTransaction.countDocuments({
      studentId,
      tenantId,
      isActive: true,
      isDeleted: false,
    });

    sendSuccessResponse(res, "Credit usage history retrieved successfully", {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get credit usage history error:", error);
    sendErrorResponse(res, error.message || "Failed to retrieve credit usage history", 500);
  }
};


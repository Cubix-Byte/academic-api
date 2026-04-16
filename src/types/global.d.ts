// Global type declarations for Express Request interface extension
import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        tenantName?: string;
        role?: string;
        roleName?: string;
        permissions?: string[];
        email?: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        isActive?: boolean;
        isDeleted?: boolean;
        isLocked?: boolean;
      };
    }
  }
}

export {};

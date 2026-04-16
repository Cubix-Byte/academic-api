import * as partnerRepository from "../repositories/partner.repository";
import * as tenantRepository from "../repositories/tenant.repository";
import { IPartner } from "../models";
import {
  CreatePartnerRequest,
  UpdatePartnerRequest,
  PartnerQueryParams,
} from "../types/partner.types";
import mongoose, { SortOrder } from "mongoose";

/**
 * Partner Service - Business logic for partner management
 */

// Create new partner
export const createPartner = async (data: CreatePartnerRequest) => {
  try {
    // Check if company name already exists
    const existingPartner = await partnerRepository.findPartnerByCompanyName(
      data.companyName
    );
    if (existingPartner) {
      throw new Error(
        `Partner with company name "${data.companyName}" already exists`
      );
    }

    const session = await mongoose.startSession();
    let partner;

    try {
      await session.withTransaction(async () => {
        // If this is set as default, unset other defaults
        if (data.isDefault) {
          await partnerRepository.unsetAllDefaultPartners(session);
        }

        partner = await partnerRepository.createPartner(data, session);
      });
      await session.endSession();
    } catch (error: any) {
      await session.endSession();
      throw error;
    }

    return {
      success: true,
      message: "Partner created successfully",
      data: partner,
    };
  } catch (error: any) {
    console.error("Create partner error:", error);
    throw new Error(error.message || "Failed to create partner");
  }
};

// Get all partners
export const getAllPartners = async (
  pageNo: number = 1,
  pageSize: number = 10,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const params: PartnerQueryParams = {
      pageNo,
      pageSize,
      filters,
      sort,
    };

    const partnersFromDb = await partnerRepository.findPartners(params);
    const total = await partnerRepository.countPartners(params);

    // Populate tenant count for each partner
    const partners = await Promise.all(
      partnersFromDb.map(async (partner) => {
        const partnerObj = partner.toObject();
        const tenantCount = await mongoose.model("Tenant").countDocuments({
          partnerId: partner._id.toString(),
          isDeleted: false,
        });
        return { ...partnerObj, tenantCount };
      })
    );

    return {
      success: true,
      data: partners,
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error: any) {
    console.error("Get all partners error:", error);
    throw new Error(`Failed to get partners: ${error.message}`);
  }
};

// Get partner by ID
export const getPartnerById = async (id: string) => {
  try {
    const partner = await partnerRepository.findPartnerById(id);
    if (!partner) {
      throw new Error("Partner not found");
    }

    const partnerObj = partner.toObject();
    const tenantCount = await mongoose.model("Tenant").countDocuments({
      partnerId: id,
      isDeleted: false,
    });

    return {
      success: true,
      data: { ...partnerObj, tenantCount },
    };
  } catch (error: any) {
    console.error("Get partner by ID error:", error);
    throw new Error(`Failed to get partner: ${error.message}`);
  }
};

// Update partner
export const updatePartner = async (id: string, data: UpdatePartnerRequest) => {
  try {
    const partner = await partnerRepository.findPartnerById(id);
    if (!partner) {
      throw new Error("Partner not found");
    }

    // Check company name uniqueness if changing
    if (data.companyName && data.companyName !== partner.companyName) {
      const existingPartner = await partnerRepository.findPartnerByCompanyName(
        data.companyName
      );
      if (existingPartner && existingPartner._id.toString() !== id) {
        throw new Error(
          `Partner with company name "${data.companyName}" already exists`
        );
      }
    }

    const session = await mongoose.startSession();
    let updatedPartner;

    try {
      await session.withTransaction(async () => {
        // If setting as default, unset others
        if (data.isDefault && !partner.isDefault) {
          await partnerRepository.unsetAllDefaultPartners(session);
        }

        updatedPartner = await partnerRepository.updatePartnerById(id, data);
      });
      await session.endSession();
    } catch (error: any) {
      await session.endSession();
      throw error;
    }

    return {
      success: true,
      message: "Partner updated successfully",
      data: updatedPartner,
    };
  } catch (error: any) {
    console.error("Update partner error:", error);
    throw new Error(error.message || "Failed to update partner");
  }
};

// Delete partner
export const deletePartner = async (id: string) => {
  try {
    const partner = await partnerRepository.findPartnerById(id);
    if (!partner) {
      throw new Error("Partner not found");
    }

    const deletedPartner = await partnerRepository.softDeletePartnerById(id);
    return {
      success: true,
      message: "Partner deleted successfully",
      data: deletedPartner,
    };
  } catch (error: any) {
    console.error("Delete partner error:", error);
    throw new Error(`Failed to delete partner: ${error.message}`);
  }
};

// Get partner statistics
export const getPartnerStatistics = async () => {
  try {
    const stats = await partnerRepository.getPartnerStatistics();
    return {
      success: true,
      data: stats,
    };
  } catch (error: any) {
    console.error("Get partner statistics error:", error);
    throw new Error(`Failed to get partner statistics: ${error.message}`);
  }
};
// Get tenants for a partner
export const getPartnerTenants = async (
  partnerId: string,
  pageNo: number = 1,
  pageSize: number = 10,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  try {
    const options = {
      pageNo,
      pageSize,
      filters: { ...filters, partnerId },
      sort,
    };

    const result = await tenantRepository.findTenants(options);

    return {
      success: true,
      data: result.tenants,
      pagination: {
        total: result.pagination.total,
        pageNo: result.pagination.pageNo,
        pageSize: result.pagination.pageSize,
        totalPages: result.pagination.totalPages,
      },
    };
  } catch (error: any) {
    console.error("Get partner tenants error:", error);
    throw new Error(`Failed to get partner tenants: ${error.message}`);
  }
};

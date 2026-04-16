import Partner from "../models/partner.schema";
import { Tenant } from "../models";
import mongoose, { SortOrder } from "mongoose";
import { IPartner } from "../models";
import { PartnerQueryParams, PartnerStatistics } from "../types/partner.types";

/**
 * Partner Repository - Data access layer for partner operations
 */

// Create new partner
export const createPartner = async (
  partnerData: Partial<IPartner>,
  session?: mongoose.ClientSession
): Promise<IPartner> => {
  try {
    const partner = new Partner(partnerData);
    if (session) {
      return await partner.save({ session });
    }
    return await partner.save();
  } catch (error: any) {
    console.error("Error creating partner:", error);
    throw error;
  }
};

// Find partner by ID
export const findPartnerById = async (id: string): Promise<IPartner | null> => {
  try {
    return await Partner.findOne({
      _id: id,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding partner by ID:", error);
    throw error;
  }
};

// Find partners with pagination and filtering
export const findPartners = async (
  params: PartnerQueryParams
): Promise<IPartner[]> => {
  try {
    const { pageNo = 1, pageSize = 10, filters = {}, sort = {} } = params;

    // Build base query
    const finalQuery = { isDeleted: false, ...filters };

    // Use provided sort or default to createdAt descending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ createdAt: -1 } as Record<string, SortOrder>);

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    return await Partner.find(finalQuery)
      .sort(finalSort)
      .skip(skip)
      .limit(pageSize);
  } catch (error: any) {
    console.error("Error finding partners:", error);
    throw error;
  }
};

// Count partners
export const countPartners = async (
  params: PartnerQueryParams
): Promise<number> => {
  try {
    const { filters = {} } = params;
    const finalQuery = { isDeleted: false, ...filters };

    return await Partner.countDocuments(finalQuery);
  } catch (error: any) {
    console.error("Error counting partners:", error);
    throw error;
  }
};

// Update partner by ID
export const updatePartnerById = async (
  id: string,
  updateData: Partial<IPartner>
): Promise<IPartner | null> => {
  try {
    return await Partner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        ...updateData,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );
  } catch (error: any) {
    console.error("Error updating partner by ID:", error);
    throw error;
  }
};

// Soft delete partner by ID
export const softDeletePartnerById = async (
  id: string
): Promise<IPartner | null> => {
  try {
    return await Partner.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
      },
      { new: true }
    );
  } catch (error: any) {
    console.error("Error soft deleting partner by ID:", error);
    throw error;
  }
};

// Hard delete partner by ID
export const deletePartnerById = async (
  id: string
): Promise<IPartner | null> => {
  try {
    return await Partner.findByIdAndDelete(id);
  } catch (error: any) {
    console.error("Error deleting partner by ID:", error);
    throw error;
  }
};

// Get partner statistics
export const getPartnerStatistics = async (): Promise<PartnerStatistics> => {
  try {
    const total = await Partner.countDocuments();
    const active = await Partner.countDocuments({
      isActive: true,
      isDeleted: false,
    });
    const deleted = await Partner.countDocuments({ isDeleted: true });

    const totalAssignedTenants = await Tenant.countDocuments({ isDeleted: false });

    const defaultPartner = await Partner.findOne({
      isDefault: true,
      isDeleted: false,
    }).select("_id");

    return {
      total,
      active,
      deleted,
      totalAssignedTenants,
      defaultPartner: defaultPartner?._id.toString(),
    };
  } catch (error: any) {
    console.error("Error getting partner statistics:", error);
    throw error;
  }
};

// Find partner by company name
export const findPartnerByCompanyName = async (
  companyName: string
): Promise<IPartner | null> => {
  try {
    return await Partner.findOne({ companyName, isDeleted: false });
  } catch (error: any) {
    console.error("Error finding partner by company name:", error);
    throw error;
  }
};

// Unset default from all partners
export const unsetAllDefaultPartners = async (
  session?: mongoose.ClientSession
): Promise<void> => {
  try {
    if (session) {
      await Partner.updateMany(
        { isDefault: true },
        { isDefault: false },
        { session }
      );
    } else {
      await Partner.updateMany({ isDefault: true }, { isDefault: false });
    }
  } catch (error: any) {
    console.error("Error unsetting default partners:", error);
    throw error;
  }
};

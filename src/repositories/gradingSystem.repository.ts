import { GradingSystem, IGradingSystem, Exam } from "../models";
import {
  CreateGradingSystemRequest,
  UpdateGradingSystemRequest,
  SearchGradingSystemsRequest,
  GradingSystemResponse,
  GradingSystemListResponse,
  GradingSystemStatistics,
} from "../types/gradingSystem.types";
import mongoose from "mongoose";

/**
 * Grading System Repository - Data access layer for grading system operations
 */

// Create grading system
export const createGradingSystem = async (
  data: CreateGradingSystemRequest,
  tenantId: string,
  tenantName: string
): Promise<GradingSystemResponse> => {
  try {
    const gradingSystem = new GradingSystem({
      ...data,
      tenantId: new mongoose.Types.ObjectId(tenantId),
      tenantName,
      createdBy: new mongoose.Types.ObjectId(), // TODO: Get from auth context
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedGradingSystem = await gradingSystem.save();
    return mapToResponse(savedGradingSystem);
  } catch (error) {
    console.error("Create grading system repository error:", error);
    throw error;
  }
};

// Get all grading systems
export const getAllGradingSystems = async (
  tenantId?: string,
  page: number = 1,
  limit: number = 10
): Promise<GradingSystemListResponse> => {
  try {
    const query: any = { isDeleted: false };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const skip = (page - 1) * limit;

    const [gradingSystems, total] = await Promise.all([
      GradingSystem.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GradingSystem.countDocuments(query),
    ]);

    return {
      gradingSystems: gradingSystems.map(mapToResponse),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Get all grading systems repository error:", error);
    throw error;
  }
};

// Find grading system by ID
export const findGradingSystemById = async (
  id: string,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    const query: any = {
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const gradingSystem = await GradingSystem.findOne(query).lean();
    return gradingSystem ? mapToResponse(gradingSystem) : null;
  } catch (error) {
    console.error("Find grading system by ID repository error:", error);
    throw error;
  }
};

// Find grading system by name
export const findGradingSystemByName = async (
  name: string,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    const query: any = {
      systemName: name,
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const gradingSystem = await GradingSystem.findOne(query).lean();
    return gradingSystem ? mapToResponse(gradingSystem) : null;
  } catch (error) {
    console.error("Find grading system by name repository error:", error);
    throw error;
  }
};

// Update grading system
export const updateGradingSystem = async (
  id: string,
  data: UpdateGradingSystemRequest,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    const query: any = {
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const updateData = {
      ...data,
      updatedBy: new mongoose.Types.ObjectId(), // TODO: Get from auth context
      updatedAt: new Date(),
    };

    const gradingSystem = await GradingSystem.findOneAndUpdate(
      query,
      updateData,
      { new: true }
    ).lean();

    return gradingSystem ? mapToResponse(gradingSystem) : null;
  } catch (error) {
    console.error("Update grading system repository error:", error);
    throw error;
  }
};

// Delete grading system
export const deleteGradingSystem = async (
  id: string,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    const query: any = {
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const gradingSystem = await GradingSystem.findOneAndUpdate(
      query,
      {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    return gradingSystem ? mapToResponse(gradingSystem) : null;
  } catch (error) {
    console.error("Delete grading system repository error:", error);
    throw error;
  }
};

// Search grading systems
export const searchGradingSystems = async (
  data: SearchGradingSystemsRequest,
  tenantId?: string
): Promise<GradingSystemListResponse> => {
  try {
    const query: any = { isDeleted: false };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    // Add search filters
    if (data.query) {
      query.$or = [
        { systemName: { $regex: data.query, $options: "i" } },
        { description: { $regex: data.query, $options: "i" } },
      ];
    }

    if (data.isActive !== undefined) {
      query.isActive = data.isActive;
    }

    if (data.isDefault !== undefined) {
      query.isDefault = data.isDefault;
    }

    const page = data.page || 1;
    const limit = data.limit || 10;
    const skip = (page - 1) * limit;

    // Sort options
    const sortBy = data.sortBy || "createdAt";
    const sortOrder = data.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const [gradingSystems, total] = await Promise.all([
      GradingSystem.find(query)
        .sort(sort as any)
        .skip(skip)
        .limit(limit)
        .lean(),
      GradingSystem.countDocuments(query),
    ]);

    return {
      gradingSystems: gradingSystems.map(mapToResponse),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Search grading systems repository error:", error);
    throw error;
  }
};

// Get grading system statistics
export const getGradingSystemStatistics = async (
  tenantId?: string
): Promise<GradingSystemStatistics> => {
  try {
    const query: any = { isDeleted: false };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    const [
      totalGradingSystems,
      activeGradingSystems,
      defaultGradingSystems,
      gradingSystemsByTenant,
      averageGradeRanges,
    ] = await Promise.all([
      GradingSystem.countDocuments(query),
      GradingSystem.countDocuments({ ...query, isActive: true }),
      GradingSystem.countDocuments({ ...query, isDefault: true }),
      GradingSystem.aggregate([
        { $match: query },
        { $group: { _id: "$tenantName", count: { $sum: 1 } } },
      ]),
      GradingSystem.aggregate([
        { $match: query },
        { $project: { gradeRangesCount: { $size: "$gradeRanges" } } },
        { $group: { _id: null, average: { $avg: "$gradeRangesCount" } } },
      ]),
    ]);

    const tenantStats: Record<string, number> = {};
    gradingSystemsByTenant.forEach((item: any) => {
      tenantStats[item._id] = item.count;
    });

    return {
      totalGradingSystems,
      activeGradingSystems,
      defaultGradingSystems,
      gradingSystemsByTenant: tenantStats,
      averageGradeRanges: averageGradeRanges[0]?.average || 0,
    };
  } catch (error) {
    console.error("Get grading system statistics repository error:", error);
    throw error;
  }
};

// Find active grading system for tenant
export const findActiveGradingSystem = async (
  tenantId: string
): Promise<GradingSystemResponse | null> => {
  try {
    const gradingSystem = await GradingSystem.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false,
    }).lean();

    return gradingSystem ? mapToResponse(gradingSystem) : null;
  } catch (error) {
    console.error("Find active grading system repository error:", error);
    throw error;
  }
};

// Check if grading system is in use
export const isGradingSystemInUse = async (id: string): Promise<boolean> => {
  try {
    // Check if any exams are using this grading system
    const count = await Exam.countDocuments({
      gradingSystemId: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    });

    return count > 0;
  } catch (error) {
    console.error("Check grading system in use repository error:", error);
    throw error;
  }
};

// Helper function to map database model to response type
function mapToResponse(gradingSystem: any): GradingSystemResponse {
  return {
    _id: gradingSystem._id.toString(),
    systemName: gradingSystem.systemName,
    description: gradingSystem.description,
    gradeRanges: gradingSystem.gradeRanges,
    isActive: gradingSystem.isActive,
    isDefault: gradingSystem.isDefault,
    tenantId: gradingSystem.tenantId.toString(),
    tenantName: gradingSystem.tenantName,
    createdAt: gradingSystem.createdAt.toISOString(),
    updatedAt: gradingSystem.updatedAt.toISOString(),
    createdBy: gradingSystem.createdBy.toString(),
    updatedBy: gradingSystem.updatedBy?.toString(),
  };
}

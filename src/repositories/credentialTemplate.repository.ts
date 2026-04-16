import { CredentialTemplate, ICredentialTemplate } from "../models";
import mongoose from "mongoose";
import {
  CreateCredentialTemplateRequest,
  GetCredentialTemplatesRequest,
} from "../types/credentialTemplate.types";
import {
  CredentialType,
  CredentialGeneratedBy,
  CredentialFilterType,
} from "../utils/constants/credentialEnums";

/**
 * Credential Template Repository - Data access layer
 */

// Create credential template
export const createCredentialTemplate = async (
  data: CreateCredentialTemplateRequest & {
    tenantId: string;
    createdBy: string;
  }
): Promise<ICredentialTemplate> => {
  try {
    // Debug logging
    console.log("📦 [REPOSITORY] Creating credential template with data:", {
      meritBadge: data.meritBadge,
      credentialType: data.credentialType,
      validationPeriod: data.validationPeriod,
      issuingCriteria: data.issuingCriteria,
      credentialInfo: data.credentialInfo,
      subjectId: data.subjectId,
      classId: data.classId,
      createdBy: data.createdBy,
      tenantId: data.tenantId,
    });

    // Validate required fields before creating
    if (!data.meritBadge) {
      throw new Error("meritBadge is required");
    }
    if (!data.credentialType) {
      throw new Error("credentialType is required");
    }
    if (!data.validationPeriod) {
      throw new Error("validationPeriod is required");
    }
    if (!data.issuingCriteria) {
      throw new Error("issuingCriteria is required");
    }
    if (!data.credentialInfo) {
      throw new Error("credentialInfo is required");
    }

    const template = new CredentialTemplate({
      meritBadge: data.meritBadge,
      credentialType: data.credentialType,
      validationPeriod: data.validationPeriod,
      subjectId: data.subjectId
        ? new mongoose.Types.ObjectId(data.subjectId)
        : undefined,
      classId: data.classId
        ? new mongoose.Types.ObjectId(data.classId)
        : undefined,
      issuingCriteria: data.issuingCriteria,
      credentialInfo: data.credentialInfo,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      filePath: data.filePath,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      generatedBy: data.generatedBy || CredentialGeneratedBy.MANUAL,
      tenantId: new mongoose.Types.ObjectId(data.tenantId),
      isDeleted: false,
    });

    return await template.save();
  } catch (error: any) {
    console.error("Error creating credential template:", error);
    throw error;
  }
};

// Find credential template by ID
export const findCredentialTemplateById = async (
  credentialTemplateId: string,
  tenantId?: string
): Promise<ICredentialTemplate | null> => {
  try {
    const query: any = {
      _id: credentialTemplateId,
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    return await CredentialTemplate.findOne(query)
      .populate("subjectId", "name")
      .populate("classId", "name")
      .populate("createdBy", "firstName lastName");
  } catch (error: any) {
    console.error("Error finding credential template by ID:", error);
    throw error;
  }
};

// Find credential templates with filters
export const findCredentialTemplates = async (params: {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
}): Promise<ICredentialTemplate[]> => {
  try {
    const {
      tenantId,
      pageNo = 1,
      pageSize = 10,
      filters = {},
      sort = { createdAt: -1 },
    } = params;

    // Build base query
    const baseQuery: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Handle ObjectId conversions for subjectId and classId if they exist in filters
    if (finalQuery.subjectId && typeof finalQuery.subjectId === "string") {
      finalQuery.subjectId = new mongoose.Types.ObjectId(finalQuery.subjectId);
    }
    if (finalQuery.classId && typeof finalQuery.classId === "string") {
      finalQuery.classId = new mongoose.Types.ObjectId(finalQuery.classId);
    }
    if (finalQuery.createdBy && typeof finalQuery.createdBy === "string") {
      finalQuery.createdBy = new mongoose.Types.ObjectId(finalQuery.createdBy);
    }

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    return await CredentialTemplate.find(finalQuery)
      .populate("subjectId", "name")
      .populate("classId", "name")
      .populate("createdBy", "firstName lastName")
      .sort(sort)
      .skip(skip)
      .limit(pageSize);
  } catch (error: any) {
    console.error("Error finding credential templates:", error);
    throw error;
  }
};

// Count credential templates
export const countCredentialTemplates = async (params: {
  tenantId: string;
  filters?: Record<string, any>;
}): Promise<number> => {
  try {
    const { tenantId, filters = {} } = params;

    // Build base query
    const baseQuery: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Handle ObjectId conversions for subjectId and classId if they exist in filters
    if (finalQuery.subjectId && typeof finalQuery.subjectId === "string") {
      finalQuery.subjectId = new mongoose.Types.ObjectId(finalQuery.subjectId);
    }
    if (finalQuery.classId && typeof finalQuery.classId === "string") {
      finalQuery.classId = new mongoose.Types.ObjectId(finalQuery.classId);
    }
    if (finalQuery.createdBy && typeof finalQuery.createdBy === "string") {
      finalQuery.createdBy = new mongoose.Types.ObjectId(finalQuery.createdBy);
    }

    return await CredentialTemplate.countDocuments(finalQuery);
  } catch (error: any) {
    console.error("Error counting credential templates:", error);
    throw error;
  }
};

// Update credential template
export const updateCredentialTemplate = async (
  credentialTemplateId: string,
  data: Partial<CreateCredentialTemplateRequest>,
  tenantId: string
): Promise<ICredentialTemplate | null> => {
  try {
    const updateData: any = {};

    if (data.meritBadge !== undefined) updateData.meritBadge = data.meritBadge;
    if (data.credentialType !== undefined)
      updateData.credentialType = data.credentialType;
    if (data.validationPeriod !== undefined)
      updateData.validationPeriod = data.validationPeriod;
    if (data.subjectId !== undefined) {
      updateData.subjectId = data.subjectId
        ? new mongoose.Types.ObjectId(data.subjectId)
        : null;
    }
    if (data.classId !== undefined) {
      updateData.classId = data.classId
        ? new mongoose.Types.ObjectId(data.classId)
        : null;
    }
    if (data.issuingCriteria !== undefined)
      updateData.issuingCriteria = data.issuingCriteria;
    if (data.credentialInfo !== undefined)
      updateData.credentialInfo = data.credentialInfo;
    if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
    if (data.fileName !== undefined) updateData.fileName = data.fileName;
    if (data.filePath !== undefined) updateData.filePath = data.filePath;
    if (data.mimeType !== undefined) updateData.mimeType = data.mimeType;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;

    return await CredentialTemplate.findOneAndUpdate(
      {
        _id: credentialTemplateId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      },
      updateData,
      { new: true }
    )
      .populate("subjectId", "name")
      .populate("classId", "name")
      .populate("createdBy", "firstName lastName");
  } catch (error: any) {
    console.error("Error updating credential template:", error);
    throw error;
  }
};

// Delete credential template (soft delete)
export const deleteCredentialTemplate = async (
  credentialTemplateId: string,
  tenantId: string
): Promise<boolean> => {
  try {
    const result = await CredentialTemplate.updateOne(
      {
        _id: credentialTemplateId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      },
      { isDeleted: true }
    );

    return result.modifiedCount > 0;
  } catch (error: any) {
    console.error("Error deleting credential template:", error);
    throw error;
  }
};

// Get all credential templates for repository (simplified list)
export const getCredentialRepository = async (
  tenantId: string
): Promise<ICredentialTemplate[]> => {
  try {
    return await CredentialTemplate.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    })
      .populate("subjectId", "name")
      .populate("classId", "name")
      .select("meritBadge credentialType validationPeriod subjectId classId")
      .sort({ createdAt: -1 });
  } catch (error: any) {
    console.error("Error getting credential repository:", error);
    throw error;
  }
};

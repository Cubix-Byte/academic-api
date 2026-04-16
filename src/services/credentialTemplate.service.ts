import * as credentialTemplateRepository from "../repositories/credentialTemplate.repository";
import {
  CreateCredentialTemplateRequest,
  UpdateCredentialTemplateRequest,
  CredentialTemplateResponse,
  GetCredentialTemplatesResponse,
  CredentialRepositoryResponse,
} from "@/types/credentialTemplate.types";
import { fetchUserNames } from "@/utils/activityLog.helper";

/**
 * Credential Template Service - Business logic for credential template management
 */

// Create credential template
export const createCredentialTemplate = async (
  data: CreateCredentialTemplateRequest,
  createdBy: string,
  tenantId: string
): Promise<CredentialTemplateResponse> => {
  try {
    const template =
      await credentialTemplateRepository.createCredentialTemplate({
        ...data,
        createdBy,
        tenantId,
      });

    // Fetch creator name
    const userNames = await fetchUserNames([createdBy]);
    const createdByName = userNames[createdBy] || "Unknown User";

    return {
      credentialTemplateId: template._id.toString(),
      meritBadge: template.meritBadge,
      credentialType: template.credentialType,
      validationPeriod: template.validationPeriod,
      subjectId: template.subjectId?.toString(),
      subjectName: (template.subjectId as any)?.name,
      classId: template.classId?.toString(),
      className: (template.classId as any)?.name,
      issuingCriteria: template.issuingCriteria,
      credentialInfo: template.credentialInfo,
      fileUrl: template.fileUrl,
      fileName: template.fileName,
      filePath: template.filePath,
      mimeType: template.mimeType,
      fileSize: template.fileSize,
      createdBy: template.createdBy.toString(),
      createdByName,
      generatedBy: template.generatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  } catch (error) {
    console.error("Create credential template error:", error);
    throw error;
  }
};

// Get credential templates
export const getCredentialTemplates = async (params: {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
}): Promise<GetCredentialTemplatesResponse> => {
  try {
    const templates =
      await credentialTemplateRepository.findCredentialTemplates(params);
    const total = await credentialTemplateRepository.countCredentialTemplates({
      tenantId: params.tenantId,
      filters: params.filters,
    });

    // Get unique creator IDs
    const creatorIds = [
      ...new Set(templates.map((t) => t.createdBy.toString())),
    ];
    const userNames = await fetchUserNames(creatorIds);

    // Find all issued credentials for these templates (match by meritBadge name)
    const { ExamCredential } = await import("../models");
    const mongoose = await import("mongoose");
    const templateNames = templates.map((t) => t.meritBadge);

    // Find all issued credentials (we'll match by name case-insensitively)
    const issuedCredentials = await ExamCredential.find({
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      isDeleted: false,
      isActive: true,
    })
      .select("credentialName studentId")
      .lean();

    // Group issued credentials by template name (case-insensitive matching)
    const credentialsByTemplate: Record<string, string[]> = {};
    const templateNameMap: Record<string, string> = {}; // Map lowercase to original case

    // Create a map of lowercase template names to original case
    templates.forEach((template) => {
      const lowerName = template.meritBadge.toLowerCase();
      templateNameMap[lowerName] = template.meritBadge;
      if (!credentialsByTemplate[template.meritBadge]) {
        credentialsByTemplate[template.meritBadge] = [];
      }
    });

    // Match issued credentials to templates (case-insensitive)
    issuedCredentials.forEach((cred: any) => {
      const credName = cred.credentialName || "";
      const lowerCredName = credName.toLowerCase();

      // Find matching template name (case-insensitive)
      const matchingTemplateName = templateNameMap[lowerCredName];
      if (matchingTemplateName) {
        credentialsByTemplate[matchingTemplateName].push(
          cred.studentId.toString()
        );
      }
    });

    // Get all unique student IDs
    const allStudentIds = [
      ...new Set(Object.values(credentialsByTemplate).flat()),
    ];
    const studentNames = await fetchUserNames(allStudentIds);

    // Map to response
    const credentialTemplates: CredentialTemplateResponse[] = templates.map(
      (template) => {
        const createdByName =
          userNames[template.createdBy.toString()] || "Unknown User";

        // Handle populated subjectId (could be ObjectId or populated object)
        const subjectIdObj = template.subjectId as any;
        const subjectId = subjectIdObj?._id
          ? subjectIdObj._id.toString()
          : subjectIdObj?.toString() || undefined;
        const subjectName = subjectIdObj?.name || undefined;

        // Handle populated classId (could be ObjectId or populated object)
        const classIdObj = template.classId as any;
        const classId = classIdObj?._id
          ? classIdObj._id.toString()
          : classIdObj?.toString() || undefined;
        const className = classIdObj?.name || undefined;

        // Get students who have been issued this credential
        const studentIds = credentialsByTemplate[template.meritBadge] || [];
        const students = studentIds.map((studentId) => ({
          studentId,
          studentName: studentNames[studentId] || "Unknown Student",
        }));

        return {
          credentialTemplateId: template._id.toString(),
          meritBadge: template.meritBadge,
          credentialType: template.credentialType,
          validationPeriod: template.validationPeriod,
          subjectId,
          subjectName,
          classId,
          className,
          issuingCriteria: template.issuingCriteria,
          credentialInfo: template.credentialInfo,
          fileUrl: template.fileUrl,
          fileName: template.fileName,
          filePath: template.filePath,
          mimeType: template.mimeType,
          fileSize: template.fileSize,
          createdBy: template.createdBy.toString(),
          createdByName,
          generatedBy: template.generatedBy,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          students: students, // Always return array, even if empty
          totalIssuedCount: students.length,
        };
      }
    );

    // Repository already handles pagination, so use templates directly
    const pageNo = params.pageNo || 1;
    const pageSize = params.pageSize || 10;

    return {
      credentialTemplates,
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get credential templates error:", error);
    throw error;
  }
};

// Get credential template by ID
export const getCredentialTemplateById = async (
  credentialTemplateId: string,
  tenantId: string
): Promise<CredentialTemplateResponse> => {
  try {
    const template =
      await credentialTemplateRepository.findCredentialTemplateById(
        credentialTemplateId,
        tenantId
      );

    if (!template) {
      throw new Error("CREDENTIAL_TEMPLATE_NOT_FOUND");
    }

    const userNames = await fetchUserNames([template.createdBy.toString()]);
    const createdByName =
      userNames[template.createdBy.toString()] || "Unknown User";

    return {
      credentialTemplateId: template._id.toString(),
      meritBadge: template.meritBadge,
      credentialType: template.credentialType,
      validationPeriod: template.validationPeriod,
      subjectId: template.subjectId?.toString(),
      subjectName: (template.subjectId as any)?.name,
      classId: template.classId?.toString(),
      className: (template.classId as any)?.name,
      issuingCriteria: template.issuingCriteria,
      credentialInfo: template.credentialInfo,
      fileUrl: template.fileUrl,
      fileName: template.fileName,
      filePath: template.filePath,
      mimeType: template.mimeType,
      fileSize: template.fileSize,
      createdBy: template.createdBy.toString(),
      createdByName,
      generatedBy: template.generatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  } catch (error) {
    console.error("Get credential template by ID error:", error);
    throw error;
  }
};

// Update credential template
export const updateCredentialTemplate = async (
  data: UpdateCredentialTemplateRequest,
  tenantId: string
): Promise<CredentialTemplateResponse> => {
  try {
    const template =
      await credentialTemplateRepository.updateCredentialTemplate(
        data.credentialTemplateId,
        data,
        tenantId
      );

    if (!template) {
      throw new Error("CREDENTIAL_TEMPLATE_NOT_FOUND");
    }

    const userNames = await fetchUserNames([template.createdBy.toString()]);
    const createdByName =
      userNames[template.createdBy.toString()] || "Unknown User";

    return {
      credentialTemplateId: template._id.toString(),
      meritBadge: template.meritBadge,
      credentialType: template.credentialType,
      validationPeriod: template.validationPeriod,
      subjectId: template.subjectId?.toString(),
      subjectName: (template.subjectId as any)?.name,
      classId: template.classId?.toString(),
      className: (template.classId as any)?.name,
      issuingCriteria: template.issuingCriteria,
      credentialInfo: template.credentialInfo,
      fileUrl: template.fileUrl,
      fileName: template.fileName,
      filePath: template.filePath,
      mimeType: template.mimeType,
      fileSize: template.fileSize,
      createdBy: template.createdBy.toString(),
      createdByName,
      generatedBy: template.generatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  } catch (error) {
    console.error("Update credential template error:", error);
    throw error;
  }
};

// Delete credential template
export const deleteCredentialTemplate = async (
  credentialTemplateId: string,
  tenantId: string
): Promise<void> => {
  try {
    const deleted = await credentialTemplateRepository.deleteCredentialTemplate(
      credentialTemplateId,
      tenantId
    );

    if (!deleted) {
      throw new Error("CREDENTIAL_TEMPLATE_NOT_FOUND");
    }
  } catch (error) {
    console.error("Delete credential template error:", error);
    throw error;
  }
};

// Get credential repository (simplified list)
export const getCredentialRepository = async (
  tenantId: string
): Promise<CredentialRepositoryResponse> => {
  try {
    const templates =
      await credentialTemplateRepository.getCredentialRepository(tenantId);

    return {
      credentialTemplates: templates.map((template) => ({
        credentialTemplateId: template._id.toString(),
        meritBadge: template.meritBadge,
        credentialType: template.credentialType,
        validationPeriod: template.validationPeriod,
        subjectName: (template.subjectId as any)?.name,
        className: (template.classId as any)?.name,
      })),
    };
  } catch (error) {
    console.error("Get credential repository error:", error);
    throw error;
  }
};

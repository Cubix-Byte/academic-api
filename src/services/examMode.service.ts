import * as examModeRepository from "../repositories/examMode.repository";
import { IExamMode } from "@/models";
import {
    CreateExamModeRequest,
    UpdateExamModeRequest,
    GetAllExamModesRequest,
    GetAllExamModesResponse,
    ExamModeStatistics,
    ExamModeDDLResponse
} from "@/types/examMode.types";

/**
 * ExamMode Service - Business logic for exam mode management
 */

// Create new exam mode
export const createExamMode = async (
	data: CreateExamModeRequest,
	tenantId: string,
	createdBy: string,
): Promise<IExamMode> => {
	try {
		// Check if exam mode name already exists for this tenant (tenant-scoped uniqueness)
		const existingExamMode = await examModeRepository.findExamModeByNameAndTenant(data.name, tenantId);
		if (existingExamMode) {
			throw new Error('EXAM_MODE_NAME_EXISTS');
		}

		// Add tenantId and createdBy to data
		const examModeData = {
			...data,
			tenantId: tenantId,
			createdBy: createdBy,
		};

		console.log('📝 Creating exam mode with data:', JSON.stringify(examModeData, null, 2));

		const examMode = await examModeRepository.createExamMode(examModeData);
		console.log('✅ Exam mode created successfully:', examMode._id);

		return examMode;
	} catch (error) {
		console.error('Create exam mode error:', error);
		throw error;
	}
};

// Get exam mode by ID
export const getExamModeById = async (id: string): Promise<IExamMode> => {
  const examMode = await examModeRepository.findExamModeById(id);
  if (!examMode) {
    throw new Error("EXAM_MODE_NOT_FOUND");
  }
  return examMode;
};

// Update exam mode
export const updateExamMode = async (
  id: string,
  data: UpdateExamModeRequest,
  tenantId: string
): Promise<IExamMode> => {
  const examMode = await examModeRepository.findExamModeById(id);
  if (!examMode) {
    throw new Error("EXAM_MODE_NOT_FOUND");
  }

  // Verify tenant ownership
  if (examMode.tenantId && examMode.tenantId.toString() !== tenantId) {
    throw new Error("EXAM_MODE_NOT_FOUND"); // Return NOT_FOUND to hide existence from other tenants
  }

  // Check if exam mode name already exists for this tenant (if name is being updated)
  if (data.name && data.name !== examMode.name) {
    const existingExamMode = await examModeRepository.findExamModeByNameAndTenant(data.name, tenantId);
    if (existingExamMode) {
      throw new Error('EXAM_MODE_NAME_EXISTS');
    }
  }

  // Update exam mode record
  const updatedExamMode = await examModeRepository.updateExamModeById(id, data);
  if (!updatedExamMode) {
    throw new Error("EXAM_MODE_NOT_FOUND");
  }
  return updatedExamMode;
};

// Delete exam mode
export const deleteExamMode = async (id: string): Promise<IExamMode | null> => {
  const examMode = await examModeRepository.findExamModeById(id);
  if (!examMode) {
    throw new Error("EXAM_MODE_NOT_FOUND");
  }

  // TODO: Check if exam mode is used in any exams before deleting
  // This will be implemented when Exam model is used

  // Soft delete exam mode record
  const deletedExamMode = await examModeRepository.softDeleteExamModeById(id);
  return deletedExamMode;
};

// Get all exam modes
export const getAllExamModes = async (params: GetAllExamModesRequest): Promise<GetAllExamModesResponse> => {
	const examModes = await examModeRepository.findExamModes(params);
	const total = await examModeRepository.countExamModes(params);

	return {
		examModes,
		pagination: {
			total,
			pageNo: params.pageNo || 1,
			pageSize: params.pageSize || 10,
			totalPages: Math.ceil(total / (params.pageSize || 10)),
		},
	};
};

// Get exam mode statistics
export const getExamModeStatistics = async (tenantId?: string): Promise<ExamModeStatistics> => {
	try {
		return await examModeRepository.getExamModeStatistics(tenantId);
	} catch (error) {
		console.error('Error getting exam mode statistics:', error);
		throw error;
	}
};

// Search exam modes
export const searchExamModes = async (
	searchTerm: string,
	params: GetAllExamModesRequest,
): Promise<GetAllExamModesResponse> => {
	const searchParams: GetAllExamModesRequest = {
		...params,
		search: searchTerm,
	};

	return await getAllExamModes(searchParams);
};

// Get exam modes dropdown list (DDL)
export const getExamModesDDL = async (tenantId?: string): Promise<ExamModeDDLResponse> => {
	try {
		const examModes = await examModeRepository.getActiveExamModesForDDL(tenantId);
		
		const examModeDDLItems = examModes.map(examMode => ({
			id: examMode._id.toString(),
			name: examMode.name
		}));

		return {
			examModes: examModeDDLItems
		};
	} catch (error) {
		console.error('Error getting exam modes DDL:', error);
		throw error;
	}
};


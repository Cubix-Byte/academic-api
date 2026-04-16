import * as examBuilderRepository from "../repositories/examBuilder.repository";
import {
    CreateExamBuilderRequest,
    ExamBuilderResponse,
    ExamBuilderStatistics,
    GetAllExamBuildersRequest,
    GetAllExamBuildersResponse,
    UpdateExamBuilderRequest,
} from "@/types/examBuilder.types";
import {IExamBuilder} from "@/models";

/**
 * ExamBuilder Service - Business logic for exam builder management
 */

// Create new exam builder
export const createExamBuilder = async (
  data: CreateExamBuilderRequest,
  tenantId: string,
  createdBy: string
): Promise<IExamBuilder> => {
  try {
    const examBuilderData = {
      ...data,
      tenantId,
      createdBy,
      status: data.status || "Draft",
    };

    return await examBuilderRepository.createExamBuilder(
        examBuilderData
    );
  } catch (error: any) {
    console.error("Error creating exam builder:", error);
    throw error;
  }
};

// Get exam builder by ID
export const getExamBuilder = async (
  id: string
): Promise<ExamBuilderResponse | null> => {
  try {
    const examBuilder = await examBuilderRepository.findExamBuilderById(id);
    if (!examBuilder) {
      return null;
    }

    return examBuilder as unknown as ExamBuilderResponse;
  } catch (error: any) {
    console.error("Error getting exam builder:", error);
    throw error;
  }
};

// Get all exam builders with filters and pagination
export const getAllExamBuilders = async (
  params: GetAllExamBuildersRequest
): Promise<GetAllExamBuildersResponse> => {
  try {
    const { pageNo = 1, pageSize = 10 } = params;

    const [examBuilders, total] = await Promise.all([
      examBuilderRepository.findExamBuilders(params),
      examBuilderRepository.countExamBuilders(params),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      examBuilders: examBuilders as unknown as ExamBuilderResponse[],
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages,
      },
    };
  } catch (error: any) {
    console.error("Error getting all exam builders:", error);
    throw error;
  }
};

// Update exam builder
export const updateExamBuilder = async (
  id: string,
  data: UpdateExamBuilderRequest
): Promise<IExamBuilder | null> => {
  try {
    const examBuilder = await examBuilderRepository.updateExamBuilderById(
      id,
      data
    );

    return examBuilder;
  } catch (error: any) {
    console.error("Error updating exam builder:", error);
    throw error;
  }
};

// Delete exam builder (soft delete)
export const deleteExamBuilder = async (
  id: string
): Promise<IExamBuilder | null> => {
  try {
    const examBuilder = await examBuilderRepository.softDeleteExamBuilderById(
      id
    );

    return examBuilder;
  } catch (error: any) {
    console.error("Error deleting exam builder:", error);
    throw error;
  }
};

// Get exam builder statistics
export const getExamBuilderStatistics = async (
  tenantId: string,
  createdBy?: string
): Promise<ExamBuilderStatistics> => {
  try {
    const statistics = await examBuilderRepository.getExamBuilderStatistics(
      tenantId,
      createdBy
    );

    return statistics;
  } catch (error: any) {
    console.error("Error getting exam builder statistics:", error);
    throw error;
  }
};

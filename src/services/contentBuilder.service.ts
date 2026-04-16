import * as contentBuilderRepository from "../repositories/contentBuilder.repository";
import {
  CreateContentBuilderRequest,
  ContentBuilderResponse,
  GetAllContentBuildersRequest,
  GetAllContentBuildersResponse,
  UpdateContentBuilderRequest,
} from "@/types/contentBuilder.types";
import { IContentBuilder } from "@/models";

/**
 * ContentBuilder Service - Business logic for content builder management
 */

// Create new content builder
export const createContentBuilder = async (
  data: CreateContentBuilderRequest,
  tenantId: string,
  teacherId: string,
  createdBy: string
): Promise<IContentBuilder> => {
  try {
    const contentBuilderData = {
      ...data,
      tenantId,
      teacherId,
      createdBy,
    };

    return await contentBuilderRepository.createContentBuilder(
      contentBuilderData
    );
  } catch (error: any) {
    console.error("Error creating content builder:", error);
    throw error;
  }
};

// Get content builder by ID
export const getContentBuilder = async (
  id: string
): Promise<ContentBuilderResponse | null> => {
  try {
    const contentBuilder = await contentBuilderRepository.findContentBuilderById(id);
    if (!contentBuilder) {
      return null;
    }

    return contentBuilder as unknown as ContentBuilderResponse;
  } catch (error: any) {
    console.error("Error getting content builder:", error);
    throw error;
  }
};

// Get all content builders with filters and pagination
export const getAllContentBuilders = async (
  params: GetAllContentBuildersRequest
): Promise<GetAllContentBuildersResponse> => {
  try {
    const { pageNo = 1, pageSize = 10 } = params;

    const [contentBuilders, total] = await Promise.all([
      contentBuilderRepository.findContentBuilders(params),
      contentBuilderRepository.countContentBuilders(params),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      contentBuilders: contentBuilders as unknown as ContentBuilderResponse[],
      pagination: {
        total,
        pageNo,
        pageSize,
        totalPages,
      },
    };
  } catch (error: any) {
    console.error("Error getting all content builders:", error);
    throw error;
  }
};

// Update content builder
export const updateContentBuilder = async (
  id: string,
  data: UpdateContentBuilderRequest
): Promise<IContentBuilder | null> => {
  try {
    const contentBuilder = await contentBuilderRepository.updateContentBuilderById(
      id,
      data
    );

    return contentBuilder;
  } catch (error: any) {
    console.error("Error updating content builder:", error);
    throw error;
  }
};

// Delete content builder (soft delete)
export const deleteContentBuilder = async (
  id: string
): Promise<IContentBuilder | null> => {
  try {
    return await contentBuilderRepository.softDeleteContentBuilderById(id);
  } catch (error: any) {
    console.error("Error deleting content builder:", error);
    throw error;
  }
};

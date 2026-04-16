import * as classTopicPerformanceRepository from "../repositories/classTopicPerformance.repository";
import {
  GetTopicStatisticsRequest,
  GetTopicStatisticsResponse,
} from "@/types/classTopicPerformance.types";

/**
 * Class Topic Performance Service - Business logic for topic performance statistics
 */

// Get topic statistics for a class and subject
export const getTopicStatistics = async (
  params: GetTopicStatisticsRequest & { tenantId: string }
): Promise<GetTopicStatisticsResponse> => {
  try {
    const { classId, subjectId, tenantId } = params;

    if (!classId) {
      throw new Error("Class ID is required");
    }

    if (!subjectId) {
      throw new Error("Subject ID is required");
    }

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    // Get aggregated topic statistics
    const topics = await classTopicPerformanceRepository.aggregateTopicStatistics(
      classId,
      subjectId,
      tenantId
    );

    return {
      success: true,
      message: "Topic statistics retrieved successfully",
      data: {
        classId,
        subjectId,
        topics,
      },
    };
  } catch (error: any) {
    console.error("Get topic statistics error:", error);
    throw new Error(`Failed to get topic statistics: ${error.message}`);
  }
};


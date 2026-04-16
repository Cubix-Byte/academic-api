import * as gradingSystemRepository from "../repositories/gradingSystem.repository";
import {
  CreateGradingSystemRequest,
  UpdateGradingSystemRequest,
  SearchGradingSystemsRequest,
  GradingSystemResponse,
  GradingSystemListResponse,
  GradingSystemStatistics,
  CalculateGradeResponse,
} from "@/types/gradingSystem.types";

/**
 * Grading System Service - Business logic for grading system management
 */

// Create grading system
export const createGradingSystem = async (
  data: CreateGradingSystemRequest,
  tenantId: string,
  tenantName: string
): Promise<GradingSystemResponse> => {
  try {
    // Check if grading system with same name already exists
    const existingSystem =
      await gradingSystemRepository.findGradingSystemByName(
        data.systemName,
        tenantId
      );

    if (existingSystem) {
      throw new Error("GRADING_SYSTEM_ALREADY_EXISTS");
    }

    const result = await gradingSystemRepository.createGradingSystem(
      data,
      tenantId,
      tenantName
    );
    return result;
  } catch (error) {
    console.error("Create grading system error:", error);
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
    const result = await gradingSystemRepository.getAllGradingSystems(
      tenantId,
      page,
      limit
    );
    return result;
  } catch (error) {
    console.error("Get all grading systems error:", error);
    throw error;
  }
};

// Get grading system by ID
export const getGradingSystemById = async (
  id: string,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    const result = await gradingSystemRepository.findGradingSystemById(
      id,
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Get grading system by ID error:", error);
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
    // Check if grading system exists
    const existingSystem = await gradingSystemRepository.findGradingSystemById(
      id,
      tenantId
    );
    if (!existingSystem) {
      throw new Error("GRADING_SYSTEM_NOT_FOUND");
    }

    // If name is being updated, check for duplicates
    if (data.systemName && data.systemName !== existingSystem.systemName) {
      const duplicateSystem =
        await gradingSystemRepository.findGradingSystemByName(
          data.systemName,
          tenantId
        );

      if (duplicateSystem && duplicateSystem._id.toString() !== id) {
        throw new Error("GRADING_SYSTEM_ALREADY_EXISTS");
      }
    }

    const result = await gradingSystemRepository.updateGradingSystem(
      id,
      data,
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Update grading system error:", error);
    throw error;
  }
};

// Delete grading system
export const deleteGradingSystem = async (
  id: string,
  tenantId?: string
): Promise<GradingSystemResponse | null> => {
  try {
    // Check if grading system exists
    const existingSystem = await gradingSystemRepository.findGradingSystemById(
      id,
      tenantId
    );
    if (!existingSystem) {
      throw new Error("GRADING_SYSTEM_NOT_FOUND");
    }

    // Check if grading system is in use
    const isInUse = await gradingSystemRepository.isGradingSystemInUse(id);
    if (isInUse) {
      throw new Error("GRADING_SYSTEM_IN_USE");
    }

    const result = await gradingSystemRepository.deleteGradingSystem(
      id,
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Delete grading system error:", error);
    throw error;
  }
};

// Search grading systems
export const searchGradingSystems = async (
  data: SearchGradingSystemsRequest,
  tenantId?: string
): Promise<GradingSystemListResponse> => {
  try {
    const result = await gradingSystemRepository.searchGradingSystems(
      data,
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Search grading systems error:", error);
    throw error;
  }
};

// Get grading system statistics
export const getGradingSystemStatistics = async (
  tenantId?: string
): Promise<GradingSystemStatistics> => {
  try {
    const result = await gradingSystemRepository.getGradingSystemStatistics(
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Get grading system statistics error:", error);
    throw error;
  }
};

// Get active grading system for tenant
export const getActiveGradingSystem = async (
  tenantId: string
): Promise<GradingSystemResponse | null> => {
  try {
    const result = await gradingSystemRepository.findActiveGradingSystem(
      tenantId
    );
    return result;
  } catch (error) {
    console.error("Get active grading system error:", error);
    throw error;
  }
};

// Calculate grade from percentage
export const calculateGrade = async (
  percentage: number,
  gradingSystemId: string
): Promise<CalculateGradeResponse> => {
  try {
    const gradingSystem = await gradingSystemRepository.findGradingSystemById(
      gradingSystemId
    );
    if (!gradingSystem) {
      throw new Error("GRADING_SYSTEM_NOT_FOUND");
    }

    // Calculate grade based on grading system rules
    const grade = calculateGradeFromPercentage(percentage, gradingSystem);

    return {
      percentage,
      grade,
      gradingSystemId,
      gradingSystemName: gradingSystem.systemName,
    };
  } catch (error) {
    console.error("Calculate grade error:", error);
    throw error;
  }
};

// Helper function to calculate grade from percentage
export function calculateGradeFromPercentage(
  percentage: number,
  gradingSystem: any
): string {
  if (!gradingSystem?.gradeRanges || gradingSystem.gradeRanges.length === 0) {
    // Default grading if no ranges defined
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 40) return "D";
    return "F";
  }

  // Find the appropriate grade based on ranges
  for (const range of gradingSystem.gradeRanges) {
    if (
      percentage >= range.minPercentage &&
      percentage <= range.maxPercentage
    ) {
      return range.grade;
    }
  }

  // If no range matches, return the lowest grade
  return (
    gradingSystem.gradeRanges[gradingSystem.gradeRanges.length - 1]?.grade ||
    "F"
  );
}

import { SubjectRepository } from "@/repositories/subject.repository";
import {
  CreateSubjectRequest,
  UpdateSubjectRequest,
  SubjectResponse,
} from "@/types";
import { ObjectId } from "mongodb";
import { SortOrder } from "mongoose";

/**
 * Subject Service
 *
 * Business logic layer for Subject operations
 * Handles validation, business rules, and data transformation
 */
export class SubjectService {
  private subjectRepository: SubjectRepository;

  constructor() {
    this.subjectRepository = new SubjectRepository();
  }

  /**
   * Create a new subject
   */
  async createSubject(
    subjectData: CreateSubjectRequest,
    tenantId: string
  ): Promise<SubjectResponse> {
    try {
      // Check if subject with same code already exists
      if (subjectData.code) {
        const existingSubjectByCode = await this.subjectRepository.findByCode(
          subjectData.code,
          tenantId
        );

        if (existingSubjectByCode) {
          throw new Error(
            `SUBJECT_CODE_EXISTS: Subject with code "${subjectData.code}" already exists`
          );
        }
      }

      // Check if subject with same name already exists (case-insensitive)
      if (subjectData.name) {
        const existingSubjectByName = await this.subjectRepository.findByName(
          subjectData.name,
          tenantId
        );

        if (existingSubjectByName) {
          throw new Error(
            `SUBJECT_NAME_EXISTS: Subject with name "${subjectData.name}" already exists`
          );
        }
      }

      // Validate syllabus format

      const newSubjectData = {
        ...subjectData,
        tenantId: new ObjectId(tenantId),
      };

      const newSubject = await this.subjectRepository.create(newSubjectData);
      return this.transformToResponse(newSubject);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  /**
   * Get subject by ID
   */
  async getSubjectById(id: string, tenantId: string): Promise<SubjectResponse> {
    try {
      const subject = await this.subjectRepository.findById(id, tenantId);
      if (!subject) {
        throw new Error("Subject not found");
      }
      return this.transformToResponse(subject);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all subjects with pagination
   */
  async getAllSubjects(params: {
    pageNo: number;
    pageSize: number;
    query?: Record<string, any>;
    sort?: Record<string, SortOrder>;
    tenantId: string;
  }): Promise<{
    subjects: SubjectResponse[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const subjects = await this.subjectRepository.findSubjects({
        pageNo: params.pageNo,
        pageSize: params.pageSize,
        tenantId: params.tenantId,
        filters: params.query,
        sort: params.sort,
      });
      const total = await this.subjectRepository.countSubjects({
        tenantId: params.tenantId,
        filters: params.query,
      });

      return {
        subjects: subjects.map((subject: any) =>
          this.transformToResponse(subject)
        ),
        pagination: {
          total,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: Math.ceil(total / (params.pageSize || 10)),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update subject
   */
  async updateSubject(
    id: string,
    subjectData: UpdateSubjectRequest,
    tenantId: string
  ): Promise<SubjectResponse> {
    try {
      // Check if subject exists
      const existingSubject = await this.subjectRepository.findById(
        id,
        tenantId
      );
      if (!existingSubject) {
        throw new Error("Subject not found");
      }

      // Check if code is being updated and if it conflicts with another subject
      if (subjectData.code && subjectData.code !== existingSubject.code) {
        const codeExists = await this.subjectRepository.codeExists(
          subjectData.code,
          tenantId,
          id
        );
        if (codeExists) {
          throw new Error(
            `SUBJECT_CODE_EXISTS: Subject with code "${subjectData.code}" already exists`
          );
        }
      }

      // Check if name is being updated and if it conflicts with another subject
      if (subjectData.name && subjectData.name !== existingSubject.name) {
        const existingSubjectByName = await this.subjectRepository.findByName(
          subjectData.name,
          tenantId
        );
        if (
          existingSubjectByName &&
          existingSubjectByName._id.toString() !== id
        ) {
          throw new Error(
            `SUBJECT_NAME_EXISTS: Subject with name "${subjectData.name}" already exists`
          );
        }
      }

      const updatedSubject = await this.subjectRepository.updateById(
        id,
        tenantId,
        subjectData
      );

      if (!updatedSubject) {
        throw new Error("Subject not found");
      }

      return this.transformToResponse(updatedSubject);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete subject (soft delete)
   */
  async deleteSubject(id: string, tenantId: string): Promise<void> {
    try {
      const deletedSubject = await this.subjectRepository.deleteById(
        id,
        tenantId
      );
      if (!deletedSubject) {
        throw new Error("Subject not found");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subject statistics
   */
  async getSubjectStats(tenantId: string): Promise<any> {
    try {
      return await this.subjectRepository.getSubjectStats(tenantId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subjects by type
   */
  async getSubjectsByType(
    type: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<SubjectResponse[]> {
    try {
      const subjects = await this.subjectRepository.findByType(
        type,
        tenantId,
        filters,
        sort
      );
      return subjects.map((subject: any) => this.transformToResponse(subject));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subjects by grade level
   */
  async getSubjectsByGradeLevel(
    grade: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<SubjectResponse[]> {
    try {
      const subjects = await this.subjectRepository.findByGradeLevel(
        grade,
        tenantId,
        filters,
        sort
      );
      return subjects.map((subject: any) => this.transformToResponse(subject));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search subjects
   */
  async searchSubjects(
    searchTerm: string,
    tenantId: string
  ): Promise<SubjectResponse[]> {
    try {
      const subjects = await this.subjectRepository.searchSubjects(
        searchTerm,
        tenantId
      );
      return subjects.map((subject: any) => this.transformToResponse(subject));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subjects DDL (dropdown list) - simplified data for dropdowns
   */
  async getSubjectsDDL(tenantId: string): Promise<any[]> {
    try {
      const subjects = await this.subjectRepository.findAll(tenantId, {
        isActive: true,
        isDeleted: false,
      });
      return subjects.map((subject: any) => ({
        id: subject._id.toString(),
        name: subject.name,
        code: subject.code,
        grade: subject.grade,
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subject grades DDL (dropdown list) - unique grades for dropdowns
   */
  async getSubjectGradesDDL(tenantId: string): Promise<any[]> {
    try {
      const subjects = await this.subjectRepository.findAll(tenantId, {
        isActive: true,
        isDeleted: false,
      });
      // Get unique grades
      const uniqueGrades = [
        ...new Set(subjects.map((subject: any) => subject.grade)),
      ]
        .filter((grade) => grade != null)
        .sort((a, b) => a - b)
        .map((grade) => ({
          value: grade,
          label: `Grade ${grade}`,
        }));
      return uniqueGrades;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subject counts (total and active)
   */
  async getSubjectCounts(tenantId: string): Promise<{
    totalCount: number;
    activeCount: number;
  }> {
    try {
      if (!tenantId) {
        throw new Error("TENANT_ID_REQUIRED");
      }

      return await this.subjectRepository.getSubjectCounts(tenantId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transform subject data to response format
   */
  private transformToResponse(subjectData: any): SubjectResponse {
    return {
      id: subjectData._id.toString(),
      code: subjectData.code,
      name: subjectData.name,
      grade: subjectData.grade,
      tenantId: subjectData.tenantId.toString(),
      isActive: subjectData.isActive,
      createdAt: subjectData.createdAt,
      updatedAt: subjectData.updatedAt,
    };
  }
}

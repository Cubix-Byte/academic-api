import { Subject, ISubject } from "../models";
import { ObjectId } from "mongodb";
import { SortOrder } from "mongoose";

/**
 * Subject Repository
 *
 * Data access layer for Subject operations
 * Handles all database interactions for subjects
 */
export class SubjectRepository {
  /**
   * Create a new subject
   */
  async create(subjectData: any): Promise<ISubject> {
    const newSubject = new Subject(subjectData);
    return await newSubject.save();
  }

  /**
   * Find subject by ID
   */
  async findById(id: string, tenantId: string): Promise<ISubject | null> {
    return await Subject.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  /**
   * Find all subjects for a tenant
   */
  async findAll(tenantId: string, filters: any = {}): Promise<ISubject[]> {
    const query: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
      ...filters,
    };

    return await Subject.find(query)
      .sort({ createdAt: -1 });
  }

  /**
   * Find subjects with pagination and filters
   */
  async findSubjects(params: {
    pageNo: number;
    pageSize: number;
    tenantId: string;
    filters?: Record<string, any>;
    sort?: Record<string, SortOrder>;
  }): Promise<ISubject[]> {
    const { pageNo, pageSize, tenantId, filters = {}, sort = {} } = params;
    const skip = (pageNo - 1) * pageSize;

    const baseQuery: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to createdAt descending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ createdAt: -1 } as Record<string, SortOrder>);

    return await Subject.find(finalQuery)
      .sort(finalSort)
      .skip(skip)
      .limit(pageSize);
  }

  /**
   * Count subjects with filters
   */
  async countSubjects(params: {
    tenantId: string;
    filters?: Record<string, any>;
  }): Promise<number> {
    const { tenantId, filters = {} } = params;

    const baseQuery: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    return await Subject.countDocuments(finalQuery);
  }

  /**
   * Update subject by ID
   */
  async updateById(
    id: string,
    tenantId: string,
    updateData: Partial<ISubject>
  ): Promise<ISubject | null> {
    return await Subject.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        ...updateData,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Soft delete subject by ID
   */
  async deleteById(id: string, tenantId: string): Promise<ISubject | null> {
    return await Subject.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Find subjects by multiple IDs (for internal API)
   */
  async findByIds(ids: string[], tenantId: string): Promise<ISubject[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    return await Subject.find({
      _id: { $in: objectIds },
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  /**
   * Find subjects by type
   */
  async findByType(
    type: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<ISubject[]> {
    const baseQuery: any = {
      type,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to name ascending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ name: 1 } as Record<string, SortOrder>);

    return await Subject.find(finalQuery).sort(finalSort);
  }

  /**
   * Find subjects by grade level
   */
  async findByGradeLevel(
    gradeLevel: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<ISubject[]> {
    const baseQuery: any = {
      grade: parseInt(gradeLevel),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to name ascending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ name: 1 } as Record<string, SortOrder>);

    return await Subject.find(finalQuery).sort(finalSort);
  }

  /**
   * Find subject by code
   */
  async findByCode(code: string, tenantId: string): Promise<ISubject | null> {
    return await Subject.findOne({
      code,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  /**
   * Find subject by name
   */
  async findByName(name: string, tenantId: string): Promise<ISubject | null> {
    return await Subject.findOne({
      name,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  // /**
  //  * Get subject classes
  //  */
  // async getSubjectClasses(id: string, tenantId: string): Promise<any[]> {
  //   const subjectData = await Subject.findOne({
  //     _id: new ObjectId(id),
  //     tenantId: new ObjectId(tenantId),
  //     isDeleted: false,
  //   }).populate(
  //     "classIds",
  //     "name grade section academicYear capacity currentStrength"
  //   );

  //   return subjectData?.classIds || [];
  // }

  /**
   * Add class to subject
   */
  async addClass(
    subjectId: string,
    classId: string,
    tenantId: string
  ): Promise<ISubject | null> {
    return await Subject.findOneAndUpdate(
      {
        _id: new ObjectId(subjectId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $addToSet: { classIds: new ObjectId(classId) },
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Remove class from subject
   */
  async removeClass(
    subjectId: string,
    classId: string,
    tenantId: string
  ): Promise<ISubject | null> {
    return await Subject.findOneAndUpdate(
      {
        _id: new ObjectId(subjectId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $pull: { classIds: new ObjectId(classId) },
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Check if subject exists
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const count = await Subject.countDocuments({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
    return count > 0;
  }

  /**
   * Check if subject code exists
   */
  async codeExists(
    code: string,
    tenantId: string,
    excludeId?: string
  ): Promise<boolean> {
    const query: any = {
      code,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) };
    }

    const count = await Subject.countDocuments(query);
    return count > 0;
  }

  /**
   * Get subject statistics
   */
  async getSubjectStats(tenantId: string): Promise<any> {
    const stats = await Subject.aggregate([
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSubjects = await Subject.countDocuments({
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });

    return {
      totalSubjects,
      byType: stats,
    };
  }

  /**
   * Search subjects
   */
  async searchSubjects(
    searchTerm: string,
    tenantId: string
  ): Promise<ISubject[]> {
    const searchConditions: any[] = [
      { name: { $regex: searchTerm, $options: "i" } },
      { code: { $regex: searchTerm, $options: "i" } },
    ];

    // If searchTerm is a number, also search by grade
    if (!isNaN(Number(searchTerm))) {
      searchConditions.push({ grade: Number(searchTerm) });
    }

    return await Subject.find({
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
      $or: searchConditions,
    }).sort({ name: 1 });
  }

  /**
   * Get subject counts (total and active)
   */
  async getSubjectCounts(tenantId: string): Promise<{
    totalCount: number;
    activeCount: number;
  }> {
    const baseQuery: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Total count (all non-deleted subjects)
    const totalCount = await Subject.countDocuments(baseQuery);

    // Active count (non-deleted and active subjects)
    const activeCount = await Subject.countDocuments({
      ...baseQuery,
      isActive: true,
    });

    return {
      totalCount,
      activeCount,
    };
  }
}

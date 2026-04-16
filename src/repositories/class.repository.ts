import { Class, IClass } from "../models";
import { ObjectId } from "mongodb";
import { SortOrder } from "mongoose";

/**
 * Class Repository
 *
 * Data access layer for Class operations
 * Handles all database interactions for classes
 */
export class ClassRepository {
  /**
   * Create a new class
   */
  async create(classData: Partial<IClass>): Promise<IClass> {
    const newClass = new Class(classData);
    return await newClass.save();
  }

  /**
   * Create multiple classes in bulk
   */
  async createBulk(classesData: Partial<IClass>[]): Promise<IClass[]> {
    try {
      const result = await Class.insertMany(classesData, {
        ordered: false, // Continue inserting even if some fail
      });
      return result;
    } catch (error: any) {
      // Handle partial failures
      if (error.writeErrors && error.insertedDocs) {
        console.log(
          `⚠️ Bulk insert: ${error.insertedDocs.length} succeeded, ${error.writeErrors.length} failed`
        );
        return error.insertedDocs;
      }
      throw error;
    }
  }

  /**
   * Find class by ID
   */
  async findById(id: string, tenantId: string): Promise<IClass | null> {
    // Validate IDs format
    if (!id || !ObjectId.isValid(id.trim())) {
      throw new Error(
        `Invalid class ID format: ${id}. Must be a valid 24-character hex string.`
      );
    }

    if (!tenantId || !ObjectId.isValid(tenantId.trim())) {
      throw new Error(
        `Invalid tenantId format: ${tenantId}. Must be a valid 24-character hex string.`
      );
    }

    return await Class.findOne({
      _id: new ObjectId(id.trim()),
      tenantId: new ObjectId(tenantId.trim()),
      isDeleted: false,
    })
      .populate("classTeacherId", "firstName lastName email")
      .populate("batchId", "batchName totalClasses startFrom endTill");
  }

  /**
   * Find existing class for duplicate check (lightweight query without populate)
   */
  // async findExistingClass(
  //   tenantId: string,
  //   filters: any = {}
  // ): Promise<IClass | null> {
  //   try {
  //     // Validate tenantId format
  //     if (!tenantId || typeof tenantId !== "string") {
  //       throw new Error(
  //         "Invalid tenantId: tenantId must be a non-empty string"
  //       );
  //     }

  //     // Clean and validate ObjectId format
  //     const cleanTenantId = tenantId.trim();
  //     if (!ObjectId.isValid(cleanTenantId)) {
  //       throw new Error(
  //         `Invalid tenantId format: ${cleanTenantId}. Must be a valid 24-character hex string.`
  //       );
  //     }

  //     const query: any = {
  //       tenantId: new ObjectId(cleanTenantId),
  //       isDeleted: false,
  //       ...filters,
  //     };

  //     console.log(
  //       `Checking for existing class with query:`,
  //       JSON.stringify(query, null, 2)
  //     );

  //     // Use findOne without populate for faster query
  //     const result = await Class.findOne(query).lean();
  //     console.log(
  //       `Existing class check result:`,
  //       result ? "Found existing class" : "No existing class found"
  //     );

  //     return result;
  //   } catch (error) {
  //     console.error("Error in findExistingClass:", error);
  //     throw error;
  //   }
  // }

  /**
   * Find existing classes in batch for duplicate check using $or query
   * Optimized for bulk operations - checks multiple classes in a single query
   *
   * @param tenantId - Tenant ID
   * @param batchId - Batch ID
   * @param classIdentifiers - Array of class identifiers { name, grade }
   * @returns Array of existing classes that match the identifiers
   */
  async findExistingClassesBatch(
    tenantId: string,
    batchId: ObjectId,
    classIdentifiers: Array<{ name: string; grade: number }>
  ): Promise<IClass[]> {
    try {
      if (!tenantId || typeof tenantId !== "string") {
        throw new Error(
          "Invalid tenantId: tenantId must be a non-empty string"
        );
      }

      const cleanTenantId = tenantId.trim();
      if (!ObjectId.isValid(cleanTenantId)) {
        throw new Error(
          `Invalid tenantId format: ${cleanTenantId}. Must be a valid 24-character hex string.`
        );
      }

      if (!classIdentifiers || classIdentifiers.length === 0) {
        return [];
      }

      const $orConditions = classIdentifiers.map((identifier) => ({
        batchId: batchId,
        name: identifier.name,
        grade: identifier.grade,
      }));

      const query: any = {
        tenantId: new ObjectId(cleanTenantId),
        isDeleted: false,
        $or: $orConditions,
      };

      console.log(
        `Checking for existing classes in batch (${classIdentifiers.length} classes)`
      );

      const results = await Class.find(query).lean();
      console.log(
        `Batch duplicate check result: ${results.length} existing class(es) found`
      );

      return results;
    } catch (error) {
      console.error("Error in findExistingClassesBatch:", error);
      throw error;
    }
  }

  /**
   * Find all classes for a tenant
   */
  async findAll(tenantId: string, filters: any = {}): Promise<IClass[]> {
    // Validate tenantId format
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    // Clean and validate ObjectId format
    const cleanTenantId = tenantId.trim();
    if (!ObjectId.isValid(cleanTenantId)) {
      throw new Error(
        `Invalid tenantId format: ${cleanTenantId}. Must be a valid 24-character hex string.`
      );
    }

    const query: any = {
      tenantId: new ObjectId(cleanTenantId),
      isDeleted: false,
      ...filters,
    };

    return await Class.find(query)
      .sort({ createdAt: -1 as SortOrder })
      .populate("classTeacherId", "firstName lastName email"); // do NOT populate subjectIds/studentIds for list endpoints
  }

  /**
   * Find all classes with populated subjects for DDL
   */
  async findAllClassesWithSubjects(tenantId: string): Promise<IClass[]> {
    // Validate tenantId format
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    // Clean and validate ObjectId format
    const cleanTenantId = tenantId.trim();
    if (!ObjectId.isValid(cleanTenantId)) {
      throw new Error(
        `Invalid tenantId format: ${cleanTenantId}. Must be a valid 24-character hex string.`
      );
    }

    const query: any = {
      tenantId: new ObjectId(cleanTenantId),
      isDeleted: false,
      // Removed isActive: true filter to include all non-deleted classes
      // Classes can be inactive but still need to appear in DDL if they have data
    };

    return await Class.find(query)
      .sort({ createdAt: -1 as SortOrder })
      .populate("subjectIds", "name code")
      .populate("batchId", "batchName totalClasses startFrom endTill")
      .lean();
  }

  /**
   * Find classes with pagination and filters
   */
  async findClasses(params: {
    pageNo: number;
    pageSize: number;
    query?: Record<string, any>;
    sort?: Record<string, SortOrder>;
    tenantId: string;
  }): Promise<IClass[]> {
    const {
      pageNo,
      pageSize,
      query: filterQuery = {},
      sort: sortQuery = {},
      tenantId,
    } = params;
    const skip = (pageNo - 1) * pageSize;

    // Build base query with tenant and soft delete check
    const query: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with filter query from buildQuery helper
    Object.assign(query, filterQuery);

    // Determine sort order - use provided sort or default to createdAt desc
    const sort: Record<string, SortOrder> =
      Object.keys(sortQuery).length > 0
        ? (sortQuery as Record<string, SortOrder>)
        : ({ createdAt: -1 } as Record<string, SortOrder>);

    return await Class.find(query)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .populate("classTeacherId", "firstName lastName email")
      .populate("batchId", "batchName totalClasses startFrom endTill"); // do NOT populate subjectIds/studentIds for paginated list
  }

  /**
   * Count classes with filters
   */
  async countClasses(params: {
    query?: Record<string, any>;
    tenantId: string;
  }): Promise<number> {
    const { query: filterQuery = {}, tenantId } = params;

    // Build base query with tenant and soft delete check
    const query: any = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with filter query from buildQuery helper
    Object.assign(query, filterQuery);

    return await Class.countDocuments(query);
  }

  /**
   * Update class by ID
   */
  async updateById(
    id: string,
    tenantId: string,
    updateData: Partial<IClass>
  ): Promise<IClass | null> {
    return await Class.findOneAndUpdate(
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
   * Soft delete class by ID
   */
  async deleteById(id: string, tenantId: string): Promise<IClass | null> {
    return await Class.findOneAndUpdate(
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
   * Find classes by multiple IDs (for internal API)
   */
  async findByIds(ids: string[], tenantId: string): Promise<IClass[]> {
    const objectIds = ids.map((id) => new ObjectId(id));
    return await Class.find({
      _id: { $in: objectIds },
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  /**
   * Find classes by grade
   */
  async findByGrade(
    grade: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<IClass[]> {
    const baseQuery: any = {
      grade,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to section ascending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ section: 1 } as Record<string, SortOrder>);

    return await Class.find(finalQuery).sort(finalSort);
  }

  /**
   * Find classes by academic year
   */
  async findByAcademicYear(
    academicYear: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {}
  ): Promise<IClass[]> {
    const baseQuery: any = {
      academicYear,
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to grade, section ascending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ grade: 1, section: 1 } as Record<string, SortOrder>);

    return await Class.find(finalQuery).sort(finalSort);
  }

  /**
   * Get class subject details with teacher assignments
   */
  async getClassSubjectDetails(id: string, tenantId: string): Promise<any[]> {
    try {
      // Validate IDs
      if (!id || !ObjectId.isValid(id.trim())) {
        throw new Error(`Invalid class ID format: ${id}`);
      }

      if (!tenantId || !ObjectId.isValid(tenantId.trim())) {
        throw new Error(`Invalid tenantId format: ${tenantId}`);
      }

      const classObjectId = new ObjectId(id.trim());
      const tenantObjectId = new ObjectId(tenantId.trim());

      console.log(
        `🔍 Getting class subject details for classId: ${id}, tenantId: ${tenantId}`
      );

      // Find class with populated subjects
      // Filter out deleted subjects in populate
      const classData = await Class.findOne({
        _id: classObjectId,
        tenantId: tenantObjectId,
        isDeleted: false,
      }).populate({
        path: "subjectIds",
        select: "name code",
        match: { isDeleted: false },
        options: { lean: true },
      });

      if (!classData) {
        console.log(`❌ Class not found: ${id} for tenant: ${tenantId}`);
        return [];
      }

      console.log(
        `✅ Class found: ${classData.name}, subjectIds count: ${classData.subjectIds?.length || 0
        }`
      );

      if (!classData.subjectIds || classData.subjectIds.length === 0) {
        console.log(`⚠️ No subjects found for class: ${id}`);
        return [];
      }

      // Import TeacherAssignClassesRepository dynamically
      const { TeacherAssignClassesRepository } = await import(
        "./teacherAssignClasses.repository"
      );

      // Get all teacher assignments for this class
      // Note: tenantId in teacher_assign_classes is stored as String, not ObjectId
      // Normalize tenantId to string format (tenantId is already a string from the parameter)
      const normalizedTenantId = tenantId.trim();

      console.log(
        `🔍 Fetching assignments for classId: ${id.trim()}, tenantId: ${normalizedTenantId}`
      );

      const assignments =
        await TeacherAssignClassesRepository.findAssignmentsByClass(
          id.trim(),
          normalizedTenantId
        );

      console.log(
        `📚 Found ${assignments.length} teacher assignments for class: ${id}`
      );

      if (assignments.length > 0) {
        console.log(
          `📋 Sample assignment:`,
          JSON.stringify(
            {
              classId: assignments[0].classId,
              subjectId: assignments[0].subjectId,
              teacherId: assignments[0].teacherId,
              tenantId: assignments[0].tenantId,
            },
            null,
            2
          )
        );
      }

      // Create a map of subjectId -> teacher assignment
      // Match by both classId and subjectId (already filtered by classId in findAssignmentsByClass)
      // Use the first (most recent) assignment if multiple exist for the same subject
      const assignmentMap = new Map<string, any>();
      assignments.forEach((assignment: any) => {
        // Handle subjectId extraction - can be ObjectId, string, or populated object
        let subjectId: string | null = null;
        if (assignment.subjectId) {
          if (typeof assignment.subjectId === "string") {
            subjectId = assignment.subjectId;
          } else if (assignment.subjectId._id) {
            subjectId = assignment.subjectId._id.toString();
          } else if (assignment.subjectId.toString) {
            subjectId = assignment.subjectId.toString();
          }
        }

        console.log(
          `🔍 Processing assignment - subjectId: ${subjectId}, teacherId: ${assignment.teacherId}`
        );

        // Only set if not already in map (to use the first/most recent assignment)
        if (subjectId && !assignmentMap.has(subjectId)) {
          // Handle teacherId extraction
          let teacherId: string | null = null;
          if (assignment.teacherId) {
            if (typeof assignment.teacherId === "string") {
              teacherId = assignment.teacherId;
            } else if (assignment.teacherId._id) {
              teacherId = assignment.teacherId._id.toString();
            } else if (assignment.teacherId.toString) {
              teacherId = assignment.teacherId.toString();
            }
          }

          // Handle teacherData - can be populated object or null
          const teacherData =
            assignment.teacherId &&
              typeof assignment.teacherId === "object" &&
              assignment.teacherId.firstName
              ? assignment.teacherId
              : null;

          console.log(
            `✅ Mapping assignment - subjectId: ${subjectId}, teacherId: ${teacherId}, hasTeacherData: ${!!teacherData}`
          );

          assignmentMap.set(subjectId, {
            teacherId: teacherId || null,
            assignedTeacher: teacherData
              ? {
                id: teacherId || null,
                firstName: teacherData.firstName || "",
                lastName: teacherData.lastName || "",
                thrId: teacherData.thrId || "",
                email: teacherData.email || "",
              }
              : null,
          });
        }
      });

      console.log(`📊 Assignment map size: ${assignmentMap.size}`);

      // Map subjects to the required format
      // Filter out null/undefined subjects (in case populate didn't find them)
      const result = classData.subjectIds
        .filter((subject: any) => subject && (subject._id || subject.id))
        .map((subject: any) => {
          // Extract subjectId - handle both Mongoose document and lean object
          let subjectId: string | null = null;
          if (subject._id) {
            subjectId =
              typeof subject._id === "string"
                ? subject._id
                : subject._id.toString();
          } else if (subject.id) {
            subjectId =
              typeof subject.id === "string"
                ? subject.id
                : subject.id.toString();
          }

          console.log(
            `🔍 Mapping subject - subjectId: ${subjectId}, subjectName: ${subject.name}`
          );

          const assignment = subjectId ? assignmentMap.get(subjectId) : null;

          console.log(
            `📋 Assignment for subject ${subjectId}:`,
            assignment
              ? {
                teacherId: assignment.teacherId,
                hasAssignedTeacher: !!assignment.assignedTeacher,
              }
              : "null"
          );

          return {
            subjectId: subjectId || null,
            subjectName: subject.name || "",
            teacherId: assignment?.teacherId || null,
            assignedTeacher: assignment?.assignedTeacher || null,
          };
        });

      console.log(`✅ Returning ${result.length} subject details`);
      console.log(
        `📊 Result sample:`,
        result.length > 0 ? JSON.stringify(result[0], null, 2) : "No results"
      );
      return result;
    } catch (error: any) {
      console.error("❌ Error in getClassSubjectDetails:", error);
      throw error;
    }
  }

  /**
   * Get class students
   */
  async getClassStudents(id: string, tenantId: string): Promise<any[]> {
    const classData = await Class.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    }).populate("studentIds", "firstName lastName email phone parentIds");

    return classData?.studentIds || [];
  }

  /**
   * Get class subjects
   */
  async getClassSubjects(id: string, tenantId: string): Promise<any[]> {
    const classData = await Class.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    }).populate("subjectIds", "name code type gradeLevel teacherIds");

    return classData?.subjectIds || [];
  }

  /**
   * Add student to class
   */
  async addStudent(
    classId: string,
    studentId: string,
    tenantId: string
  ): Promise<IClass | null> {
    // Extract ID if studentId is a full object
    let actualStudentId = studentId;

    // Check if studentId is a JSON object string
    if (typeof studentId === "string" && studentId.trim().startsWith("{")) {
      try {
        const studentObj = JSON.parse(studentId.trim());
        actualStudentId = studentObj.id || studentObj._id || studentId;
      } catch (e) {
        console.error("Failed to parse studentId as JSON:", e);
      }
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(actualStudentId)) {
      throw new Error(
        `Invalid studentId format: ${actualStudentId}. Must be a valid 24-character hex string.`
      );
    }

    return await Class.findOneAndUpdate(
      {
        _id: new ObjectId(classId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $addToSet: { studentIds: new ObjectId(actualStudentId) },
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Remove student from class
   */
  async removeStudent(
    classId: string,
    studentId: string,
    tenantId: string
  ): Promise<IClass | null> {
    return await Class.findOneAndUpdate(
      {
        _id: new ObjectId(classId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $pull: { studentIds: new ObjectId(studentId) },
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /**
   * Bulk add students to class
   */
  async bulkAddStudents(
    classId: string,
    studentIds: string[],
    tenantId: string,
    session?: any
  ): Promise<void> {
    await Class.findOneAndUpdate(
      {
        _id: new ObjectId(classId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $addToSet: { studentIds: { $each: studentIds.map(id => new ObjectId(id)) } },
        updatedAt: new Date(),
      },
      { session }
    );
  }

  /**
   * Bulk remove students from class
   */
  async bulkRemoveStudents(
    classId: string,
    studentIds: string[],
    tenantId: string,
    session?: any
  ): Promise<void> {
    await Class.findOneAndUpdate(
      {
        _id: new ObjectId(classId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      {
        $pull: { studentIds: { $in: studentIds.map(id => new ObjectId(id)) } },
        updatedAt: new Date(),
      },
      { session }
    );
  }

  /**
   * Check if class exists
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    const count = await Class.countDocuments({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
    return count > 0;
  }

  /**
   * Get class statistics
   */
  async getClassStats(tenantId: string): Promise<any> {
    const matchQuery = {
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    const total = await Class.countDocuments(matchQuery);
    const active = await Class.countDocuments({
      ...matchQuery,
      isActive: true,
    });
    const inactive = await Class.countDocuments({
      ...matchQuery,
      isActive: false,
    });

    return {
      total,
      active,
      inactive,
    };
  }
}

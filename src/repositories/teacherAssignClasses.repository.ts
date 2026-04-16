import mongoose from "mongoose";
import { TeacherAssignClasses, ITeacherAssignClasses } from "../models";

/**
 * TeacherAssignClasses Repository - Data access layer for teacher assignments
 */
export class TeacherAssignClassesRepository {
  /**
   * Create a new teacher assignment
   */
  static async createAssignment(
    data: Partial<ITeacherAssignClasses>
  ): Promise<ITeacherAssignClasses> {
    try {
      const assignment = new TeacherAssignClasses(data);
      return await assignment.save();
    } catch (error: any) {
      console.error("Error creating teacher assignment:", error);
      throw new Error(`Failed to create teacher assignment: ${error.message}`);
    }
  }

  /**
   * Create multiple assignments in bulk
   */
  static async createBulkAssignments(
    assignments: any[],
    session?: mongoose.ClientSession
  ): Promise<ITeacherAssignClasses[]> {
    try {
      const options: any = {
        ordered: false, // Continue inserting even if some documents fail (e.g., duplicates)
      };
      if (session) {
        options.session = session;
      }

      try {
        const result = await TeacherAssignClasses.insertMany(
          assignments,
          options
        );
        return result as ITeacherAssignClasses[];
      } catch (error: any) {
        // With ordered: false, MongoDB continues inserting and returns both successful and failed writes
        // Check if we have successful inserts in the error object
        if (error.writeErrors && error.insertedDocs) {
          // Some inserts succeeded, return those
          console.log(
            `⚠️ Bulk insert: ${error.insertedDocs.length} succeeded, ${error.writeErrors.length} failed (duplicates)`
          );
          return error.insertedDocs as ITeacherAssignClasses[];
        }
        // If no successful inserts in error object, throw the error
        throw error;
      }
    } catch (error: any) {
      console.error("Error creating bulk teacher assignments:", error);
      throw new Error(
        `Failed to create bulk teacher assignments: ${error.message}`
      );
    }
  }

  /**
   * Find assignments by teacher ID
   */
  static async findAssignmentsByTeacher(
    teacherId: string,
    tenantId: string
  ): Promise<ITeacherAssignClasses[]> {
    try {
      return await TeacherAssignClasses.find({
        teacherId: new mongoose.Types.ObjectId(teacherId),
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      })
        .populate({
          path: "classId",
          select: "name grade section academicYear",
          match: { isDeleted: false }, // Filter out soft-deleted classes
        })
        .populate({
          path: "subjectId",
          select: "name code type",
          match: { isDeleted: false }, // Filter out soft-deleted subjects
        })
        .sort({ assignedAt: -1 });
    } catch (error: any) {
      console.error("Error finding assignments by teacher:", error);
      throw new Error(
        `Failed to find assignments by teacher: ${error.message}`
      );
    }
  }

  /**
   * Find teacher assigned classes with batch for DDL list
   */
  static async findTeacherClassesDDL(
    teacherId: string,
    tenantId: string,
    batchId?: string
  ): Promise<any[]> {
    try {
      // Build query - only require non-deleted assignments
      const query: any = {
        teacherId: new mongoose.Types.ObjectId(teacherId),
        tenantId: tenantId,
        isDeleted: false,
      };

      // Only include active status if we want to filter by it
      // Remove status filter to get all non-deleted assignments

      // Build match condition for classId populate
      // If batchId is provided, filter classes by batchId
      const classMatch: any = { isDeleted: false };
      if (batchId) {
        classMatch.batchId = new mongoose.Types.ObjectId(batchId);
      }

      console.log("🔍 Finding teacher classes DDL with query:", {
        teacherId,
        tenantId,
        batchId: batchId || "all batches",
        query: JSON.stringify(query),
        classMatch: JSON.stringify(classMatch),
      });

      const assignments = await TeacherAssignClasses.find(query)
        .populate({
          path: "classId",
          select: "name grade section academicYear batchId",
          match: classMatch, // Filter out deleted classes and by batchId if provided
          populate: {
            path: "batchId",
            select: "batchName",
          },
        })
        .populate({
          path: "subjectId",
          select: "name",
          match: { isDeleted: false }, // Filter out deleted subjects
        })
        .sort({ assignedAt: -1 })
        .lean();

      console.log(
        `📊 Found ${assignments.length} assignments for teacher ${teacherId}${batchId ? ` (filtered by batchId: ${batchId})` : ""}`
      );

      // Filter out assignments where class or subject is null (deleted or filtered out)
      const filteredAssignments = assignments.filter(
        (assignment: any) =>
          assignment.classId !== null && assignment.subjectId !== null
      );

      return filteredAssignments;
    } catch (error: any) {
      console.error("Error finding teacher classes DDL:", error);
      throw new Error(`Failed to find teacher classes DDL: ${error.message}`);
    }
  }

  /**
   * Find teacher assigned classes with subjects grouped by class
   * Returns array of classes, each containing an array of assigned subjects
   */
  static async findTeacherClassesWithSubjects(
    teacherId: string,
    tenantId: string
  ): Promise<any[]> {
    try {
      // Build query - only require non-deleted assignments
      const query: any = {
        teacherId: new mongoose.Types.ObjectId(teacherId),
        tenantId: tenantId,
        isDeleted: false,
      };

      console.log("🔍 Finding teacher classes with subjects:", {
        teacherId,
        tenantId,
      });

      const assignments = await TeacherAssignClasses.find(query)
        .populate({
          path: "classId",
          select: "name grade section academicYear batchId",
          match: { isDeleted: false }, // Filter out deleted classes
          populate: {
            path: "batchId",
            select: "batchName",
          },
        })
        .populate({
          path: "subjectId",
          select: "name code type",
          match: { isDeleted: false }, // Filter out deleted subjects
        })
        .sort({ assignedAt: -1 })
        .lean();

      console.log(
        `📊 Found ${assignments.length} assignments for teacher ${teacherId}`
      );

      // Filter out assignments where class or subject is null (deleted)
      const validAssignments = assignments.filter(
        (assignment: any) =>
          assignment.classId !== null && assignment.subjectId !== null
      );

      // Group assignments by classId
      const classMap = new Map<string, any>();

      validAssignments.forEach((assignment: any) => {
        const classData = assignment.classId;
        const subjectData = assignment.subjectId;
        const batchData = classData?.batchId || null;

        if (!classData) {
          return; // Skip if class data is missing
        }

        const classId = classData._id.toString();

        // If class not in map, add it
        if (!classMap.has(classId)) {
          classMap.set(classId, {
            id: classId,
            name: classData.name || "",
            grade: classData.grade,
            section: classData.section || null,
            academicYear: classData.academicYear || "",
            batchId: batchData?._id?.toString() || null,
            batchName: batchData?.batchName || null,
            subjects: [],
          });
        }

        // Add subject to the class's subjects array if subject exists
        if (subjectData) {
          const classObj = classMap.get(classId);
          // Check if subject already exists in the array (avoid duplicates)
          const subjectExists = classObj.subjects.some(
            (subj: any) => subj.id === subjectData._id.toString()
          );

          if (!subjectExists) {
            classObj.subjects.push({
              id: subjectData._id.toString(),
              name: subjectData.name || "",
              code: subjectData.code || null,
              type: subjectData.type || null,
            });
          }
        }
      });

      // Convert map to array
      const result = Array.from(classMap.values());

      // Sort subjects within each class by name
      result.forEach((classObj: any) => {
        classObj.subjects.sort((a: any, b: any) =>
          (a.name || "").localeCompare(b.name || "")
        );
      });

      // Sort classes by grade, then by name
      result.sort((a: any, b: any) => {
        if (a.grade !== b.grade) {
          return (a.grade || 0) - (b.grade || 0);
        }
        return (a.name || "").localeCompare(b.name || "");
      });

      console.log(`✅ Returning ${result.length} classes with subjects`);
      return result;
    } catch (error: any) {
      console.error("Error finding teacher classes with subjects:", error);
      throw new Error(
        `Failed to find teacher classes with subjects: ${error.message}`
      );
    }
  }

  /**
   * Find assignments by class ID
   */
  static async findAssignmentsByClass(
    classId: string,
    tenantId: string
  ): Promise<ITeacherAssignClasses[]> {
    try {
      // Normalize tenantId - tenantId is already a string parameter, just trim it
      const normalizedTenantId = tenantId.trim();

      console.log(
        `🔍 Finding assignments by class: classId=${classId}, tenantId=${normalizedTenantId}`
      );

      const query = {
        classId: new mongoose.Types.ObjectId(classId.trim()),
        tenantId: normalizedTenantId,
        isActive: true,
        isDeleted: false,
      };

      console.log(`📋 Query:`, JSON.stringify(query, null, 2));

      const assignments = await TeacherAssignClasses.find(query)
        .populate("teacherId", "firstName lastName thrId email")
        .populate("subjectId", "name code type")
        .sort({ assignedAt: -1 })
        .lean();

      console.log(
        `✅ Found ${assignments.length} assignments for class ${classId}`
      );

      return assignments as ITeacherAssignClasses[];
    } catch (error: any) {
      console.error("Error finding assignments by class:", error);
      throw new Error(`Failed to find assignments by class: ${error.message}`);
    }
  }

  /**
   * Find teacher IDs by classId and/or subjectId
   * Returns array of unique teacher IDs
   */
  static async findTeacherIdsByClassAndSubject(
    tenantId: string,
    classId?: string,
    subjectId?: string
  ): Promise<string[]> {
    try {
      const query: any = {
        tenantId: tenantId.trim(),
        isActive: true,
        isDeleted: false,
      };

      if (classId && mongoose.Types.ObjectId.isValid(classId.trim())) {
        query.classId = new mongoose.Types.ObjectId(classId.trim());
      }

      if (subjectId && mongoose.Types.ObjectId.isValid(subjectId.trim())) {
        query.subjectId = new mongoose.Types.ObjectId(subjectId.trim());
      }

      // If neither classId nor subjectId provided, return empty array
      if (!classId && !subjectId) {
        return [];
      }

      const assignments = await TeacherAssignClasses.find(query)
        .select("teacherId")
        .lean();

      // Extract unique teacher IDs
      const teacherIds = [
        ...new Set(
          assignments
            .map((a) => a.teacherId?.toString())
            .filter((id): id is string => !!id)
        ),
      ];

      return teacherIds;
    } catch (error: any) {
      console.error("Error finding teacher IDs by class and subject:", error);
      throw new Error(`Failed to find teacher IDs: ${error.message}`);
    }
  }

  /**
   * Remove teacher from specific class-subject assignment (soft delete)
   */
  static async removeTeacherFromClassSubject(
    teacherId: string,
    classId: string,
    subjectId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const result = await TeacherAssignClasses.updateOne(
        {
          teacherId: new mongoose.Types.ObjectId(teacherId),
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: tenantId,
          isActive: true,
          isDeleted: false,
        },
        {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        }
      );
      return result.modifiedCount > 0;
    } catch (error: any) {
      console.error("Error removing teacher from class-subject:", error);
      throw new Error(
        `Failed to remove teacher from class-subject: ${error.message}`
      );
    }
  }

  /**
   * Check if teacher has other subjects in the same class
   */
  static async hasOtherSubjectsInClass(
    teacherId: string,
    classId: string,
    excludeSubjectId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const count = await TeacherAssignClasses.countDocuments({
        teacherId: new mongoose.Types.ObjectId(teacherId),
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: { $ne: new mongoose.Types.ObjectId(excludeSubjectId) },
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      });
      return count > 0;
    } catch (error: any) {
      console.error("Error checking other subjects in class:", error);
      throw new Error(
        `Failed to check other subjects in class: ${error.message}`
      );
    }
  }

  /**
   * Create assignment if it doesn't exist
   */
  static async createAssignmentIfNotExists(
    teacherId: string,
    classId: string,
    subjectId: string,
    tenantId: string,
    tenantName: string,
    assignedBy: string
  ): Promise<ITeacherAssignClasses | null> {
    try {
      // Validate ObjectIds
      if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId.trim())) {
        throw new Error(`Invalid teacherId: ${teacherId}`);
      }
      if (!classId || !mongoose.Types.ObjectId.isValid(classId.trim())) {
        throw new Error(`Invalid classId: ${classId}`);
      }
      if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId.trim())) {
        throw new Error(`Invalid subjectId: ${subjectId}`);
      }

      // Validate assignedBy - if it's not a valid ObjectId, use a default or skip
      let assignedByObjectId: mongoose.Types.ObjectId;
      if (assignedBy && mongoose.Types.ObjectId.isValid(assignedBy.trim())) {
        assignedByObjectId = new mongoose.Types.ObjectId(assignedBy.trim());
      } else {
        // If assignedBy is not a valid ObjectId (e.g., email or "system"),
        // we need to handle it differently or use a default admin ID
        // For now, we'll use the teacherId as assignedBy as a fallback
        console.warn(
          `Invalid assignedBy ObjectId: ${assignedBy}, using teacherId as fallback`
        );
        assignedByObjectId = new mongoose.Types.ObjectId(teacherId.trim());
      }

      // Validate tenantName
      if (!tenantName || tenantName.trim() === "") {
        throw new Error("Tenant name is required");
      }

      const teacherObjectId = new mongoose.Types.ObjectId(teacherId.trim());
      const classObjectId = new mongoose.Types.ObjectId(classId.trim());
      const subjectObjectId = new mongoose.Types.ObjectId(subjectId.trim());

      // Check if assignment already exists (including soft-deleted ones)
      const existing = await TeacherAssignClasses.findOne({
        teacherId: teacherObjectId,
        classId: classObjectId,
        subjectId: subjectObjectId,
        tenantId: tenantId,
      });

      if (existing) {
        // If exists but is soft-deleted, restore it
        if (existing.isDeleted || !existing.isActive) {
          existing.isDeleted = false;
          existing.isActive = true;
          existing.assignedBy = assignedByObjectId;
          existing.assignedAt = new Date();
          existing.updatedAt = new Date();
          await existing.save();
          return existing;
        }
        // Already exists and active
        return existing;
      }

      // Create new assignment
      const assignment = new TeacherAssignClasses({
        teacherId: teacherObjectId,
        classId: classObjectId,
        subjectId: subjectObjectId,
        tenantId: tenantId.trim(),
        tenantName: tenantName.trim(),
        assignedBy: assignedByObjectId,
        assignedAt: new Date(),
        status: "active",
        isActive: true,
        isDeleted: false,
        createdBy: assignedBy || teacherId.trim(),
      });

      const savedAssignment = await assignment.save();

      console.log(`✅ Created new assignment:`, {
        _id: savedAssignment._id,
        classId: savedAssignment.classId?.toString(),
        subjectId: savedAssignment.subjectId?.toString(),
        teacherId: savedAssignment.teacherId?.toString(),
        tenantId: savedAssignment.tenantId,
        isActive: savedAssignment.isActive,
        isDeleted: savedAssignment.isDeleted,
      });

      return savedAssignment;
    } catch (error: any) {
      console.error("Error creating assignment if not exists:", error);
      throw new Error(`Failed to create assignment: ${error.message}`);
    }
  }

  /**
   * Find assignments by subject ID
   */
  static async findAssignmentsBySubject(
    subjectId: string,
    tenantId: string
  ): Promise<ITeacherAssignClasses[]> {
    try {
      return await TeacherAssignClasses.find({
        subjectId: new mongoose.Types.ObjectId(subjectId),
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      })
        .populate("teacherId", "firstName lastName thrId")
        .populate("classId", "name grade section academicYear")
        .sort({ assignedAt: -1 });
    } catch (error: any) {
      console.error("Error finding assignments by subject:", error);
      throw new Error(
        `Failed to find assignments by subject: ${error.message}`
      );
    }
  }

  /**
   * Find specific assignment by teacher, class, and subject
   */
  static async findSpecificAssignment(
    teacherId: string,
    classId: string,
    subjectId: string,
    tenantId: string
  ): Promise<ITeacherAssignClasses | null> {
    try {
      return await TeacherAssignClasses.findOne({
        teacherId: new mongoose.Types.ObjectId(teacherId),
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      });
    } catch (error: any) {
      console.error("Error finding specific assignment:", error);
      throw new Error(`Failed to find specific assignment: ${error.message}`);
    }
  }

  /**
   * Find existing assignments from a list of assignments
   * Returns assignments that already exist (to avoid duplicates)
   * Checks for ALL assignments regardless of isActive/isDeleted status
   * because unique index still applies even to soft-deleted records
   */
  static async findExistingAssignments(
    teacherId: string,
    assignments: { classId: string; subjectId: string }[],
    tenantId: string
  ): Promise<ITeacherAssignClasses[]> {
    try {
      if (assignments.length === 0) {
        return [];
      }

      // Build $or query to check all assignments at once
      // Don't filter by isActive/isDeleted because unique index applies to all records
      const orConditions = assignments.map((assignment) => ({
        teacherId: new mongoose.Types.ObjectId(teacherId),
        classId: new mongoose.Types.ObjectId(assignment.classId),
        subjectId: new mongoose.Types.ObjectId(assignment.subjectId),
        tenantId: tenantId,
      }));

      return await TeacherAssignClasses.find({
        $or: orConditions,
      }).lean();
    } catch (error: any) {
      console.error("Error finding existing assignments:", error);
      throw new Error(`Failed to find existing assignments: ${error.message}`);
    }
  }

  /**
   * Update assignment status
   */
  static async updateAssignmentStatus(
    assignmentId: string,
    status: "active" | "inactive",
    tenantId: string
  ): Promise<ITeacherAssignClasses | null> {
    try {
      return await TeacherAssignClasses.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(assignmentId),
          tenantId: tenantId,
          isActive: true,
          isDeleted: false,
        },
        {
          status: status,
          updatedAt: new Date(),
        },
        { new: true }
      );
    } catch (error: any) {
      console.error("Error updating assignment status:", error);
      throw new Error(`Failed to update assignment status: ${error.message}`);
    }
  }

  /**
   * Soft delete assignments by teacher ID
   */
  static async deleteAssignmentsByTeacher(
    teacherId: string,
    tenantId: string,
    session?: mongoose.ClientSession
  ): Promise<boolean> {
    try {
      const options: any = {};
      if (session) {
        options.session = session;
      }

      const result = await TeacherAssignClasses.updateMany(
        {
          teacherId: new mongoose.Types.ObjectId(teacherId),
          tenantId: tenantId,
          isActive: true,
          isDeleted: false,
        },
        {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
        options
      );
      return result.modifiedCount > 0;
    } catch (error: any) {
      console.error("Error deleting assignments by teacher:", error);
      throw new Error(
        `Failed to delete assignments by teacher: ${error.message}`
      );
    }
  }

  /**
   * Hard delete all assignments by teacher ID (removes records from database)
   */
  static async hardDeleteAssignmentsByTeacher(
    teacherId: string,
    tenantId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    try {
      const options: any = {};
      if (session) {
        options.session = session;
      }

      const result = await TeacherAssignClasses.deleteMany(
        {
          teacherId: new mongoose.Types.ObjectId(teacherId),
          tenantId: tenantId,
        },
        options
      );
      return result.deletedCount || 0;
    } catch (error: any) {
      console.error("Error hard deleting assignments by teacher:", error);
      throw new Error(
        `Failed to hard delete assignments by teacher: ${error.message}`
      );
    }
  }

  /**
   * Soft delete specific assignment
   */
  static async deleteSpecificAssignment(
    teacherId: string,
    classId: string,
    subjectId: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const result = await TeacherAssignClasses.updateOne(
        {
          teacherId: new mongoose.Types.ObjectId(teacherId),
          classId: new mongoose.Types.ObjectId(classId),
          subjectId: new mongoose.Types.ObjectId(subjectId),
          tenantId: tenantId,
          isActive: true,
          isDeleted: false,
        },
        {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        }
      );
      return result.modifiedCount > 0;
    } catch (error: any) {
      console.error("Error deleting specific assignment:", error);
      throw new Error(`Failed to delete specific assignment: ${error.message}`);
    }
  }

  /**
   * Get assignment statistics for tenant
   */
  static async getAssignmentStatistics(tenantId: string): Promise<{
    totalAssignments: number;
    activeAssignments: number;
    inactiveAssignments: number;
    assignmentsByTeacher: { teacherId: string; count: number }[];
    assignmentsByClass: { classId: string; count: number }[];
    assignmentsBySubject: { subjectId: string; count: number }[];
  }> {
    try {
      const totalAssignments = await TeacherAssignClasses.countDocuments({
        tenantId: tenantId,
        isActive: true,
        isDeleted: false,
      });

      const activeAssignments = await TeacherAssignClasses.countDocuments({
        tenantId: tenantId,
        status: "active",
        isActive: true,
        isDeleted: false,
      });

      const inactiveAssignments = await TeacherAssignClasses.countDocuments({
        tenantId: tenantId,
        status: "inactive",
        isActive: true,
        isDeleted: false,
      });

      const assignmentsByTeacher = await TeacherAssignClasses.aggregate([
        {
          $match: {
            tenantId: tenantId,
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$teacherId",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            teacherId: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]);

      const assignmentsByClass = await TeacherAssignClasses.aggregate([
        {
          $match: {
            tenantId: tenantId,
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$classId",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            classId: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]);

      const assignmentsBySubject = await TeacherAssignClasses.aggregate([
        {
          $match: {
            tenantId: tenantId,
            isActive: true,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$subjectId",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            subjectId: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]);

      return {
        totalAssignments,
        activeAssignments,
        inactiveAssignments,
        assignmentsByTeacher,
        assignmentsByClass,
        assignmentsBySubject,
      };
    } catch (error: any) {
      console.error("Error getting assignment statistics:", error);
      throw new Error(`Failed to get assignment statistics: ${error.message}`);
    }
  }
}

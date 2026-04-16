import {
  TeacherCredentialAssignment,
  ITeacherCredentialAssignment,
} from "../models";
import mongoose from "mongoose";
import {
  AssignCredentialToTeachersRequest,
  GetTeacherCredentialAssignmentsRequest,
} from "../types/credentialAssignment.types";

export const createTeacherCredentialAssignments = async (
  credentialTemplateId: string,
  data: AssignCredentialToTeachersRequest,
  tenantId: string
): Promise<ITeacherCredentialAssignment[]> => {
  try {
    const assignments: ITeacherCredentialAssignment[] = [];

    for (const teacherId of data.teacherIds) {
      const assignmentData: Record<string, unknown> = {
        credentialTemplateId: new mongoose.Types.ObjectId(credentialTemplateId),
        teacherId: new mongoose.Types.ObjectId(teacherId),
        startDate: data.startDate,
        endDate: data.endDate,
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isActive: true,
      };
      if (data.classId && mongoose.Types.ObjectId.isValid(data.classId)) {
        assignmentData.classId = new mongoose.Types.ObjectId(data.classId);
      }
      if (data.credentialCategory) {
        assignmentData.credentialCategory = data.credentialCategory;
      }

      const assignment = new TeacherCredentialAssignment(assignmentData);

      const saved = await assignment.save();
      assignments.push(saved);
    }

    return assignments;
  } catch (error: any) {
    console.error("Error creating teacher credential assignments:", error);
    throw error;
  }
};

export const findTeacherCredentialAssignments = async (
  params: GetTeacherCredentialAssignmentsRequest & { tenantId: string }
): Promise<ITeacherCredentialAssignment[]> => {
  try {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
    };

    if (params.teacherId) {
      query.teacherId = new mongoose.Types.ObjectId(params.teacherId);
    }
    if (params.credentialTemplateId) {
      query.credentialTemplateId = new mongoose.Types.ObjectId(
        params.credentialTemplateId
      );
    }
    if (params.isActive !== undefined) {
      query.isActive = params.isActive;
    }

    return await TeacherCredentialAssignment.find(query)
      .populate({
        path: "credentialTemplateId",
        select: "meritBadge credentialType credentialInfo createdBy",
        populate: {
          path: "createdBy",
          select: "firstName lastName email"
        }
      })
      .populate("teacherId", "firstName lastName email")
      .sort({ createdAt: -1 });
  } catch (error: any) {
    console.error("Error finding teacher credential assignments:", error);
    throw error;
  }
};

export const countTeacherCredentialAssignments = async (
  params: GetTeacherCredentialAssignmentsRequest & { tenantId: string }
): Promise<number> => {
  try {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
    };

    if (params.teacherId) {
      query.teacherId = new mongoose.Types.ObjectId(params.teacherId);
    }
    if (params.credentialTemplateId) {
      query.credentialTemplateId = new mongoose.Types.ObjectId(
        params.credentialTemplateId
      );
    }
    if (params.isActive !== undefined) {
      query.isActive = params.isActive;
    }

    return await TeacherCredentialAssignment.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting teacher credential assignments:", error);
    throw error;
  }
};

export const findActiveAssignmentsForTeachers = async (
  credentialTemplateId: string,
  teacherIds: string[],
  tenantId: string,
  now: Date
): Promise<ITeacherCredentialAssignment[]> => {
  try {
    if (!teacherIds.length) {
      return [];
    }

    const teacherObjectIds = teacherIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!teacherObjectIds.length) {
      return [];
    }

    return await TeacherCredentialAssignment.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      credentialTemplateId: new mongoose.Types.ObjectId(credentialTemplateId),
      teacherId: { $in: teacherObjectIds },
      endDate: { $gte: now },
    });
  } catch (error: any) {
    console.error("Error finding active teacher credential assignments:", error);
    throw error;
  }
};

/**
 * Get teacher IDs that already have an active assignment for this credential + class + category.
 * Used to exclude them from the class-teachers list when fetching for credential assignment.
 */
export const findAssignedTeacherIdsForClassAndCategory = async (
  credentialTemplateId: string,
  classId: string,
  credentialCategory: string,
  tenantId: string,
  now: Date
): Promise<string[]> => {
  try {
    if (!classId || !credentialCategory || !mongoose.Types.ObjectId.isValid(classId)) {
      return [];
    }

    const assignments = await TeacherCredentialAssignment.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      credentialTemplateId: new mongoose.Types.ObjectId(credentialTemplateId),
      classId: new mongoose.Types.ObjectId(classId),
      credentialCategory: credentialCategory.toLowerCase(),
      isActive: true,
      endDate: { $gte: now },
    })
      .select("teacherId")
      .lean();

    return assignments
      .map((a: any) => {
        const tid = a.teacherId;
        return tid?.toString?.() ?? (tid && typeof tid === "object" && "_id" in tid ? (tid as any)._id?.toString() : null);
      })
      .filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id));
  } catch (error: any) {
    console.error(
      "Error finding assigned teacher IDs by class and category:",
      error
    );
    throw error;
  }
};

/**
 * Find active assignments for the same credential + class + category.
 * Used to block duplicate: same credential (Other/Exam) for same teacher in same class.
 */
export const findActiveAssignmentsForTeachersWithClassAndCategory = async (
  credentialTemplateId: string,
  teacherIds: string[],
  classId: string,
  credentialCategory: string,
  tenantId: string,
  now: Date
): Promise<ITeacherCredentialAssignment[]> => {
  try {
    if (!teacherIds.length || !classId || !credentialCategory) {
      return [];
    }

    const teacherObjectIds = teacherIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (!teacherObjectIds.length || !mongoose.Types.ObjectId.isValid(classId)) {
      return [];
    }

    return await TeacherCredentialAssignment.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      credentialTemplateId: new mongoose.Types.ObjectId(credentialTemplateId),
      teacherId: { $in: teacherObjectIds },
      classId: new mongoose.Types.ObjectId(classId),
      credentialCategory: credentialCategory.toLowerCase(),
      isActive: true,
      endDate: { $gte: now },
    }).lean();
  } catch (error: any) {
    console.error(
      "Error finding active assignments by class and category:",
      error
    );
    throw error;
  }
};

export const findAssignmentById = async (
  assignmentId: string,
  tenantId?: string
): Promise<ITeacherCredentialAssignment | null> => {
  try {
    const query: any = {
      _id: assignmentId,
    };

    if (tenantId) {
      query.tenantId = new mongoose.Types.ObjectId(tenantId);
    }

    return await TeacherCredentialAssignment.findOne(query)
      .populate("credentialTemplateId", "meritBadge credentialType")
      .populate("teacherId", "firstName lastName");
  } catch (error: any) {
    console.error("Error finding assignment by ID:", error);
    throw error;
  }
};

export const updateAssignment = async (
  assignmentId: string,
  data: Partial<AssignCredentialToTeachersRequest>,
  tenantId: string
): Promise<ITeacherCredentialAssignment | null> => {
  try {
    const updateData: any = {};

    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    return await TeacherCredentialAssignment.findOneAndUpdate(
      {
        _id: assignmentId,
        tenantId: new mongoose.Types.ObjectId(tenantId),
      },
      updateData,
      { new: true }
    )
      .populate("credentialTemplateId", "meritBadge credentialType")
      .populate("teacherId", "firstName lastName");
  } catch (error: any) {
    console.error("Error updating assignment:", error);
    throw error;
  }
};

export const deleteAssignment = async (
  assignmentId: string,
  tenantId: string
): Promise<boolean> => {
  try {
    const result = await TeacherCredentialAssignment.deleteOne({
      _id: assignmentId,
      tenantId: new mongoose.Types.ObjectId(tenantId),
    });

    return result.deletedCount > 0;
  } catch (error: any) {
    console.error("Error deleting assignment:", error);
    throw error;
  }
};

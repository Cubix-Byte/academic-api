import { ExamCredential, IExamCredential, TeacherActivityLog } from "../models";
import mongoose from "mongoose";
import { GetTeacherCredentialsRequest } from "../types/teacherCredentials.types";

/**
 * Exam Credential Repository - Data access layer
 */

// Find credentials by student
export const findCredentialsByStudent = async (
  studentId: string,
  filters?: Record<string, any>,
  sort?: Record<string, 1 | -1>
): Promise<IExamCredential[]> => {
  try {
    const query = {
      studentId: studentId,
      isDeleted: false,
      ...filters,
    };

    return await ExamCredential.find(query)
      .populate("examId", "classId subjectId examTitle")
      .sort(sort || { issuedDate: -1 });
  } catch (error: any) {
    console.error("Error finding credentials by student:", error);
    throw error;
  }
};

// Find issued credentials with enhanced filters
export const findIssuedCredentials = async (params: {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  filters?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
}): Promise<IExamCredential[]> => {
  try {
    const {
      tenantId,
      pageNo,
      pageSize,
      filters = {},
      sort = { issuedDate: -1 },
    } = params;

    // Build base query
    const baseQuery: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Handle ObjectId conversions for examId and studentId if they exist in filters
    if (finalQuery.examId && typeof finalQuery.examId === "string") {
      finalQuery.examId = new mongoose.Types.ObjectId(finalQuery.examId);
    }
    if (finalQuery.studentId && typeof finalQuery.studentId === "string") {
      finalQuery.studentId = new mongoose.Types.ObjectId(finalQuery.studentId);
    }

    // Build query
    let query = ExamCredential.find(finalQuery)
      .populate("examId", "classId subjectId examTitle")
      .populate("createdBy", "firstName lastName email thrId profilePicture")
      .sort(sort);

    // Apply pagination only if both pageNo and pageSize are provided
    if (pageNo !== undefined && pageSize !== undefined) {
      const skip = (pageNo - 1) * pageSize;
      query = query.skip(skip).limit(pageSize);
    }

    // Note: classId and issuedBy filters need to be applied after fetching
    // because they require joins with Exam and ActivityLog

    return await query;
  } catch (error: any) {
    console.error("Error finding issued credentials:", error);
    throw error;
  }
};

// Count issued credentials
export const countIssuedCredentials = async (params: {
  tenantId: string;
  filters?: Record<string, any>;
}): Promise<number> => {
  try {
    const { tenantId, filters = {} } = params;

    // Build base query
    const baseQuery: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Handle ObjectId conversions for examId and studentId if they exist in filters
    if (finalQuery.examId && typeof finalQuery.examId === "string") {
      finalQuery.examId = new mongoose.Types.ObjectId(finalQuery.examId);
    }
    if (finalQuery.studentId && typeof finalQuery.studentId === "string") {
      finalQuery.studentId = new mongoose.Types.ObjectId(finalQuery.studentId);
    }

    return await ExamCredential.countDocuments(finalQuery);
  } catch (error: any) {
    console.error("Error counting issued credentials:", error);
    throw error;
  }
};

// Find credential by ID
export const findCredentialById = async (
  credentialId: string
): Promise<IExamCredential | null> => {
  try {
    return await ExamCredential.findOne({
      _id: credentialId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding credential by ID:", error);
    throw error;
  }
};

// Find credential by verification code
export const findCredentialByVerificationCode = async (
  verificationCode: string
): Promise<IExamCredential | null> => {
  try {
    return await ExamCredential.findOne({
      verificationCode: verificationCode,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error finding credential by verification code:", error);
    throw error;
  }
};

// Count credentials for student
export const countCredentialsForStudent = async (
  studentId: string
): Promise<number> => {
  try {
    return await ExamCredential.countDocuments({
      studentId: studentId,
      isDeleted: false,
    });
  } catch (error: any) {
    console.error("Error counting credentials for student:", error);
    throw error;
  }
};

// Get exam IDs for which the student already has a credential (used to exclude from current-class list).
// When credentialId is provided, only excludes exams where this student has this specific credential (e.g. "Good").
// When credentialId is omitted, excludes exams where student has any credential (backward compatible).
export const findExamIdsWithCredentialForStudent = async (
  studentId: string,
  credentialId?: string
): Promise<string[]> => {
  try {
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return [];
    }
    const query: Record<string, unknown> = {
      studentId: new mongoose.Types.ObjectId(studentId),
      isDeleted: false,
      isActive: true,
      examId: { $exists: true, $ne: null },
    };
    if (credentialId && mongoose.Types.ObjectId.isValid(credentialId)) {
      query.credentialId = new mongoose.Types.ObjectId(credentialId);
    }
    const docs = await ExamCredential.find(query)
      .select("examId")
      .lean();
    const examIds = docs
      .map((d: any) => {
        const eid = d.examId;
        if (!eid) return null;
        return eid instanceof mongoose.Types.ObjectId
          ? eid.toString()
          : String(eid);
      })
      .filter(
        (id): id is string =>
          id !== null && mongoose.Types.ObjectId.isValid(id)
      );
    return [...new Set(examIds)];
  } catch (error: any) {
    console.error("Error finding exam IDs with credential for student:", error);
    throw error;
  }
};

// Find credentials issued by specific teachers
export const findCredentialsByTeacherIds = async (
  teacherIds: string[],
  tenantId: string,
  pageNo?: number,
  pageSize?: number,
  credentialName?: string,
  credentialType?: string
): Promise<IExamCredential[]> => {
  try {
    // Filter out invalid teacher IDs and convert to ObjectIds
    const validTeacherIds = teacherIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validTeacherIds.length === 0) {
      return [];
    }

    // First, find all credential IDs issued by these teachers from activity logs
    const activityLogs = await TeacherActivityLog.find({
      teacherId: { $in: validTeacherIds },
      activityType: "CredentialCreated",
      relatedEntityType: "Credential",
      tenantId: new mongoose.Types.ObjectId(tenantId),
    })
      .select("relatedEntityId teacherId")
      .lean();

    console.log("📝 [REPOSITORY] Activity logs found:", {
      count: activityLogs.length,
      teacherIds: validTeacherIds.map((id) => id.toString()),
      activityLogDetails: activityLogs.map((log: any) => ({
        teacherId: log.teacherId?.toString(),
        credentialId: log.relatedEntityId?.toString(),
      })),
    });

    // Extract credential IDs, handling both ObjectId and string formats
    const credentialIds = activityLogs
      .map((log) => {
        const id = log.relatedEntityId;
        // If it's already an ObjectId, use it directly; otherwise convert to string then ObjectId
        if (id instanceof mongoose.Types.ObjectId) {
          return id;
        } else if (id) {
          const idStr = typeof id === "string" ? id : String(id);
          if (mongoose.Types.ObjectId.isValid(idStr)) {
            return new mongoose.Types.ObjectId(idStr);
          }
        }
        return null;
      })
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    console.log("🆔 [REPOSITORY] Extracted credential IDs:", {
      count: credentialIds.length,
      credentialIds: credentialIds.map((id) => id.toString()),
    });

    // Fallback: If no activity logs found, try querying by createdBy field directly
    let credentialIdsToQuery = credentialIds;
    let useCreatedByFallback = false;

    if (credentialIds.length === 0) {
      console.log("⚠️ [REPOSITORY] No credential IDs found in activity logs, trying createdBy fallback");
      useCreatedByFallback = true;
      // Query credentials directly by createdBy field
      const credentialsByCreatedBy = await ExamCredential.find({
        createdBy: { $in: validTeacherIds },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .select("_id")
        .lean();

      credentialIdsToQuery = credentialsByCreatedBy
        .map((c) => c._id)
        .filter((id): id is mongoose.Types.ObjectId => id instanceof mongoose.Types.ObjectId);

      console.log("🔄 [REPOSITORY] Fallback: Found credentials by createdBy:", {
        count: credentialIdsToQuery.length,
        credentialIds: credentialIdsToQuery.map((id) => id.toString()),
      });

      if (credentialIdsToQuery.length === 0) {
        console.log("⚠️ [REPOSITORY] No credentials found by createdBy either");
        return [];
      }
    }

    // Then fetch the actual credentials
    const query: any = {
      _id: { $in: credentialIdsToQuery },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Filter by credential template if provided
    // credentialName should match template's meritBadge (case-insensitive)
    if (credentialName) {
      // Use case-insensitive regex for matching (handles case variations)
      const escapedName = credentialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.credentialName = {
        $regex: new RegExp(`^${escapedName}$`, 'i')
      };
    }
    // credentialType should match template's credentialType (case-insensitive)
    if (credentialType) {
      const escapedType = credentialType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.credentialType = {
        $regex: new RegExp(`^${escapedType}$`, 'i')
      };
    }

    console.log("🔍 [REPOSITORY] Query for credentials:", {
      credentialIdsCount: credentialIdsToQuery.length,
      credentialName: credentialName,
      credentialType: credentialType,
      useCreatedByFallback: useCreatedByFallback,
      query: JSON.stringify(query),
    });

    const skip = pageNo && pageSize ? (pageNo - 1) * pageSize : 0;
    const limit = pageSize || undefined;

    const credentials = await ExamCredential.find(query)
      .populate("examId", "classId subjectId examTitle")
      .sort({ issuedDate: -1 })
      .skip(skip)
      .limit(limit || 0);

    console.log("📊 [REPOSITORY] Found credentials:", {
      count: credentials.length,
      credentialNames: credentials.map((c) => c.credentialName),
      credentialTypes: credentials.map((c) => c.credentialType),
    });

    return credentials;
  } catch (error: any) {
    console.error("Error finding credentials by teacher IDs:", error);
    throw error;
  }
};

// Count credentials issued by specific teachers
export const countCredentialsByTeacherIds = async (
  teacherIds: string[],
  tenantId: string,
  credentialName?: string,
  credentialType?: string
): Promise<number> => {
  try {
    // Filter out invalid teacher IDs and convert to ObjectIds
    const validTeacherIds = teacherIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validTeacherIds.length === 0) {
      return 0;
    }

    // First, find all credential IDs issued by these teachers from activity logs
    const activityLogs = await TeacherActivityLog.find({
      teacherId: { $in: validTeacherIds },
      activityType: "CredentialCreated",
      relatedEntityType: "Credential",
      tenantId: new mongoose.Types.ObjectId(tenantId),
    })
      .select("relatedEntityId")
      .lean();

    // Extract credential IDs, handling both ObjectId and string formats
    const credentialIds = activityLogs
      .map((log) => {
        const id = log.relatedEntityId;
        // If it's already an ObjectId, use it directly; otherwise convert to string then ObjectId
        if (id instanceof mongoose.Types.ObjectId) {
          return id;
        } else if (id) {
          const idStr = typeof id === "string" ? id : String(id);
          if (mongoose.Types.ObjectId.isValid(idStr)) {
            return new mongoose.Types.ObjectId(idStr);
          }
        }
        return null;
      })
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    // Fallback: If no activity logs found, try querying by createdBy field directly
    let credentialIdsToQuery = credentialIds;

    if (credentialIds.length === 0) {
      // Query credentials directly by createdBy field
      const credentialsByCreatedBy = await ExamCredential.find({
        createdBy: { $in: validTeacherIds },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .select("_id")
        .lean();

      credentialIdsToQuery = credentialsByCreatedBy
        .map((c) => c._id)
        .filter((id): id is mongoose.Types.ObjectId => id instanceof mongoose.Types.ObjectId);

      if (credentialIdsToQuery.length === 0) {
        return 0;
      }
    }

    // Build query with optional credential template filters
    const query: any = {
      _id: { $in: credentialIdsToQuery },
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    };

    // Filter by credential template if provided
    // credentialName should match template's meritBadge (case-insensitive)
    if (credentialName) {
      // Use case-insensitive regex for matching (handles case variations)
      const escapedName = credentialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.credentialName = {
        $regex: new RegExp(`^${escapedName}$`, 'i')
      };
    }
    // credentialType should match template's credentialType (case-insensitive)
    if (credentialType) {
      const escapedType = credentialType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.credentialType = {
        $regex: new RegExp(`^${escapedType}$`, 'i')
      };
    }

    // Then count the actual credentials
    return await ExamCredential.countDocuments(query);
  } catch (error: any) {
    console.error("Error counting credentials by teacher IDs:", error);
    throw error;
  }
};

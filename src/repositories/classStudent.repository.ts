import mongoose from "mongoose";
import ClassStudent, { IClassStudent } from "@/models/class_student.schema";

export const create = async (
  data: Partial<IClassStudent>,
  session?: mongoose.ClientSession
): Promise<IClassStudent> => {
  const doc = new ClassStudent({
    ...data,
  });
  if (session) {
    return await doc.save({ session });
  }
  return await doc.save();
};

export const findByClassAndRoll = async (
  tenantId: string,
  classId: string,
  rollNumber: string
) => {
  return await ClassStudent.findOne({
    tenantId,
    classId: new mongoose.Types.ObjectId(classId),
    rollNumber,
    isDeleted: false,
  });
};

/**
 * Batch check which (classId, rollNumber) pairs already exist in class_students (for bulk upload validation).
 * Returns a Set of keys "classId:rollNumber" for existing pairs.
 */
export const findExistingClassRolls = async (
  tenantId: string,
  pairs: Array<{ classId: string; rollNumber: string }>
): Promise<Set<string>> => {
  if (pairs.length === 0) return new Set();
  const validPairs = pairs.filter(
    (p) => p.classId && mongoose.Types.ObjectId.isValid(p.classId) && p.rollNumber?.trim?.()
  );
  if (validPairs.length === 0) return new Set();
  const orConditions = validPairs.map((p) => ({
    classId: new mongoose.Types.ObjectId(p.classId),
    rollNumber: p.rollNumber.trim(),
  }));
  const existing = await ClassStudent.find({
    tenantId,
    isDeleted: false,
    $or: orConditions,
  })
    .select("classId rollNumber")
    .lean()
    .exec();
  const keySet = new Set<string>();
  for (const d of existing as any[]) {
    const cid = d.classId?.toString?.();
    const rn = d.rollNumber;
    if (cid && rn) keySet.add(`${cid}:${rn}`);
  }
  return keySet;
};

export const findByClassAndStudent = async (
  tenantId: string, // Kept for API compatibility but not used in query
  classId: string,
  studentId: string
) => {
  // Note: class_students table doesn't have tenantId field, so we only filter by classId and studentId
  return await ClassStudent.findOne({
    classId: new mongoose.Types.ObjectId(classId),
    studentId: new mongoose.Types.ObjectId(studentId),
    isDeleted: false,
  });
};

export const findByStudent = async (studentId: string, tenantId?: string) => {
  const filter: any = {
    studentId: new mongoose.Types.ObjectId(studentId),
    isDeleted: false,
  };
  if (tenantId) {
    filter.tenantId = mongoose.Types.ObjectId.isValid(tenantId)
      ? new mongoose.Types.ObjectId(tenantId)
      : tenantId;
  }
  return await ClassStudent.find(filter);
};

export const softDeleteById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await ClassStudent.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true, isActive: false } },
    { new: true }
  );
};

export const bulkPromoteUpdate = async (
  studentIds: string[],
  classId: string,
  session?: mongoose.ClientSession
) => {
  return await ClassStudent.updateMany(
    {
      studentId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
      classId: new mongoose.Types.ObjectId(classId),
      isDeleted: false,
      enrollmentStatus: "active"
    },
    {
      $set: {
        enrollmentStatus: "promoted",
        isActive: false,
        updatedAt: new Date()
      }
    },
    { session }
  );
};

export const createBulk = async (
  data: Partial<IClassStudent>[],
  session?: mongoose.ClientSession
) => {
  if (session) {
    return await ClassStudent.insertMany(data, { session });
  }
  return await ClassStudent.insertMany(data);
};

export const findByStudentIdsAndClass = async (
  studentIds: string[],
  classId: string,
) => {
  return await ClassStudent.find({
    studentId: { $in: studentIds.map(id => new mongoose.Types.ObjectId(id)) },
    classId: new mongoose.Types.ObjectId(classId),
    isDeleted: false,
    enrollmentStatus: "active"
  });
};

export const updateByStudentAndClass = async (
  studentId: string,
  classId: string,
  updates: Partial<IClassStudent>,
  session?: mongoose.ClientSession
) => {
  const filter: any = {
    studentId: new mongoose.Types.ObjectId(studentId),
    classId: new mongoose.Types.ObjectId(classId),
    isDeleted: false,
  };
  
  const updateData: any = {
    ...updates,
    updatedAt: new Date(),
  };
  
  // Convert subjectIds to ObjectIds if provided
  if (updates.subjectIds && Array.isArray(updates.subjectIds)) {
    updateData.subjectIds = updates.subjectIds.map((id: any) => 
      id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
    );
  }

  const options: any = { new: true };
  if (session) {
    options.session = session;
  }

  return await ClassStudent.findOneAndUpdate(filter, { $set: updateData }, options);
};

// Find class_students records for multiple studentIds
export const findByStudentIds = async (
  studentIds: string[],
  tenantId: string // Kept for API compatibility but not used in query
) => {
  if (!studentIds || studentIds.length === 0) {
    console.log(`⚠️ [findByStudentIds] No studentIds provided`);
    return [];
  }

  // Convert studentIds to ObjectIds
  const studentObjectIds = studentIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  if (studentObjectIds.length === 0) {
    console.log(`⚠️ [findByStudentIds] No valid studentIds after conversion`);
    return [];
  }

  // Note: class_students table doesn't have tenantId field, so we only filter by studentId
  const filter: any = {
    studentId: { $in: studentObjectIds },
    isDeleted: false,
    enrollmentStatus: { $in: ["active", "promoted"] },
  };

  console.log(`🔍 [findByStudentIds] Query filter:`, {
    studentIdCount: studentObjectIds.length,
    isDeleted: false,
    enrollmentStatus: { $in: ["active", "promoted"] }
  });

  const results = await ClassStudent.find(filter)
    .select("studentId classId subjectIds enrollmentStatus")
    .lean();
  
  console.log(`📚 [findByStudentIds] Found ${results.length} class_students records`);
  if (results.length > 0) {
    results.forEach((record: any, index: number) => {
      const subjectIds = record.subjectIds && Array.isArray(record.subjectIds)
        ? record.subjectIds.map((id: any) => id.toString())
        : [];
      console.log(`📚 [findByStudentIds] Record ${index + 1}:`, {
        studentId: record.studentId?.toString(),
        classId: record.classId?.toString(),
        enrollmentStatus: record.enrollmentStatus,
        subjectIdsCount: subjectIds.length,
        subjectIds: subjectIds
      });
    });
  }

  return results;
};

// Find studentIds by classId and subjectId(s) - for filtering students by subject
export const findStudentIdsByClassAndSubject = async (
  classId: string,
  subjectIds: string[]
): Promise<string[]> => {
  if (!subjectIds || subjectIds.length === 0) {
    return [];
  }

  // Convert subjectIds to ObjectIds
  const subjectObjectIds = subjectIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  if (subjectObjectIds.length === 0) {
    console.log(`⚠️ [findStudentIdsByClassAndSubject] No valid subjectIds provided`);
    return [];
  }

  // Query class_students to find records where:
  // - classId matches
  // - subjectIds array contains any of the requested subjectIds
  // - enrollmentStatus is active
  // - not deleted
  const filter: any = {
    classId: new mongoose.Types.ObjectId(classId),
    subjectIds: { $in: subjectObjectIds }, // At least one subjectId must match
    isDeleted: false,
    enrollmentStatus: "active",
  };

  console.log(`🔍 [findStudentIdsByClassAndSubject] Query filter:`, {
    classId,
    subjectIdsCount: subjectObjectIds.length,
    isDeleted: false,
    enrollmentStatus: "active"
  });

  const results = await ClassStudent.find(filter)
    .select("studentId")
    .lean();

  // Extract unique studentIds
  const studentIds = [...new Set(
    results
      .map((record: any) => record.studentId?.toString())
      .filter((id: string | undefined) => id)
  )];

  console.log(`📚 [findStudentIdsByClassAndSubject] Found ${studentIds.length} unique students with subject(s) in class ${classId}`);

  return studentIds;
};




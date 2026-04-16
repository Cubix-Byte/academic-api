import { Teacher, ITeacher } from "../models";
import mongoose, { SortOrder } from "mongoose";

/**
 * Teacher Repository - Database operations for Teacher entity
 */

// Find teacher by ID (finds both active and inactive teachers, but not deleted)
export const findTeacherById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return await Teacher.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
};

// Find teacher by userId (for JWT-based authentication)
// Checks both _id and userId field to support different setups
export const findTeacherByUserId = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return await Teacher.findOne({
    $or: [
      { _id: new mongoose.Types.ObjectId(userId) }, // Teacher _id equals userId (shared ID)
      { userId: new mongoose.Types.ObjectId(userId) }, // Teacher userId field equals userId
    ],
    isDeleted: false,
  })
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    });
};

// Find teacher by email (tenant-specific)
export const findTeacherByEmail = async (email: string, tenantId: string) => {
  const query: any = {
    email: email.toLowerCase(),
    isActive: true,
    isDeleted: false,
    tenantId: tenantId, // Must match the specific tenant
  };

  return await Teacher.findOne(query);
};

/**
 * Find existing teacher emails in tenant (for bulk upload batch validation).
 * Returns set of lowercase emails that already exist.
 */
export const findExistingTeacherEmails = async (
  emails: string[],
  tenantId: string
): Promise<Set<string>> => {
  if (emails.length === 0) return new Set();
  const normalized = emails.map((e) => e?.trim?.()?.toLowerCase?.()).filter(Boolean);
  const existing = await Teacher.find(
    { email: { $in: normalized }, tenantId, isActive: true, isDeleted: false },
    { email: 1 }
  )
    .lean()
    .exec();
  return new Set((existing as any[]).map((d) => (d.email || "").toLowerCase()).filter(Boolean));
};

/**
 * Bulk insert teachers (for bulk upload). thrId and _id must be set on each doc.
 */
export const insertManyTeachers = async (
  teacherDocs: Partial<ITeacher>[],
  session?: mongoose.ClientSession
): Promise<ITeacher[]> => {
  if (teacherDocs.length === 0) return [];
  const options = session ? { session } : {};
  const inserted = await Teacher.insertMany(teacherDocs, options);
  return inserted as ITeacher[];
};

// Create teacher
export const createTeacher = async (
  teacherData: Partial<ITeacher>,
  session?: mongoose.ClientSession
) => {
  const teacher = new Teacher({
    ...teacherData,
    createdBy: "academy-api",
    isActive: teacherData.isActive !== undefined ? teacherData.isActive : true,
    isDeleted: false,
  });

  if (session) {
    return await teacher.save({ session });
  }
  return await teacher.save();
};

/**
 * Bulk update userId on multiple teachers in one DB round-trip (for bulk upload).
 */
export const bulkUpdateUserIds = async (
  updates: Array<{ teacherId: string; userId: string }>,
  session?: mongoose.ClientSession
): Promise<void> => {
  if (updates.length === 0) return;
  const bulkOps = updates
    .filter((u) => mongoose.Types.ObjectId.isValid(u.teacherId) && mongoose.Types.ObjectId.isValid(u.userId))
    .map(({ teacherId, userId }) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(teacherId) },
        update: {
          $set: {
            userId: new mongoose.Types.ObjectId(userId),
            updatedBy: "academy-api",
          },
        },
      },
    }));
  if (bulkOps.length === 0) return;
  await Teacher.bulkWrite(bulkOps, session ? { session } : {});
};

// Update teacher by ID
export const updateTeacherById = async (
  id: string,
  updateData: Partial<ITeacher>,
  session?: mongoose.ClientSession
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const options: any = { new: true, runValidators: true };
  if (session) {
    options.session = session;
  }

  return await Teacher.findByIdAndUpdate(
    id,
    { $set: { ...updateData, updatedBy: "academy-api" } },
    options
  )
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    });
};

// Soft delete teacher by ID
export const softDeleteTeacherById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return await Teacher.findByIdAndUpdate(
    id,
    {
      $set: {
        isDeleted: true,
        isActive: false,
        updatedBy: "academy-api",
      },
    },
    { new: true }
  );
};

// Find teachers with filters
export const findTeachers = async ({
  pageNo = 1,
  pageSize = 10,
  tenantId,
  filters = {},
  sort = {},
}: {
  pageNo?: number;
  pageSize?: number;
  tenantId?: string;
  filters?: Record<string, any>;
  sort?: Record<string, SortOrder>;
}) => {
  const skip = (pageNo - 1) * pageSize;

  // Base query with required filters
  const whereClause: any = {
    isDeleted: false,
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  // Extract search filter if present
  const { search, isActive, ...otherFilters } = filters;

  // Handle isActive filter - only add filter if explicitly provided
  // If undefined, don't filter by isActive (returns both active and inactive)
  if (isActive !== undefined) {
    whereClause.isActive = isActive;
  }
  // If isActive is undefined, we don't add it to whereClause, so it returns all teachers

  // Handle search filter - search across multiple fields
  if (search && typeof search === "string" && search.trim()) {
    const searchRegex = { $regex: search.trim(), $options: "i" };
    whereClause.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { thrId: searchRegex },
      { qualification: searchRegex },
      { specialization: searchRegex },
      { designation: searchRegex },
    ];
  }

  // Handle _id filter (for teacher IDs array from class/subject filtering)
  if (otherFilters._id) {
    whereClause._id = otherFilters._id;
    delete otherFilters._id;
  }

  // Merge with other dynamic filters
  const finalQuery = { ...whereClause, ...otherFilters };

  // Use provided sort or default to createdAt descending
  const finalSort: Record<string, SortOrder> =
    Object.keys(sort).length > 0
      ? sort
      : ({ createdAt: -1 } as Record<string, SortOrder>);

  // Get total count for pagination
  const total = await Teacher.countDocuments(finalQuery);

  // Get paginated teachers
  const teachers = await Teacher.find(finalQuery)
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
    .sort(finalSort)
    .skip(skip)
    .limit(pageSize)
    .lean();

  // Calculate total pages
  const totalPages = Math.ceil(total / pageSize);

  return {
    teachers,
    pagination: {
      pageNo,
      pageSize,
      total,
      totalPages,
    },
  };
};

// Count teachers
export const countTeachers = async ({
  tenantId,
  filters = {},
}: {
  tenantId?: string;
  filters?: Record<string, any>;
}) => {
  const whereClause: any = {
    isActive: true,
    isDeleted: false,
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  // Merge with dynamic filters from buildQuery
  const finalQuery = { ...whereClause, ...filters };

  return await Teacher.countDocuments(finalQuery);
};

// Count teachers for seat/quota enforcement (counts all non-deleted, regardless of active/inactive)
export const countTeachersAll = async ({ tenantId }: { tenantId: string }) => {
  const whereClause: any = { isDeleted: false };
  if (tenantId) whereClause.tenantId = tenantId;
  return await Teacher.countDocuments(whereClause);
};

// Find teachers by class
export const findTeachersByClass = async (
  classId: string,
  tenantId?: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  const whereClause: any = {
    assignedClasses: classId,
    isActive: true,
    isDeleted: false,
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  // Merge with dynamic filters from buildQuery
  const finalQuery = { ...whereClause, ...filters };

  // Use provided sort or default to createdAt descending
  const finalSort: Record<string, SortOrder> =
    Object.keys(sort).length > 0
      ? sort
      : ({ createdAt: -1 } as Record<string, SortOrder>);

  return await Teacher.find(finalQuery)
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
    .sort(finalSort)
    .lean();
};

// Find teachers by subject
export const findTeachersBySubject = async (
  subjectId: string,
  tenantId?: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
) => {
  const whereClause: any = {
    assignedSubjects: subjectId,
    isActive: true,
    isDeleted: false,
  };

  if (tenantId) {
    whereClause.tenantId = tenantId;
  }

  // Merge with dynamic filters from buildQuery
  const finalQuery = { ...whereClause, ...filters };

  // Use provided sort or default to createdAt descending
  const finalSort: Record<string, SortOrder> =
    Object.keys(sort).length > 0
      ? sort
      : ({ createdAt: -1 } as Record<string, SortOrder>);

  return await Teacher.find(finalQuery)
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
    .sort(finalSort)
    .lean();
};

// Get teacher statistics
export const getTeacherStatistics = async (tenantId?: string) => {
  const matchClause: any = {
    isActive: true,
    isDeleted: false,
  };

  if (tenantId) {
    matchClause.tenantId = tenantId;
  }

  const stats = await Teacher.aggregate([
    { $match: matchClause },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
  };

  stats.forEach((stat) => {
    const status = stat._id as keyof typeof result;
    if (status in result) {
      result[status] = stat.count;
    }
    result.total += stat.count;
  });

  return result;
};

// Get teachers by department
export const getTeachersByDepartment = async (department: string) => {
  return await Teacher.find({
    department,
    isActive: true,
    isDeleted: false,
  })
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
    .lean();
};

// Get teachers by designation
export const getTeachersByDesignation = async (designation: string) => {
  return await Teacher.find({
    designation,
    isActive: true,
    isDeleted: false,
  })
    .populate({
      path: "assignedClasses",
      match: { isDeleted: false },
    })
    .populate({
      path: "assignedSubjects",
      match: { isDeleted: false },
    })
    .lean();
};

// Get teachers DDL (dropdown list) - simplified data for dropdowns
export const getTeachersDDL = async (tenantId: string) => {
  try {
    // Validate tenantId before proceeding
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    const teachers = await Teacher.find({
      tenantId: tenantId,
      isActive: true,
      isDeleted: false,
    })
      .select("_id firstName lastName thrId email")
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return teachers.map((teacher: any) => ({
      id: teacher._id.toString(),
      name:
        `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "N/A",
      firstName: teacher.firstName || "",
      lastName: teacher.lastName || "",
      thrId: teacher.thrId || "",
      email: teacher.email || "",
    }));
  } catch (error: any) {
    // Provide more specific error messages
    if (error.message.includes("Invalid tenantId format")) {
      throw new Error(
        `Invalid tenantId format: ${tenantId}. Please check your authentication token.`
      );
    } else if (error.message.includes("Invalid tenantId")) {
      throw new Error(`Invalid tenantId: ${error.message}`);
    }
    throw error;
  }
};

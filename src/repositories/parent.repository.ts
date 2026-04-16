import { Parent, IParent } from "../models";
import mongoose, { SortOrder } from "mongoose";
import { ParentChild } from "../models";

/**
 * Parent Repository - Database operations for Parent entity
 */

// Find parent by ID
export const findParentById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return await Parent.findOne({
    _id: id,
    isDeleted: false,
  });
};

/**
 * Find parents by multiple IDs in one query (for bulk upload - get updated docs after bulkUpdateParents).
 */
export const findParentsByIds = async (ids: string[]) => {
  if (!ids || ids.length === 0) return [];
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (validIds.length === 0) return [];
  return await Parent.find({ _id: { $in: validIds }, isDeleted: false }).lean().exec();
};

// Find parent by parent ID (tenant-specific)
export const findParentByParentId = async (
  parentId: string,
  tenantId: string
) => {
  return await Parent.findOne({
    parentId,
    tenantId,
    isActive: true,
    isDeleted: false,
  });
};

/**
 * Find parents by multiple parentIds in one query (for bulk upload validation).
 */
export const findParentsByParentIds = async (
  parentIds: string[],
  tenantId: string
) => {
  if (!parentIds || parentIds.length === 0) return [];
  const trimmed = parentIds.map((p) => p?.trim?.()).filter(Boolean);
  return await Parent.find({
    parentId: { $in: trimmed },
    tenantId,
    isActive: true,
    isDeleted: false,
  })
    .lean()
    .exec();
};

// Find parent by email (tenant-specific)
export const findParentByEmail = async (email: string, tenantId: string) => {
  const query: any = {
    email: email.toLowerCase(),
    isActive: true,
    isDeleted: false,
    tenantId: tenantId, // Must match the specific tenant
  };

  return await Parent.findOne(query);
};

/**
 * Find existing parent emails in tenant (for bulk upload batch validation).
 * Returns set of lowercase emails that already exist.
 */
export const findExistingParentEmails = async (
  emails: string[],
  tenantId: string
): Promise<Set<string>> => {
  if (!emails || emails.length === 0) return new Set();
  const normalized = emails.map((e) => e?.trim?.()?.toLowerCase?.()).filter(Boolean);
  const existing = await Parent.find(
    { email: { $in: normalized }, tenantId, isActive: true, isDeleted: false },
    { email: 1 }
  )
    .lean()
    .exec();
  return new Set((existing as any[]).map((d) => (d.email || "").toLowerCase()).filter(Boolean));
};

/**
 * Bulk insert parents (for bulk upload). _id and prtId must be set on each doc.
 */
export const insertManyParents = async (
  parentDocs: Partial<IParent>[],
  session?: mongoose.ClientSession
): Promise<IParent[]> => {
  if (!parentDocs || parentDocs.length === 0) return [];
  const options = session ? { session } : {};
  const inserted = await Parent.insertMany(parentDocs, options);
  return inserted as IParent[];
};

/**
 * Bulk update userId on multiple parents in one DB round-trip (for bulk upload).
 */
export const bulkUpdateUserIds = async (
  updates: Array<{ parentId: string; userId: string }>,
  session?: mongoose.ClientSession
): Promise<void> => {
  if (!updates || updates.length === 0) return;
  const bulkOps = updates
    .filter(
      (u) =>
        mongoose.Types.ObjectId.isValid(u.parentId) &&
        mongoose.Types.ObjectId.isValid(u.userId)
    )
    .map(({ parentId, userId }) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(parentId) },
        update: {
          $set: {
            userId: new mongoose.Types.ObjectId(userId),
            updatedBy: "academy-api",
          },
        },
      },
    }));
  if (bulkOps.length === 0) return;
  await Parent.bulkWrite(bulkOps, session ? { session } : {});
};


// Find parent by userId (for JWT-based authentication)
export const findParentByUserId = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return await Parent.findOne({
    $or: [
      { _id: new mongoose.Types.ObjectId(userId) }, // Parent _id equals userId (shared ID)
      { userId: new mongoose.Types.ObjectId(userId) }, // Parent userId field equals userId
    ],
    isActive: true,
    isDeleted: false,
  });
};

// Create parent
export const createParent = async (
  parentData: Partial<IParent>,
  session?: mongoose.ClientSession
) => {
  const parent = new Parent({
    ...parentData,
    createdBy: "academy-api",
    isActive: true,
    isDeleted: false,
  });

  if (session) {
    return await parent.save({ session });
  }
  return await parent.save();
};

// Update parent by ID
export const updateParentById = async (
  id: string,
  updateData: Partial<IParent>
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return await Parent.findByIdAndUpdate(
    id,
    { $set: { ...updateData, updatedBy: "academy-api" } },
    { new: true, runValidators: true }
  );
};

// Bulk update parents
export const bulkUpdateParents = async (
  updates: Array<{ 
    parentId: string; 
    updateData: Partial<IParent> 
  }>,
  session?: mongoose.ClientSession
) => {
  if (!updates || updates.length === 0) {
    return { modifiedCount: 0 };
  }

  const bulkOps = updates
    .filter(update => mongoose.Types.ObjectId.isValid(update.parentId))
    .map(update => ({
      updateOne: {
        filter: { 
          _id: new mongoose.Types.ObjectId(update.parentId),
          isDeleted: false 
        },
        update: { 
          $set: { 
            ...update.updateData, 
            updatedBy: "academy-api",
            updatedAt: new Date()
          } 
        }
      }
    }));

  if (bulkOps.length === 0) {
    return { modifiedCount: 0 };
  }

  const options: any = { ordered: false };
  if (session) {
    options.session = session;
  }

  const result = await Parent.bulkWrite(bulkOps, options);
  return {
    modifiedCount: result.modifiedCount || 0,
    matchedCount: result.matchedCount || 0
  };
};

// Bulk find parents by emails (for validation)
export const findParentsByEmails = async (
  emails: string[],
  tenantId: string
) => {
  if (!emails || emails.length === 0) {
    return [];
  }

  const normalizedEmails = emails.map(email => email.toLowerCase());
  
  return await Parent.find({
    email: { $in: normalizedEmails },
    tenantId: tenantId,
    isActive: true,
    isDeleted: false,
  }).lean();
};

// Soft delete parent by ID
export const softDeleteParentById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return await Parent.findByIdAndUpdate(
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

// Find parents with filters
export const findParents = async ({
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

  const baseQuery: any = {
    isDeleted: false,
  };

  // Handle status filter - if status is provided, use it; otherwise default to active
  if (filters.status) {
    // If status filter is provided, use it
    baseQuery.status = filters.status;
    // Set isActive based on status
    if (filters.status === "active") {
      baseQuery.isActive = true;
    } else if (filters.status === "inactive") {
      baseQuery.isActive = false;
    }
    // Remove status from filters to avoid duplication
    const { status, ...restFilters } = filters;
    filters = restFilters;
  } else {
    // Default to active if no status filter
    baseQuery.isActive = true;
    baseQuery.status = "active";
  }

  if (tenantId) {
    baseQuery.tenantId = tenantId;
  }

  // Merge with dynamic filters from buildQuery
  const finalQuery = { ...baseQuery, ...filters };

  // Use provided sort or default to createdAt descending
  const finalSort: Record<string, SortOrder> =
    Object.keys(sort).length > 0
      ? sort
      : ({ createdAt: -1 } as Record<string, SortOrder>);

  return await Parent.find(finalQuery)
    .sort(finalSort)
    .skip(skip)
    .limit(pageSize)
    .lean();
};

// Count parents
export const countParents = async ({
  tenantId,
  filters = {},
}: {
  tenantId?: string;
  filters?: Record<string, any>;
}) => {
  const baseQuery: any = {
    isDeleted: false,
  };

  // Handle status filter - if status is provided, use it; otherwise default to active
  if (filters.status) {
    // If status filter is provided, use it
    baseQuery.status = filters.status;
    // Set isActive based on status
    if (filters.status === "active") {
      baseQuery.isActive = true;
    } else if (filters.status === "inactive") {
      baseQuery.isActive = false;
    }
    // Remove status from filters to avoid duplication
    const { status, ...restFilters } = filters;
    filters = restFilters;
  } else {
    // Default to active if no status filter
    baseQuery.isActive = true;
    baseQuery.status = "active";
  }

  if (tenantId) {
    baseQuery.tenantId = tenantId;
  }

  // Merge with dynamic filters from buildQuery
  const finalQuery = { ...baseQuery, ...filters };

  return await Parent.countDocuments(finalQuery);
};

// Count parents for seat/quota enforcement (counts all non-deleted, regardless of active/inactive/status)
export const countParentsAll = async ({ tenantId }: { tenantId: string }) => {
  const baseQuery: any = { isDeleted: false };
  if (tenantId) baseQuery.tenantId = tenantId;
  return await Parent.countDocuments(baseQuery);
};

// Get parent statistics
export const getParentStatistics = async (tenantId?: string) => {
  const matchClause: any = {
    isActive: true,
    isDeleted: false,
  };

  if (tenantId) {
    matchClause.tenantId = tenantId;
  }

  const stats = await Parent.aggregate([
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

// Check if parent ID exists
export const parentIdExists = async (parentId: string) => {
  return await Parent.findOne({
    parentId,
    isDeleted: false,
  });
};

// Get parents by relationship
export const getParentsByRelationship = async (relationship: string) => {
  return await Parent.find({
    relationship,
    isActive: true,
    isDeleted: false,
  }).lean();
};

// Get parents by occupation
export const getParentsByOccupation = async (occupation: string) => {
  return await Parent.find({
    occupation,
    isActive: true,
    isDeleted: false,
  }).lean();
};

/**
 * Verify if a parent-child relationship exists
 */
export const verifyParentChildRelationship = async (
  parentId: string,
  childId: string
): Promise<boolean> => {
  if (
    !mongoose.Types.ObjectId.isValid(parentId) ||
    !mongoose.Types.ObjectId.isValid(childId)
  ) {
    return false;
  }

  const relationship = await ParentChild.findOne({
    parentId: new mongoose.Types.ObjectId(parentId),
    childId: new mongoose.Types.ObjectId(childId),
    isActive: true,
    isDeleted: false,
  });

  return !!relationship;
};

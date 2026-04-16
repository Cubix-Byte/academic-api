import { Tenant, ITenant, Partner } from "../models";
import mongoose, { SortOrder } from "mongoose";

/**
 * Tenant Repository
 * Handles database operations for Tenants
 */
export const findTenantById = async (id: string) => {
  const tenant = await Tenant.findOne({ _id: id, isDeleted: { $ne: true } });
  if (tenant && tenant.partnerId) {
    const tenantObj = tenant.toObject();
    const partner = await Partner.findOne({
      _id: tenant.partnerId,
      isDeleted: { $ne: true },
    }).select("companyName");
    if (partner) {
      tenantObj.partnerName = partner.companyName;
    }
    return tenantObj;
  }
  return tenant;
};

export const findTenantByTenantName = async (name: string) => {
  return await Tenant.findOne({
    tenantName: name,
    isDeleted: { $ne: true },
  });
};

export const findTenantBySchoolName = async (schoolName: string) => {
  return await Tenant.findOne({ schoolName, isDeleted: { $ne: true } });
};

export const findTenantByAdminEmail = async (email: string) => {
  return await Tenant.findOne({
    adminEmail: email,
    isDeleted: { $ne: true },
  });
};

export const createTenant = async (
  tenantData: Partial<ITenant>,
  session?: mongoose.ClientSession
) => {
  const tenant = new Tenant(tenantData);
  return await tenant.save({ session });
};

export const updateTenant = async (
  id: string,
  updateData: Partial<ITenant>,
  session?: mongoose.ClientSession
) => {
  return await Tenant.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: updateData },
    { new: true, runValidators: true, session }
  );
};

export const deleteTenant = async (
  id: string,
  session?: mongoose.ClientSession
) => {
  return await Tenant.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, isActive: false } },
    { new: true, session }
  );
};

export const findTenants = async ({
  pageNo = 1,
  pageSize = 10,
  filters = {},
  sort = {},
}: {
  pageNo?: number;
  pageSize?: number;
  filters?: any;
  sort?: Record<string, SortOrder>;
}) => {
  const skip = (pageNo - 1) * pageSize;

  const query: any = { isDeleted: { $ne: true }, ...filters };

  // Default sort: order by createdAt desc if no sort is provided
  const sortOptions =
    Object.keys(sort).length > 0 ? sort : { createdAt: -1 as SortOrder };

  // Handle search by school name
  if (filters.search) {
    query.schoolName = { $regex: filters.search, $options: "i" };
    delete query.search;
  }

  const [tenantsFromDb, total] = await Promise.all([
    Tenant.find(query).skip(skip).limit(pageSize).sort(sortOptions),
    Tenant.countDocuments(query),
  ]);

  // Fetch partner names if partnerId exists
  const partnerIds = [
    ...new Set(tenantsFromDb.map((t) => t.partnerId).filter(Boolean)),
  ];
  const partners =
    partnerIds.length > 0
      ? await Partner.find({
        _id: { $in: partnerIds },
        isDeleted: { $ne: true },
      }).select("companyName")
      : [];

  const partnerMap = partners.reduce((acc, p) => {
    acc[(p._id as any).toString()] = p.companyName;
    return acc;
  }, {} as Record<string, string>);

  const tenants = tenantsFromDb.map((t) => {
    const tObj = t.toObject();
    if (t.partnerId) {
      tObj.partnerName = partnerMap[t.partnerId] || "N/A";
    }
    return tObj;
  });

  return {
    tenants,
    pagination: {
      total,
      pageNo,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getTenantsDDL = async () => {
  return await Tenant.find({
    isDeleted: { $ne: true },
    profileStatus: "active",
  })
    .select("schoolName tenantName")
    .sort({ schoolName: 1 });
};

export const getTenantStats = async () => {
  const [total, active, inactive, totalPartners] = await Promise.all([
    Tenant.countDocuments({ isDeleted: { $ne: true } }),
    Tenant.countDocuments({
      isDeleted: { $ne: true },
      profileStatus: "active",
    }),
    Tenant.countDocuments({
      isDeleted: { $ne: true },
      profileStatus: "inactive",
    }),
    Partner.countDocuments({ isDeleted: { $ne: true } }),
  ]);

  return {
    total,
    active,
    inactive,
    totalPartners,
  };
};

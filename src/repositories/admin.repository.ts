import { Admin, IAdmin } from "../models";

/**
 * Admin Repository
 * Handles database operations for Admin
 */

export const getAllAdmins = async () => {
  return await Admin.find({ isDeleted: { $ne: true } });
};

export const createAdmin = async (adminData: Partial<IAdmin>) => {
  return await Admin.create(adminData);
};

export const findAdminByEmail = async (email: string) => {
  return await Admin.findOne({ email, isDeleted: { $ne: true } });
};

export const findAdminByTenantId = async (tenantId: string) => {
  return await Admin.findOne({ tenantId, isDeleted: { $ne: true } });
};

export const findAdminsByTenantIds = async (tenantIds: string[]) => {
  if (!tenantIds || tenantIds.length === 0) return [];
  return await Admin.find({
    tenantId: { $in: tenantIds },
    isDeleted: { $ne: true },
  });
};

export const findAdminById = async (id: string) => {
  return await Admin.findOne({ _id: id, isDeleted: { $ne: true } });
};

export const updateAdmin = async (
  tenantId: string,
  updateData: Partial<IAdmin>
) => {
  return await Admin.findOneAndUpdate(
    { tenantId, isDeleted: { $ne: true } },
    { $set: updateData },
    { new: true }
  );
};

export const deleteAdmin = async (tenantId: string) => {
  return await Admin.findOneAndUpdate(
    { tenantId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
};

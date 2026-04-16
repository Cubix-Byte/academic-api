import { Announcement, IAnnouncement } from "../models/announcement.schema";

export interface GetAnnouncementsParams {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

/**
 * Create a new announcement
 */
export const createAnnouncement = async (
  data: Partial<IAnnouncement>,
): Promise<IAnnouncement> => {
  const announcement = new Announcement(data);
  return await announcement.save();
};

/**
 * Find announcement by ID (not deleted)
 */
export const findAnnouncementById = async (
  id: string,
): Promise<IAnnouncement | null> => {
  return await Announcement.findOne({ _id: id, isDeleted: false });
};

/**
 * Find paginated announcements for a tenant (admin list)
 */
export const findAnnouncements = async (
  params: GetAnnouncementsParams,
): Promise<IAnnouncement[]> => {
  const { tenantId, pageNo = 1, pageSize = 10, search, isActive } = params;

  const query: any = {
    tenantId,
    isDeleted: false,
  };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  const skip = (pageNo - 1) * pageSize;

  return await Announcement.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize);
};

/**
 * Count announcements for pagination
 */
export const countAnnouncements = async (
  params: GetAnnouncementsParams,
): Promise<number> => {
  const { tenantId, search, isActive } = params;

  const query: any = {
    tenantId,
    isDeleted: false,
  };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  return await Announcement.countDocuments(query);
};

/**
 * Update announcement by ID
 */
export const updateAnnouncementById = async (
  id: string,
  data: Partial<IAnnouncement>,
): Promise<IAnnouncement | null> => {
  return await Announcement.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: data },
    { new: true },
  );
};

/**
 * Soft-delete announcement by ID
 */
export const softDeleteAnnouncementById = async (
  id: string,
): Promise<IAnnouncement | null> => {
  return await Announcement.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true },
  );
};

/**
 * Find active announcements for a specific tenant and role.
 * Filters: isActive=true, isDeleted=false, startDate <= now <= endDate, role in targetAudience
 */
export const findActiveAnnouncements = async (
  tenantId: string,
  role: string,
): Promise<IAnnouncement[]> => {
  const now = new Date();

  return await Announcement.find({
    tenantId,
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
    targetAudience: role.toLowerCase(),
  }).sort({ createdAt: -1 });
};

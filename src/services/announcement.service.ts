import * as announcementRepository from "../repositories/announcement.repository";
import { IAnnouncement } from "../models/announcement.schema";

export interface CreateAnnouncementData {
  title: string;
  message: string;
  category?: string;
  targetAudience: ("student" | "teacher" | "parent")[];
  startDate: Date | string;
  endDate: Date | string;
  isActive?: boolean;
}

export interface GetAnnouncementsParams {
  tenantId: string;
  pageNo?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export interface AnnouncementsListResponse {
  announcements: IAnnouncement[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Create a new announcement
 */
export const createAnnouncement = async (
  data: CreateAnnouncementData,
  tenantId: string,
  createdBy: string,
): Promise<IAnnouncement> => {
  const announcementData = {
    ...data,
    tenantId,
    createdBy,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
  };

  return await announcementRepository.createAnnouncement(
    announcementData as any,
  );
};

/**
 * Get announcement by ID
 */
export const getAnnouncementById = async (
  id: string,
): Promise<IAnnouncement> => {
  const announcement = await announcementRepository.findAnnouncementById(id);
  if (!announcement) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }
  return announcement;
};

/**
 * Get all announcements for admin (paginated)
 */
export const getAllAnnouncements = async (
  params: GetAnnouncementsParams,
): Promise<AnnouncementsListResponse> => {
  const announcements = await announcementRepository.findAnnouncements(params);
  const total = await announcementRepository.countAnnouncements(params);
  const pageSize = params.pageSize || 10;
  const pageNo = params.pageNo || 1;

  return {
    announcements,
    pagination: {
      total,
      pageNo,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

/**
 * Update an announcement
 */
export const updateAnnouncement = async (
  id: string,
  data: Partial<CreateAnnouncementData>,
  tenantId: string,
): Promise<IAnnouncement> => {
  const existing = await announcementRepository.findAnnouncementById(id);
  if (!existing) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  if (existing.tenantId.toString() !== tenantId) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  const updateData: any = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);

  const updated = await announcementRepository.updateAnnouncementById(
    id,
    updateData,
  );
  if (!updated) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }
  return updated;
};

/**
 * Soft-delete an announcement
 */
export const deleteAnnouncement = async (
  id: string,
  tenantId: string,
): Promise<IAnnouncement | null> => {
  const existing = await announcementRepository.findAnnouncementById(id);
  if (!existing) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  if (existing.tenantId.toString() !== tenantId) {
    throw new Error("ANNOUNCEMENT_NOT_FOUND");
  }

  return await announcementRepository.softDeleteAnnouncementById(id);
};

/**
 * Get currently active announcements for a given role (used by the banner)
 */
export const getActiveAnnouncements = async (
  tenantId: string,
  role: string,
): Promise<IAnnouncement[]> => {
  return await announcementRepository.findActiveAnnouncements(tenantId, role);
};

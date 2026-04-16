import { CommunityMember, ICommunityMember } from "../models";
import mongoose from "mongoose";

/**
 * Explicitly adds a user to a Club community
 */
export const addMember = async (
  data: Partial<ICommunityMember>,
): Promise<ICommunityMember> => {
  return await CommunityMember.create(data);
};

/**
 * Explicitly removes a user from a Club community
 */
export const removeMember = async (
  communityId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
) => {
  if (!communityId || !userId) return null;
  return await CommunityMember.findOneAndDelete({ communityId, userId });
};

/**
 * Lists all explicit members for a given Club. Only used by ADMINs.
 */
export const getMembersByCommunity = async (
  communityId: string | mongoose.Types.ObjectId,
) => {
  if (!communityId) return [];
  return await CommunityMember.find({ communityId, isActive: true }).lean();
};

/**
 * Helper to check if a specific user is explicitly enrolled in a specific Club
 */
export const findMember = async (
  communityId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
): Promise<ICommunityMember | null> => {
  if (!communityId || !userId) return null;
  return await CommunityMember.findOne({ communityId, userId }).lean();
};

/**
 * Fetches all Club communities that a specific user has been explicitly added to
 */
export const findCommunitiesByUser = async (
  userId: string | mongoose.Types.ObjectId,
  tenantId: string | mongoose.Types.ObjectId,
) => {
  if (!userId || !tenantId) return [];
  return await CommunityMember.find({ userId, tenantId, isActive: true })
    .populate("communityId")
    .lean();
};

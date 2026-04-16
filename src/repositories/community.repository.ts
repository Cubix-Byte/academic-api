import { Community, ICommunity } from "../models";
import mongoose from "mongoose";

/**
 * Creates a new community document
 */
export const createCommunity = async (
  data: Partial<ICommunity>,
): Promise<ICommunity> => {
  return await Community.create(data);
};

/**
 * Finds a community by its unique ID
 */
export const findCommunityById = async (
  communityId: string | mongoose.Types.ObjectId,
): Promise<ICommunity | null> => {
  if (!communityId) return null;
  return await Community.findById(communityId).lean();
};

/**
 * Retrieves the auto-generated Institution community for a tenant
 */
export const findInstitutionCommunity = async (
  tenantId: string | mongoose.Types.ObjectId,
): Promise<ICommunity | null> => {
  if (!tenantId) return null;
  return await Community.findOne({
    tenantId,
    type: "INSTITUTION",
    isActive: true,
  }).lean();
};

/**
 * Retrieves an auto-generated Class community based on its referenceId
 */
export const findCommunityByReference = async (
  type: string,
  referenceId: string | mongoose.Types.ObjectId,
): Promise<ICommunity | null> => {
  if (!referenceId) return null;
  return await Community.findOne({ type, referenceId, isActive: true }).lean();
};

/**
 * Retrieves multiple auto-generated Class communities by an array of referenceIds
 */
export const findCommunitiesByReferences = async (
  type: string,
  referenceIds: (string | mongoose.Types.ObjectId)[],
): Promise<ICommunity[]> => {
  if (!referenceIds || referenceIds.length === 0) return [];
  return await Community.find({
    type,
    referenceId: { $in: referenceIds },
    isActive: true,
  }).lean();
};

/**
 * Retrieves all active communities for a given tenant. Used primarily by ADMINs.
 */
export const findCommunitiesByTenant = async (
  tenantId: string | mongoose.Types.ObjectId,
): Promise<ICommunity[]> => {
  if (!tenantId) return [];
  return await Community.find({ tenantId, isActive: true }).lean();
};

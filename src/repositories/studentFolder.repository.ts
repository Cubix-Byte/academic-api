import mongoose from "mongoose";
import { StudentFolder, IStudentFolder } from "../models";

/**
 * Student Folder Repository
 * Data access for student-created folders (assigned content organization).
 */
export const create = async (
  data: { name: string; studentId: string; tenantId: string }
): Promise<IStudentFolder> => {
  const folder = new StudentFolder({
    name: data.name,
    studentId: new mongoose.Types.ObjectId(data.studentId),
    tenantId: new mongoose.Types.ObjectId(data.tenantId),
    contentIds: [],
    isDeleted: false,
  });
  return await folder.save();
};

export const findByStudent = async (
  studentId: string,
  tenantId: string
): Promise<IStudentFolder[]> => {
  return await StudentFolder.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  })
    .sort({ updatedAt: -1 })
    .lean();
};

export const findByIdAndStudent = async (
  folderId: string,
  studentId: string,
  tenantId: string
): Promise<IStudentFolder | null> => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) return null;
  return await StudentFolder.findOne({
    _id: new mongoose.Types.ObjectId(folderId),
    studentId: new mongoose.Types.ObjectId(studentId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isDeleted: false,
  }).lean();
};

export const updateName = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  name: string
): Promise<IStudentFolder | null> => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) return null;
  return await StudentFolder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(folderId),
      studentId: new mongoose.Types.ObjectId(studentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    },
    { $set: { name: name.trim(), updatedAt: new Date() } },
    { new: true }
  ).lean();
};

export const softDelete = async (
  folderId: string,
  studentId: string,
  tenantId: string
): Promise<IStudentFolder | null> => {
  if (!mongoose.Types.ObjectId.isValid(folderId)) return null;
  const now = new Date();
  return await StudentFolder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(folderId),
      studentId: new mongoose.Types.ObjectId(studentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    },
    { $set: { isDeleted: true, deletedAt: now, updatedAt: now } },
    { new: true }
  ).lean();
};

export const addContentId = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  contentId: string
): Promise<IStudentFolder | null> => {
  if (!mongoose.Types.ObjectId.isValid(folderId) || !mongoose.Types.ObjectId.isValid(contentId))
    return null;
  const contentObjectId = new mongoose.Types.ObjectId(contentId);
  return await StudentFolder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(folderId),
      studentId: new mongoose.Types.ObjectId(studentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    },
    { $addToSet: { contentIds: contentObjectId }, $set: { updatedAt: new Date() } },
    { new: true }
  ).lean();
};

export const removeContentId = async (
  folderId: string,
  studentId: string,
  tenantId: string,
  contentId: string
): Promise<IStudentFolder | null> => {
  if (!mongoose.Types.ObjectId.isValid(folderId) || !mongoose.Types.ObjectId.isValid(contentId))
    return null;
  return await StudentFolder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(folderId),
      studentId: new mongoose.Types.ObjectId(studentId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false,
    },
    {
      $pull: { contentIds: new mongoose.Types.ObjectId(contentId) },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  ).lean();
};

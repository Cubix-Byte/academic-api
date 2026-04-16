import mongoose from "mongoose";
import { IContentBuilder } from "../models/contentBuilder.schema";

/**
 * ContentBuilder Types - Request and Response interfaces for ContentBuilder management
 */

// Create ContentBuilder Request
export interface CreateContentBuilderRequest {
  contentTitle: string;
  description?: string;
  subjectId: string;
  classId: string;
  batchId: string;
  contentType: string;
}

// Update ContentBuilder Request
export interface UpdateContentBuilderRequest {
  contentTitle?: string;
  description?: string;
  subjectId?: string;
  classId?: string;
  batchId?: string;
  contentType?: string;
}

// Get All ContentBuilders Request (with filters)
export interface GetAllContentBuildersRequest {
  tenantId: string;
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  batchId?: string;
  contentType?: string;
  search?: string; // Search by contentTitle
  pageNo?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "contentTitle";
  sortOrder?: "asc" | "desc";
}

// ContentBuilder Response with populated fields
export interface ContentBuilderResponse {
  _id: string;
  contentTitle: string;
  description?: string;
  subjectId: {
    _id: string;
    name: string;
  };
  classId: {
    _id: string;
    name: string;
    grade?: string;
    section?: string;
  };
  batchId: {
    _id: string;
    batchName: string;
  };
  contentType: string;
  tenantId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Get All ContentBuilders Response
export interface GetAllContentBuildersResponse {
  contentBuilders: ContentBuilderResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

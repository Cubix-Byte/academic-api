import mongoose from "mongoose";
import { IExamBuilder } from "../models/examBuilder.schema";

/**
 * ExamBuilder Types - Request and Response interfaces for ExamBuilder management
 */

// ConversationMessage interface
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Create ExamBuilder Request
export interface CreateExamBuilderRequest {
  contentTitle: string;
  description?: string;
  classId: string;
  subjectId: string;
  batchId: string;
  contentType: "Syllabus" | "Lesson Plan" | "Study Material" | "Worksheet";
  chatHistory?: ConversationMessage[];
  // AI-generated content types with download links
  sessions?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  videoScript?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  presentationPdf?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  status?: "Recent" | "Draft" | "Published";
}

// Update ExamBuilder Request
export interface UpdateExamBuilderRequest {
  contentTitle?: string;
  description?: string;
  classId?: string;
  subjectId?: string;
  batchId?: string;
  contentType?: "Syllabus" | "Lesson Plan" | "Study Material" | "Worksheet";
  chatHistory?: ConversationMessage[];
  // AI-generated content types with download links
  sessions?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  videoScript?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  presentationPdf?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  status?: "Recent" | "Draft" | "Published";
}

// Get All ExamBuilders Request (with filters)
export interface GetAllExamBuildersRequest {
  tenantId: string;
  createdBy?: string;
  status?: "Recent" | "Published" |"Draft" | "All";
  classId?: string;
  subjectId?: string;
  batchId?: string;
  contentType?: "Syllabus" | "Lesson Plan" | "Study Material" | "Worksheet";
  search?: string; // Search by contentTitle
  pageNo?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "contentTitle";
  sortOrder?: "asc" | "desc";
}

// ExamBuilder Response with populated fields
export interface ExamBuilderResponse {
  _id: string;
  contentTitle: string;
  description?: string;
  classId: {
    _id: string;
    name: string;
    grade?: string;
    section?: string;
  };
  subjectId: {
    _id: string;
    name: string;
  };
  batchId: {
    _id: string;
    batchName: string;
  };
  contentType: "Syllabus" | "Lesson Plan" | "Study Material" | "Worksheet";
  chatHistory?: ConversationMessage[];
  // AI-generated content types with download links
  sessions?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  videoScript?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  presentationPdf?: {
    content?: string;
    downloadLink?: string;
    fileName?: string;
    filePath?: string;
    mimeType?: string;
    size?: number;
    generatedAt?: Date;
  };
  status: "Recent" | "Published" | "Draft";
  createdBy: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Get All ExamBuilders Response
export interface GetAllExamBuildersResponse {
  examBuilders: ExamBuilderResponse[];
  pagination: {
    total: number;
    pageNo: number;
    pageSize: number;
    totalPages: number;
  };
}

// ExamBuilder Statistics
export interface ExamBuilderStatistics {
  total: number;
  recent: number;
  draft: number;
  byContentType: {
    Syllabus: number;
    "Lesson Plan": number;
    "Study Material": number;
    Worksheet: number;
  };
}

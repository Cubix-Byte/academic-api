import mongoose, { Schema, Document } from "mongoose";

/**
 * Student Content Read - Tracks when a student has opened/viewed assigned content.
 * No record = unread. Record exists = read (readAt is when they opened it).
 * Used for unread counts in assigned-content stats.
 */
export interface IStudentContentRead extends Document {
  studentId: mongoose.Types.ObjectId;
  contentId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentContentReadSchema = new Schema<IStudentContentRead>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      ref: "ContentLibraryContent",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "student_content_reads",
  }
);

StudentContentReadSchema.index({ studentId: 1, contentId: 1 }, { unique: true });

const StudentContentRead = mongoose.model<IStudentContentRead>(
  "StudentContentRead",
  StudentContentReadSchema
);
export default StudentContentRead;

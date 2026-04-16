import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";
import {
  CLASS_SESSION_STATUS,
  CLASS_SESSION_STATUS_ARRAY,
} from "@/utils/constants/classSession.constants";

// ClassSession model - represents a single delivered class/lecture for a class + subject + teacher
export interface IClassSession extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  scheduleId?: mongoose.Types.ObjectId;

  date: Date;
  startTime: Date;
  endTime: Date;
  sessionCreatedAt?: Date; // Time when attendance was marked (current time when session starts)

  status: CLASS_SESSION_STATUS;
  academicYear?: mongoose.Types.ObjectId; // Reference to Batch (stored as batchId)
}

const ClassSessionSchema: Schema<IClassSession> = new Schema(
  {
    ...BaseDocumentSchema.obj,
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"],
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject ID is required"],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Teacher ID is required"],
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "ClassSchedule",
    },
    date: {
      type: Date,
      required: [true, "Session date is required"],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, "Session start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "Session end time is required"],
    },
    sessionCreatedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: CLASS_SESSION_STATUS_ARRAY,
      default: CLASS_SESSION_STATUS.IN_PROGRESS,
      index: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
    },
  },
  {
    timestamps: true,
    collection: "class_sessions",
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        const { _id, __v, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
  }
);

// Indexes for fast lookups and analytics
ClassSessionSchema.index({ tenantId: 1, classId: 1, date: 1 });
ClassSessionSchema.index({ tenantId: 1, teacherId: 1, date: 1 });
ClassSessionSchema.index({ tenantId: 1, subjectId: 1, date: 1 });
ClassSessionSchema.index({ tenantId: 1, status: 1, date: 1 });

const ClassSession =
  mongoose.models.ClassSession ||
  mongoose.model<IClassSession>("ClassSession", ClassSessionSchema);

export default ClassSession;
export { ClassSession };



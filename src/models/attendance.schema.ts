import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";
import {
  ATTENDANCE_ROLE,
  ATTENDANCE_ROLES_ARRAY,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_ARRAY,
} from "../utils/constants/attendance.constants";

export type AttendanceRole = `${ATTENDANCE_ROLE}`;
export type AttendanceStatus = `${ATTENDANCE_STATUS}`;

// Attendance model - unified for teachers and students, scoped to a ClassSession
export interface IAttendance extends IBaseDocument {
  tenantId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: AttendanceRole;
  status: AttendanceStatus;
  markedAt: Date;
  markedBy?: mongoose.Types.ObjectId;
  remarks?: string;
}

const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    ...BaseDocumentSchema.obj,
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: [true, "Tenant ID is required"],
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ClassSession",
      required: [true, "Session ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      index: true,
    },
    role: {
      type: String,
      enum: ATTENDANCE_ROLES_ARRAY,
      required: [true, "Role is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUS_ARRAY,
      required: [true, "Status is required"],
    },
    markedAt: {
      type: Date,
      required: [true, "markedAt is required"],
      default: Date.now,
      index: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    collection: "attendances",
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

// Uniqueness: one attendance record per (sessionId, userId)
AttendanceSchema.index(
  { sessionId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Common query patterns
AttendanceSchema.index({ tenantId: 1, sessionId: 1 });
AttendanceSchema.index({ tenantId: 1, userId: 1, role: 1 });
AttendanceSchema.index({ tenantId: 1, userId: 1, markedAt: -1 });

const Attendance =
  mongoose.models.Attendance ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
export { Attendance };



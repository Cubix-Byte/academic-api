import mongoose, { Schema, Document } from "mongoose";

/**
 * Announcement Interface
 */
export interface IAnnouncement extends Document {
  title: string;
  message: string;
  category?: string;
  targetAudience: ("student" | "teacher" | "parent")[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  tenantId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Announcement Schema
 */
const AnnouncementSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    targetAudience: {
      type: [String],
      enum: ["student", "teacher", "parent"],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one target audience is required",
      },
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "announcements",
  },
);

// Compound indexes
AnnouncementSchema.index({ tenantId: 1, isDeleted: 1, isActive: 1 });
AnnouncementSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });
AnnouncementSchema.index({
  tenantId: 1,
  targetAudience: 1,
  isActive: 1,
  isDeleted: 1,
});

AnnouncementSchema.set("toJSON", { virtuals: true });
AnnouncementSchema.set("toObject", { virtuals: true });

export const Announcement = mongoose.model<IAnnouncement>(
  "Announcement",
  AnnouncementSchema,
);
export default Announcement;

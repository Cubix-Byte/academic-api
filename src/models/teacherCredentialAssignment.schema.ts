import mongoose, { Schema, Document } from "mongoose";

/**
 * TeacherCredentialAssignment Interface - Assigns credential templates to teachers
 */
export interface ITeacherCredentialAssignment extends Document {
  credentialTemplateId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  tenantId: mongoose.Types.ObjectId;
  isActive: boolean;
  classId?: mongoose.Types.ObjectId;
  credentialCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TeacherCredentialAssignment Schema
 */
const TeacherCredentialAssignmentSchema = new Schema(
  {
    credentialTemplateId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "CredentialTemplate",
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Teacher",
      index: true,
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
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      default: null,
    },
    credentialCategory: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "teacher_credential_assignments",
  }
);

// Validation: endDate must be after startDate
TeacherCredentialAssignmentSchema.pre("save", function (next) {
  if (this.endDate <= this.startDate) {
    next(new Error("endDate must be after startDate"));
  } else {
    next();
  }
});

// Indexes for high performance queries
TeacherCredentialAssignmentSchema.index({
  tenantId: 1,
  teacherId: 1,
  isActive: 1,
});
TeacherCredentialAssignmentSchema.index({
  tenantId: 1,
  credentialTemplateId: 1,
  isActive: 1,
});
TeacherCredentialAssignmentSchema.index({
  tenantId: 1,
  startDate: 1,
  endDate: 1,
});
TeacherCredentialAssignmentSchema.index({ teacherId: 1, isActive: 1 });

export const TeacherCredentialAssignment =
  mongoose.model<ITeacherCredentialAssignment>(
    "TeacherCredentialAssignment",
    TeacherCredentialAssignmentSchema
  );
export default TeacherCredentialAssignment;

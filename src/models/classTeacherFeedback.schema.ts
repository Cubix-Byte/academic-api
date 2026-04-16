import mongoose, { Schema, Document } from "mongoose";

/**
 * ClassTeacherFeedback Interface
 * Stores overall feedback given by class teacher about their students
 */
export interface IClassTeacherFeedback extends Document {
  classId: mongoose.Types.ObjectId; // Class this feedback belongs to
  studentId: mongoose.Types.ObjectId; // Student receiving the feedback
  teacherId: mongoose.Types.ObjectId; // Class teacher who gave the feedback
  feedback: string; // Overall feedback text
  tenantId: mongoose.Types.ObjectId; // Multi-tenant isolation
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

/**
 * ClassTeacherFeedback Schema
 * Manages class teacher's overall feedback for students
 */
const ClassTeacherFeedbackSchema = new Schema(
  {
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      required: [true, "Teacher ID is required"],
      index: true,
    },
    feedback: {
      type: String,
      required: [true, "Feedback text is required"],
      trim: true,
      maxlength: [5000, "Feedback cannot exceed 5000 characters"],
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: [true, "Tenant ID is required"],
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "class_teacher_feedbacks",
  }
);

// Compound indexes for efficient queries
ClassTeacherFeedbackSchema.index({ classId: 1, studentId: 1, tenantId: 1 });
ClassTeacherFeedbackSchema.index({ studentId: 1, tenantId: 1, isDeleted: 1 });
ClassTeacherFeedbackSchema.index({ teacherId: 1, tenantId: 1, isDeleted: 1 });

// Ensure only one active feedback per student per class
ClassTeacherFeedbackSchema.index(
  { classId: 1, studentId: 1, tenantId: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Ensure virtual fields are serialized
ClassTeacherFeedbackSchema.set("toJSON", { virtuals: true });
ClassTeacherFeedbackSchema.set("toObject", { virtuals: true });

export const ClassTeacherFeedback = mongoose.model<IClassTeacherFeedback>(
  "ClassTeacherFeedback",
  ClassTeacherFeedbackSchema
);
export default ClassTeacherFeedback;

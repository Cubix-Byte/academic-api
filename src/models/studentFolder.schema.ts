import mongoose, { Schema, Document } from "mongoose";

/**
 * Student Folder Schema
 * Student-created folders to organize assigned content (my-courses).
 * One content can be in many folders (many-to-many via contentIds array per folder).
 */
export interface IStudentFolder extends Document {
  name: string;
  studentId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  contentIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

const StudentFolderSchema = new Schema<IStudentFolder>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    contentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "ContentLibraryContent",
        default: [],
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "student_folders",
  }
);

StudentFolderSchema.index({ studentId: 1, tenantId: 1, isDeleted: 1 });
StudentFolderSchema.index({ studentId: 1, isDeleted: 1 });

export default mongoose.models.StudentFolder ||
  mongoose.model<IStudentFolder>("StudentFolder", StudentFolderSchema);

import mongoose, { Document, Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";
import autoIdPlugin from "../utils/plugins/auto-id.plugin";

// Teacher model interface - represents teacher information in academy
export interface ITeacher extends IBaseDocument {
  // Personal Information (from User-API form)
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  profilePicture?: string; // URL to profile picture stored in storage-api
  gender?: "male" | "female" | "other" | "prefer_not_to_say";

  // Academic Information
  thrId?: string; // Auto generated teacher code e.g., THR-001
  joiningDate: Date;
  qualification?: string;
  specialization?: string;
  experience?: number; // in years

  // Contact Information
  emergencyContact?: string;
  emergencyPhone?: string;

  // Academic Information
  department?: string;
  designation?: string;
  salary?: number;

  // Class and Subject Assignments (1-to-many relationships)
  assignedClasses: mongoose.Types.ObjectId[]; // References to Class
  assignedSubjects: mongoose.Types.ObjectId[]; // References to Subject

  // Documents
  documents: {
    name: string;
    type: string; // 'degree', 'certificate', 'diploma', 'other'
    url: string;
    uploadedAt: Date;
  }[];

  // Status
  status: "active" | "inactive" | "suspended";

  // Demo password for initial login
  demoPassword: string;

  // Additional Information
  bio?: string;
  achievements?: string[];
  certifications?: string[];

  // Tenant Information
  tenantId: string;
  tenantName: string;

  // User reference (for compatibility with existing index)
  userId?: mongoose.Types.ObjectId;
}

const TeacherSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    // Personal Information (from User-API form)
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    profilePicture: {
      type: String,
      trim: true,
      maxlength: [500, "Profile picture URL cannot exceed 500 characters"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      lowercase: true,
      trim: true,
      required: true,
    },
    thrId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      maxlength: [50, "Teacher code cannot exceed 50 characters"],
    },
    // Academic Information
    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
    },
    qualification: {
      type: String,
      required: false,
      trim: true,
      maxlength: [200, "Qualification cannot exceed 200 characters"],
    },
    specialization: {
      type: String,
      required: false,
      trim: true,
      maxlength: [100, "Specialization cannot exceed 100 characters"],
    },
    experience: {
      type: Number,
      required: false,
      min: [0, "Experience cannot be negative"],
      max: [50, "Experience cannot exceed 50 years"],
    },
    emergencyContact: {
      type: String,
      required: false,
      trim: true,
      maxlength: [100, "Emergency contact cannot exceed 100 characters"],
    },
    emergencyPhone: {
      type: String,
      required: false,
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department cannot exceed 100 characters"],
    },
    designation: {
      type: String,
      required: false,
      trim: true,
      maxlength: [100, "Designation cannot exceed 100 characters"],
    },
    salary: {
      type: Number,
      min: [0, "Salary cannot be negative"],
    },
    assignedClasses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    assignedSubjects: [
      {
        type: Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    documents: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          required: true,
          enum: ["degree", "certificate", "diploma", "other"],
          lowercase: true,
        },
        url: {
          type: String,
          required: true,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      required: true,
    },
    demoPassword: {
      type: String,
      required: [true, "Demo password is required"],
      trim: true,
      select: false,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    achievements: [
      {
        type: String,
        trim: true,
        maxlength: [200, "Achievement cannot exceed 200 characters"],
      },
    ],
    certifications: [
      {
        type: String,
        trim: true,
        maxlength: [200, "Certification cannot exceed 200 characters"],
      },
    ],
    // Tenant Information
    tenantId: {
      type: String,
      required: [true, "Tenant ID is required"],
      trim: true,
    },
    tenantName: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
    },
    // User reference (for compatibility with existing unique index)
    userId: {
      type: Schema.Types.ObjectId,
      required: false,
      unique: true,
      sparse: true, // Only index non-null values
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        const { _id, __v, demoPassword, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
    toObject: {
      transform: function (doc, ret) {
        const { _id, __v, demoPassword, ...rest } = ret;
        return { id: (_id as any).toString(), ...rest };
      },
    },
  }
);

// Indexes for better performance
TeacherSchema.index({ status: 1 });
TeacherSchema.index({ assignedClasses: 1 });
TeacherSchema.index({ assignedSubjects: 1 });
TeacherSchema.index({ isActive: 1 });
TeacherSchema.index({ isDeleted: 1 });
TeacherSchema.index({ tenantId: 1 });
TeacherSchema.index({ email: 1, tenantId: 1 }); // Compound index for tenant-specific email validation

// Virtual for full name
TeacherSchema.virtual("fullName").get(function () {
  // This would need to be populated from user data
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

// Auto-generate THR-XXX codes
TeacherSchema.plugin(autoIdPlugin, { fieldName: "thrId", prefix: "THR", pad: 3 });

export default mongoose.model<ITeacher>("Teacher", TeacherSchema);

import mongoose, { Schema, Document } from "mongoose";
import autoIdPlugin from "../utils/plugins/auto-id.plugin";

/**
 * Student Interface - All fields from UI image with only specified fields required
 */
export interface IStudent extends Document {
  // REQUIRED FIELDS (as specified)
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // Phone Number/Father Number
  rollNumber: string; // Roll Number (unique per class per tenant)
  admissionDate: Date;
  tenantId: string; // for multi-tenant mapping
  tenantName: string; // for multi-tenant mapping
  studentId?: string; // Student ID (for compatibility with existing unique index)
  stdId?: string; // Auto generated student code e.g., STD-001

  // OPTIONAL FIELDS from UI image
  address?: string;
  profileImage?: string;
  spouseNumber?: string; // Spouse Number
  gender?: "male" | "female" | "other" | "prefer_not_to_say";

  // Academic fields (optional)
  classId?: string; // Select Class
  className?: string;
  currentGrade?: string;
  section?: string;
  academicYear?: string;
  status?: "active" | "inactive" | "suspended" | "graduated";

  // Contact information (optional)
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;

  // Academic records (optional)
  previousSchool?: string;
  previousGrade?: string;
  transferCertificate?: string;
  birthCertificate?: string;

  // Financial (optional)
  feeStructure?: string;
  scholarship?: string;
  paymentStatus?: "paid" | "pending" | "overdue";

  // Additional fields (optional)
  bloodGroup?: string;
  medicalConditions?: string;
  allergies?: string;
  transportRequired?: boolean;
  transportRoute?: string;

  // Arrays (optional)
  subjects?: string[]; // Array of subject IDs
  documents?: string[]; // Array of document IDs
  achievements?: string[];
  disciplinaryActions?: string[];

  // Standard document fields
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isDeleted: boolean;

  // User reference (for compatibility with existing unique index)
  userId?: mongoose.Types.ObjectId;

  // Additional info field for future flexibility
  additionalInfo?: Record<string, any>;
}

/**
 * Student Schema - All fields from UI image with only specified fields required
 */
const StudentSchema = new Schema(
  {
    // REQUIRED FIELDS (as specified)
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    stdId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    rollNumber: {
      type: String,
      required: false, // Optional - only required when classId is provided
      index: true,
      trim: true,
      maxlength: 20,
    },
    studentId: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Only index non-null values
      trim: true,
      maxlength: 50,
    },
    admissionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    tenantName: {
      type: String,
      required: true,
      trim: true,
    },

    // OPTIONAL FIELDS from UI image
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    spouseNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      lowercase: true,
      trim: true,
      required: true,
    },

    // Academic fields (optional)
    classId: {
      type: String,
      trim: true,
    },
    className: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    currentGrade: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    section: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    academicYear: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "graduated"],
      default: "active",
    },

    // Contact information (optional)
    fatherName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    motherName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    guardianName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    guardianPhone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    emergencyContact: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    emergencyPhone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    // Academic records (optional)
    previousSchool: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    previousGrade: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    transferCertificate: {
      type: String,
      trim: true,
    },
    birthCertificate: {
      type: String,
      trim: true,
    },

    // Financial (optional)
    feeStructure: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    scholarship: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      default: "pending",
    },

    // Additional fields (optional)
    bloodGroup: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    medicalConditions: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    allergies: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    transportRequired: {
      type: Boolean,
      default: false,
    },
    transportRoute: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Arrays (optional)
    subjects: [
      {
        type: String,
        trim: true,
      },
    ],
    documents: [
      {
        type: String,
        trim: true,
      },
    ],
    achievements: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    disciplinaryActions: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],

    // Standard document fields
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    // User reference (for compatibility with existing unique index)
    userId: {
      type: Schema.Types.ObjectId,
      required: false,
      unique: true,
      sparse: true, // Only index non-null values
    },
    // Additional info field for future flexibility
    additionalInfo: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "students",
  }
);

// Indexes for better performance
// Roll number must be unique per class per tenant
// Partial filter ensures we only index documents where rollNumber and classId exist (not null/undefined)
// This allows multiple students without rollNumber/classId without duplicate key errors
StudentSchema.index(
  { rollNumber: 1, tenantId: 1, classId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      $and: [
        { rollNumber: { $exists: true, $nin: [null, ""] } },
        { classId: { $exists: true, $nin: [null, ""] } },
      ],
    },
  }
);
StudentSchema.index({ email: 1, tenantId: 1 });
StudentSchema.index({ phone: 1, tenantId: 1 });
StudentSchema.index({ isActive: 1, isDeleted: 1, tenantId: 1 });

// Virtual for full name
StudentSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
StudentSchema.set("toJSON", { virtuals: true });
StudentSchema.set("toObject", { virtuals: true });

// Auto-generate STD-XXX codes
StudentSchema.plugin(autoIdPlugin, { fieldName: "stdId", prefix: "STD", pad: 3 });

export const Student = mongoose.model<IStudent>("Student", StudentSchema);
export default Student;


import mongoose, { Document, Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";
import autoIdPlugin from "../utils/plugins/auto-id.plugin";

// Parent model interface - represents parent information in academy
export interface IParent extends IBaseDocument {
  // Personal Information (from User-API form)
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address?: string;
  profilePicture?: string; // URL to profile picture stored in storage-api
  gender?: "male" | "female" | "other" | "prefer_not_to_say";

  // Parent Information
  parentId?: string; // Unique parent ID
  prtId?: string; // Auto generated parent code e.g., PRT-001
  occupation?: string;
  workplace?: string;
  workPhone?: string;
  workAddress?: string;

  // Contact Information
  alternatePhone?: string;
  alternateEmail?: string;

  // Role Information (Required)
  role: "father" | "mother" | "guardian";

  // Relationship Information
  relationship?: "father" | "mother" | "guardian" | "other";
  maritalStatus?: "single" | "married" | "divorced" | "widowed";

  // Emergency Information
  emergencyContact?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;

  // Address Information
  permanentAddress?: string;
  currentAddress?: string;

  // Financial Information
  monthlyIncome?: number;
  paymentMethod?: "cash" | "bank_transfer" | "cheque" | "other";
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    branchCode?: string;
  };

  // Status
  status: "active" | "inactive" | "suspended";

  // Demo password for initial login
  demoPassword: string;

  // Additional Information
  notes?: string;
  preferences?: {
    communicationMethod: "email" | "phone" | "sms" | "whatsapp";
    language: string;
    receiveNotifications: boolean;
  };

  // Tenant Information
  tenantId: string;
  tenantName: string;

  // User reference (for compatibility with existing unique index)
  userId?: mongoose.Types.ObjectId;
}

const ParentSchema: Schema = new Schema(
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
    },
    // Parent Information
    parentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    prtId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    occupation: {
      type: String,
      trim: true,
      maxlength: [100, "Occupation cannot exceed 100 characters"],
    },
    workplace: {
      type: String,
      trim: true,
      maxlength: [200, "Workplace cannot exceed 200 characters"],
    },
    workPhone: {
      type: String,
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    workAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Work address cannot exceed 500 characters"],
    },
    alternatePhone: {
      type: String,
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    alternateEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    // Role (Required)
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: ["father", "mother", "guardian"],
      lowercase: true,
      trim: true,
    },
    relationship: {
      type: String,
      enum: ["father", "mother", "guardian", "other"],
      lowercase: true,
    },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed"],
      lowercase: true,
    },
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
    emergencyContact: {
      type: String,
      trim: true,
      maxlength: [100, "Emergency contact cannot exceed 100 characters"],
    },
    emergencyPhone: {
      type: String,
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    emergencyRelation: {
      type: String,
      trim: true,
      maxlength: [50, "Emergency relation cannot exceed 50 characters"],
    },
    permanentAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Permanent address cannot exceed 500 characters"],
    },
    currentAddress: {
      type: String,
      trim: true,
      maxlength: [500, "Current address cannot exceed 500 characters"],
    },
    monthlyIncome: {
      type: Number,
      min: [0, "Monthly income cannot be negative"],
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "other"],
      lowercase: true,
    },
    bankDetails: {
      bankName: {
        type: String,
        trim: true,
        maxlength: [100, "Bank name cannot exceed 100 characters"],
      },
      accountNumber: {
        type: String,
        trim: true,
        maxlength: [50, "Account number cannot exceed 50 characters"],
      },
      accountHolderName: {
        type: String,
        trim: true,
        maxlength: [100, "Account holder name cannot exceed 100 characters"],
      },
      branchCode: {
        type: String,
        trim: true,
        maxlength: [20, "Branch code cannot exceed 20 characters"],
      },
    },
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
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    preferences: {
      communicationMethod: {
        type: String,
        enum: ["email", "phone", "sms", "whatsapp"],
        default: "email",
      },
      language: {
        type: String,
        default: "en",
        trim: true,
      },
      receiveNotifications: {
        type: Boolean,
        default: true,
      },
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
ParentSchema.index({ parentId: 1 });
ParentSchema.index({ status: 1 });
ParentSchema.index({ role: 1 }); // Index for role field
ParentSchema.index({ relationship: 1 });
ParentSchema.index({ isActive: 1 });
ParentSchema.index({ isDeleted: 1 });
ParentSchema.index({ tenantId: 1 });
ParentSchema.index({ email: 1, tenantId: 1 }); // Compound index for tenant-specific email validation
ParentSchema.index({ parentId: 1, tenantId: 1 }); // Compound index for tenant-specific parentId validation

// Virtual for full name
ParentSchema.virtual("fullName").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

// Auto-generate PRT-XXX codes
ParentSchema.plugin(autoIdPlugin, {
  fieldName: "prtId",
  prefix: "PRT",
  pad: 3,
});

export default mongoose.model<IParent>("Parent", ParentSchema);

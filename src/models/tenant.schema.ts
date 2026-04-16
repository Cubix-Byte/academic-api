import mongoose, { Document, Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";
import { PROFILE_STATUS_ARRAY } from "../utils/shared-lib-imports";

// Permission interface for tenant permissions
export interface ITenantPermission {
  type: number;
  name: string; // Fixed identifier (parents, teachers, students, school, staff) - never changes
  displayName: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  isAssigned: boolean;
  status?: "Active" | "In Active";
}

// Tenant model interface - represents school/tenant information
export interface ITenant extends IBaseDocument {
  schoolName: string;
  tenantName: string;
  schoolAddress: string;
  city: string;
  state: string;
  countryCode: string;
  timeZone?: string;
  zipCode: string;
  schoolPhone: string;
  adminEmail: string;
  profilePicture?: string;
  topIcon?: string;
  schoolWebsite?: string;
  schoolSystem?: string;
  type?: "Academic" | "Corporate";
  profileStatus: "active" | "inactive";
  // colorTheme: { key: string; value: string }[];
  isTrial?: boolean;
  trialEndDate?: Date;
  trialDaysTotal?: number;
  trialDaysRemaining?: number;
  lastTrialDecrementDate?: string; // Local date string (YYYY-MM-DD) in tenant timezone
  typography?: string;
  colors?: Record<string, string>;
  additionalDetails?: Record<string, any>;
  permissions?: ITenantPermission[];
  landingPageInfo?: {
    landingWelcome?: string;
    landingDescription?: string;
    studentportalDescription?: string;
    teacherPortalDescription?: string;
    parentPortalDescription?: string;
    studentPicture?: string;
    teacherPicture?: string;
    parentPicture?: string;
  };
  partnerId?: string;
  partnerName?: string; // Appended from Partner model
  seatsNlicense?: {
    startDate: Date;
    endDate: Date;
    teacherSeats: number;
    studentSeats: number;
    parentSeats: number;
    AiPracticeExamePerYear: number;
    currency?: string;
    creditPrice?: number;
  };
  gradeRanges?: {
    ELEMENTARY?: { min: number; max: number };
    MIDDLE?: { min: number; max: number };
    HIGH?: { min: number; max: number };
  };
  maxSchoolLevel?: number;
}

const TenantSchema: Schema = new Schema(
  {
    ...BaseDocumentSchema.obj,
    schoolName: {
      type: String,
      required: [true, "School name is required"],
      trim: true,
      unique: true,
      maxlength: [200, "School name cannot exceed 200 characters"],
    },
    tenantName: {
      type: String,
      required: [true, "Tenant name is required"],
      trim: true,
      unique: true,
      maxlength: [30, "Tenant name cannot exceed 30 characters"],
      minlength: [3, "Tenant name must be at least 3 characters long"],
    },
    schoolAddress: {
      type: String,
      required: [true, "School address is required"],
      trim: true,
      maxlength: [500, "School address cannot exceed 500 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City cannot exceed 100 characters"],
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [100, "State cannot exceed 100 characters"],
    },
    countryCode: {
      type: String,
      required: [true, "Country code is required"],
      trim: true,
      uppercase: true,
      maxlength: [10, "Country code cannot exceed 10 characters"],
    },
    timeZone: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      required: [true, "Zip code is required"],
      trim: true,
      maxlength: [20, "Zip code cannot exceed 20 characters"],
    },
    schoolPhone: {
      type: String,
      required: [true, "School phone is required"],
      trim: true,
      match: [/^[\+]?[0-9\-\s]{10,20}$/, "Please enter a valid phone number"],
    },
    adminEmail: {
      type: String,
      required: [true, "Admin email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    type: {
      type: String,
      enum: ["Academic", "Corporate"],
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    topIcon: {
      type: String,
      trim: true,
    },
    schoolWebsite: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Please enter a valid URL"],
    },
    schoolSystem: {
      type: String,
      trim: true,
    },
    profileStatus: {
      type: String,
      enum: PROFILE_STATUS_ARRAY,
      default: "active",
      required: true,
    },
    isTrial: {
      type: Boolean,
      default: false,
    },
    trialEndDate: {
      type: Date,
    },
    trialDaysTotal: {
      type: Number,
    },
    trialDaysRemaining: {
      type: Number,
    },
    lastTrialDecrementDate: {
      type: String, // Stored as YYYY-MM-DD in tenant timezone
    },
    // colorTheme: [
    //   {
    //     key: {
    //       type: String,
    //       required: true,
    //       trim: true,
    //     },
    //     value: {
    //       type: String,
    //       required: true,
    //       trim: true,
    //     },
    //   },
    // ],
    typography: {
      type: String,
      trim: true,
    },
    colors: {
      type: Schema.Types.Mixed,
      default: {},
    },
    additionalDetails: {
      type: Schema.Types.Mixed,
      default: {},
    },
    permissions: [
      {
        type: {
          type: Number,
          required: true,
        },
        name: {
          type: String,
          required: false, // Will be computed from type, not stored in DB
          trim: true,
        },
        displayName: {
          type: String,
          required: true,
          trim: true,
        },
        canView: {
          type: Boolean,
          required: true,
          default: false,
        },
        canEdit: {
          type: Boolean,
          required: true,
          default: false,
        },
        canDelete: {
          type: Boolean,
          required: true,
          default: false,
        },
        canCreate: {
          type: Boolean,
          required: true,
          default: false,
        },
        isAssigned: {
          type: Boolean,
          required: true,
          default: true,
        },
        status: {
          type: String,
          enum: ["Active", "In Active"],
          default: "In Active",
        },
      },
    ],
    landingPageInfo: {
      landingWelcome: {
        type: String,
        trim: true,
      },
      landingDescription: {
        type: String,
        trim: true,
      },
      studentportalDescription: {
        type: String,
        trim: true,
      },
      teacherPortalDescription: {
        type: String,
        trim: true,
      },
      parentPortalDescription: {
        type: String,
        trim: true,
      },
      studentPicture: {
        type: String,
        trim: true,
      },
      teacherPicture: {
        type: String,
        trim: true,
      },
      parentPicture: {
        type: String,
        trim: true,
      },
    },
    partnerId: {
      type: String,
      trim: true,
    },
    seatsNlicense: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      teacherSeats: {
        type: Number,
        default: 0,
      },
      studentSeats: {
        type: Number,
        default: 0,
      },
      parentSeats: {
        type: Number,
        default: 0,
      },
      AiPracticeExamePerYear: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "USD",
        trim: true,
      },
      creditPrice: {
        type: Number,
        default: 0,
      },
    },
    gradeRanges: {
      type: Schema.Types.Mixed,
      default: {
        ELEMENTARY: { min: 1, max: 5 },
        MIDDLE: { min: 6, max: 8 },
        HIGH: { min: 9, max: 12 },
      },
    },
    maxSchoolLevel: {
      type: Number,
      default: 12,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        const { _id, __v, demoPassword, ...rest } = ret;
        // Ensure optional fields are always included (null if undefined or empty)
        const additionalDetails = ret.additionalDetails || {};
        const result = {
          id: (_id as any).toString(),
          ...rest,
          profilePicture: ret.profilePicture ?? null,
          topIcon: ret.topIcon ?? null,
          timeZone: ret.timeZone ?? null,
          schoolWebsite: ret.schoolWebsite ?? null,
          schoolSystem: ret.schoolSystem ?? null,
          isTrial: ret.isTrial ?? false,
          trialEndDate: ret.trialEndDate ?? null,
          additionalDetails: {
            ...additionalDetails,
            isPremium: additionalDetails.isPremium ?? false,
          },
          landingPageInfo: ret.landingPageInfo
            ? {
              landingWelcome: ret.landingPageInfo.landingWelcome ?? null,
              landingDescription:
                ret.landingPageInfo.landingDescription ?? null,
              studentportalDescription:
                ret.landingPageInfo.studentportalDescription ?? null,
              teacherPortalDescription:
                ret.landingPageInfo.teacherPortalDescription ?? null,
              parentPortalDescription:
                ret.landingPageInfo.parentPortalDescription ?? null,
              studentPicture: ret.landingPageInfo.studentPicture ?? null,
              teacherPicture: ret.landingPageInfo.teacherPicture ?? null,
              parentPicture: ret.landingPageInfo.parentPicture ?? null,
            }
            : null,
        };
        return result;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        const { _id, __v, demoPassword, ...rest } = ret;
        // Ensure optional fields are always included (null if undefined or empty)
        const additionalDetails = ret.additionalDetails || {};
        const result = {
          id: (_id as any).toString(),
          ...rest,
          profilePicture: ret.profilePicture ?? null,
          topIcon: ret.topIcon ?? null,
          timeZone: ret.timeZone ?? null,
          schoolWebsite: ret.schoolWebsite ?? null,
          schoolSystem: ret.schoolSystem ?? null,
          isTrial: ret.isTrial ?? false,
          trialEndDate: ret.trialEndDate ?? null,
          additionalDetails: {
            ...additionalDetails,
            isPremium: additionalDetails.isPremium ?? false,
          },
          landingPageInfo: ret.landingPageInfo
            ? {
              landingWelcome: ret.landingPageInfo.landingWelcome ?? null,
              landingDescription:
                ret.landingPageInfo.landingDescription ?? null,
              studentportalDescription:
                ret.landingPageInfo.studentportalDescription ?? null,
              teacherPortalDescription:
                ret.landingPageInfo.teacherPortalDescription ?? null,
              parentPortalDescription:
                ret.landingPageInfo.parentPortalDescription ?? null,
              studentPicture: ret.landingPageInfo.studentPicture ?? null,
              teacherPicture: ret.landingPageInfo.teacherPicture ?? null,
              parentPicture: ret.landingPageInfo.parentPicture ?? null,
            }
            : null,
        };
        return result;
      },
    },
  },
);

// Indexes for better performance
TenantSchema.index({ schoolName: 1 });
TenantSchema.index({ city: 1 });
TenantSchema.index({ state: 1 });
TenantSchema.index({ profileStatus: 1 });
TenantSchema.index({ isActive: 1 });
TenantSchema.index({ isDeleted: 1 });
TenantSchema.index({ partnerId: 1 });

export default mongoose.model<ITenant>("Tenant", TenantSchema);

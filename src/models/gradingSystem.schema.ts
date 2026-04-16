import mongoose, { Schema, Document } from "mongoose";

/**
 * Grading System Schema
 * Defines the structure for grading systems used in exams
 */

export interface IGradeRange {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  description?: string;
  color?: string;
}

export interface IGradingSystem extends Document {
  systemName: string;
  description?: string;
  gradeRanges: IGradeRange[];
  isActive: boolean;
  isDefault: boolean;
  tenantId: mongoose.Types.ObjectId;
  tenantName: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

const GradeRangeSchema = new Schema<IGradeRange>(
  {
    grade: {
      type: String,
      required: true,
      trim: true,
    },
    minPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const GradingSystemSchema = new Schema<IGradingSystem>(
  {
    systemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    gradeRanges: {
      type: [GradeRangeSchema],
      required: true,
      validate: {
        validator: function (ranges: IGradeRange[]) {
          return ranges.length > 0;
        },
        message: "At least one grade range is required",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Tenant",
    },
    tenantName: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: "gradingSystems",
  }
);

// Indexes
GradingSystemSchema.index({ tenantId: 1, systemName: 1 }, { unique: true });
GradingSystemSchema.index({ tenantId: 1, isActive: 1 });
GradingSystemSchema.index({ tenantId: 1, isDefault: 1 });
GradingSystemSchema.index({ isDeleted: 1 });

// Pre-save middleware to validate grade ranges
GradingSystemSchema.pre("save", function (next) {
  // Validate that grade ranges don't overlap
  const ranges = this.gradeRanges;
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const range1 = ranges[i];
      const range2 = ranges[j];

      // Check for overlap
      if (
        (range1.minPercentage <= range2.maxPercentage &&
          range1.maxPercentage >= range2.minPercentage) ||
        (range2.minPercentage <= range1.maxPercentage &&
          range2.maxPercentage >= range1.minPercentage)
      ) {
        return next(new Error("Grade ranges cannot overlap"));
      }
    }

    // Validate min <= max
    if (ranges[i].minPercentage > ranges[i].maxPercentage) {
      return next(
        new Error(
          "Minimum percentage cannot be greater than maximum percentage"
        )
      );
    }
  }

  next();
});

// Virtual for checking if grading system is expired
GradingSystemSchema.virtual("isExpired").get(function (this: IGradingSystem) {
  return false; // Grading systems don't expire
});

// Instance method to validate percentage against grade ranges
GradingSystemSchema.methods.validatePercentage = function (
  percentage: number
): boolean {
  return this.gradeRanges.some(
    (range: IGradeRange) =>
      percentage >= range.minPercentage && percentage <= range.maxPercentage
  );
};

// Instance method to get grade for percentage
GradingSystemSchema.methods.getGradeForPercentage = function (
  percentage: number
): string | null {
  const range = this.gradeRanges.find(
    (range: IGradeRange) =>
      percentage >= range.minPercentage && percentage <= range.maxPercentage
  );
  return range ? range.grade : null;
};

export default mongoose.model<IGradingSystem>(
  "GradingSystem",
  GradingSystemSchema
);

import mongoose, { Schema } from "mongoose";
import { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

// Class Schedule model interface - represents a subject period/slot in the timetable
export interface IClassSchedule extends IBaseDocument {
    tenantId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;

    dayOfWeek: number; // 0-6 (Sun-Sat)
    slotNumber: number; // 1, 2, 3...

    // Runtime properties that won't be saved to DB but exist for API responses
    // Populated in runtime from tenant_timetable_config
    startTime?: string;
    endTime?: string;

    academicYear: string;
}

// Class Schedule schema definition
const ClassScheduleSchema: Schema = new Schema(
    {
        ...BaseDocumentSchema.obj,
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
            required: [true, "Tenant ID is required"],
        },
        classId: {
            type: Schema.Types.ObjectId,
            ref: "Class",
            required: [true, "Class ID is required"],
        },
        subjectId: {
            type: Schema.Types.ObjectId,
            ref: "Subject",
            required: [true, "Subject ID is required"],
        },
        teacherId: {
            type: Schema.Types.ObjectId,
            ref: "Teacher",
            required: [true, "Teacher ID is required"],
        },
        dayOfWeek: {
            type: Number,
            required: [true, "Day of week is required"],
            min: [0, "Day of week must be between 0 and 6"],
            max: [6, "Day of week must be between 0 and 6"],
        },
        slotNumber: {
            type: Number,
            required: [true, "Slot number is required"],
            min: [1, "Slot number must be at least 1"],
        },
        academicYear: {
            type: String,
            required: [true, "Academic year is required"],
            trim: true,
        },
    },
    {
        timestamps: true,
        collection: "class_schedules",
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

// Database indexes as specified for optimization
ClassScheduleSchema.index({ tenantId: 1, classId: 1 });
ClassScheduleSchema.index({ teacherId: 1, dayOfWeek: 1 });
ClassScheduleSchema.index({ classId: 1, dayOfWeek: 1 });

// Note: startTime and endTime will be added to the document on runtime
// at the service layer by fetching from tenant_timetable_config.

// Export ClassSchedule model
const ClassSchedule = mongoose.model<IClassSchedule>("ClassSchedule", ClassScheduleSchema);
export default ClassSchedule;
export { ClassSchedule };

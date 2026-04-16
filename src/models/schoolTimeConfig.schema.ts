import mongoose, { Document, Schema } from 'mongoose';
import { SLOT_TYPE, SLOT_TYPES_ARRAY } from '../utils/constants/tenantTimetable.constants';

export interface ITenantTimetableConfig extends Document {
    tenantId: mongoose.Types.ObjectId;
    workingDays: number[];
    slotDuration: number;
    totalSlotsPerDay: number;
    schoolStartTime: string;
    schoolEndTime?: string;
    slots: {
        slotNumber: number;
        startTime: string;
        endTime: string;
        duration: number;
        type: SLOT_TYPE;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const slotSchema = new Schema({
    slotNumber: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, required: true },
    type: { type: String, enum: Object.values(SLOT_TYPE), required: true },
}, { _id: false });

const schoolTimeConfigSchema = new Schema<ITenantTimetableConfig>(
    {
        tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        workingDays: { type: [Number], required: true },
        slotDuration: { type: Number, required: true },
        totalSlotsPerDay: { type: Number, required: true },
        schoolStartTime: { type: String, required: true },
        schoolEndTime: { type: String },
        slots: { type: [slotSchema], required: true },
    },
    { timestamps: true, collection: 'tenant_timetable_config' }
);

export const TenantTimetableConfig = mongoose.model<ITenantTimetableConfig>('TenantTimetableConfig', schoolTimeConfigSchema);

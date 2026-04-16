import { z } from 'zod';
import { SLOT_TYPES_ARRAY } from '../constants/tenantTimetable.constants';

const timeRegex = /^([01]\d|2[0-3]):?([0-5]\d)$/;

const slotSchema = z.object({
    slotNumber: z.number().int().positive(),
    startTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)'),
    endTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)'),
    duration: z.number().int().positive(),
    type: z.enum(SLOT_TYPES_ARRAY),
});

export const createOrUpdateSchoolTimeConfigSchema = z.object({
    body: z.object({
        workingDays: z.array(z.number().int().min(0).max(6)).nonempty(),
        slotDuration: z.number().int().positive(),
        totalSlotsPerDay: z.number().int().positive(),
        schoolStartTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)'),
        schoolEndTime: z.string().regex(timeRegex, 'Invalid time format (HH:mm)').optional(),
        slots: z.array(slotSchema).nonempty(),
    }),
});

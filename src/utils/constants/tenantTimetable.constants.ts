/**
 * Slot type constants for the Tenant Timetable configuration
 */
export enum SLOT_TYPE {
    PERIOD = 'period',
    BREAK = 'break',
}

export const SLOT_TYPES_ARRAY = [SLOT_TYPE.PERIOD, SLOT_TYPE.BREAK] as const;

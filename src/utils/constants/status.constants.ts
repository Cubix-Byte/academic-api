/**
 * Status constants for the application
 */
export enum STATUS {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
}

export const STATUS_ARRAY = [STATUS.ACTIVE, STATUS.INACTIVE] as const;

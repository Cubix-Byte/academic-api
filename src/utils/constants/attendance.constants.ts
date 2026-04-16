export enum ATTENDANCE_ROLE {
  TEACHER = "teacher",
  STUDENT = "student",
}

export const ATTENDANCE_ROLES_ARRAY = [
  ATTENDANCE_ROLE.TEACHER,
  ATTENDANCE_ROLE.STUDENT,
] as const;

export enum ATTENDANCE_STATUS {
  PRESENT = "present",
  ABSENT = "absent",
  LATE = "late",
}

export const ATTENDANCE_STATUS_ARRAY = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.ABSENT,
  ATTENDANCE_STATUS.LATE,
] as const;

// Optional enum to standardize common remark values in code.
// NOTE: Schema still allows free-text remarks to avoid breaking existing data.
export enum ATTENDANCE_REMARK {
  PRESENT = "present",
  ABSENT = "absent",
  LATE = "late",
}

export const ATTENDANCE_REMARKS_ARRAY = [
  ATTENDANCE_REMARK.PRESENT,
  ATTENDANCE_REMARK.ABSENT,
  ATTENDANCE_REMARK.LATE,
] as const;



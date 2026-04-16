import { HttpStatusCodes } from "shared-lib";
import * as tenantRepository from "../repositories/tenant.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as studentRepository from "../repositories/student.repository";
import * as parentRepository from "../repositories/parent.repository";

export type SeatUserType = "teacher" | "student" | "parent";

export interface SeatCheckResult {
  unlimited: boolean;
  limit: number; // 0 means unlimited
  current: number;
  requested: number;
  remaining: number; // Infinity when unlimited
}

function toSeatNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getCurrentCount(tenantId: string, type: SeatUserType) {
  switch (type) {
    case "teacher":
      return await teacherRepository.countTeachersAll({ tenantId });
    case "student":
      return await studentRepository.countStudents({ tenantId, filters: {} } as any);
    case "parent":
      return await parentRepository.countParentsAll({ tenantId });
    default:
      return 0;
  }
}

export async function assertSeatAvailable(params: {
  tenantId: string;
  type: SeatUserType;
  requested?: number;
}): Promise<SeatCheckResult> {
  const { tenantId, type } = params;
  const requested = Math.max(0, Number(params.requested ?? 1));

  const tenant: any = await tenantRepository.findTenantById(tenantId);
  if (!tenant) {
    const err: any = new Error("Tenant not found");
    err.statusCode = HttpStatusCodes.NOT_FOUND;
    throw err;
  }

  const seats = tenant?.seatsNlicense || {};
  const limit =
    type === "teacher"
      ? toSeatNumber(seats.teacherSeats)
      : type === "student"
        ? toSeatNumber(seats.studentSeats)
        : toSeatNumber(seats.parentSeats);

  // Rule: 0 (or <0 / missing) means unlimited
  if (!limit || limit <= 0) {
    return {
      unlimited: true,
      limit: 0,
      current: 0,
      requested,
      remaining: Infinity,
    };
  }

  const current = await getCurrentCount(tenantId, type);

  const remaining = Math.max(0, limit - current);
  const wouldExceed = current + requested > limit;

  if (wouldExceed) {
    const label =
      type === "teacher" ? "Teacher" : type === "student" ? "Student" : "Parent";
    const err: any = new Error(
      `${label} seats are at full capacity (${limit}). Please increase seats to create more.`
    );
    err.statusCode = HttpStatusCodes.CONFLICT;
    err.details = { type, limit, current, requested };
    throw err;
  }

  return {
    unlimited: false,
    limit,
    current,
    requested,
    remaining,
  };
}



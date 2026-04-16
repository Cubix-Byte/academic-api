import mongoose from "mongoose";
import { ClassSchedule, Class, IClassSchedule } from "@/models";
import ClassStudent, { IClassStudent } from "@/models/class_student.schema";
import { TenantTimetableConfigService } from "./schoolTimeConfig.service";
import { SLOT_TYPE } from "@/utils/constants/tenantTimetable.constants";

interface CreateClassScheduleInput {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  slotNumber: number;
  academicYear: string;
}

interface UpdateClassScheduleInput {
  classId?: string;
  subjectId?: string;
  teacherId?: string;
  dayOfWeek?: number;
  slotNumber?: number;
  academicYear?: string;
}

export class ClassScheduleService {
  /**
   * Helper to validate slot/day against tenant timetable config
   */
  private static async validateAgainstTimetableConfig(
    tenantId: string | mongoose.Types.ObjectId,
    dayOfWeek: number,
    slotNumber: number
  ) {
    const config = await TenantTimetableConfigService.getConfigByTenantId(
      tenantId
    );

    if (!config) {
      // If there's no config, we skip strict validation to avoid blocking tenants mid-setup
      return null;
    }

    if (!config.workingDays.includes(dayOfWeek)) {
      throw new Error(
        `Selected dayOfWeek (${dayOfWeek}) is not a working day for this tenant`
      );
    }

    if (slotNumber < 1 || slotNumber > config.totalSlotsPerDay) {
      throw new Error(
        `slotNumber must be between 1 and ${config.totalSlotsPerDay} for this tenant`
      );
    }

    const slotConfig = config.slots.find(
      (s) => s.slotNumber === slotNumber && s.type === SLOT_TYPE.PERIOD
    );

    if (!slotConfig) {
      throw new Error(
        `No active PERIOD slot configuration found for slotNumber ${slotNumber}`
      );
    }

    return slotConfig;
  }

  /**
   * Ensures there are no conflicts for the given combination
   * - No two classes can occupy the same (tenantId, classId, dayOfWeek, slotNumber, academicYear)
   * - No teacher can be booked in two places at the same (tenantId, teacherId, dayOfWeek, slotNumber, academicYear)
   */
  private static async assertNoConflicts(options: {
    tenantId: string | mongoose.Types.ObjectId;
    classId: string | mongoose.Types.ObjectId;
    teacherId: string | mongoose.Types.ObjectId;
    dayOfWeek: number;
    slotNumber: number;
    academicYear: string;
    excludeId?: string | mongoose.Types.ObjectId;
  }) {
    const {
      tenantId,
      classId,
      teacherId,
      dayOfWeek,
      slotNumber,
      academicYear,
      excludeId,
    } = options;

    const baseFilter: any = {
      tenantId,
      dayOfWeek,
      slotNumber,
      academicYear,
    };

    const excludeFilter = excludeId
      ? { _id: { $ne: new mongoose.Types.ObjectId(excludeId) } }
      : {};

    const [classConflict, teacherConflict] = await Promise.all([
      ClassSchedule.findOne({
        ...baseFilter,
        classId,
        ...excludeFilter,
      }).lean(),
      ClassSchedule.findOne({
        ...baseFilter,
        teacherId,
        ...excludeFilter,
      }).lean(),
    ]);

    if (classConflict) {
      throw new Error(
        "A schedule for this class already exists for the same day and slot (class-time conflict)"
      );
    }

    if (teacherConflict) {
      throw new Error(
        "This teacher is already assigned to another class at the same day and slot (teacher-time conflict)"
      );
    }
  }

  static async createSchedule(
    tenantId: string | mongoose.Types.ObjectId,
    payload: CreateClassScheduleInput,
    createdBy: string | mongoose.Types.ObjectId
  ): Promise<IClassSchedule> {
    const {
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      slotNumber,
      academicYear,
    } = payload;

    await this.validateAgainstTimetableConfig(tenantId, dayOfWeek, slotNumber);

    await this.assertNoConflicts({
      tenantId,
      classId: new mongoose.Types.ObjectId(classId),
      teacherId: new mongoose.Types.ObjectId(teacherId),
      dayOfWeek,
      slotNumber,
      academicYear,
    });

    const schedule = await ClassSchedule.create({
      tenantId,
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      slotNumber,
      academicYear,
      createdBy,
      updatedBy: createdBy,
    } as any);

    return schedule;
  }

  static async updateSchedule(
    tenantId: string | mongoose.Types.ObjectId,
    id: string,
    updates: UpdateClassScheduleInput,
    updatedBy: string | mongoose.Types.ObjectId
  ): Promise<IClassSchedule> {
    const existing = await ClassSchedule.findOne({
      _id: id,
      tenantId,
    });

    if (!existing) {
      throw new Error("Class schedule not found");
    }

    const newValues = {
      classId: updates.classId || existing.classId,
      subjectId: updates.subjectId || existing.subjectId,
      teacherId: updates.teacherId || existing.teacherId,
      dayOfWeek:
        typeof updates.dayOfWeek === "number"
          ? updates.dayOfWeek
          : existing.dayOfWeek,
      slotNumber:
        typeof updates.slotNumber === "number"
          ? updates.slotNumber
          : existing.slotNumber,
      academicYear: updates.academicYear || existing.academicYear,
    };

    await this.validateAgainstTimetableConfig(
      tenantId,
      newValues.dayOfWeek,
      newValues.slotNumber
    );

    await this.assertNoConflicts({
      tenantId,
      classId: newValues.classId,
      teacherId: newValues.teacherId,
      dayOfWeek: newValues.dayOfWeek,
      slotNumber: newValues.slotNumber,
      academicYear: newValues.academicYear,
      excludeId: id,
    });

    existing.classId = newValues.classId as any;
    existing.subjectId = newValues.subjectId as any;
    existing.teacherId = newValues.teacherId as any;
    existing.dayOfWeek = newValues.dayOfWeek;
    existing.slotNumber = newValues.slotNumber;
    existing.academicYear = newValues.academicYear;
    (existing as any).updatedBy = updatedBy;

    await existing.save();
    return existing;
  }

  static async deleteSchedule(
    tenantId: string | mongoose.Types.ObjectId,
    id: string
  ) {
    const deleted = await ClassSchedule.findOneAndDelete({
      _id: id,
      tenantId,
    });
    if (!deleted) {
      throw new Error("Class schedule not found");
    }
    return deleted;
  }

  static async getScheduleById(
    tenantId: string | mongoose.Types.ObjectId,
    id: string
  ) {
    const schedule = await ClassSchedule.findOne({
      _id: id,
      tenantId,
    });
    if (!schedule) {
      throw new Error("Class schedule not found");
    }
    return schedule;
  }

  static async listSchedules(options: {
    tenantId: string | mongoose.Types.ObjectId;
    classId?: string;
    teacherId?: string;
    subjectId?: string;
    academicYear?: string;
    dayOfWeek?: number;
  }) {
    const { tenantId, classId, teacherId, subjectId, academicYear, dayOfWeek } =
      options;

    const filter: any = {
      tenantId,
    };

    if (classId) filter.classId = classId;
    if (teacherId) filter.teacherId = teacherId;
    if (subjectId) filter.subjectId = subjectId;
    if (academicYear) filter.academicYear = academicYear;
    if (typeof dayOfWeek === "number") filter.dayOfWeek = dayOfWeek;

    const schedules = await ClassSchedule.find(filter)
      .sort({ dayOfWeek: 1, slotNumber: 1 })
      .lean();

    return schedules;
  }

  /**
   * Get a summary of class timetables created for a tenant,
   * grouped by classId with class details and last updated timestamp.
   */
  static async getClassTimetableSummary(options: {
    tenantId: string | mongoose.Types.ObjectId;
    academicYear?: string;
  }) {
    const { tenantId, academicYear } = options;

    const match: any = {
      tenantId:
        typeof tenantId === "string"
          ? new mongoose.Types.ObjectId(tenantId)
          : tenantId,
    };

    if (academicYear) {
      match.academicYear = academicYear;
    }

    const summary = await ClassSchedule.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$classId",
          lastUpdate: { $max: "$updatedAt" },
          totalSlots: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "classes",
          localField: "_id",
          foreignField: "_id",
          as: "class",
        },
      },
      { $unwind: "$class" },
      {
        $lookup: {
          from: "batches",
          localField: "class.batchId",
          foreignField: "_id",
          as: "batch",
        },
      },
      {
        $unwind: {
          path: "$batch",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          classId: "$_id",
          batchId: "$class.batchId",
          batchName: "$batch.batchName",
          className: "$class.name",
          isActive: "$class.isActive",
          lastUpdate: 1,
          totalSlots: 1,
        },
      },
      { $sort: { className: 1 } },
    ]);

    return {
      totalClasses: summary.length,
      classes: summary,
    };
  }

  /**
   * Get full timetable for a class (all days/slots) with start/end times populated from tenant timetable config
   */
  static async getClassTimetable(options: {
    tenantId: string | mongoose.Types.ObjectId;
    classId: string;
    academicYear: string;
  }) {
    const { tenantId, classId, academicYear } = options;

    const [config, schedules] = await Promise.all([
      TenantTimetableConfigService.getConfigByTenantId(tenantId),
      ClassSchedule.find({
        tenantId,
        classId,
        academicYear,
      })
        // Populate related entities so we can expose their names in the API
        .populate("classId", "name grade section")
        .populate("subjectId", "name code grade")
        .populate("teacherId", "firstName lastName thrId")
        .sort({ dayOfWeek: 1, slotNumber: 1 })
        .lean<IClassSchedule[]>(),
    ]);

    const slotsByNumber =
      config?.slots?.reduce<Record<number, (typeof config.slots)[number]>>(
        (acc, slot) => {
          acc[slot.slotNumber] = slot;
          return acc;
        },
        {}
      ) || {};

    const enriched = (schedules as any[]).map((s: any) => {
      const slotCfg = slotsByNumber[s.slotNumber];
      const classDoc = s.classId as any;
      const subjectDoc = s.subjectId as any;
      const teacherDoc = s.teacherId as any;

      const teacherName = teacherDoc
        ? `${teacherDoc.firstName || ""} ${teacherDoc.lastName || ""}`.trim()
        : undefined;

      return {
        ...s,
        startTime: slotCfg?.startTime,
        endTime: slotCfg?.endTime,
        slotDuration: slotCfg?.duration,
        slotType: slotCfg?.type,
        // Convenience fields for client usage
        className: classDoc?.name,
        subjectName: subjectDoc?.name,
        teacherName: teacherName || undefined,
      };
    });

    return {
      timetable: enriched,
      config,
    };
  }

  /**
   * Get full timetable for a teacher (all days/slots) with start/end times populated from tenant timetable config
   */
  static async getTeacherTimetable(options: {
    tenantId: string | mongoose.Types.ObjectId;
    teacherId: string;
    academicYear: string;
  }) {
    const { tenantId, teacherId, academicYear } = options;

    const [config, schedules] = await Promise.all([
      TenantTimetableConfigService.getConfigByTenantId(tenantId),
      ClassSchedule.find({
        tenantId,
        teacherId,
        academicYear,
      })
        .populate("classId", "name grade")
        .populate("subjectId", "name code")
        .sort({ dayOfWeek: 1, slotNumber: 1 })
        .lean<IClassSchedule[]>(),
    ]);

    const slotsByNumber =
      config?.slots?.reduce<Record<number, (typeof config.slots)[number]>>(
        (acc, slot) => {
          acc[slot.slotNumber] = slot;
          return acc;
        },
        {}
      ) || {};

    const enriched = schedules.map((s: any) => {
      const slotCfg = slotsByNumber[s.slotNumber];
      return {
        ...s,
        startTime: slotCfg?.startTime,
        endTime: slotCfg?.endTime,
        slotDuration: slotCfg?.duration,
        slotType: slotCfg?.type,
      };
    });

    return {
      timetable: enriched,
      config,
    };
  }

  /**
   * Get full timetable for a student:
   * - Determines current active class and subject assignments from class_students
   * - Returns timetable for that class and academic year, filtered to student's subjects
   */
  static async getStudentTimetable(options: {
    tenantId: string | mongoose.Types.ObjectId;
    studentId: string;
    academicYear?: string;
  }) {
    const { tenantId, studentId, academicYear } = options;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new Error("Invalid studentId format");
    }

    // Find the student's current active enrollment (class + subjects)
    const enrollmentQuery: any = {
      studentId: new mongoose.Types.ObjectId(studentId),
      enrollmentStatus: "active",
      isDeleted: false,
    };

    // If academicYear is provided, filter enrollment by that year; otherwise use the latest active enrollment
    if (academicYear) {
      enrollmentQuery.academicYear = academicYear;
    }

    const enrollment = await ClassStudent.findOne(enrollmentQuery)
      .select("classId subjectIds academicYear")
      .lean<IClassStudent | null>();

    if (!enrollment) {
      throw new Error(
        "Active class enrollment not found for this student and academic year"
      );
    }

    const classId = enrollment.classId?.toString();
    if (!classId) {
      throw new Error("Enrollment record is missing classId");
    }

    // Determine which academic year to use for timetable lookups (if available):
    // - Prefer explicit academicYear param
    // - Fallback to enrollment.academicYear
    // - If neither is present, we don't filter by academicYear and return
    //   all timetable entries for the student's current active class.
    const effectiveAcademicYear =
      academicYear || enrollment.academicYear || undefined;

    const subjectIds =
      (enrollment.subjectIds || []).map((id: any) =>
        id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
      ) ?? [];

    // If student has no subject assignments, return empty timetable with config
    const [config, schedules] = subjectIds.length
      ? await Promise.all([
        TenantTimetableConfigService.getConfigByTenantId(tenantId),
        (() => {
          const filter: any = {
            tenantId,
            classId,
            subjectId: { $in: subjectIds },
          };
          if (effectiveAcademicYear) {
            filter.academicYear = effectiveAcademicYear;
          }
          return ClassSchedule.find(filter)
            .populate("classId", "name grade")
            .populate("subjectId", "name code")
            .sort({ dayOfWeek: 1, slotNumber: 1 })
            .lean<IClassSchedule[]>();
        })(),
      ])
      : await Promise.all([
        TenantTimetableConfigService.getConfigByTenantId(tenantId),
        Promise.resolve([] as IClassSchedule[]),
      ]);

    const slotsByNumber =
      config?.slots?.reduce<Record<number, (typeof config.slots)[number]>>(
        (acc, slot) => {
          acc[slot.slotNumber] = slot;
          return acc;
        },
        {}
      ) || {};

    const enriched = (schedules as any[]).map((s: any) => {
      const slotCfg = slotsByNumber[s.slotNumber];
      return {
        ...s,
        startTime: slotCfg?.startTime,
        endTime: slotCfg?.endTime,
        slotDuration: slotCfg?.duration,
        slotType: slotCfg?.type,
      };
    });

    return {
      timetable: enriched,
      config,
      classId,
      academicYear: effectiveAcademicYear,
    };
  }
}

export default ClassScheduleService;



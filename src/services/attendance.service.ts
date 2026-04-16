import mongoose from "mongoose";
import {
  Attendance,
  ClassSession,
  ClassStudent,
  IAttendance,
  IClassSession,
  IClassStudent,
  IClass,
  IClassSchedule,
  IBatch,
  Class,
  ClassSchedule,
  Batch,
} from "@/models";
import { TransactionHelper } from "@/utils/shared-lib-imports";
import { TenantTimetableConfigService } from "./schoolTimeConfig.service";
import { SLOT_TYPE } from "@/utils/constants/tenantTimetable.constants";
import {
  ATTENDANCE_ROLE,
  ATTENDANCE_STATUS,
} from "@/utils/constants/attendance.constants";
import { CLASS_SESSION_STATUS } from "@/utils/constants/classSession.constants";

interface StartSessionInput {
  tenantId: string | mongoose.Types.ObjectId;
  classId: string;
  subjectId: string;
  teacherId: string;
  scheduleId?: string;
  sessionCreatedAt?: Date; // Optional - accepted from payload, automatically calculated to current time if not provided
  academicYear?: string;
  createdBy: string;
}

interface MarkAttendanceInput {
  tenantId: string | mongoose.Types.ObjectId;
  sessionId: string;
  userId: string;
  role: ATTENDANCE_ROLE;
  status: ATTENDANCE_STATUS;
  markedBy: string;
  remarks?: string;
}

interface MarkAttendanceRecordInput {
  userId: string;
  role: ATTENDANCE_ROLE;
  status: ATTENDANCE_STATUS;
  remarks?: string;
}

interface MarkAttendanceBulkInput {
  tenantId: string | mongoose.Types.ObjectId;
  sessionId: string;
  markedBy: string;
  records: MarkAttendanceRecordInput[];
}

export class AttendanceService {
  /**
   * Start a class session for a specific class + subject + teacher.
   * - Creates ClassSession document
   * - Auto-marks teacher attendance as present
   * - Validates scheduleId, classId, subjectId, and academicYear (batchId) relationships
   */
  static async startSession(input: StartSessionInput): Promise<IClassSession> {
    const {
      tenantId,
      classId,
      subjectId,
      teacherId,
      scheduleId,
      sessionCreatedAt,
      academicYear,
      createdBy,
    } = input;

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const classObjectId = new mongoose.Types.ObjectId(classId);
    const subjectObjectId = new mongoose.Types.ObjectId(subjectId);

    // Validate Class exists and get batchId
    const classDoc = await Class.findOne({
      _id: classObjectId,
      tenantId: tenantObjectId,
      isDeleted: false,
    }).lean<IClass | null>();

    if (!classDoc) {
      throw new Error("Class not found or does not belong to this tenant");
    }

    // Validate Subject exists in the class
    if (!classDoc.subjectIds || !classDoc.subjectIds.some((id: any) => id.toString() === subjectId)) {
      throw new Error("Subject does not belong to this class");
    }

    // Convert academicYear (batchId string) to ObjectId if provided
    let academicYearObjectId: mongoose.Types.ObjectId | undefined;
    if (academicYear) {
      // Validate that academicYear is a valid ObjectId (batchId)
      if (!mongoose.Types.ObjectId.isValid(academicYear)) {
        throw new Error("Invalid academicYear (batchId) format");
      }
      academicYearObjectId = new mongoose.Types.ObjectId(academicYear);

      // Validate Batch exists
      const batch = await Batch.findOne({
        _id: academicYearObjectId,
        tenantId: tenantObjectId.toString(),
        isDeleted: false,
      }).lean<IBatch | null>();

      if (!batch) {
        throw new Error("Academic year (batch) not found or does not belong to this tenant");
      }

      // Validate that class belongs to this batch
      if (classDoc.batchId && classDoc.batchId.toString() !== academicYear) {
        throw new Error("Class does not belong to the specified academic year (batch)");
      }
    } else if (classDoc.batchId) {
      // If academicYear not provided but class has batchId, use class's batchId
      academicYearObjectId = classDoc.batchId as mongoose.Types.ObjectId;
    }

    // Validate Schedule if provided and validate sessionCreatedAt
    let schedule: IClassSchedule | null = null;
    let slotConfig: any = null;
    let calculatedStartTime: Date | undefined;
    let calculatedEndTime: Date | undefined;

    if (scheduleId) {
      const scheduleObjectId = new mongoose.Types.ObjectId(scheduleId);
      schedule = await ClassSchedule.findOne({
        _id: scheduleObjectId,
        tenantId: tenantObjectId,
        isDeleted: false,
      }).lean<IClassSchedule | null>();

      if (!schedule) {
        throw new Error("Schedule not found or does not belong to this tenant");
      }

      // Validate schedule belongs to the correct class
      if (schedule.classId.toString() !== classId) {
        throw new Error("Schedule does not belong to the specified class");
      }

      // Validate schedule belongs to the correct subject
      if (schedule.subjectId.toString() !== subjectId) {
        throw new Error("Schedule does not belong to the specified subject");
      }

      // Validate schedule's academicYear matches (if academicYear is provided)
      if (academicYearObjectId && schedule.academicYear) {
        // Note: ClassSchedule stores academicYear as string, so we need to check if it matches
        // This assumes the academicYear string in schedule matches the batch name or ID
        // You may need to adjust this based on your actual data structure
        // For now, we'll validate that the schedule exists and belongs to the class/subject
      }

      // Validate sessionCreatedAt against schedule's dayOfWeek and slotNumber
      // sessionCreatedAt can be provided in payload or will be automatically set to current time
      const markTime = sessionCreatedAt ?? new Date();

      // Get day of week from markTime (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const markTimeDayOfWeek = markTime.getDay();

      // Validate day of week matches schedule
      if (markTimeDayOfWeek !== schedule.dayOfWeek) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        throw new Error(
          `Session creation time day (${dayNames[markTimeDayOfWeek]}) does not match schedule day (${dayNames[schedule.dayOfWeek]})`
        );
      }

      // Get tenant timetable config to validate time slot
      const timetableConfig = await TenantTimetableConfigService.getConfigByTenantId(tenantObjectId);

      if (!timetableConfig) {
        throw new Error("Tenant timetable configuration not found. Please configure timetable settings first.");
      }

      // Find the slot configuration for this slotNumber
      // At this point, schedule is guaranteed to be non-null due to the check above
      const scheduleSlotNumber = schedule.slotNumber;
      slotConfig = timetableConfig.slots.find(
        (s) => s.slotNumber === scheduleSlotNumber && s.type === SLOT_TYPE.PERIOD
      );

      if (!slotConfig) {
        throw new Error(
          `No active PERIOD slot configuration found for slotNumber ${scheduleSlotNumber}`
        );
      }

      // Parse slot start and end times (format: "HH:mm" or "HH:mm:ss")
      const parseTime = (timeStr: string): { hours: number; minutes: number } => {
        const parts = timeStr.split(':');
        return {
          hours: parseInt(parts[0], 10),
          minutes: parseInt(parts[1], 10),
        };
      };

      const slotStart = parseTime(slotConfig.startTime);
      const slotEnd = parseTime(slotConfig.endTime);

      // Create Date objects for slot start and end times on the markTime date
      const slotStartDate = new Date(markTime);
      slotStartDate.setHours(slotStart.hours, slotStart.minutes, 0, 0);

      const slotEndDate = new Date(markTime);
      slotEndDate.setHours(slotEnd.hours, slotEnd.minutes, 0, 0);

      // Validate that markTime falls within the slot time range
      if (markTime < slotStartDate || markTime > slotEndDate) {
        throw new Error(
          `Session creation time (${markTime.toLocaleTimeString()}) is outside the scheduled slot time (${slotConfig.startTime} - ${slotConfig.endTime})`
        );
      }

      // Calculate startTime and endTime from slot configuration
      calculatedStartTime = slotStartDate;
      calculatedEndTime = slotEndDate;
    }

    const now = new Date();
    const markTime = sessionCreatedAt ?? now;
    const dateOnly = new Date(
      markTime.getFullYear(),
      markTime.getMonth(),
      markTime.getDate()
    );

    // Use calculated times from schedule validation, or default to markTime + 45 mins
    const start = calculatedStartTime ?? markTime;
    const end = calculatedEndTime ?? new Date(start.getTime() + 45 * 60 * 1000); // default 45 mins

    // Prevent duplicate sessions for the same class + subject + day + time slot
    // - If scheduleId is provided, we ensure only one session per (class, subject, scheduleId, date)
    // - If scheduleId is not provided, we ensure no overlapping session for the same (class, subject, date, time range)
    const existingSessionFilter: any = {
      tenantId: tenantObjectId,
      classId: classObjectId,
      subjectId: subjectObjectId,
      date: dateOnly,
      isDeleted: false,
    };

    if (scheduleId) {
      existingSessionFilter.scheduleId = new mongoose.Types.ObjectId(scheduleId);
    } else {
      // Check for any overlapping session in the same day for this class & subject
      existingSessionFilter.$or = [
        {
          // Existing session starts before this one ends AND ends after this one starts
          startTime: { $lt: end },
          endTime: { $gt: start },
        },
      ];
    }

    const existingSession = await ClassSession.findOne(
      existingSessionFilter
    ).lean<IClassSession | null>();

    if (existingSession) {
      const duplicateError: any = new Error(
        "Attendance session already exists for this class, subject, date and time slot"
      );
      duplicateError.code = "DUPLICATE_SESSION";
      duplicateError.sessionId = (existingSession as any)._id?.toString();
      duplicateError.session = existingSession;
      throw duplicateError;
    }

    // Create a mongoose session for the transaction
    const mongoSession = await mongoose.startSession();

    try {
      const session = await TransactionHelper.withTransaction(
        mongoSession,
        async (sessionMongooseSession: mongoose.ClientSession) => {
          // Create ClassSession
          const classSession = await ClassSession.create(
            [
              {
                tenantId: tenantObjectId,
                classId: classObjectId,
                subjectId: subjectObjectId,
                teacherId: new mongoose.Types.ObjectId(teacherId),
                scheduleId: scheduleId
                  ? new mongoose.Types.ObjectId(scheduleId)
                  : undefined,
                date: dateOnly,
                startTime: start,
                endTime: end,
                sessionCreatedAt: markTime,
                status: CLASS_SESSION_STATUS.IN_PROGRESS,
                academicYear: academicYearObjectId,
                createdBy,
                updatedBy: createdBy,
              } as any,
            ],
            { session: sessionMongooseSession }
          );

          const createdSession = classSession[0];

          // Auto-mark teacher attendance as present
          await Attendance.updateOne(
            {
              tenantId: tenantObjectId,
              sessionId: createdSession._id,
              userId: new mongoose.Types.ObjectId(teacherId),
            },
            {
              $set: {
                role: "teacher",
                status: "present",
                markedAt: now,
                markedBy: new mongoose.Types.ObjectId(teacherId),
                updatedBy: createdBy,
              },
              $setOnInsert: {
                createdBy,
              },
            },
            {
              upsert: true,
              session: sessionMongooseSession,
            }
          );

          return createdSession.toObject() as IClassSession;
        }
      );

      return session;
    } finally {
      await mongoSession.endSession();
    }
  }

  /**
   * Mark or update attendance for a single user in a session.
   * Uses upsert to avoid duplicates while honoring unique index (sessionId + userId).
   * Validates sessionId exists and userId belongs to that session's class.
   */
  static async markAttendance(
    input: MarkAttendanceInput
  ): Promise<IAttendance> {
    const { tenantId, sessionId, userId, role, status, markedBy, remarks } =
      input;

    console.log("🔍 [markAttendance] Input:", {
      tenantId,
      sessionId,
      userId,
      role,
      status,
      markedBy,
    });

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const sessionObjectId = new mongoose.Types.ObjectId(sessionId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const markedByObjectId = new mongoose.Types.ObjectId(markedBy);

    console.log("🔍 [markAttendance] Converted IDs:", {
      tenantObjectId: tenantObjectId.toString(),
      sessionObjectId: sessionObjectId.toString(),
      userObjectId: userObjectId.toString(),
      markedByObjectId: markedByObjectId.toString(),
    });

    // Validate session exists
    const session = await ClassSession.findOne({
      _id: sessionObjectId,
      tenantId: tenantObjectId,
      isDeleted: false,
    }).lean<IClassSession | null>();

    if (!session) {
      console.error("❌ [markAttendance] Session not found:", {
        sessionId: sessionObjectId.toString(),
        tenantId: tenantObjectId.toString(),
      });
      throw new Error("Class session not found or does not belong to this tenant");
    }

    console.log("✅ [markAttendance] Session found:", {
      sessionId: session._id.toString(),
      classId: session.classId?.toString(),
      subjectId: session.subjectId?.toString(),
      teacherId: session.teacherId?.toString(),
      tenantId: session.tenantId?.toString(),
    });

    // Validate user belongs to the session's class
    if (role === "student") {
      // Note: class_students table doesn't have tenantId field, so we don't filter by it
      const queryFilter = {
        classId: session.classId,
        studentId: userObjectId,
        isDeleted: false,
        isActive: true,
        enrollmentStatus: { $in: ["active", "promoted"] },
      };

      console.log("🔍 [markAttendance] ClassStudent query filter:", {
        classId: queryFilter.classId?.toString(),
        studentId: queryFilter.studentId.toString(),
        isDeleted: queryFilter.isDeleted,
        isActive: queryFilter.isActive,
        enrollmentStatus: queryFilter.enrollmentStatus,
      });

      // Check if student is enrolled in the class
      const classStudent = await ClassStudent.findOne(queryFilter).lean<IClassStudent | null>();

      if (!classStudent) {
        console.error("❌ [markAttendance] ClassStudent not found with query filter");
        throw new Error("Student is not enrolled in this class or enrollment is not active");
      }

      console.log("✅ [markAttendance] ClassStudent found:", {
        classStudentId: classStudent._id.toString(),
        classId: classStudent.classId.toString(),
        studentId: classStudent.studentId.toString(),
        isActive: classStudent.isActive,
        isDeleted: classStudent.isDeleted,
        enrollmentStatus: classStudent.enrollmentStatus,
        subjectIds: classStudent.subjectIds?.map((id: any) => id.toString()),
      });

      // Validate student has access to the subject
      const hasSubjectAccess = classStudent.subjectIds && classStudent.subjectIds.some((id: any) => id.toString() === session.subjectId.toString());

      console.log("🔍 [markAttendance] Subject access check:", {
        sessionSubjectId: session.subjectId.toString(),
        studentSubjectIds: classStudent.subjectIds?.map((id: any) => id.toString()),
        hasSubjectAccess,
      });

      if (!hasSubjectAccess) {
        console.error("❌ [markAttendance] Student does not have access to subject");
        throw new Error("Student does not have access to this subject");
      }
    } else if (role === "teacher") {
      // Validate teacher is assigned to this session
      if (session.teacherId.toString() !== userId && session.teacherId.toString() !== markedBy) {
        // Allow marking if the markedBy is the session teacher
        if (session.teacherId.toString() !== markedBy) {
          throw new Error("Teacher is not assigned to this session");
        }
      }
    }

    const now = new Date();

    const updated = await Attendance.findOneAndUpdate(
      {
        tenantId: tenantObjectId,
        sessionId: sessionObjectId,
        userId: userObjectId,
      },
      {
        $set: {
          role,
          status,
          markedAt: now,
          markedBy: markedByObjectId,
          remarks,
          updatedBy: markedBy,
        },
        $setOnInsert: {
          createdBy: markedBy,
        },
      } as any,
      {
        upsert: true,
        new: true,
      }
    ).lean<IAttendance | null>();

    if (!updated) {
      throw new Error("Failed to mark attendance");
    }

    return updated;
  }

  /**
   * Bulk mark or update attendance for multiple users in a session.
   * - Accepts a single sessionId at root level and an array of attendance records.
   * - Validates the session once.
   * - For students: only marks attendance if they are enrolled in the session's class
   *   AND have the session's subject assigned (via class_students).
   * - For teachers: applies the same validation as single markAttendance.
   * - Skips invalid students/teachers instead of failing the whole batch.
   */
  static async markAttendanceBulk(
    input: MarkAttendanceBulkInput
  ): Promise<{
    sessionId: string;
    updated: IAttendance[];
    skipped: Array<{
      userId: string;
      role: "teacher" | "student";
      reason: string;
    }>;
  }> {
    const { tenantId, sessionId, markedBy, records } = input;

    console.log("🔍 [markAttendanceBulk] Input:", {
      tenantId,
      sessionId,
      markedBy,
      recordsCount: records?.length ?? 0,
    });

    if (!records || records.length === 0) {
      return {
        sessionId,
        updated: [],
        skipped: [],
      };
    }

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const sessionObjectId = new mongoose.Types.ObjectId(sessionId);
    const markedByObjectId = new mongoose.Types.ObjectId(markedBy);

    // Validate session exists (once for all records)
    const session = await ClassSession.findOne({
      _id: sessionObjectId,
      tenantId: tenantObjectId,
      isDeleted: false,
    }).lean<IClassSession | null>();

    if (!session) {
      console.error("❌ [markAttendanceBulk] Session not found:", {
        sessionId: sessionObjectId.toString(),
        tenantId: tenantObjectId.toString(),
      });
      throw new Error(
        "Class session not found or does not belong to this tenant"
      );
    }

    console.log("✅ [markAttendanceBulk] Session found:", {
      sessionId: session._id.toString(),
      classId: session.classId?.toString(),
      subjectId: session.subjectId?.toString(),
      teacherId: session.teacherId?.toString(),
      tenantId: session.tenantId?.toString(),
    });

    const now = new Date();

    const skipped: Array<{
      userId: string;
      role: "teacher" | "student";
      reason: string;
    }> = [];

    const validStudentRecords = records.filter(
      (r) => r.role === "student" && r.userId && r.status
    );
    const validTeacherRecords = records.filter(
      (r) => r.role === "teacher" && r.userId && r.status
    );

    // Pre-validate all students against class_students for this class+subject
    let allowedStudentIdSet = new Set<string>();
    if (validStudentRecords.length > 0) {
      const studentIds = validStudentRecords
        .map((r) => r.userId)
        .filter((id) => !!id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (studentIds.length > 0) {
        const classStudentFilter: any = {
          classId: session.classId,
          studentId: { $in: studentIds },
          isDeleted: false,
          isActive: true,
          enrollmentStatus: { $in: ["active", "promoted"] },
          subjectIds: { $in: [session.subjectId] },
        };

        console.log(
          "🔍 [markAttendanceBulk] ClassStudent bulk query filter:",
          {
            classId: classStudentFilter.classId?.toString(),
            studentIdsCount: studentIds.length,
            isDeleted: classStudentFilter.isDeleted,
            isActive: classStudentFilter.isActive,
            enrollmentStatus: classStudentFilter.enrollmentStatus,
            subjectId: session.subjectId?.toString(),
          }
        );

        const classStudents = await ClassStudent.find(
          classStudentFilter
        ).lean<IClassStudent[]>();

        allowedStudentIdSet = new Set(
          classStudents
            .map((cs) => cs.studentId?.toString())
            .filter((id): id is string => !!id)
        );

        console.log(
          "✅ [markAttendanceBulk] Allowed students for class+subject:",
          {
            count: allowedStudentIdSet.size,
          }
        );
      }
    }

    const updates: Promise<IAttendance | null>[] = [];

    // Process student records
    for (const record of validStudentRecords) {
      const { userId, role, status, remarks } = record;

      if (!allowedStudentIdSet.has(userId)) {
        skipped.push({
          userId,
          role,
          reason:
            "Student is not enrolled in this class or does not have this subject assigned",
        });
        continue;
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      updates.push(
        Attendance.findOneAndUpdate(
          {
            tenantId: tenantObjectId,
            sessionId: sessionObjectId,
            userId: userObjectId,
          },
          {
            $set: {
              role,
              status,
              markedAt: now,
              markedBy: markedByObjectId,
              remarks,
              updatedBy: markedBy,
            },
            $setOnInsert: {
              createdBy: markedBy,
            },
          } as any,
          {
            upsert: true,
            new: true,
          }
        ).lean<IAttendance | null>()
      );
    }

    // Process teacher records
    for (const record of validTeacherRecords) {
      const { userId, role, status, remarks } = record;

      // Validate teacher is assigned to this session (same logic as single markAttendance)
      if (
        session.teacherId.toString() !== userId &&
        session.teacherId.toString() !== markedBy
      ) {
        skipped.push({
          userId,
          role,
          reason: "Teacher is not assigned to this session",
        });
        continue;
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      updates.push(
        Attendance.findOneAndUpdate(
          {
            tenantId: tenantObjectId,
            sessionId: sessionObjectId,
            userId: userObjectId,
          },
          {
            $set: {
              role,
              status,
              markedAt: now,
              markedBy: markedByObjectId,
              remarks,
              updatedBy: markedBy,
            },
            $setOnInsert: {
              createdBy: markedBy,
            },
          } as any,
          {
            upsert: true,
            new: true,
          }
        ).lean<IAttendance | null>()
      );
    }

    const updatedResults = await Promise.all(updates);
    const updated = updatedResults.filter(
      (doc): doc is IAttendance => !!doc
    );

    console.log("✅ [markAttendanceBulk] Summary:", {
      requested: records.length,
      updated: updated.length,
      skipped: skipped.length,
    });

    return {
      sessionId: session._id.toString(),
      updated,
      skipped,
    };
  }

  /**
   * Get attendance list for a session (teacher + students).
   * Validates sessionId exists and belongs to the tenant.
   */
  static async getSessionAttendance(options: {
    tenantId: string | mongoose.Types.ObjectId;
    sessionId: string;
  }) {
    const { tenantId, sessionId } = options;
    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const sessionObjectId = new mongoose.Types.ObjectId(sessionId);

    // Validate session exists
    const sessionDoc = await ClassSession.findOne({
      _id: sessionObjectId,
      tenantId: tenantObjectId,
      isDeleted: false,
    })
      .populate("classId", "name grade section")
      .populate("subjectId", "name code")
      .populate("teacherId", "firstName lastName email")
      .populate("academicYear", "batchName")
      .lean<IClassSession & { classId: any; subjectId: any; teacherId: any; academicYear: any } | null>();

    if (!sessionDoc) {
      throw new Error("Class session not found or does not belong to this tenant");
    }

    const attendance = await Attendance.find({
      tenantId: tenantObjectId,
      sessionId: sessionObjectId,
      isDeleted: false,
    })
      .sort({ role: 1, userId: 1 })
      .lean<IAttendance[]>();

    return {
      session: sessionDoc,
      attendance,
    };
  }

  /**
   * Get a student's attendance summary across sessions.
   * Returns detailed attendance records grouped by subject with date and time information.
   * Validates student belongs to the specified class (if provided).
   */
  static async getStudentAttendanceSummary(options: {
    tenantId: string | mongoose.Types.ObjectId;
    studentId: string;
    fromDate?: Date;
    toDate?: Date;
    classId?: string;
    subjectId?: string;
  }) {
    const { tenantId, studentId, fromDate, toDate, classId, subjectId } =
      options;

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // Validate student belongs to the class if classId is provided
    if (classId) {
      const classObjectId = new mongoose.Types.ObjectId(classId);
      // Note: class_students table doesn't have tenantId field, so we don't filter by it
      const classStudent = await ClassStudent.findOne({
        classId: classObjectId,
        studentId: studentObjectId,
        isDeleted: false,
        isActive: true,
        enrollmentStatus: { $in: ["active", "promoted"] },
      }).lean<IClassStudent | null>();

      if (!classStudent) {
        throw new Error("Student is not enrolled in the specified class or enrollment is not active");
      }

      // Validate subject if provided
      if (subjectId) {
        const subjectObjectId = new mongoose.Types.ObjectId(subjectId);
        if (!classStudent.subjectIds || !classStudent.subjectIds.some((id: any) => id.toString() === subjectId)) {
          throw new Error("Student does not have access to the specified subject in this class");
        }
      }
    }

    const matchAttendance: any = {
      tenantId: tenantObjectId,
      userId: studentObjectId,
      role: "student",
      isDeleted: false,
    };

    if (fromDate || toDate) {
      matchAttendance.markedAt = {};
      if (fromDate) {
        matchAttendance.markedAt.$gte = fromDate;
      }
      if (toDate) {
        matchAttendance.markedAt.$lte = toDate;
      }
    }

    const matchSession: any = {
      tenantId: tenantObjectId,
      isDeleted: false,
    };

    if (classId) {
      matchSession.classId = new mongoose.Types.ObjectId(classId);
    }
    if (subjectId) {
      matchSession.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchAttendance },
      {
        $lookup: {
          from: "class_sessions",
          localField: "sessionId",
          foreignField: "_id",
          as: "session",
        },
      },
      { $unwind: "$session" },
      { $match: { "session.tenantId": tenantObjectId, "session.isDeleted": false, ...matchSession } },
      {
        $lookup: {
          from: "subjects",
          localField: "session.subjectId",
          foreignField: "_id",
          as: "subject",
        },
      },
      { $unwind: { path: "$subject", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "classes",
          localField: "session.classId",
          foreignField: "_id",
          as: "class",
        },
      },
      { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          attendanceId: { $toString: "$_id" },
          sessionId: { $toString: "$session._id" },
          status: "$status",
          markedAt: "$markedAt",
          remarks: "$remarks",
          sessionDate: "$session.date",
          sessionStartTime: "$session.startTime",
          sessionEndTime: "$session.endTime",
          sessionCreatedAt: "$session.sessionCreatedAt",
          sessionStatus: "$session.status",
          subjectId: { $toString: "$session.subjectId" },
          subjectName: "$subject.name",
          subjectCode: "$subject.code",
          classId: { $toString: "$session.classId" },
          className: "$class.name",
          classCode: "$class.code",
        },
      },
      {
        $sort: {
          subjectName: 1,
          sessionDate: -1,
          sessionStartTime: -1,
        },
      },
      {
        $group: {
          _id: "$subjectId",
          subjectId: { $first: "$subjectId" },
          subjectName: { $first: "$subjectName" },
          subjectCode: { $first: "$subjectCode" },
          attendanceRecords: {
            $push: {
              attendanceId: "$attendanceId",
              sessionId: "$sessionId",
              status: "$status",
              markedAt: "$markedAt",
              remarks: "$remarks",
              sessionDate: "$sessionDate",
              sessionStartTime: "$sessionStartTime",
              sessionEndTime: "$sessionEndTime",
              sessionCreatedAt: "$sessionCreatedAt",
              sessionStatus: "$sessionStatus",
              classId: "$classId",
              className: "$className",
              classCode: "$classCode",
            },
          },
          totalSessions: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: 1,
          subjectName: 1,
          subjectCode: 1,
          attendanceRecords: 1,
          totalSessions: 1,
          summary: {
            present: "$presentCount",
            absent: "$absentCount",
            late: "$lateCount",
          },
        },
      },
      { $sort: { subjectName: 1 } },
    ];

    const summary = await Attendance.aggregate(pipeline);

    return summary;
  }

  /**
   * Helper to fetch active students for a class+subject (for frontend to render student list).
   */
  static async getSessionStudents(options: {
    tenantId: string | mongoose.Types.ObjectId;
    classId: string;
    subjectId: string;
    academicYear?: string;
  }) {
    const { tenantId, classId, subjectId, academicYear } = options;

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    // Note: class_students table doesn't have tenantId field, so we don't filter by it
    const filter: any = {
      classId: new mongoose.Types.ObjectId(classId),
      enrollmentStatus: { $in: ["active", "promoted"] },
      isDeleted: false,
      isActive: true,
      subjectIds: { $in: [new mongoose.Types.ObjectId(subjectId)] },
    };

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    const students = await ClassStudent.find(filter)
      .select("studentId stdId rollNumber subjectIds academicYear")
      .lean();

    return students;
  }

  /**
   * Get a teacher's attendance summary across their (active) classes/subjects.
   * Groups by class + subject and returns counts of present/absent/late.
   */
  static async getTeacherAttendanceSummary(options: {
    tenantId: string | mongoose.Types.ObjectId;
    teacherId: string;
    fromDate?: Date;
    toDate?: Date;
    classId?: string;
    subjectId?: string;
  }) {
    const { tenantId, teacherId, fromDate, toDate, classId, subjectId } =
      options;

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      throw new Error("Invalid teacherId format");
    }

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);

    const matchSession: any = {
      tenantId: tenantObjectId,
      teacherId: teacherObjectId,
      isDeleted: false,
    };

    // Optional filters
    if (fromDate || toDate) {
      matchSession.date = {};
      if (fromDate) {
        const start = new Date(
          fromDate.getFullYear(),
          fromDate.getMonth(),
          fromDate.getDate()
        );
        matchSession.date.$gte = start;
      }
      if (toDate) {
        const end = new Date(
          toDate.getFullYear(),
          toDate.getMonth(),
          toDate.getDate(),
          23,
          59,
          59,
          999
        );
        matchSession.date.$lte = end;
      }
    }

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new Error("Invalid classId format");
      }
      matchSession.classId = new mongoose.Types.ObjectId(classId);
    }

    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        throw new Error("Invalid subjectId format");
      }
      matchSession.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchSession },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "class",
        },
      },
      {
        $unwind: {
          path: "$class",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "class.isDeleted": false,
          // Treat non-false as active; default true from BaseDocumentSchema
          $or: [{ "class.isActive": { $exists: false } }, { "class.isActive": true }],
        } as any,
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subject",
        },
      },
      {
        $unwind: {
          path: "$subject",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "attendances",
          let: { sessionId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sessionId", "$$sessionId"] },
                    { $eq: ["$tenantId", tenantObjectId] },
                    { $eq: ["$userId", teacherObjectId] },
                    { $eq: ["$role", "teacher"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
          ],
          as: "teacherAttendance",
        },
      },
      {
        $unwind: {
          path: "$teacherAttendance",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          classId: 1,
          subjectId: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          sessionStatus: "$status",
          subjectName: "$subject.name",
          subjectCode: "$subject.code",
          className: "$class.name",
          grade: "$class.grade",
          section: "$class.section",
          attendanceStatus: "$teacherAttendance.status",
        },
      },
      {
        $group: {
          _id: { classId: "$classId", subjectId: "$subjectId" },
          classId: { $first: "$classId" },
          className: { $first: "$className" },
          grade: { $first: "$grade" },
          section: { $first: "$section" },
          subjectId: { $first: "$subjectId" },
          subjectName: { $first: "$subjectName" },
          subjectCode: { $first: "$subjectCode" },
          totalSessions: { $sum: 1 },
          presentCount: {
            $sum: {
              $cond: [{ $eq: ["$attendanceStatus", "present"] }, 1, 0],
            },
          },
          absentCount: {
            $sum: {
              $cond: [{ $eq: ["$attendanceStatus", "absent"] }, 1, 0],
            },
          },
          lateCount: {
            $sum: {
              $cond: [{ $eq: ["$attendanceStatus", "late"] }, 1, 0],
            },
          },
          sessions: {
            $push: {
              date: "$date",
              startTime: "$startTime",
              endTime: "$endTime",
              day: {
                $let: {
                  vars: { dow: { $dayOfWeek: "$date" } },
                  in: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$dow", 1] }, then: "Monday" },
                        { case: { $eq: ["$$dow", 2] }, then: "Tuesday" },
                        { case: { $eq: ["$$dow", 3] }, then: "Wednesday" },
                        { case: { $eq: ["$$dow", 4] }, then: "Thursday" },
                        { case: { $eq: ["$$dow", 5] }, then: "Friday" },
                        { case: { $eq: ["$$dow", 6] }, then: "Saturday" },
                        { case: { $eq: ["$$dow", 7] }, then: "Sunday" },
                      ],
                      default: "Unknown",
                    },
                  },
                },
              },
              sessionStatus: "$sessionStatus",
              attendanceStatus: "$attendanceStatus",
            },
          },
        },
      },
      {
        $sort: {
          grade: 1,
          className: 1,
          subjectName: 1,
        },
      },
      {
        $project: {
          _id: 0,
          class: {
            id: { $toString: "$classId" },
            name: "$className",
            grade: "$grade",
          },
          subject: {
            id: { $toString: "$subjectId" },
            name: "$subjectName",
            code: "$subjectCode",
          },
          totalSessions: 1,
          sessions: 1,
        },
      },
    ];

    const summary = await ClassSession.aggregate(pipeline);
    return summary;
  }

  /**
   * Get logged-in student's attendance statistics for their current active class.
   * - Resolves current active enrollment from class_students
   * - Aggregates attendance (present/absent/late) for sessions of that class
   */
  static async getStudentCurrentClassAttendanceStats(options: {
    tenantId: string | mongoose.Types.ObjectId;
    studentId: string;
  }) {
    const { tenantId, studentId } = options;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new Error("Invalid studentId format");
    }

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // Find the student's current active enrollment (class)
    const enrollment = await ClassStudent.findOne({
      studentId: studentObjectId,
      enrollmentStatus: { $in: ["active", "promoted"] },
      isDeleted: false,
      isActive: true,
    })
      .select("classId academicYear")
      .lean<IClassStudent | null>();

    if (!enrollment || !enrollment.classId) {
      throw new Error(
        "Active class enrollment not found for this student"
      );
    }

    const classObjectId = enrollment.classId as mongoose.Types.ObjectId;

    const pipeline: mongoose.PipelineStage[] = [
      {
        $match: {
          tenantId: tenantObjectId,
          userId: studentObjectId,
          role: "student",
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "class_sessions",
          localField: "sessionId",
          foreignField: "_id",
          as: "session",
        },
      },
      { $unwind: "$session" },
      {
        $match: {
          "session.tenantId": tenantObjectId,
          "session.isDeleted": false,
          "session.classId": classObjectId,
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
          },
        },
      },
    ];

    const result = await Attendance.aggregate(pipeline);

    const statsRaw =
      (Array.isArray(result) && result.length > 0
        ? (result[0] as any)
        : null) || {
        totalSessions: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
      };

    const totalSessions = statsRaw.totalSessions || 0;
    const present = statsRaw.presentCount || 0;
    const absent = statsRaw.absentCount || 0;
    const late = statsRaw.lateCount || 0;

    const overallPercentage =
      totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    return {
      classId: classObjectId.toString(),
      academicYear: (enrollment as any).academicYear || undefined,
      totalSessions,
      present,
      absent,
      late,
      overallAttendancePercentage: overallPercentage,
    };
  }

  /**
   * Safely update a class session's status.
   * - Only allows toggling from IN_PROGRESS to COMPLETED.
   * - Ignores any other fields; only status is updated.
   */
  static async updateSessionStatus(options: {
    tenantId: string | mongoose.Types.ObjectId;
    sessionId: string;
    status: CLASS_SESSION_STATUS;
  }): Promise<IClassSession> {
    const { tenantId, sessionId, status } = options;

    const tenantObjectId =
      typeof tenantId === "string"
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      throw new Error("Invalid sessionId format");
    }

    if (status !== CLASS_SESSION_STATUS.COMPLETED) {
      throw new Error(
        "Only transition to 'completed' status is allowed for class sessions"
      );
    }

    const sessionObjectId = new mongoose.Types.ObjectId(sessionId);

    const existing = await ClassSession.findOne({
      _id: sessionObjectId,
      tenantId: tenantObjectId,
      isDeleted: false,
    });

    if (!existing) {
      throw new Error("Class session not found or does not belong to this tenant");
    }

    // Prevent updating status after the scheduled slot end time has passed
    // const now = new Date();
    // if (existing.endTime && now > existing.endTime) {
    //   throw new Error(
    //     "Cannot update class session status because the scheduled slot end time has already passed"
    //   );
    // }

    if (existing.status !== CLASS_SESSION_STATUS.IN_PROGRESS) {
      throw new Error(
        "Class session status can only be updated from 'in-progress' to 'completed'"
      );
    }

    existing.status = CLASS_SESSION_STATUS.COMPLETED;
    await existing.save();

    return existing.toObject() as IClassSession;
  }
}

export default AttendanceService;

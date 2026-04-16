import mongoose from 'mongoose';
import { TeacherActivityLog, ITeacherActivityLog } from '../models/teacherActivityLog.schema';
import { StudentActivityLog, IStudentActivityLog } from '../models/studentActivityLog.schema';

/**
 * Activity Log Repository - Data access layer for activity log management
 */

// Create teacher activity log
export const createTeacherActivityLog = async (
  data: {
    teacherId: string;
    activityType: ITeacherActivityLog['activityType'];
    activityDescription: string;
    relatedEntityId: string;
    relatedEntityType: string;
    classId: string;
    subjectId: string;
    studentId?: string;
    tenantId: string;
  },
  session?: mongoose.ClientSession
): Promise<ITeacherActivityLog> => {
  try {
    const logData = {
      teacherId: new mongoose.Types.ObjectId(data.teacherId),
      activityType: data.activityType,
      activityDescription: data.activityDescription,
      relatedEntityId: new mongoose.Types.ObjectId(data.relatedEntityId),
      relatedEntityType: data.relatedEntityType,
      classId: new mongoose.Types.ObjectId(data.classId),
      subjectId: new mongoose.Types.ObjectId(data.subjectId),
      tenantId: new mongoose.Types.ObjectId(data.tenantId),
      ...(data.studentId && { studentId: new mongoose.Types.ObjectId(data.studentId) })
    };

    const log = new TeacherActivityLog(logData);
    if (session) {
      return await log.save({ session });
    }
    return await log.save();
  } catch (error: any) {
    console.error('Error creating teacher activity log:', error);
    throw error;
  }
};

// Create student activity log
export const createStudentActivityLog = async (
  data: {
    studentId: string;
    activityType: IStudentActivityLog['activityType'];
    activityDescription: string;
    relatedEntityId: string;
    relatedEntityType: string;
    classId: string;
    subjectId: string;
    tenantId: string;
  },
  session?: mongoose.ClientSession
): Promise<IStudentActivityLog> => {
  try {
    const logData = {
      studentId: new mongoose.Types.ObjectId(data.studentId),
      activityType: data.activityType,
      activityDescription: data.activityDescription,
      relatedEntityId: new mongoose.Types.ObjectId(data.relatedEntityId),
      relatedEntityType: data.relatedEntityType,
      classId: new mongoose.Types.ObjectId(data.classId),
      subjectId: new mongoose.Types.ObjectId(data.subjectId),
      tenantId: new mongoose.Types.ObjectId(data.tenantId)
    };

    const log = new StudentActivityLog(logData);
    if (session) {
      return await log.save({ session });
    }
    return await log.save();
  } catch (error: any) {
    console.error('Error creating student activity log:', error);
    throw error;
  }
};

// Find activity logs with filters
export const findActivityLogs = async (filters: {
  tenantId: string;
  userType?: 'teacher' | 'student';
  userId?: string;
  classId?: string;
  classIds?: string[]; // Added support for multiple class IDs
  subjectId?: string;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ teacherLogs: ITeacherActivityLog[]; studentLogs: IStudentActivityLog[] }> => {
  try {
    const { tenantId, userType, userId, classId, classIds, subjectId, activityType, startDate, endDate, month, year, limit = 50, offset = 0 } = filters;

    const tenantIdObj = new mongoose.Types.ObjectId(tenantId);
    const dateFilter: any = {};

    // Build date filter
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = startDate;
      if (endDate) dateFilter.createdAt.$lte = endDate;
    } else if (month !== undefined && year !== undefined) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter.createdAt = { $gte: start, $lte: end };
    }

    const teacherQuery: any = { tenantId: tenantIdObj, ...dateFilter };
    const studentQuery: any = { tenantId: tenantIdObj, ...dateFilter };

    if (classId) {
      // Validate classId before converting to ObjectId
      if (mongoose.Types.ObjectId.isValid(classId)) {
        teacherQuery.classId = new mongoose.Types.ObjectId(classId);
        studentQuery.classId = new mongoose.Types.ObjectId(classId);
      } else {
        console.warn(`⚠️ Invalid classId format: ${classId}, skipping classId filter`);
      }
    } else if (classIds && classIds.length > 0) {
      // Filter by multiple classIds (e.g., for a teacher)
      const classIdObjs = classIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

      if (classIdObjs.length > 0) {
        teacherQuery.classId = { $in: classIdObjs };
        studentQuery.classId = { $in: classIdObjs };
      }
    }

    if (subjectId) {
      // Validate subjectId before converting to ObjectId
      if (mongoose.Types.ObjectId.isValid(subjectId)) {
        teacherQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
        studentQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
      } else {
        console.warn(`⚠️ Invalid subjectId format: ${subjectId}, skipping subjectId filter`);
      }
    }

    if (activityType) {
      teacherQuery.activityType = activityType;
      studentQuery.activityType = activityType;
    }

    if (userId) {
      if (userType === 'teacher') {
        teacherQuery.teacherId = new mongoose.Types.ObjectId(userId);
      } else if (userType === 'student') {
        studentQuery.studentId = new mongoose.Types.ObjectId(userId);
      }
    }

    const teacherLogsPromise = (userType === undefined || userType === 'teacher')
      ? TeacherActivityLog.find(teacherQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean()
      : Promise.resolve([]);

    const studentLogsPromise = (userType === undefined || userType === 'student')
      ? StudentActivityLog.find(studentQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean()
      : Promise.resolve([]);

    const [teacherLogs, studentLogs] = await Promise.all([teacherLogsPromise, studentLogsPromise]);

    return {
      teacherLogs: teacherLogs as ITeacherActivityLog[],
      studentLogs: studentLogs as IStudentActivityLog[]
    };
  } catch (error: any) {
    console.error('Error finding activity logs:', error);
    throw error;
  }
};

// Find teacher activity logs
export const findTeacherActivityLogs = async (filters: {
  tenantId: string;
  teacherId?: string;
  classId?: string;
  classIds?: string[]; // Added support for multiple class IDs
  subjectId?: string;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<ITeacherActivityLog[]> => {
  try {
    const { tenantId, teacherId, classId, classIds, subjectId, activityType, startDate, endDate, month, year, limit = 50, offset = 0 } = filters;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (teacherId) query.teacherId = new mongoose.Types.ObjectId(teacherId);
    if (classId) {
      query.classId = new mongoose.Types.ObjectId(classId);
    } else if (classIds && classIds.length > 0) {
      const classIdObjs = classIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (classIdObjs.length > 0) {
        query.classId = { $in: classIdObjs };
      }
    }
    if (subjectId) query.subjectId = new mongoose.Types.ObjectId(subjectId);
    if (activityType) query.activityType = activityType;

    // Build date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    } else if (month !== undefined && year !== undefined) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const logs = await TeacherActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return logs as ITeacherActivityLog[];
  } catch (error: any) {
    console.error('Error finding teacher activity logs:', error);
    throw error;
  }
};

// Find student activity logs
export const findStudentActivityLogs = async (filters: {
  tenantId: string;
  studentId?: string;
  classId?: string;
  classIds?: string[]; // Added support for multiple class IDs
  subjectId?: string;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<IStudentActivityLog[]> => {
  try {
    const { tenantId, studentId, classId, classIds, subjectId, activityType, startDate, endDate, month, year, limit = 50, offset = 0 } = filters;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (studentId) query.studentId = new mongoose.Types.ObjectId(studentId);
    if (classId) {
      query.classId = new mongoose.Types.ObjectId(classId);
    } else if (classIds && classIds.length > 0) {
      const classIdObjs = classIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (classIdObjs.length > 0) {
        query.classId = { $in: classIdObjs };
      }
    }
    if (subjectId) query.subjectId = new mongoose.Types.ObjectId(subjectId);
    if (activityType) query.activityType = activityType;

    // Build date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    } else if (month !== undefined && year !== undefined) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const logs = await StudentActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    return logs as IStudentActivityLog[];
  } catch (error: any) {
    console.error('Error finding student activity logs:', error);
    throw error;
  }
};

// Count teacher activity logs
export const countTeacherActivityLogs = async (filters: {
  tenantId: string;
  teacherId?: string;
  classId?: string;
  classIds?: string[]; // Added support for multiple class IDs
  subjectId?: string;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
}): Promise<number> => {
  try {
    const { tenantId, teacherId, classId, classIds, subjectId, activityType, startDate, endDate, month, year } = filters;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (teacherId) query.teacherId = new mongoose.Types.ObjectId(teacherId);
    if (classId) {
      if (mongoose.Types.ObjectId.isValid(classId)) {
        query.classId = new mongoose.Types.ObjectId(classId);
      } else {
        console.warn(`⚠️ Invalid classId format: ${classId}, skipping classId filter`);
      }
    } else if (classIds && classIds.length > 0) {
      const classIdObjs = classIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (classIdObjs.length > 0) {
        query.classId = { $in: classIdObjs };
      }
    }
    if (subjectId) {
      if (mongoose.Types.ObjectId.isValid(subjectId)) {
        query.subjectId = new mongoose.Types.ObjectId(subjectId);
      } else {
        console.warn(`⚠️ Invalid subjectId format: ${subjectId}, skipping subjectId filter`);
      }
    }
    if (activityType) query.activityType = activityType;

    // Build date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    } else if (month !== undefined && year !== undefined) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const count = await TeacherActivityLog.countDocuments(query);
    return count;
  } catch (error: any) {
    console.error('Error counting teacher activity logs:', error);
    throw error;
  }
};

// Count student activity logs
export const countStudentActivityLogs = async (filters: {
  tenantId: string;
  studentId?: string;
  classId?: string;
  classIds?: string[]; // Added support for multiple class IDs
  subjectId?: string;
  activityType?: string;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
}): Promise<number> => {
  try {
    const { tenantId, studentId, classId, classIds, subjectId, activityType, startDate, endDate, month, year } = filters;

    const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

    if (studentId) query.studentId = new mongoose.Types.ObjectId(studentId);
    if (classId) {
      if (mongoose.Types.ObjectId.isValid(classId)) {
        query.classId = new mongoose.Types.ObjectId(classId);
      } else {
        console.warn(`⚠️ Invalid classId format: ${classId}, skipping classId filter`);
      }
    } else if (classIds && classIds.length > 0) {
      const classIdObjs = classIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (classIdObjs.length > 0) {
        query.classId = { $in: classIdObjs };
      }
    }
    if (subjectId) {
      if (mongoose.Types.ObjectId.isValid(subjectId)) {
        query.subjectId = new mongoose.Types.ObjectId(subjectId);
      } else {
        console.warn(`⚠️ Invalid subjectId format: ${subjectId}, skipping subjectId filter`);
      }
    }
    if (activityType) query.activityType = activityType;

    // Build date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    } else if (month !== undefined && year !== undefined) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const count = await StudentActivityLog.countDocuments(query);
    return count;
  } catch (error: any) {
    console.error('Error counting student activity logs:', error);
    throw error;
  }
};

// Find class-wise activity logs
export const findClassActivityLogs = async (filters: {
  tenantId: string;
  classId: string;
  userType?: 'teacher' | 'student';
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ teacherLogs: ITeacherActivityLog[]; studentLogs: IStudentActivityLog[] }> => {
  return findActivityLogs({
    ...filters,
    classId: filters.classId,
    userType: filters.userType
  });
};

// Find subject-wise activity logs
export const findSubjectActivityLogs = async (filters: {
  tenantId: string;
  subjectId: string;
  userType?: 'teacher' | 'student';
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ teacherLogs: ITeacherActivityLog[]; studentLogs: IStudentActivityLog[] }> => {
  return findActivityLogs({
    ...filters,
    subjectId: filters.subjectId,
    userType: filters.userType
  });
};



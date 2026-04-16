import { Student, IStudent, ExamStudent } from "../models";
import mongoose, { SortOrder } from "mongoose";
import { StudentQueryParams, StudentStatistics } from "../types/student.types";

/**
 * Student Repository - Data access layer for student operations
 * Handles all database operations for students
 */

// Create new student
export const createStudent = async (
  studentData: Partial<IStudent>,
  session?: mongoose.ClientSession
): Promise<IStudent> => {
  try {
    const student = new Student(studentData);
    if (session) {
      const savedStudent = await student.save({ session });
      return savedStudent;
    }
    const savedStudent = await student.save();
    return savedStudent;
  } catch (error: any) {
    console.error("Error creating student:", error);
    throw error;
  }
};

/**
 * Bulk insert students (for bulk upload). Does not run save middleware (e.g. stdId must be set on docs).
 */
export const insertManyStudents = async (
  studentDocs: Partial<IStudent>[],
  session?: mongoose.ClientSession
): Promise<IStudent[]> => {
  if (studentDocs.length === 0) return [];
  try {
    const options = session ? { session } : {};
    const inserted = await Student.insertMany(studentDocs, options);
    return inserted as IStudent[];
  } catch (error: any) {
    console.error("Error bulk inserting students:", error);
    throw error;
  }
};

// Find student by ID
export const findStudentById = async (id: string): Promise<IStudent | null> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      isDeleted: false,
    });
    return student;
  } catch (error: any) {
    console.error("Error finding student by ID:", error);
    throw error;
  }
};

// Note: Removed findStudentByUserId as we no longer use userId references

// Find student by student ID
export const findStudentByStudentId = async (
  studentId: string,
  tenantId?: string
): Promise<IStudent | null> => {
  try {
    const query: any = {
      studentId: studentId,
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const student = await Student.findOne(query);
    return student;
  } catch (error: any) {
    console.error("Error finding student by student ID:", error);
    throw error;
  }
};

// Find student by roll number (tenant and class-specific)
export const findStudentByRollNumber = async (
  rollNumber: string,
  tenantId: string,
  classId?: string
): Promise<IStudent | null> => {
  try {
    const query: any = {
      rollNumber: rollNumber,
      tenantId: tenantId,
      isDeleted: false,
    };

    // Include classId in query if provided (for uniqueness per class per tenant)
    if (classId) {
      query.classId = classId;
    }

    const student = await Student.findOne(query);
    return student;
  } catch (error: any) {
    console.error("Error finding student by roll number:", error);
    throw error;
  }
};

// Find student by email (tenant-specific)
export const findStudentByEmail = async (
  email: string,
  tenantId: string
): Promise<IStudent | null> => {
  try {
    const query: any = {
      email: email.toLowerCase(),
      tenantId: tenantId,
      isDeleted: false,
    };

    const student = await Student.findOne(query);
    return student;
  } catch (error: any) {
    console.error("Error finding student by email:", error);
    throw error;
  }
};

/**
 * Batch check which emails already exist as students in this tenant (for bulk upload validation).
 * Returns a Set of existing emails (lowercase).
 */
export const findExistingStudentEmails = async (
  emails: string[],
  tenantId: string
): Promise<Set<string>> => {
  if (emails.length === 0) return new Set();
  try {
    const normalized = emails.map((e) => e?.trim?.()?.toLowerCase?.()).filter(Boolean);
    const existing = await Student.find(
      { email: { $in: normalized }, tenantId, isDeleted: false },
      { email: 1 }
    )
      .lean()
      .exec();
    return new Set((existing as any[]).map((d) => (d.email || "").toLowerCase()).filter(Boolean));
  } catch (error: any) {
    console.error("Error finding existing student emails:", error);
    throw error;
  }
};

// Find student by stdId (auto-generated student code like STD-001)
export const findStudentByStdId = async (
  stdId: string,
  tenantId: string
): Promise<IStudent | null> => {
  try {
    const query: any = {
      stdId: stdId.toUpperCase().trim(), // stdId is stored in uppercase
      tenantId: tenantId,
      isDeleted: false,
    };

    const student = await Student.findOne(query);
    return student;
  } catch (error: any) {
    console.error("Error finding student by stdId:", error);
    throw error;
  }
};

/**
 * Find students by multiple stdIds in one query (for parent bulk upload).
 * Returns Map of stdId (uppercase) -> student _id string.
 */
export const findStudentsByStdIds = async (
  stdIds: string[],
  tenantId: string
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (!stdIds || stdIds.length === 0) return map;
  const normalized = stdIds.map((s) => s?.trim?.()?.toUpperCase?.()).filter(Boolean);
  const unique = [...new Set(normalized)];
  const students = await Student.find(
    { stdId: { $in: unique }, tenantId, isDeleted: false },
    { _id: 1, stdId: 1 }
  )
    .lean()
    .exec();
  for (const s of students as any[]) {
    if (s.stdId && s._id) map.set(String(s.stdId).toUpperCase(), s._id.toString());
  }
  return map;
};

// Find students with pagination and filtering
export const findStudents = async (
  params: StudentQueryParams
): Promise<IStudent[]> => {
  try {
    const {
      pageNo = 1,
      pageSize = 10,
      tenantId,
      filters = {},
      sort = {},
    } = params;

    // Build base query
    const baseQuery: any = { isDeleted: false };

    if (tenantId) {
      baseQuery.tenantId = tenantId;
    }

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Debug: Log the final MongoDB query
    console.log(
      "🔍 [STUDENTS REPO] Final MongoDB query:",
      JSON.stringify(finalQuery, null, 2)
    );

    // Use provided sort or default to createdAt descending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ createdAt: -1 } as Record<string, SortOrder>);

    // Calculate skip
    const skip = (pageNo - 1) * pageSize;

    const students = await Student.find(finalQuery)
      .sort(finalSort)
      .skip(skip)
      .limit(pageSize);

    return students as IStudent[];
  } catch (error: any) {
    console.error("Error finding students:", error);
    throw error;
  }
};

// Count students
export const countStudents = async (
  params: StudentQueryParams
): Promise<number> => {
  try {
    const { tenantId, filters = {} } = params;

    // Build base query
    const baseQuery: any = { isDeleted: false };

    if (tenantId) {
      baseQuery.tenantId = tenantId;
    }

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    const count = await Student.countDocuments(finalQuery);
    return count;
  } catch (error: any) {
    console.error("Error counting students:", error);
    throw error;
  }
};

// Update student by ID
export const updateStudentById = async (
  id: string,
  updateData: Partial<IStudent>
): Promise<IStudent | null> => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        ...updateData,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );
    return student;
  } catch (error: any) {
    console.error("Error updating student by ID:", error);
    throw error;
  }
};

// Note: Removed updateStudentByUserId as we no longer use userId references

// Soft delete student by ID
export const softDeleteStudentById = async (
  id: string
): Promise<IStudent | null> => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
      },
      { new: true }
    );
    return student;
  } catch (error: any) {
    console.error("Error soft deleting student by ID:", error);
    throw error;
  }
};

// Hard delete student by ID
export const deleteStudentById = async (
  id: string
): Promise<IStudent | null> => {
  try {
    const student = await Student.findByIdAndDelete(id);
    return student;
  } catch (error: any) {
    console.error("Error deleting student by ID:", error);
    throw error;
  }
};

// Find students by class
export const findStudentsByClass = async (
  classId: string,
  tenantId?: string,
  filters: Record<string, any> = {},
  sort: Record<string, SortOrder> = {}
): Promise<IStudent[]> => {
  try {
    const baseQuery: any = {
      classId: classId,
      isDeleted: false,
      isActive: true,
    };

    if (tenantId) {
      baseQuery.tenantId = tenantId;
    }

    // Merge with dynamic filters from buildQuery
    const finalQuery = { ...baseQuery, ...filters };

    // Use provided sort or default to rollNumber ascending
    const finalSort: Record<string, SortOrder> =
      Object.keys(sort).length > 0
        ? sort
        : ({ rollNumber: 1 } as Record<string, SortOrder>);

    const students = await Student.find(finalQuery).sort(finalSort);

    return students as IStudent[];
  } catch (error: any) {
    console.error("Error finding students by class:", error);
    throw error;
  }
};

export const countStudentsByClass = async (
  classId: string,
  tenantId?: string
): Promise<number> => {
  try {
    const query: any = {
      classId: classId,
      isDeleted: false,
      isActive: true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const count = await Student.countDocuments(query);
    return count;
  } catch (error: any) {
    console.error("Error counting students by class:", error);
    throw error;
  }
};

// Find students by subject
export const findStudentsBySubject = async (
  subjectId: string,
  tenantId?: string
): Promise<IStudent[]> => {
  try {
    const query: any = {
      subjects: subjectId,
      isDeleted: false,
      isActive: true,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    const students = await Student.find(query).sort({
      rollNumber: 1 as SortOrder,
    });

    return students as IStudent[];
  } catch (error: any) {
    console.error("Error finding students by subject:", error);
    throw error;
  }
};

// Get active students DDL (dropdown list) - simplified data for dropdowns
export const getActiveStudentsDDL = async (tenantId: string) => {
  try {
    // Validate tenantId before proceeding
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid tenantId: tenantId must be a non-empty string");
    }

    const students = await Student.find({
      tenantId: tenantId,
      isActive: true,
      isDeleted: false,
      status: "active", // Only active students
    })
      .select("_id firstName lastName rollNumber email")
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return students.map((student: any) => ({
      id: student._id.toString(),
      name:
        `${student.firstName || ""} ${student.lastName || ""}`.trim() || "N/A",
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      rollNumber: student.rollNumber || "",
      email: student.email || "",
    }));
  } catch (error: any) {
    // Provide more specific error messages
    if (error.message.includes("Invalid tenantId format")) {
      throw new Error(
        `Invalid tenantId format: ${tenantId}. Please check your authentication token.`
      );
    } else if (error.message.includes("Invalid tenantId")) {
      throw new Error(`Invalid tenantId: ${error.message}`);
    }
    throw error;
  }
};

// Get student statistics (simplified)
export const getStudentStatistics = async (
  tenantId?: string
): Promise<StudentStatistics> => {
  try {
    const matchQuery: any = { isDeleted: false };

    if (tenantId) {
      matchQuery.tenantId = tenantId;
    }

    // Get basic counts
    const total = await Student.countDocuments(matchQuery);
    const active = await Student.countDocuments({
      ...matchQuery,
      status: "active",
    });
    const inactive = await Student.countDocuments({
      ...matchQuery,
      status: "inactive",
    });
    const suspended = await Student.countDocuments({
      ...matchQuery,
      status: "suspended",
    });
    const graduated = await Student.countDocuments({
      ...matchQuery,
      status: "graduated",
    });

    // Get recent admissions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAdmissions = await Student.countDocuments({
      ...matchQuery,
      admissionDate: { $gte: thirtyDaysAgo },
    });

    return {
      total,
      active,
      inactive,
      suspended,
      graduated,
      byClass: [],
      byStatus: [
        { status: "active", count: active },
        { status: "inactive", count: inactive },
        { status: "suspended", count: suspended },
        { status: "graduated", count: graduated },
      ],
      recentAdmissions,
      monthlyAdmissions: [],
    };
  } catch (error: any) {
    console.error("Error getting student statistics:", error);
    throw error;
  }
};

// Assign subjects to student
export const assignSubjectsToStudent = async (
  studentId: string,
  subjectIds: string[]
): Promise<IStudent | null> => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: studentId, isDeleted: false },
      {
        subjects: subjectIds,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );
    return student;
  } catch (error: any) {
    console.error("Error assigning subjects to student:", error);
    throw error;
  }
};

// Update student class
export const updateStudentClass = async (
  studentId: string,
  classId: string,
  className: string
): Promise<IStudent | null> => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: studentId, isDeleted: false },
      {
        classId: classId,
        className: className,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );
    return student;
  } catch (error: any) {
    console.error("Error updating student class:", error);
    throw error;
  }
};

// Bulk update students
export const bulkUpdateStudents = async (
  updates: Array<{ id: string; data: Partial<IStudent> }>
): Promise<IStudent[]> => {
  try {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.id, isDeleted: false },
        update: {
          $set: {
            ...update.data,
            updatedAt: new Date(),
          },
        },
      },
    }));

    await Student.bulkWrite(bulkOps);

    // Return updated students
    const studentIds = updates.map((update) => update.id);
    const updatedStudents = await Student.find({
      _id: { $in: studentIds },
      isDeleted: false,
    });

    return updatedStudents;
  } catch (error: any) {
    console.error("Error bulk updating students:", error);
    throw error;
  }
};

// Check if student ID exists
export const checkStudentIdExists = async (
  studentId: string,
  tenantId?: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    const query: any = {
      studentId: studentId,
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const student = await Student.findOne(query);
    return !!student;
  } catch (error: any) {
    console.error("Error checking if student ID exists:", error);
    throw error;
  }
};

// Check if roll number exists (per class per tenant)
export const checkRollNumberExists = async (
  rollNumber: string,
  tenantId?: string,
  classId?: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    const query: any = {
      rollNumber: rollNumber,
      isDeleted: false,
    };

    if (tenantId) {
      query.tenantId = tenantId;
    }

    // Include classId in query if provided (for uniqueness per class per tenant)
    if (classId) {
      query.classId = classId;
    }

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const student = await Student.findOne(query);
    return !!student;
  } catch (error: any) {
    console.error("Error checking if roll number exists:", error);
    throw error;
  }
};

// Get top students by class with average exam percentage
export const getTopStudentsByClass = async (
  classId: string,
  tenantId: string,
  subjectId?: string
): Promise<
  Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    className: string;
    subjectName?: string;
    averagePercentage: number;
    totalExams: number;
  }>
> => {
  try {
    console.log("🔍 getTopStudentsByClass - Input:", {
      classId,
      tenantId,
      subjectId,
    });
    console.log(
      "🔍 Type check - classId type:",
      typeof classId,
      "tenantId type:",
      typeof tenantId
    );

    // Validate and convert IDs
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      throw new Error(`Invalid classId format: ${classId}`);
    }
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      throw new Error(`Invalid tenantId format: ${tenantId}`);
    }

    // Build match query for ExamStudent
    const matchQuery: any = {
      status: "Completed",
      gradingStatus: "Completed",
      classId: new mongoose.Types.ObjectId(classId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      percentage: { $exists: true, $ne: null }, // Must have percentage
    };

    // Add subjectId filter if provided
    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        throw new Error(`Invalid subjectId format: ${subjectId}`);
      }
      matchQuery.subjectId = new mongoose.Types.ObjectId(subjectId);
    }

    console.log(
      "📊 ExamStudent match query:",
      JSON.stringify(matchQuery, null, 2)
    );

    // First, check if any ExamStudent records exist with this query
    const examStudentCount = await ExamStudent.countDocuments(matchQuery);
    console.log(
      `📊 Found ${examStudentCount} ExamStudent records matching criteria`
    );

    // Aggregate pipeline to calculate average percentage per student
    const aggregationResult = await ExamStudent.aggregate([
      // Match completed and graded exams
      {
        $match: matchQuery,
      },
      // Join with exams to get totalMarks
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "exam",
        },
      },
      {
        $unwind: "$exam",
      },
      // Calculate obtained marks for each exam and group by student
      {
        $group: {
          _id: "$studentId",
          totalObtainedMarks: {
            $sum: {
              $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
            },
          },
          totalPossibleMarks: { $sum: "$exam.totalMarks" },
          totalExams: { $sum: 1 },
        },
      },
      // Calculate weighted average percentage
      {
        $addFields: {
          averagePercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
      // Lookup student details
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      // Unwind student array
      {
        $unwind: {
          path: "$student",
          preserveNullAndEmptyArrays: false,
        },
      },
      // Filter to ensure student exists and is not deleted
      {
        $match: {
          "student.isDeleted": false,
          "student.isActive": true,
          "student.tenantId": tenantId.toString().trim(),
        },
      },
      // Project required fields
      {
        $project: {
          studentId: { $toString: "$_id" },
          firstName: "$student.firstName",
          lastName: "$student.lastName",
          className: "$student.className",
          averagePercentage: { $round: ["$averagePercentage", 2] },
          totalExams: 1,
        },
      },
      // Sort by average percentage descending
      {
        $sort: { averagePercentage: -1 },
      },
    ]);

    console.log(`✅ Aggregation result count: ${aggregationResult.length}`);
    if (aggregationResult.length > 0) {
      console.log(
        "📋 Sample aggregation result:",
        JSON.stringify(aggregationResult[0], null, 2)
      );
    }

    // If subjectId is provided, get subject name
    let subjectName: string | undefined;
    if (subjectId) {
      try {
        const { Subject } = await import("../models");
        const subject = await Subject.findById(subjectId);
        subjectName = subject?.name;
      } catch (err) {
        console.warn("Could not fetch subject name:", err);
      }
    }

    // Format results with subject name if available
    const results = aggregationResult.map((item) => ({
      studentId: item.studentId,
      firstName: item.firstName,
      lastName: item.lastName,
      className: item.className || "",
      subjectName: subjectName,
      averagePercentage: item.averagePercentage,
      totalExams: item.totalExams,
    }));

    return results;
  } catch (error: any) {
    console.error("Error getting top students by class:", error);
    throw error;
  }
};

// Get student profile details with statistics
export const getStudentProfileDetails = async (
  studentId: string,
  tenantId: string
): Promise<{
  student: IStudent;
  classAverage?: number;
  totalSubjects: number;
  totalTeachers: number;
  currentRank?: number;
  previousRank?: number;
  rankChange?: number;
  totalStudentsInClass?: number;
  overallAverageScore: number;
  totalExamsCompleted: number;
  className?: string;
  classTeacher?: {
    teacherId: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: string;
  } | null;
  achievements?: {
    badgesCount: number;
    achievementsCount: number;
    credentialsCount: number;
  };
  schoolRank?: number;
  totalSchoolsInTenant?: number;
}> => {
  try {
    // Get student details
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      tenantId: tenantId,
      isDeleted: false,
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const studentIdObj = student._id.toString();
    console.log(
      "🔍 Student found - ID:",
      studentIdObj,
      "classId:",
      student.classId
    );

    // Get class details if classId exists
    let classAverage: number | undefined;
    let totalSubjects = 0;
    let className: string | undefined;
    let classTeacher: {
      teacherId: string;
      firstName: string;
      lastName: string;
      email: string;
      profileImage?: string;
    } | null = null;

    if (student.classId) {
      try {
        const { Class } = await import("../models");
        const classData = await Class.findById(student.classId)
          .populate("classTeacherId", "firstName lastName email profileImage")
          .lean();
        if (classData) {
          className = classData.name;
          // Note: totalSubjects will be calculated from assigned subjects in getChildSubjectsWithTeachers
          // Don't set it here based on class subjects - it will be overridden later
          totalSubjects = 0; // Will be set from assigned subjects

          // Extract class teacher info if assigned
          if (classData.classTeacherId) {
            const teacher = classData.classTeacherId as any;
            classTeacher = {
              teacherId: teacher._id?.toString() || "",
              firstName: teacher.firstName || "",
              lastName: teacher.lastName || "",
              email: teacher.email || "",
              profileImage: teacher.profileImage,
            };
          }

          // Calculate class average from all students' exam performance
          const classStudents = await Student.find({
            classId: student.classId,
            tenantId: tenantId,
            isDeleted: false,
            isActive: true,
          })
            .select("_id")
            .lean();

          if (classStudents.length > 0) {
            const studentIds = classStudents.map((s) => s._id);
            const classAvgResult = await ExamStudent.aggregate([
              {
                $match: {
                  studentId: { $in: studentIds },
                  status: "Completed",
                  gradingStatus: "Completed",
                  tenantId: new mongoose.Types.ObjectId(tenantId),
                  isActive: true,
                  percentage: { $exists: true, $ne: null },
                },
              },
              // Join with exams to get totalMarks
              {
                $lookup: {
                  from: "exams",
                  localField: "examId",
                  foreignField: "_id",
                  as: "exam",
                },
              },
              {
                $unwind: "$exam",
              },
              // Calculate obtained marks and total marks for the group
              {
                $group: {
                  _id: null,
                  totalObtainedMarks: {
                    $sum: {
                      $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
                    },
                  },
                  totalPossibleMarks: { $sum: "$exam.totalMarks" },
                },
              },
              // Calculate weighted average
              {
                $project: {
                  averagePercentage: {
                    $cond: {
                      if: { $gt: ["$totalPossibleMarks", 0] },
                      then: {
                        $multiply: [
                          { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                          100,
                        ],
                      },
                      else: 0,
                    },
                  },
                },
              },
            ]);

            if (classAvgResult.length > 0) {
              classAverage =
                Math.round(classAvgResult[0].averagePercentage * 100) / 100;
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch class details:", err);
      }
    }

    // Get total teachers from teacher-assign-classes
    let totalTeachers = 0;
    if (student.classId) {
      try {
        const { TeacherAssignClasses } = await import("../models");
        // classId in TeacherAssignClasses is ObjectId, tenantId is String
        const uniqueTeachers = await TeacherAssignClasses.distinct(
          "teacherId",
          {
            classId: new mongoose.Types.ObjectId(student.classId),
            tenantId: tenantId.toString().trim(),
            isDeleted: false,
            isActive: true,
            status: "active",
          }
        );
        totalTeachers = uniqueTeachers.length;
      } catch (err) {
        console.warn("Could not fetch teachers count:", err);
      }
    }

    // Get student's overall average score and total exams completed
    const studentStats = await ExamStudent.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          // status: "Completed",
          gradingStatus: "Completed",
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isActive: true,
          percentage: { $exists: true, $ne: null },
        },
      },
      // Join with exams to get totalMarks
      {
        $lookup: {
          from: "exams",
          localField: "examId",
          foreignField: "_id",
          as: "exam",
        },
      },
      {
        $unwind: "$exam",
      },
      // Calculate obtained marks and total marks for the student
      {
        $group: {
          _id: null,
          totalObtainedMarks: {
            $sum: {
              $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
            },
          },
          totalPossibleMarks: { $sum: "$exam.totalMarks" },
          totalExams: { $sum: 1 },
        },
      },
      // Calculate weighted average
      {
        $project: {
          totalExams: 1,
          averagePercentage: {
            $cond: {
              if: { $gt: ["$totalPossibleMarks", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ]);

    const overallAverageScore =
      studentStats.length > 0
        ? Math.round(studentStats[0].averagePercentage * 100) / 100
        : 0;
    const totalExamsCompleted =
      studentStats.length > 0 ? studentStats[0].totalExams : 0;

    // Get class rank if classId exists - using same logic as top-students API
    let currentRank: number | undefined;
    let totalStudentsInClass: number | undefined;

    if (student.classId) {
      try {
        console.log(
          "🔍 Getting class rank for student:",
          studentIdObj,
          "classId:",
          student.classId
        );

        // Use the same aggregation logic as getTopStudentsByClass
        const matchQuery: any = {
          status: "Completed",
          gradingStatus: "Completed",
          classId: new mongoose.Types.ObjectId(student.classId),
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isActive: true,
          percentage: { $exists: true, $ne: null },
        };

        // ...existing code...

        const rankedStudents = await ExamStudent.aggregate([
          {
            $match: matchQuery,
          },
          // Join with exams to get totalMarks
          {
            $lookup: {
              from: "exams",
              localField: "examId",
              foreignField: "_id",
              as: "exam",
            },
          },
          {
            $unwind: "$exam",
          },
          // Calculate obtained marks and total marks for each student
          {
            $group: {
              _id: "$studentId",
              totalObtainedMarks: {
                $sum: {
                  $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
                },
              },
              totalPossibleMarks: { $sum: "$exam.totalMarks" },
              totalExams: { $sum: 1 },
            },
          },
          // Calculate weighted average
          {
            $addFields: {
              averagePercentage: {
                $cond: {
                  if: { $gt: ["$totalPossibleMarks", 0] },
                  then: {
                    $multiply: [
                      { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
          {
            $lookup: {
              from: "students",
              localField: "_id",
              foreignField: "_id",
              as: "student",
            },
          },
          {
            $unwind: {
              path: "$student",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              "student.isDeleted": false,
              "student.isActive": true,
              "student.tenantId": tenantId.toString().trim(),
            },
          },
          {
            $project: {
              studentId: { $toString: "$_id" },
              averagePercentage: { $round: ["$averagePercentage", 2] },
            },
          },
          {
            $sort: { averagePercentage: -1 },
          },
        ]);

        totalStudentsInClass = rankedStudents.length;
        console.log(
          `📊 Found ${totalStudentsInClass} students with completed exams in class`
        );

        // Apply dense ranking - students with same percentage get same rank
        let currentRankValue = 1;
        let previousPercentage: number | null = null;

        const rankedStudentsWithRank = rankedStudents.map((student) => {
          // If percentage has dropped, increment rank
          if (previousPercentage !== null && student.averagePercentage < previousPercentage) {
            currentRankValue++;
          }
          previousPercentage = student.averagePercentage;

          return {
            ...student,
            rank: currentRankValue
          };
        });

        // Find student's rank
        const studentIdStr = studentIdObj;
        const studentData = rankedStudentsWithRank.find(
          (s) => s.studentId.toString() === studentIdStr
        );

        console.log("🔍 Looking for:", studentIdStr);
        console.log(
          "🔍 Available IDs:",
          rankedStudentsWithRank.map((s) => `${s.studentId.toString()} (${s.averagePercentage}% - Rank ${s.rank})`)
        );

        if (studentData) {
          currentRank = studentData.rank;
          console.log(`✅ Student rank found: ${currentRank} (Average: ${studentData.averagePercentage}%)`);
        } else {
          console.warn(
            "⚠️ Student not found in ranked list - they may not have completed exams for this class"
          );
        }
      } catch (err) {
        console.error("❌ Error fetching class rank:", err);
      }
    } else {
      console.log("⚠️ Student has no classId assigned");
    }

    // Calculate previous rank (excluding the student's latest exam)
    let previousRank: number | undefined;
    let rankChange: number | undefined;

    if (student.classId) {
      try {
        console.log("🔍 Calculating previous rank (excluding latest exam for each student)");

        // Get the latest exam for each student in the class, then exclude it
        const previousRankedStudents = await ExamStudent.aggregate([
          // First, get all completed exams for the class
          {
            $match: {
              status: "Completed",
              gradingStatus: "Completed",
              classId: new mongoose.Types.ObjectId(student.classId),
              tenantId: new mongoose.Types.ObjectId(tenantId),
              isActive: true,
              percentage: { $exists: true, $ne: null },
            },
          },
          // Join with exams to get totalMarks
          {
            $lookup: {
              from: "exams",
              localField: "examId",
              foreignField: "_id",
              as: "exam",
            },
          },
          {
            $unwind: "$exam",
          },
          // Sort by updatedAt to identify latest exam per student
          { $sort: { studentId: 1, updatedAt: -1 } },
          // Group by student and collect all exams with their totalMarks
          {
            $group: {
              _id: "$studentId",
              allExams: {
                $push: {
                  examId: "$examId",
                  percentage: "$percentage",
                  totalMarks: "$exam.totalMarks",
                  updatedAt: "$updatedAt",
                },
              },
              totalExams: { $sum: 1 },
            },
          },
          // Only include students with more than 1 exam (so we can exclude latest)
          { $match: { totalExams: { $gt: 1 } } },
          // Filter out the latest exam and calculate weighted average for the rest
          {
            $project: {
              studentId: "$_id",
              previousExams: { $slice: ["$allExams", 1, { $subtract: ["$totalExams", 1] }] },
            },
          },
          { $unwind: "$previousExams" },
          {
            $group: {
              _id: "$studentId",
              totalObtainedMarks: {
                $sum: {
                  $divide: [
                    { $multiply: ["$previousExams.percentage", "$previousExams.totalMarks"] },
                    100,
                  ],
                },
              },
              totalPossibleMarks: { $sum: "$previousExams.totalMarks" },
              examCount: { $sum: 1 },
            },
          },
          // Calculate weighted average
          {
            $addFields: {
              averagePercentage: {
                $cond: {
                  if: { $gt: ["$totalPossibleMarks", 0] },
                  then: {
                    $multiply: [
                      { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
          // Lookup student details
          {
            $lookup: {
              from: "students",
              localField: "_id",
              foreignField: "_id",
              as: "student",
            },
          },
          {
            $unwind: {
              path: "$student",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              "student.isDeleted": false,
              "student.isActive": true,
              "student.tenantId": tenantId.toString().trim(),
            },
          },
          {
            $project: {
              studentId: { $toString: "$_id" },
              averagePercentage: { $round: ["$averagePercentage", 2] },
              examCount: 1,
            },
          },
          { $sort: { averagePercentage: -1 } },
        ]);

        console.log(`📊 Found ${previousRankedStudents.length} students with previous exam data`);

        if (previousRankedStudents.length > 0) {
          // Apply dense ranking for previous period
          let prevRankValue = 1;
          let prevPercentage: number | null = null;

          const previousRankedWithRank = previousRankedStudents.map((s) => {
            if (prevPercentage !== null && s.averagePercentage < prevPercentage) {
              prevRankValue++;
            }
            prevPercentage = s.averagePercentage;
            return { ...s, rank: prevRankValue };
          });

          // Find student's previous rank
          const studentPrevData = previousRankedWithRank.find(
            (s) => s.studentId.toString() === studentIdObj
          );

          if (studentPrevData) {
            previousRank = studentPrevData.rank;
            console.log(`✅ Previous rank found: ${previousRank} (based on ${studentPrevData.examCount} exams, excluding latest)`);

            // Calculate rank change (positive = improved, negative = dropped)
            if (currentRank !== undefined && previousRank !== undefined) {
              rankChange = previousRank - currentRank; // e.g., was 5, now 3 = +2 improvement
              console.log(`📈 Rank change: ${rankChange > 0 ? '+' : ''}${rankChange}`);
            }
          } else {
            console.log("⚠️ Student has only 1 exam, no previous rank available");
          }
        }
      } catch (err) {
        console.error("❌ Error fetching previous rank:", err);
      }
    }

    // Get achievements counts (badges, achievements, credentials)
    let achievements = {
      badgesCount: 0,
      achievementsCount: 0,
      credentialsCount: 0,
    };

    try {
      const { ExamBadge, ExamAchievement, ExamCredential } = await import("../models");
      const studentObjId = new mongoose.Types.ObjectId(studentId);

      const [badgesCount, achievementsCount, credentialsCount] = await Promise.all([
        ExamBadge.countDocuments({
          studentId: studentObjId,
          isEarned: true,
          isDeleted: false,
        }),
        ExamAchievement.countDocuments({
          studentId: studentObjId,
          isUnlocked: true,
          isDeleted: false,
        }),
        ExamCredential.countDocuments({
          studentId: studentObjId,
          isActive: true,
          isDeleted: false,
        }),
      ]);

      achievements = {
        badgesCount,
        achievementsCount,
        credentialsCount,
      };
    } catch (err) {
      console.warn("Could not fetch achievements counts:", err);
    }

    // Calculate school rank (across all students in the tenant)
    let schoolRank: number | undefined;
    let totalSchoolsInTenant: number | undefined;

    try {
      console.log("🔍 Getting school rank for student:", studentIdObj);

      // Get all students in the tenant
      const allSchoolStudents = await Student.find({
        tenantId: tenantId,
        isDeleted: false,
        isActive: true,
      })
        .select("_id")
        .lean();

      if (allSchoolStudents.length > 0) {
        const allStudentIds = allSchoolStudents.map((s) => s._id);

        // Calculate school-wide ranking
        const schoolRankedStudents = await ExamStudent.aggregate([
          {
            $match: {
              studentId: { $in: allStudentIds },
              status: "Completed",
              gradingStatus: "Completed",
              tenantId: new mongoose.Types.ObjectId(tenantId),
              isActive: true,
              percentage: { $exists: true, $ne: null },
            },
          },
          // Join with exams to get totalMarks
          {
            $lookup: {
              from: "exams",
              localField: "examId",
              foreignField: "_id",
              as: "exam",
            },
          },
          {
            $unwind: "$exam",
          },
          // Calculate obtained marks and total marks for each student
          {
            $group: {
              _id: "$studentId",
              totalObtainedMarks: {
                $sum: {
                  $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
                },
              },
              totalPossibleMarks: { $sum: "$exam.totalMarks" },
              totalExams: { $sum: 1 },
            },
          },
          // Calculate weighted average
          {
            $addFields: {
              averagePercentage: {
                $cond: {
                  if: { $gt: ["$totalPossibleMarks", 0] },
                  then: {
                    $multiply: [
                      { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
          {
            $lookup: {
              from: "students",
              localField: "_id",
              foreignField: "_id",
              as: "student",
            },
          },
          {
            $unwind: {
              path: "$student",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              "student.isDeleted": false,
              "student.isActive": true,
              "student.tenantId": tenantId.toString().trim(),
            },
          },
          {
            $project: {
              studentId: { $toString: "$_id" },
              averagePercentage: { $round: ["$averagePercentage", 2] },
            },
          },
          {
            $sort: { averagePercentage: -1 },
          },
        ]);

        // Apply dense ranking
        let schoolRankValue = 1;
        let previousSchoolPercentage: number | null = null;

        const schoolRankedWithRank = schoolRankedStudents.map((s) => {
          if (previousSchoolPercentage !== null && s.averagePercentage < previousSchoolPercentage) {
            schoolRankValue++;
          }
          previousSchoolPercentage = s.averagePercentage;
          return { ...s, rank: schoolRankValue };
        });

        // Find student's school rank
        const studentSchoolData = schoolRankedWithRank.find(
          (s) => s.studentId.toString() === studentIdObj
        );

        if (studentSchoolData) {
          schoolRank = studentSchoolData.rank;
          console.log(`✅ School rank found: ${schoolRank} (Average: ${studentSchoolData.averagePercentage}%)`);
        } else {
          console.warn("⚠️ Student not found in school ranked list");
        }
      }

      // Count total schools (classes) in the tenant
      try {
        const { Class } = await import("../models");
        totalSchoolsInTenant = await Class.countDocuments({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          isDeleted: false,
        });
        console.log(`📊 Total schools (classes) in tenant: ${totalSchoolsInTenant}`);
      } catch (err) {
        console.warn("⚠️ Could not fetch total schools in tenant:", err);
      }
    } catch (err) {
      console.error("❌ Error fetching school rank:", err);
    }

    return {
      student: student as IStudent,
      classAverage,
      totalSubjects,
      totalTeachers,
      currentRank,
      previousRank,
      rankChange,
      totalStudentsInClass,
      overallAverageScore,
      totalExamsCompleted,
      className: className || student.className,
      classTeacher,
      achievements,
      schoolRank,
      totalSchoolsInTenant,
    };
  } catch (error: any) {
    console.error("Error getting student profile details:", error);
    throw error;
  }
};

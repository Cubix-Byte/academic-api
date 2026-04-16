import { ClassRepository } from "@/repositories/class.repository";
import { CreateClassRequest, UpdateClassRequest, ClassResponse } from "@/types";
import { ObjectId } from "mongodb";
import mongoose, { SortOrder } from "mongoose";
import { Student, Class } from "@/models";
import * as classStudentRepository from "@/repositories/classStudent.repository";

/**
 * Class Service
 *
 * Business logic layer for Class operations
 * Handles validation, business rules, and data transformation
 */
export class ClassService {
  private classRepository: ClassRepository;

  constructor() {
    this.classRepository = new ClassRepository();
  }

  /**
   * Create class(es) - supports single or bulk creation
   */
  async createClass(
    requestData: CreateClassRequest,
    tenantId: string,
    createdBy?: string,
    createdById?: string,
    createdByRole?: string,
  ): Promise<ClassResponse | ClassResponse[]> {
    try {
      console.log(
        `Creating ${requestData.class_details.length} class(es) for tenant: ${tenantId}`,
      );

      // Transform new structure to database structure
      const batchId = new ObjectId(requestData.batchId);
      const subjectIds = requestData.subjectIds
        .filter((id) => id && !id.includes("{{"))
        .map((id) => new ObjectId(id));

      // Transform class_details array to DB format
      const classesToCreate = requestData.class_details.map((detail) => ({
        name: detail.name,
        grade: requestData.grade,
        section: undefined, // Optional, can be added later if needed
        capacity: detail.capacity,
        batchId: batchId,
        subjectIds: subjectIds,
        description: detail.description,
        isActive: true, // Default to active (not from request)
        tenantId: new ObjectId(tenantId),
        studentIds: [],
        classTeacherId: undefined, // Can be assigned later
        createdBy: createdBy || "system",
      }));

      // Validate duplicates before insert (optimized batch validation)
      const classIdentifiers = classesToCreate.map((classData) => ({
        name: classData.name,
        grade: classData.grade,
      }));

      const existingClasses =
        await this.classRepository.findExistingClassesBatch(
          tenantId,
          batchId,
          classIdentifiers,
        );

      if (existingClasses.length > 0) {
        const duplicateDetails = existingClasses.map((existing) => {
          return `Class "${existing.name}" (grade ${existing.grade})`;
        });
        throw new Error(
          `The following class(es) already exist: ${duplicateDetails.join(
            ", ",
          )}`,
        );
      }

      const seen = new Set<string>();
      for (const identifier of classIdentifiers) {
        const key = `${batchId.toString()}|${identifier.name}|${
          identifier.grade
        }`;
        if (seen.has(key)) {
          throw new Error(
            `Duplicate class in request: "${identifier.name}" (grade ${identifier.grade})`,
          );
        }
        seen.add(key);
      }

      // Insert classes
      let createdClasses: any[] = [];
      if (classesToCreate.length === 1) {
        // Single class - use existing create method
        const newClass = await this.classRepository.create(classesToCreate[0]);
        console.log(`Class created successfully with ID: ${newClass._id}`);
        createdClasses = [newClass];
      } else {
        // Multiple classes - use insertMany
        const newClasses =
          await this.classRepository.createBulk(classesToCreate);
        console.log(`${newClasses.length} class(es) created successfully`);
        createdClasses = newClasses;
      }

      // ===== SEND NOTIFICATIONS FOR CLASS CREATION =====
      // Send notification to admin who created the class(es)
      if (createdById && createdClasses.length > 0) {
        try {
          const { sendNotifications } = await import("./notification.service");
          const tenantIdString = tenantId?.toString
            ? tenantId.toString()
            : String(tenantId);
          const adminIdString = createdById?.toString
            ? createdById.toString()
            : String(createdById);
          const adminRole = createdByRole || "ADMIN";

          // Validate IDs are valid ObjectIds
          if (
            !mongoose.Types.ObjectId.isValid(adminIdString) ||
            !mongoose.Types.ObjectId.isValid(tenantIdString)
          ) {
            console.warn(
              "⚠️ Invalid adminId or tenantId, skipping notifications",
            );
          } else {
            const notifications: any[] = [];
            const classNames = createdClasses
              .map((cls) => cls.name || `Class ${cls._id}`)
              .join(", ");

            // Send notification to admin
            notifications.push({
              receiverId: adminIdString,
              receiverRole: adminRole,
              title: "Class Created Successfully",
              content:
                createdClasses.length === 1
                  ? `You have successfully created class "${classNames}".`
                  : `You have successfully created ${createdClasses.length} classes: ${classNames}.`,
              senderId: undefined, // No sender for system notifications
              senderRole: "SYSTEM",
              tenantId: tenantIdString,
              meta: {
                entityType: "Class",
                classCount: createdClasses.length,
                classIds: createdClasses.map((cls) => cls._id.toString()),
                classNames: createdClasses.map(
                  (cls) => cls.name || `Class ${cls._id}`,
                ),
              },
            });

            // Send notifications
            if (notifications.length > 0) {
              console.log(
                `📤 Sending ${notifications.length} notification(s) for class creation...`,
              );
              sendNotifications(notifications)
                .then((result) => {
                  console.log(
                    `✅ Successfully sent notification(s) for class creation:`,
                    result,
                  );
                })
                .catch((notificationError: any) => {
                  console.error(
                    "⚠️ Failed to send class creation notifications:",
                    notificationError.message,
                  );
                });
            }
          }
        } catch (notificationError: any) {
          // Log error but don't fail the class creation
          console.error(
            "⚠️ Error preparing class creation notifications:",
            notificationError.message,
          );
        }
      }

      // Return response
      if (createdClasses.length === 1) {
        return this.transformToResponse(createdClasses[0]);
      } else {
        return createdClasses.map((cls) => this.transformToResponse(cls));
      }
    } catch (error) {
      console.error("Error creating class(es):", error);
      throw error;
    }
  }

  /**
   * Get all classes for a tenant
   */
  async getAllClasses(params: {
    pageNo: number;
    pageSize: number;
    query?: Record<string, any>;
    sort?: Record<string, SortOrder>;
    tenantId: string;
  }): Promise<{
    classes: ClassResponse[];
    pagination: {
      total: number;
      pageNo: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    try {
      const classes = await this.classRepository.findClasses(params);
      const total = await this.classRepository.countClasses(params);

      return {
        classes: classes.map((cls: any) => this.transformToResponse(cls)),
        pagination: {
          total,
          pageNo: params.pageNo || 1,
          pageSize: params.pageSize || 10,
          totalPages: Math.ceil(total / (params.pageSize || 10)),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get class by ID
   */
  async getClassById(id: string, tenantId: string): Promise<ClassResponse> {
    try {
      const classData = await this.classRepository.findById(id, tenantId);

      if (!classData) {
        throw new Error("Class not found");
      }

      return this.transformToResponse(classData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update class
   */
  async updateClass(
    id: string,
    classData: UpdateClassRequest,
    tenantId: string,
  ): Promise<ClassResponse> {
    try {
      // Check if class exists
      const existingClass = await this.classRepository.findById(id, tenantId);
      if (!existingClass) {
        throw new Error("Class not found");
      }

      const updateData = {
        ...classData,
        classTeacherId:
          classData.classTeacherId && !classData.classTeacherId.includes("{{")
            ? new ObjectId(classData.classTeacherId)
            : undefined,
        batchId:
          classData.batchId && !classData.batchId.includes("{{")
            ? new ObjectId(classData.batchId)
            : undefined,
        subjectIds: classData.subjectIds
          ? classData.subjectIds
              .filter((id) => id && !id.includes("{{"))
              .map((id) => new ObjectId(id))
          : undefined,
      };
      const updatedClass = await this.classRepository.updateById(
        id,
        tenantId,
        updateData,
      );

      if (!updatedClass) {
        throw new Error("Failed to update class");
      }

      return this.transformToResponse(updatedClass);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete class
   */
  async deleteClass(id: string, tenantId: string): Promise<void> {
    try {
      const deletedClass = await this.classRepository.deleteById(id, tenantId);

      if (!deletedClass) {
        throw new Error("Class not found");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get class students
   */
  async getClassStudents(id: string, tenantId: string): Promise<any[]> {
    try {
      const students = await this.classRepository.getClassStudents(
        id,
        tenantId,
      );

      // Format the response to include fullName and id fields
      return students.map((student: any) => ({
        _id: student._id,
        id: student._id,
        email: student.email,
        phone: student.phone,
        fullName:
          `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
          "N/A",
        parentIds: student.parentIds,
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get class subjects
   */
  async getClassSubjects(id: string, tenantId: string): Promise<any[]> {
    try {
      const subjects = await this.classRepository.getClassSubjects(
        id,
        tenantId,
      );
      return subjects;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get class subject details with teacher assignments
   */
  async getClassSubjectDetails(id: string, tenantId: string): Promise<any[]> {
    try {
      const subjectDetails = await this.classRepository.getClassSubjectDetails(
        id,
        tenantId,
      );
      return subjectDetails;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add student to class
   */
  async addStudentToClass(
    classId: string,
    studentId: string,
    tenantId: string,
  ): Promise<ClassResponse> {
    try {
      const classData = await this.classRepository.findById(classId, tenantId);
      if (!classData) {
        throw new Error("Class not found");
      }

      // Check if class has capacity
      const currentStudentCount = classData.studentIds?.length || 0;
      if (currentStudentCount >= classData.capacity) {
        throw new Error("Class is at full capacity");
      }

      console.log(
        `🎯 [addStudentToClass] Adding student ${studentId} to class ${classId}`,
      );

      const updatedClass = await this.classRepository.addStudent(
        classId,
        studentId,
        tenantId,
      );

      if (!updatedClass) {
        throw new Error("Failed to add student to class");
      }

      console.log(`✅ [addStudentToClass] Student successfully added to class`);

      // Send notifications to student and teachers
      try {
        console.log(`📧 [addStudentToClass] Starting notification process...`);
        const { sendNotifications } = await import("./notification.service");
        const { findStudentById } =
          await import("../repositories/student.repository");

        console.log(
          `🔍 [addStudentToClass] Fetching student details for ${studentId}...`,
        );
        // Get student details for notification
        const student = await findStudentById(studentId);
        console.log(`📋 [addStudentToClass] Student found:`, {
          id: studentId,
          firstName: student?.firstName,
          lastName: student?.lastName,
          exists: !!student,
        });

        const studentName = student
          ? `${student.firstName} ${student.lastName}`.trim()
          : "New student";

        console.log(`👤 [addStudentToClass] Student name: ${studentName}`);

        const notificationsToSend: any[] = [];
        console.log(`📝 [addStudentToClass] Preparing notifications...`);

        // 1. Notification to student
        const studentNotification = {
          receiverId: studentId,
          receiverRole: "STUDENT",
          title: "Added to Class",
          content: `You have been added to ${classData.name}`,
          meta: {
            entityId: classId,
            entityType: "class",
            className: classData.name,
          },
          tenantId: tenantId,
        };
        notificationsToSend.push(studentNotification);
        console.log(
          `✅ [addStudentToClass] Student notification prepared:`,
          studentNotification,
        );

        // 2. Get all teachers assigned to this class and send notifications
        console.log(
          `🔍 [addStudentToClass] Fetching teachers for class ${classId}...`,
        );
        const { TeacherAssignClassesRepository } =
          await import("../repositories/teacherAssignClasses.repository");
        const teacherAssignments =
          await TeacherAssignClassesRepository.findAssignmentsByClass(
            classId,
            tenantId,
          );
        console.log(
          `📊 [addStudentToClass] Found ${teacherAssignments.length} teacher assignment(s)`,
        );

        // Get unique teacher IDs
        const teacherIds = new Set<string>();
        teacherAssignments.forEach((assignment: any) => {
          if (assignment.teacherId) {
            // Handle both ObjectId and populated teacher object
            const teacherIdStr =
              typeof assignment.teacherId === "string"
                ? assignment.teacherId
                : assignment.teacherId._id
                  ? assignment.teacherId._id.toString()
                  : assignment.teacherId.toString();
            teacherIds.add(teacherIdStr);
            console.log(
              `👨‍🏫 [addStudentToClass] Found teacher: ${teacherIdStr}`,
            );
          }
        });
        console.log(
          `📋 [addStudentToClass] Total unique teachers: ${teacherIds.size}`,
        );

        // Add notification for each teacher
        teacherIds.forEach((teacherId) => {
          const teacherNotification = {
            receiverId: teacherId,
            receiverRole: "TEACHER",
            title: "New Student Added",
            content: `${studentName} has been added to ${classData.name}`,
            meta: {
              entityId: classId,
              entityType: "class",
              className: classData.name,
              studentId: studentId,
              studentName: studentName,
            },
            tenantId: tenantId,
          };
          notificationsToSend.push(teacherNotification);
          console.log(
            `✅ [addStudentToClass] Teacher notification prepared for ${teacherId}`,
          );
        });

        // 3. Get all parents/guardians of the student and send notifications
        console.log(
          `🔍 [class.service addStudentToClass] Fetching parents for student ${studentId}...`,
        );
        const { findParentsByChildId } =
          await import("../repositories/parentChild.repository");
        const parentRelationships = await findParentsByChildId(studentId);
        console.log(
          `📊 [class.service addStudentToClass] Found ${parentRelationships.length} parent/guardian relationship(s)`,
        );

        // Add notification for each parent/guardian
        parentRelationships.forEach((relationship: any) => {
          if (relationship.parentId) {
            const parentIdStr =
              typeof relationship.parentId === "string"
                ? relationship.parentId
                : relationship.parentId._id
                  ? relationship.parentId._id.toString()
                  : relationship.parentId.toString();

            const parentNotification = {
              receiverId: parentIdStr,
              receiverRole: "PARENT",
              title: "Child Added to Class",
              content: `Your child ${studentName} has been added to ${classData.name}`,
              meta: {
                entityId: classId,
                entityType: "class",
                className: classData.name,
                studentId: studentId,
                studentName: studentName,
              },
              tenantId: tenantId,
            };
            notificationsToSend.push(parentNotification);
            console.log(
              `✅ [class.service addStudentToClass] Parent notification prepared for ${parentIdStr}`,
            );
          }
        });

        // Send all notifications in bulk
        if (notificationsToSend.length > 0) {
          console.log(
            `📤 [addStudentToClass] Sending ${notificationsToSend.length} notification(s)...`,
          );
          console.log(
            `📦 [addStudentToClass] Notification payload:`,
            JSON.stringify(notificationsToSend, null, 2),
          );

          const result = await sendNotifications(notificationsToSend);
          console.log(
            `✅ [addStudentToClass] Successfully sent ${notificationsToSend.length} notification(s): 1 to student + ${teacherIds.size} to teacher(s)`,
          );
          console.log(
            `📬 [addStudentToClass] Notification API response:`,
            JSON.stringify(result, null, 2),
          );
        } else {
          console.warn(`⚠️ [addStudentToClass] No notifications to send!`);
        }
      } catch (notificationError) {
        console.error(
          `❌ [addStudentToClass] Failed to send notifications:`,
          notificationError,
        );
        console.error(
          `❌ [addStudentToClass] Error stack:`,
          (notificationError as Error).stack,
        );
        // Non-fatal: continue even if notification fails
      }

      return this.transformToResponse(updatedClass);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove student from class
   */
  async removeStudentFromClass(
    classId: string,
    studentId: string,
    tenantId: string,
  ): Promise<ClassResponse> {
    try {
      const updatedClass = await this.classRepository.removeStudent(
        classId,
        studentId,
        tenantId,
      );

      if (!updatedClass) {
        throw new Error("Failed to remove student from class");
      }

      return this.transformToResponse(updatedClass);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get class statistics
   */
  async getClassStats(tenantId: string): Promise<any> {
    try {
      const stats = await this.classRepository.getClassStats(tenantId);
      return stats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get classes by grade
   */
  async getClassesByGrade(
    grade: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {},
  ): Promise<ClassResponse[]> {
    try {
      const classes = await this.classRepository.findByGrade(
        grade,
        tenantId,
        filters,
        sort,
      );
      return classes.map((cls) => this.transformToResponse(cls));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get classes by academic year
   */
  async getClassesByAcademicYear(
    academicYear: string,
    tenantId: string,
    filters: Record<string, any> = {},
    sort: Record<string, SortOrder> = {},
  ): Promise<ClassResponse[]> {
    try {
      const classes = await this.classRepository.findByAcademicYear(
        academicYear,
        tenantId,
        filters,
        sort,
      );
      return classes.map((cls) => this.transformToResponse(cls));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get classes DDL (dropdown list) - simplified data for dropdowns
   */
  async getClassesDDL(tenantId: string): Promise<any[]> {
    try {
      // Validate tenantId before proceeding
      if (!tenantId || typeof tenantId !== "string") {
        throw new Error(
          "Invalid tenantId: tenantId must be a non-empty string",
        );
      }

      const classes = await this.classRepository.findAll(tenantId, {
        isActive: true,
        isDeleted: false,
      });
      return classes.map((cls: any) => {
        // Extract teacher ID and name from populated object
        let mainClassTeacherId: string | undefined = undefined;
        let mainClassTeacherName: string | undefined = undefined;

        if (cls.classTeacherId) {
          if (typeof cls.classTeacherId === "string") {
            mainClassTeacherId = cls.classTeacherId;
          } else if (cls.classTeacherId._id) {
            mainClassTeacherId = cls.classTeacherId._id.toString();
          } else if (cls.classTeacherId.toString) {
            mainClassTeacherId = cls.classTeacherId.toString();
          }

          // Extract teacher name
          if (typeof cls.classTeacherId === "object") {
            const teacher = cls.classTeacherId;
            if (teacher.name) {
              mainClassTeacherName = teacher.name;
            } else if (teacher.firstName || teacher.lastName) {
              mainClassTeacherName =
                `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() ||
                undefined;
            }
          }
        }

        return {
          id: cls._id.toString(),
          name: cls.name,
          grade: cls.grade,
          section: cls.section,
          mainClassTeacherId,
          mainClassTeacherName,
        };
      });
    } catch (error) {
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes("Invalid tenantId format")) {
          throw new Error(
            `Invalid tenantId format: ${tenantId}. Please check your authentication token.`,
          );
        } else if (error.message.includes("Invalid tenantId")) {
          throw new Error(`Invalid tenantId: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Get teacher assigned classes DDL list
   */
  async getMyClassesDDL(
    teacherId: string,
    tenantId: string,
    batchId?: string,
  ): Promise<any[]> {
    try {
      // Validate inputs
      if (!teacherId || typeof teacherId !== "string") {
        throw new Error("Teacher ID is required");
      }

      if (!tenantId || typeof tenantId !== "string") {
        throw new Error("Tenant ID is required");
      }

      // Import TeacherAssignClassesRepository dynamically to avoid circular dependency
      const { TeacherAssignClassesRepository } =
        await import("../repositories/teacherAssignClasses.repository");

      const classes =
        await TeacherAssignClassesRepository.findTeacherClassesDDL(
          teacherId,
          tenantId,
          batchId,
        );

      return classes;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to get teacher classes DDL");
    }
  }

  /**
   * Remove teacher from class-subject assignment
   */
  async removeTeacherFromClassSubject(
    classId: string,
    teacherId: string,
    subjectId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Import TeacherAssignClassesRepository dynamically
      const { TeacherAssignClassesRepository } =
        await import("../repositories/teacherAssignClasses.repository");
      const { findTeacherById, updateTeacherById } =
        await import("../repositories/teacher.repository");

      // 1. Soft delete the assignment
      const removed =
        await TeacherAssignClassesRepository.removeTeacherFromClassSubject(
          teacherId,
          classId,
          subjectId,
          tenantId,
        );

      if (!removed) {
        throw new Error("Assignment not found or already removed");
      }

      // 2. Check if teacher has other subjects in this class
      const hasOtherSubjects =
        await TeacherAssignClassesRepository.hasOtherSubjectsInClass(
          teacherId,
          classId,
          subjectId,
          tenantId,
        );

      console.log(
        `🔍 Teacher has other subjects in class: ${hasOtherSubjects}`,
      );

      // 3. Get all active assignments for this teacher to rebuild arrays
      const teacherAssignments =
        await TeacherAssignClassesRepository.findAssignmentsByTeacher(
          teacherId,
          tenantId,
        );

      console.log(
        `📚 Found ${teacherAssignments.length} active assignments for teacher`,
      );

      // 4. Rebuild assignedClasses and assignedSubjects from active assignments
      const classIds = new Set<string>();
      const subjectIds = new Set<string>();

      teacherAssignments.forEach((assignment: any) => {
        // Handle classId extraction
        let classIdStr: string | null = null;
        if (assignment.classId) {
          if (typeof assignment.classId === "string") {
            classIdStr = assignment.classId;
          } else if (assignment.classId._id) {
            classIdStr = assignment.classId._id.toString();
          } else if (assignment.classId.toString) {
            classIdStr = assignment.classId.toString();
          }
        }

        // Handle subjectId extraction
        let subjectIdStr: string | null = null;
        if (assignment.subjectId) {
          if (typeof assignment.subjectId === "string") {
            subjectIdStr = assignment.subjectId;
          } else if (assignment.subjectId._id) {
            subjectIdStr = assignment.subjectId._id.toString();
          } else if (assignment.subjectId.toString) {
            subjectIdStr = assignment.subjectId.toString();
          }
        }

        // Only add valid ObjectIds
        if (classIdStr && ObjectId.isValid(classIdStr.trim())) {
          classIds.add(classIdStr.trim());
        }
        if (subjectIdStr && ObjectId.isValid(subjectIdStr.trim())) {
          subjectIds.add(subjectIdStr.trim());
        }
      });

      // 5. Convert to ObjectId arrays
      const validClassIds = Array.from(classIds)
        .filter((id) => id && ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const validSubjectIds = Array.from(subjectIds)
        .filter((id) => id && ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      console.log(
        `📝 Updating teacher ${teacherId} with ${validClassIds.length} classes and ${validSubjectIds.length} subjects`,
      );

      // 6. Update teacher with rebuilt arrays
      await updateTeacherById(teacherId, {
        assignedClasses: validClassIds,
        assignedSubjects: validSubjectIds,
        updatedAt: new Date(),
      });

      console.log(`✅ Teacher arrays updated successfully`);

      return {
        success: true,
        message: "Teacher removed from class-subject assignment successfully",
      };
    } catch (error) {
      console.error("Error removing teacher from class-subject:", error);
      throw error;
    }
  }

  /**
   * Get teacher assigned classes with subjects grouped by class
   */
  async getMyClassesWithSubjects(
    teacherId: string,
    tenantId: string,
  ): Promise<any[]> {
    try {
      // Validate inputs
      if (!teacherId || typeof teacherId !== "string") {
        throw new Error("Teacher ID is required");
      }

      if (!tenantId || typeof tenantId !== "string") {
        throw new Error("Tenant ID is required");
      }

      // Import TeacherAssignClassesRepository dynamically to avoid circular dependency
      const { TeacherAssignClassesRepository } =
        await import("../repositories/teacherAssignClasses.repository");

      const classes =
        await TeacherAssignClassesRepository.findTeacherClassesWithSubjects(
          teacherId,
          tenantId,
        );

      return classes;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to get teacher classes with subjects");
    }
  }

  /**
   * Get student enrolled classes with subjects
   */
  async getMyStudentClassesWithSubjects(
    studentId: string,
    tenantId: string,
    filters?: Record<string, any>,
  ): Promise<any[]> {
    try {
      // Validate inputs
      if (!studentId || typeof studentId !== "string") {
        throw new Error("Student ID is required");
      }

      if (!tenantId || typeof tenantId !== "string") {
        throw new Error("Tenant ID is required");
      }

      // Import repositories dynamically to avoid circular dependency
      const classStudentRepository =
        await import("../repositories/classStudent.repository");
      const mongoose = await import("mongoose");
      const { Class } = await import("../models/class.schema");

      // Get all ClassStudent records for this student (query by studentId only)
      const classStudentRecords = await classStudentRepository.findByStudent(
        studentId,
        undefined, // Don't filter by tenantId - verify through Class instead
      );

      // Filter to only include active and promoted enrollments
      const activeAndPromotedRecords = classStudentRecords.filter(
        (record) =>
          record.enrollmentStatus === "active" ||
          record.enrollmentStatus === "promoted",
      );

      // If student has no active/promoted classes, return empty array
      if (!activeAndPromotedRecords || activeAndPromotedRecords.length === 0) {
        return [];
      }

      // Get class IDs for active and promoted classes
      const activeClassIds = activeAndPromotedRecords
        .filter((record) => record.enrollmentStatus === "active")
        .map((record) => {
          const classId = record.classId;
          return classId instanceof mongoose.Types.ObjectId
            ? classId.toString()
            : classId.toString();
        });

      const promotedClassIds = activeAndPromotedRecords
        .filter((record) => record.enrollmentStatus === "promoted")
        .map((record) => {
          const classId = record.classId;
          return classId instanceof mongoose.Types.ObjectId
            ? classId.toString()
            : classId.toString();
        });

      // Combine all valid classIds
      const allValidClassIds = [...activeClassIds, ...promotedClassIds];

      // Verify classes belong to tenant
      const validClasses = await Class.find({
        _id: {
          $in: allValidClassIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .select("_id")
        .lean();

      const validClassIds = validClasses.map((cls: any) => cls._id.toString());

      if (validClassIds.length === 0) {
        return [];
      }

      // Handle classId filter if provided in filters
      let filteredClassIds = validClassIds;
      let requestedClassId: string | null = null;

      if (filters?.classId) {
        // Check if classId filter is provided (after buildQueryFromRequest processing)
        // It could be: filters.classId.$eq or filters.classId (direct value, string or ObjectId)
        if (filters.classId?.$eq) {
          // Handle $eq operator format
          const classIdValue = filters.classId.$eq;
          requestedClassId = classIdValue?.toString() || null;
        } else if (typeof filters.classId === "string") {
          requestedClassId = filters.classId;
        } else if (
          filters.classId &&
          typeof filters.classId === "object" &&
          "toString" in filters.classId
        ) {
          // Handle ObjectId or similar objects
          requestedClassId = filters.classId.toString();
        }

        // If classId filter is provided, validate and filter
        if (requestedClassId) {
          // Normalize to string for comparison
          const normalizedRequestedId = requestedClassId.toString();

          // Validate that the requested classId is one of the student's valid classes
          if (validClassIds.includes(normalizedRequestedId)) {
            filteredClassIds = [normalizedRequestedId];
          } else {
            // Requested classId is not in student's classes - return empty array
            return [];
          }
        }
      }

      // Get all classes with populated batch
      const populatedClasses = await Class.find({
        _id: {
          $in: filteredClassIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        tenantId: new mongoose.Types.ObjectId(tenantId),
        isDeleted: false,
      })
        .populate({
          path: "batchId",
          select: "batchName",
        })
        .lean();

      if (!populatedClasses || populatedClasses.length === 0) {
        return [];
      }

      // Create a map of classId to ClassStudent record for quick lookup
      const classStudentMap = new Map<string, any>();
      activeAndPromotedRecords.forEach((record) => {
        const classIdStr = record.classId.toString();
        if (filteredClassIds.includes(classIdStr)) {
          classStudentMap.set(classIdStr, record);
        }
      });

      // Import Subject model for populating subjectIds from class_students
      const { Subject } = await import("../models/subject.schema");

      // Format response to match teacher endpoint structure
      const result = await Promise.all(
        populatedClasses.map(async (populatedClass: any) => {
          const batchData: any = populatedClass.batchId || null;
          const classIdStr = populatedClass._id.toString();
          const classStudentRecord = classStudentMap.get(classIdStr);

          // Get subjects from class_students.subjectIds (if exists), otherwise fallback to Class.subjectIds
          let subjectIds: mongoose.Types.ObjectId[] = [];
          if (
            classStudentRecord?.subjectIds &&
            classStudentRecord.subjectIds.length > 0
          ) {
            // Use subjectIds from class_students
            subjectIds = classStudentRecord.subjectIds;
          } else if (
            populatedClass.subjectIds &&
            populatedClass.subjectIds.length > 0
          ) {
            // Fallback to Class.subjectIds for backward compatibility
            subjectIds = populatedClass.subjectIds;
          }

          // Populate subjects
          const subjects = [];
          if (subjectIds.length > 0) {
            const populatedSubjects = await Subject.find({
              _id: { $in: subjectIds },
              isDeleted: false,
              isActive: true,
            })
              .select("name code grade")
              .lean();

            subjects.push(
              ...populatedSubjects.map((subject: any) => ({
                id: subject._id?.toString() || "",
                name: subject.name || "",
                code: subject.code || null,
                grade: subject.grade || null,
              })),
            );
          }

          // Sort subjects by name
          subjects.sort((a: any, b: any) =>
            (a.name || "").localeCompare(b.name || ""),
          );

          return {
            id: classIdStr,
            name: populatedClass.name || "",
            grade: populatedClass.grade,
            section: populatedClass.section || null,
            batchId: batchData?._id?.toString() || null,
            batchName: batchData?.batchName || null,
            subjects: subjects,
          };
        }),
      );

      // Sort classes by grade (descending) and then by name
      result.sort((a: any, b: any) => {
        if (a.grade !== b.grade) {
          return (b.grade || 0) - (a.grade || 0); // Higher grade first
        }
        return (a.name || "").localeCompare(b.name || "");
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to get student classes with subjects");
    }
  }

  /**
   * Assign class to teacher subject-wise
   */
  async assignClassToTeacherSubjectWise(
    assignments: Array<{
      classId: string;
      teacherId: string;
      subjectId: string;
    }>,
    tenantId: string,
    tenantName: string,
    assignedBy: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      created: number;
      existing: number;
      updatedTeachers: string[];
    };
  }> {
    try {
      // Import TeacherAssignClassesRepository dynamically
      const { TeacherAssignClassesRepository } =
        await import("../repositories/teacherAssignClasses.repository");
      const { findTeacherById, updateTeacherById } =
        await import("../repositories/teacher.repository");

      // Get tenantName from teacher if not provided
      let finalTenantName = tenantName;
      if (!finalTenantName || finalTenantName.trim() === "") {
        // Get tenantName from first teacher in assignments
        if (assignments.length > 0) {
          const firstTeacher = await findTeacherById(assignments[0].teacherId);
          if (firstTeacher && firstTeacher.tenantName) {
            finalTenantName = firstTeacher.tenantName;
          } else {
            // Fallback to default
            finalTenantName = tenantName;
          }
        } else {
          finalTenantName = tenantName;
        }
      }

      // Validate all IDs before processing
      for (const assignment of assignments) {
        const { classId, teacherId, subjectId } = assignment;

        // Validate ObjectIds
        if (!classId || !ObjectId.isValid(classId.trim())) {
          throw new Error(`Invalid classId: ${classId}`);
        }
        if (!teacherId || !ObjectId.isValid(teacherId.trim())) {
          throw new Error(`Invalid teacherId: ${teacherId}`);
        }
        if (!subjectId || !ObjectId.isValid(subjectId.trim())) {
          throw new Error(`Invalid subjectId: ${subjectId}`);
        }
      }

      let createdCount = 0;
      let existingCount = 0;
      const updatedTeacherIds = new Set<string>();
      const newAssignments: Array<{
        classId: string;
        teacherId: string;
        subjectId: string;
      }> = [];

      // Process each assignment
      for (const assignment of assignments) {
        const { classId, teacherId, subjectId } = assignment;

        // Trim IDs
        const trimmedClassId = classId.trim();
        const trimmedTeacherId = teacherId.trim();
        const trimmedSubjectId = subjectId.trim();

        // Check if assignment already exists
        const existing =
          await TeacherAssignClassesRepository.findSpecificAssignment(
            trimmedTeacherId,
            trimmedClassId,
            trimmedSubjectId,
            tenantId,
          );

        if (existing && existing.isActive && !existing.isDeleted) {
          existingCount++;
          console.log(
            `ℹ️ Assignment already exists for teacher ${trimmedTeacherId}, class ${trimmedClassId}, subject ${trimmedSubjectId}`,
          );
          continue; // Already exists and active
        }

        // Create or restore assignment
        await TeacherAssignClassesRepository.createAssignmentIfNotExists(
          trimmedTeacherId,
          trimmedClassId,
          trimmedSubjectId,
          tenantId,
          finalTenantName,
          assignedBy,
        );
        createdCount++;
        updatedTeacherIds.add(trimmedTeacherId);
        newAssignments.push({
          classId: trimmedClassId,
          teacherId: trimmedTeacherId,
          subjectId: trimmedSubjectId,
        });
        console.log(
          `✅ Created new assignment for teacher ${trimmedTeacherId}, class ${trimmedClassId}, subject ${trimmedSubjectId}`,
        );
      }

      // Update teacher's assignedClasses and assignedSubjects arrays & send notifications
      for (const teacherId of updatedTeacherIds) {
        const teacher = await findTeacherById(teacherId);
        if (!teacher) {
          console.warn(`Teacher ${teacherId} not found, skipping array update`);
          continue;
        }

        // Get all active assignments for this teacher
        const teacherAssignments =
          await TeacherAssignClassesRepository.findAssignmentsByTeacher(
            teacherId,
            tenantId,
          );

        // Extract unique classIds and subjectIds
        const classIds = new Set<string>();
        const subjectIds = new Set<string>();

        teacherAssignments.forEach((assignment: any) => {
          // Handle classId extraction - can be ObjectId, string, or populated object
          let classIdStr: string | null = null;
          if (assignment.classId) {
            if (typeof assignment.classId === "string") {
              classIdStr = assignment.classId;
            } else if (assignment.classId._id) {
              classIdStr = assignment.classId._id.toString();
            } else if (assignment.classId.toString) {
              classIdStr = assignment.classId.toString();
            }
          }

          // Handle subjectId extraction - can be ObjectId, string, or populated object
          let subjectIdStr: string | null = null;
          if (assignment.subjectId) {
            if (typeof assignment.subjectId === "string") {
              subjectIdStr = assignment.subjectId;
            } else if (assignment.subjectId._id) {
              subjectIdStr = assignment.subjectId._id.toString();
            } else if (assignment.subjectId.toString) {
              subjectIdStr = assignment.subjectId.toString();
            }
          }

          // Only add valid ObjectIds
          if (classIdStr && ObjectId.isValid(classIdStr.trim())) {
            classIds.add(classIdStr.trim());
          }
          if (subjectIdStr && ObjectId.isValid(subjectIdStr.trim())) {
            subjectIds.add(subjectIdStr.trim());
          }
        });

        // Update teacher arrays - only with valid ObjectIds
        const validClassIds = Array.from(classIds)
          .filter((id) => id && ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        const validSubjectIds = Array.from(subjectIds)
          .filter((id) => id && ObjectId.isValid(id))
          .map((id) => new ObjectId(id));

        console.log(
          `📝 Updating teacher ${teacherId} with ${validClassIds.length} classes and ${validSubjectIds.length} subjects`,
        );

        await updateTeacherById(teacherId, {
          assignedClasses: validClassIds,
          assignedSubjects: validSubjectIds,
          updatedAt: new Date(),
        });

        // Send notifications for newly assigned classes/subjects
        try {
          const { sendNotifications } = await import("./notification.service");
          const { SubjectRepository } =
            await import("../repositories/subject.repository");

          const subjectRepo = new SubjectRepository();
          const notificationsToSend: any[] = [];

          // Build notifications for each newly created assignment for this teacher
          const teacherNewAssignments = newAssignments.filter(
            (a) => a.teacherId === teacherId,
          );

          console.log(
            `📧 Preparing ${teacherNewAssignments.length} notification(s) for teacher ${teacherId}`,
          );

          for (const assignment of teacherNewAssignments) {
            try {
              const classData = await this.classRepository.findById(
                assignment.classId,
                tenantId,
              );
              const subjectData = await subjectRepo.findById(
                assignment.subjectId,
                tenantId,
              );

              if (classData && subjectData) {
                const notification = {
                  receiverId: teacherId,
                  receiverRole: "TEACHER",
                  title: "Class Assigned",
                  content: `You have been assigned to teach ${subjectData.name} in ${classData.name}`,
                  meta: {
                    entityId: assignment.classId,
                    entityType: "class",
                    className: classData.name,
                    subjectName: subjectData.name,
                  },
                  tenantId: tenantId,
                };
                notificationsToSend.push(notification);
                console.log(
                  `📝 Notification prepared: ${subjectData.name} in ${classData.name} -> teacher ${teacherId}`,
                );
              } else {
                console.warn(
                  `⚠️ Could not find class (${assignment.classId}) or subject (${assignment.subjectId}) data`,
                );
              }
            } catch (lookupError) {
              console.error(
                `❌ Error fetching class/subject details for notification:`,
                lookupError,
              );
              // Send generic notification as fallback
              const fallbackNotification = {
                receiverId: teacherId,
                receiverRole: "TEACHER",
                title: "Class Assigned",
                content: "You have been assigned to a new class",
                meta: {
                  entityId: assignment.classId,
                  entityType: "class",
                },
                tenantId: tenantId,
              };
              notificationsToSend.push(fallbackNotification);
              console.log(
                `📝 Fallback notification prepared for teacher ${teacherId}`,
              );
            }
          }

          // Send all notifications in bulk
          if (notificationsToSend.length > 0) {
            console.log(
              `📤 Sending ${notificationsToSend.length} notification(s) to teacher ${teacherId}...`,
            );
            console.log(
              "📦 Notification payload:",
              JSON.stringify(notificationsToSend, null, 2),
            );

            const result = await sendNotifications(notificationsToSend);
            console.log(
              `✅ Successfully sent ${notificationsToSend.length} class assignment notification(s) to teacher ${teacherId}`,
            );
            console.log(
              "📬 Notification API response:",
              JSON.stringify(result, null, 2),
            );
          } else {
            console.log(
              `ℹ️ No new assignments for teacher ${teacherId}, no notifications to send`,
            );
          }
        } catch (notificationError) {
          console.error(
            `❌ Failed to send notifications to teacher ${teacherId}:`,
            notificationError,
          );
          console.error("Error stack:", (notificationError as Error).stack);
          // Non-fatal: continue with assignment even if notification fails
        }
      }

      return {
        success: true,
        message: `Successfully processed ${assignments.length} assignment(s). Created: ${createdCount}, Already existed: ${existingCount}`,
        data: {
          created: createdCount,
          existing: existingCount,
          updatedTeachers: Array.from(updatedTeacherIds),
        },
      };
    } catch (error) {
      console.error("Error assigning class to teacher subject-wise:", error);
      throw error;
    }
  }

  /**
   * Assign class to main teacher (every class has a main teacher)
   */
  async assignMainClassTeacher(
    classId: string,
    mainClassTeacherId: string,
    tenantId: string,
    tenantName: string,
    assignedBy: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      classId: string;
      mainClassTeacherId: string;
    };
  }> {
    try {
      // Validate ObjectIds
      if (!classId || !ObjectId.isValid(classId.trim())) {
        throw new Error(`Invalid classId: ${classId}`);
      }
      if (!mainClassTeacherId || !ObjectId.isValid(mainClassTeacherId.trim())) {
        throw new Error(`Invalid mainClassTeacherId: ${mainClassTeacherId}`);
      }
      if (!tenantId || !ObjectId.isValid(tenantId.trim())) {
        throw new Error(`Invalid tenantId: ${tenantId}`);
      }

      const trimmedClassId = classId.trim();
      const trimmedTeacherId = mainClassTeacherId.trim();
      const trimmedTenantId = tenantId.trim();

      // Check if class exists and belongs to tenant
      const existingClass = await this.classRepository.findById(
        trimmedClassId,
        trimmedTenantId,
      );

      if (!existingClass) {
        throw new Error(
          `Class with ID ${trimmedClassId} not found for tenant ${trimmedTenantId}`,
        );
      }

      // Check if teacher exists (import dynamically to avoid circular dependency)
      const { findTeacherById } =
        await import("../repositories/teacher.repository");
      const teacher = await findTeacherById(trimmedTeacherId);

      if (!teacher) {
        throw new Error(`Teacher with ID ${trimmedTeacherId} not found`);
      }

      // Verify teacher belongs to same tenant
      if (teacher.tenantId !== trimmedTenantId) {
        throw new Error(`Teacher does not belong to tenant ${trimmedTenantId}`);
      }

      // Update class with main class teacher
      const updatedClass = await this.classRepository.updateById(
        trimmedClassId,
        trimmedTenantId,
        {
          classTeacherId: new ObjectId(trimmedTeacherId),
          updatedAt: new Date(),
        },
      );

      if (!updatedClass) {
        throw new Error("Failed to update class with main class teacher");
      }

      // Send notification to teacher about being assigned as main class teacher
      try {
        const { sendNotifications } = await import("./notification.service");

        // Get class name for notification
        let className = existingClass.name || "the class";

        await sendNotifications([
          {
            receiverId: trimmedTeacherId,
            receiverRole: "TEACHER",
            title: "Main Class Teacher Assignment",
            content: `You have been assigned as the main class teacher for ${className}`,
            meta: {
              entityId: trimmedClassId,
              entityType: "class",
              className: className,
            },
            tenantId: trimmedTenantId,
          },
        ]);
        console.log(
          `✅ Sent main class teacher notification to teacher ${trimmedTeacherId}`,
        );
      } catch (notificationError) {
        console.warn(
          `Failed to send main class teacher notification:`,
          notificationError,
        );
        // Non-fatal: continue even if notification fails
      }

      return {
        success: true,
        message: "Main class teacher assigned successfully",
        data: {
          classId: trimmedClassId,
          mainClassTeacherId: trimmedTeacherId,
        },
      };
    } catch (error) {
      console.error("Error assigning main class teacher:", error);
      throw error;
    }
  }

  /**
   * Remove main class teacher from class
   */
  async removeMainClassTeacher(
    classId: string,
    mainClassTeacherId: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      classId: string;
      mainClassTeacherId: string;
    };
  }> {
    try {
      // Validate ObjectIds
      if (!classId || !ObjectId.isValid(classId.trim())) {
        throw new Error(`Invalid classId: ${classId}`);
      }
      if (!mainClassTeacherId || !ObjectId.isValid(mainClassTeacherId.trim())) {
        throw new Error(`Invalid mainClassTeacherId: ${mainClassTeacherId}`);
      }
      if (!tenantId || !ObjectId.isValid(tenantId.trim())) {
        throw new Error(`Invalid tenantId: ${tenantId}`);
      }

      const trimmedClassId = classId.trim();
      const trimmedTeacherId = mainClassTeacherId.trim();
      const trimmedTenantId = tenantId.trim();

      // Check if class exists and belongs to tenant
      const existingClass = await this.classRepository.findById(
        trimmedClassId,
        trimmedTenantId,
      );

      if (!existingClass) {
        throw new Error(
          `Class with ID ${trimmedClassId} not found for tenant ${trimmedTenantId}`,
        );
      }

      console.log(
        "************************************************************",
      );
      console.log("**** existingClass:", existingClass);

      // Verify that the class currently has this teacher as main class teacher
      const currentMainTeacherId = existingClass.classTeacherId?.id?.toString();

      console.log("**** currentMainTeacherId:", currentMainTeacherId);
      console.log("**** trimmedTeacherId:", trimmedTeacherId);
      if (!currentMainTeacherId || currentMainTeacherId !== trimmedTeacherId) {
        throw new Error(
          `Teacher ${trimmedTeacherId} is not the current main class teacher for class ${trimmedClassId}`,
        );
      }

      // Remove main class teacher by unsetting classTeacherId field
      // Use direct model update with $unset to properly remove the field
      const { Class } = await import("../models/class.schema");
      const updatedClass = await Class.findOneAndUpdate(
        {
          _id: new ObjectId(trimmedClassId),
          tenantId: new ObjectId(trimmedTenantId),
          isDeleted: false,
        },
        {
          $unset: { classTeacherId: "" },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      );

      if (!updatedClass) {
        throw new Error("Failed to remove main class teacher from class");
      }

      return {
        success: true,
        message: "Main class teacher removed successfully",
        data: {
          classId: trimmedClassId,
          mainClassTeacherId: trimmedTeacherId,
        },
      };
    } catch (error) {
      console.error("Error removing main class teacher:", error);
      throw error;
    }
  }

  /**
   * Transform class data to response format
   */
  private transformToResponse(classData: any): ClassResponse {
    // Helper function to extract ID from populated object or string
    const extractId = (item: any): string => {
      if (!item) return "";
      if (typeof item === "string") return item;
      if (item._id) return item._id.toString();
      if (item.id) return item.id.toString();
      return item.toString();
    };

    // Helper function to extract ID from populated object for single reference
    const extractSingleId = (item: any): string | undefined => {
      if (!item) return undefined;
      if (typeof item === "string") return item;
      if (item._id) return item._id.toString();
      if (item.id) return item.id.toString();
      return item.toString();
    };

    const classTeacherIdValue = extractSingleId(classData.classTeacherId);

    // Extract teacher name from populated object
    let mainClassTeacherName: string | undefined = undefined;
    if (
      classData.classTeacherId &&
      typeof classData.classTeacherId === "object"
    ) {
      const teacher = classData.classTeacherId as any;
      // Handle both 'name' field (if exists) or 'firstName lastName' combination
      if (teacher.name) {
        mainClassTeacherName = teacher.name;
      } else if (teacher.firstName || teacher.lastName) {
        mainClassTeacherName =
          `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() ||
          undefined;
      }
    }

    return {
      id: classData._id.toString(),
      name: classData.name,
      grade: classData.grade,
      section: classData.section,
      capacity: classData.capacity,
      classTeacherId: classTeacherIdValue,
      mainClassTeacherId: classTeacherIdValue, // Alias for classTeacherId (main class teacher)
      mainClassTeacherName: mainClassTeacherName,
      batchId: extractSingleId(classData.batchId),
      batch:
        classData.batchId && typeof classData.batchId === "object"
          ? {
              id:
                classData.batchId._id?.toString() ||
                classData.batchId.id?.toString(),
              batchName: classData.batchId.batchName,
              totalClasses: classData.batchId.totalClasses,
              startFrom: classData.batchId.startFrom,
              endTill: classData.batchId.endTill,
            }
          : undefined,
      subjectIds:
        classData.subjectIds?.map((item: any) => extractId(item)) || [],
      studentIds:
        classData.studentIds?.map((item: any) => extractId(item)) || [],
      description: classData.description,
      tenantId: classData.tenantId.toString(),
      isActive: classData.isActive,
      createdAt: classData.createdAt,
      updatedAt: classData.updatedAt,
    };
  }

  /**
   * Get all classes DDL with subjects
   * Returns array of classes with format: { id, name: "className | grade", subjects: [{ id, name }] }
   */
  async getAllClassesDDL(tenantId: string): Promise<any[]> {
    try {
      // Validate inputs
      if (!tenantId || typeof tenantId !== "string") {
        throw new Error("Tenant ID is required");
      }

      // Get all classes with populated subjects
      const classes =
        await this.classRepository.findAllClassesWithSubjects(tenantId);

      // Format the response
      const formattedClasses = classes.map((cls: any) => {
        // Use the class name field directly instead of formatting from grade/section
        const name = cls.name || "";

        // Format subjects array
        const subjects = (cls.subjectIds || [])
          .filter((subject: any) => subject !== null && subject !== undefined) // Filter out null values from populate
          .map((subject: any) => ({
            id: subject._id?.toString() || subject.id,
            name: subject.name,
          }));

        // Format batch object
        const batch =
          cls.batchId && typeof cls.batchId === "object"
            ? {
                id:
                  cls.batchId._id?.toString() ||
                  cls.batchId.id?.toString() ||
                  cls.batchId.toString(),
                batchName: cls.batchId.batchName || "",
                totalClasses: cls.batchId.totalClasses || 0,
                startFrom: cls.batchId.startFrom || null,
                endTill: cls.batchId.endTill || null,
              }
            : null;

        return {
          id: cls._id?.toString() || cls.id,
          name: name,
          grade: cls.grade,
          capacity: cls.capacity,
          description: cls.description || "",
          isActive: cls.isActive !== undefined ? cls.isActive : true,
          batch: batch,
          subjects: subjects,
        };
      });

      return formattedClasses;
    } catch (error) {
      console.error("Error in getAllClassesDDL:", error);
      throw error;
    }
  }

  /**
   * Promote selected students to a new class with transaction and history
   */
  async promoteStudents(params: {
    students: Array<{
      studentId: string;
      assignedRollNumber?: string;
      subjectIds?: string[];
      assignedSubjectIds?: string[];
    }>;
    oldClassId: string;
    newClassId: string;
    tenantId: string;
  }): Promise<{ success: boolean; message: string }> {
    const { students, oldClassId, newClassId, tenantId } = params;
    const studentIds = students.map((s) => s.studentId);
    const studentIdToSubjectIds = new Map<string, string[]>();
    students.forEach((s) => {
      const ids = s.assignedSubjectIds ?? s.subjectIds;
      if (ids && ids.length > 0) {
        studentIdToSubjectIds.set(s.studentId.toString(), ids);
      }
    });
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 0. Validate payload (roll numbers required + unique within payload)
      const studentIdToRoll = new Map<string, string>();
      const rollToStudentId = new Map<string, string>();

      for (const s of students) {
        const sid = s.studentId;
        const roll = (s.assignedRollNumber ?? "").toString().trim();
        if (!sid) {
          throw new Error("Invalid payload: studentId is required");
        }
        if (!roll) {
          throw new Error(
            "Invalid payload: assignedRollNumber is required for each student",
          );
        }
        studentIdToRoll.set(sid.toString(), roll);
        const existingSid = rollToStudentId.get(roll);
        if (existingSid && existingSid !== sid) {
          throw new Error(
            `Invalid payload: Duplicate assigned roll number "${roll}" in request`,
          );
        }
        rollToStudentId.set(roll, sid);
      }

      // 1. Get current ClassStudent records to preserve roll numbers and stdIds
      const currentEnrollments =
        await classStudentRepository.findByStudentIdsAndClass(
          studentIds,
          oldClassId,
        );

      if (currentEnrollments.length === 0) {
        throw new Error(
          "No active enrollments found for the selected students in the source class",
        );
      }

      // 2. Mark old records as 'promoted'
      await classStudentRepository.bulkPromoteUpdate(
        studentIds,
        oldClassId,
        session,
      );

      // 3. Create new enrollment records for the new class (with subjectIds from payload)
      const newEnrollments = currentEnrollments.map((env: any) => {
        const sid = env.studentId?.toString();
        const subjectIdsRaw = studentIdToSubjectIds.get(sid);
        const subjectIds =
          subjectIdsRaw && subjectIdsRaw.length > 0
            ? subjectIdsRaw
                .filter(
                  (id: string) => id && mongoose.Types.ObjectId.isValid(id),
                )
                .map((id: string) => new mongoose.Types.ObjectId(id))
            : [];
        return {
          classId: new mongoose.Types.ObjectId(newClassId),
          studentId: env.studentId,
          stdId: env.stdId,
          rollNumber: studentIdToRoll.get(sid) as string,
          tenantId: env.tenantId,
          enrollmentStatus: "active",
          isActive: true,
          createdBy: "academy-api",
          subjectIds,
        };
      });

      await classStudentRepository.createBulk(newEnrollments as any, session);

      // 4. Update the Students' current classId, rollNumber, and subjects (from payload)
      const now = new Date();
      await Student.bulkWrite(
        students.map((s) => {
          const assignedSubjectIds = (
            s.assignedSubjectIds ??
            s.subjectIds ??
            []
          ).map((id: string) => (typeof id === "string" ? id : String(id)));
          return {
            updateOne: {
              filter: { _id: new mongoose.Types.ObjectId(s.studentId) },
              update: {
                $set: {
                  classId: newClassId,
                  rollNumber: (s.assignedRollNumber ?? "").toString().trim(),
                  subjects: assignedSubjectIds,
                  updatedAt: now,
                },
              },
            },
          };
        }),
        { session },
      );

      // 5. Update Roster for Old Class
      await this.classRepository.bulkRemoveStudents(
        oldClassId,
        studentIds,
        tenantId,
        session,
      );

      // 6. Update Roster for New Class
      await this.classRepository.bulkAddStudents(
        newClassId,
        studentIds,
        tenantId,
        session,
      );

      await session.commitTransaction();
      return {
        success: true,
        message: `Successfully promoted ${studentIds.length} students to the new class`,
      };
    } catch (error: any) {
      await session.abortTransaction();
      console.error("Promotion Error:", error);

      // Handle duplicate key errors with user-friendly messages
      if (error.code === 11000 || error.code === 11001) {
        const errorMessage = error.message || "";

        if (
          errorMessage.includes("tenantId_1_classId_1_rollNumber_1") ||
          errorMessage.includes("rollNumber")
        ) {
          const rollMatch = errorMessage.match(/rollNumber: "([^"]+)"/);
          const rollNumber = rollMatch ? rollMatch[1] : "unknown";
          throw new Error(
            `Cannot promote student(s): Roll number "${rollNumber}" already exists in the target class. Please assign a different roll number or remove the existing student with this roll number.`,
          );
        } else if (
          errorMessage.includes("tenantId_1_classId_1_studentId_1") ||
          errorMessage.includes("studentId")
        ) {
          throw new Error(
            `Cannot promote student(s): One or more students are already enrolled in the target class. Please check the class roster and remove duplicate entries.`,
          );
        } else {
          throw new Error(
            `Cannot promote student(s): Duplicate entry detected. One or more students or roll numbers already exist in the target class. Please review the class roster.`,
          );
        }
      }

      // Re-throw the error with a more readable message if it's not a duplicate key error
      throw new Error(`Promotion failed: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
}

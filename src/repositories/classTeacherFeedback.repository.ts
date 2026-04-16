import mongoose from "mongoose";
import { ClassTeacherFeedback, IClassTeacherFeedback } from "@/models/classTeacherFeedback.schema";
import { ObjectId } from "mongodb";

/**
 * ClassTeacherFeedback Repository
 * Handles database operations for class teacher feedback
 */
export class ClassTeacherFeedbackRepository {
  /**
   * Create new feedback
   */
  async create(feedbackData: Partial<IClassTeacherFeedback>): Promise<IClassTeacherFeedback> {
    const feedback = new ClassTeacherFeedback(feedbackData);
    return await feedback.save();
  }

  /**
   * Find feedback by class and student
   */
  async findByClassAndStudent(
    classId: string,
    studentId: string,
    tenantId: string
  ): Promise<IClassTeacherFeedback | null> {
    return await ClassTeacherFeedback.findOne({
      classId: new ObjectId(classId),
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    }).lean();
  }

  /**
   * Find all feedback for a student across classes
   */
  async findByStudent(
    studentId: string,
    tenantId: string
  ): Promise<IClassTeacherFeedback[]> {
    return await ClassTeacherFeedback.find({
      studentId: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    })
      .populate("classId", "name grade section")
      .populate("teacherId", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Find all feedback given by a teacher
   */
  async findByTeacher(
    teacherId: string,
    tenantId: string,
    classId?: string
  ): Promise<IClassTeacherFeedback[]> {
    const query: any = {
      teacherId: new ObjectId(teacherId),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    };

    if (classId) {
      query.classId = new ObjectId(classId);
    }

    return await ClassTeacherFeedback.find(query)
      .populate("studentId", "firstName lastName rollNumber")
      .populate("classId", "name grade section")
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Update existing feedback
   */
  async update(
    classId: string,
    studentId: string,
    tenantId: string,
    feedback: string
  ): Promise<IClassTeacherFeedback | null> {
    return await ClassTeacherFeedback.findOneAndUpdate(
      {
        classId: new ObjectId(classId),
        studentId: new ObjectId(studentId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      { feedback, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();
  }

  /**
   * Soft delete feedback
   */
  async softDelete(
    classId: string,
    studentId: string,
    tenantId: string
  ): Promise<boolean> {
    const result = await ClassTeacherFeedback.updateOne(
      {
        classId: new ObjectId(classId),
        studentId: new ObjectId(studentId),
        tenantId: new ObjectId(tenantId),
        isDeleted: false,
      },
      { isDeleted: true, updatedAt: new Date() }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Get feedback count for a class
   */
  async getCountByClass(classId: string, tenantId: string): Promise<number> {
    return await ClassTeacherFeedback.countDocuments({
      classId: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    });
  }

  /**
   * Bulk find feedback for multiple students in a class
   */
  async findBulkByClassAndStudents(
    classId: string,
    studentIds: string[],
    tenantId: string
  ): Promise<IClassTeacherFeedback[]> {
    return await ClassTeacherFeedback.find({
      classId: new ObjectId(classId),
      studentId: { $in: studentIds.map((id) => new ObjectId(id)) },
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    }).lean();
  }
}

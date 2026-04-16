import { ClassTeacherFeedbackRepository } from "@/repositories/classTeacherFeedback.repository";
import { Class } from "@/models";
import { ObjectId } from "mongodb";

/**
 * ClassTeacherFeedback Service
 * Handles business logic for class teacher feedback operations
 */
export class ClassTeacherFeedbackService {
  private feedbackRepository: ClassTeacherFeedbackRepository;

  constructor() {
    this.feedbackRepository = new ClassTeacherFeedbackRepository();
  }

  /**
   * Verify if the teacher is the class teacher for the given class
   */
  private async verifyClassTeacher(
    classId: string,
    teacherId: string,
    tenantId: string
  ): Promise<boolean> {
    const classData = await Class.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
      isDeleted: false,
    }).lean();

    if (!classData) {
      throw new Error("Class not found");
    }

    // Check if the teacher is the assigned class teacher
    const classTeacherId = classData.classTeacherId?.toString();
    if (!classTeacherId || classTeacherId !== teacherId) {
      return false;
    }

    return true;
  }

  /**
   * Create or update class teacher feedback
   */
  async createOrUpdateFeedback(
    classId: string,
    studentId: string,
    teacherId: string,
    feedback: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
    isNew: boolean;
  }> {
    try {
      // Validate ObjectIds
      if (!ObjectId.isValid(classId)) {
        throw new Error("Invalid class ID");
      }
      if (!ObjectId.isValid(studentId)) {
        throw new Error("Invalid student ID");
      }
      if (!ObjectId.isValid(teacherId)) {
        throw new Error("Invalid teacher ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }

      // Verify teacher is the class teacher
      const isClassTeacher = await this.verifyClassTeacher(
        classId,
        teacherId,
        tenantId
      );

      if (!isClassTeacher) {
        throw new Error(
          "Only the assigned class teacher can provide overall feedback for students in this class"
        );
      }

      // Check if feedback already exists
      const existingFeedback = await this.feedbackRepository.findByClassAndStudent(
        classId,
        studentId,
        tenantId
      );

      let result;
      let isNew = false;

      if (existingFeedback) {
        // Update existing feedback
        result = await this.feedbackRepository.update(
          classId,
          studentId,
          tenantId,
          feedback
        );
      } else {
        // Create new feedback
        result = await this.feedbackRepository.create({
          classId: new ObjectId(classId) as any,
          studentId: new ObjectId(studentId) as any,
          teacherId: new ObjectId(teacherId) as any,
          feedback,
          tenantId: new ObjectId(tenantId) as any,
        });
        isNew = true;
      }

      return {
        success: true,
        message: isNew
          ? "Feedback created successfully"
          : "Feedback updated successfully",
        data: result,
        isNew,
      };
    } catch (error) {
      console.error("Error creating/updating feedback:", error);
      throw error;
    }
  }

  /**
   * Get feedback for a specific student in a class
   */
  async getFeedbackForStudent(
    classId: string,
    studentId: string,
    tenantId: string
  ): Promise<any> {
    try {
      if (!ObjectId.isValid(classId)) {
        throw new Error("Invalid class ID");
      }
      if (!ObjectId.isValid(studentId)) {
        throw new Error("Invalid student ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }

      const feedback = await this.feedbackRepository.findByClassAndStudent(
        classId,
        studentId,
        tenantId
      );

      return {
        success: true,
        data: feedback,
      };
    } catch (error) {
      console.error("Error fetching feedback:", error);
      throw error;
    }
  }

  /**
   * Get all feedback for a student across all their classes
   */
  async getAllFeedbackForStudent(
    studentId: string,
    tenantId: string
  ): Promise<any> {
    try {
      if (!ObjectId.isValid(studentId)) {
        throw new Error("Invalid student ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }

      const feedbacks = await this.feedbackRepository.findByStudent(
        studentId,
        tenantId
      );

      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      console.error("Error fetching student feedbacks:", error);
      throw error;
    }
  }

  /**
   * Get all feedback given by a teacher (for a specific class or all classes)
   */
  async getFeedbackByTeacher(
    teacherId: string,
    tenantId: string,
    classId?: string
  ): Promise<any> {
    try {
      if (!ObjectId.isValid(teacherId)) {
        throw new Error("Invalid teacher ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }
      if (classId && !ObjectId.isValid(classId)) {
        throw new Error("Invalid class ID");
      }

      const feedbacks = await this.feedbackRepository.findByTeacher(
        teacherId,
        tenantId,
        classId
      );

      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      console.error("Error fetching teacher feedbacks:", error);
      throw error;
    }
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(
    classId: string,
    studentId: string,
    teacherId: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      if (!ObjectId.isValid(classId)) {
        throw new Error("Invalid class ID");
      }
      if (!ObjectId.isValid(studentId)) {
        throw new Error("Invalid student ID");
      }
      if (!ObjectId.isValid(teacherId)) {
        throw new Error("Invalid teacher ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }

      // Verify teacher is the class teacher
      const isClassTeacher = await this.verifyClassTeacher(
        classId,
        teacherId,
        tenantId
      );

      if (!isClassTeacher) {
        throw new Error(
          "Only the assigned class teacher can delete feedback for students in this class"
        );
      }

      const deleted = await this.feedbackRepository.softDelete(
        classId,
        studentId,
        tenantId
      );

      if (!deleted) {
        throw new Error("Feedback not found or already deleted");
      }

      return {
        success: true,
        message: "Feedback deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting feedback:", error);
      throw error;
    }
  }

  /**
   * Get bulk feedback for multiple students in a class
   */
  async getBulkFeedbackForClass(
    classId: string,
    studentIds: string[],
    tenantId: string
  ): Promise<any> {
    try {
      if (!ObjectId.isValid(classId)) {
        throw new Error("Invalid class ID");
      }
      if (!ObjectId.isValid(tenantId)) {
        throw new Error("Invalid tenant ID");
      }

      const feedbacks = await this.feedbackRepository.findBulkByClassAndStudents(
        classId,
        studentIds,
        tenantId
      );

      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      console.error("Error fetching bulk feedbacks:", error);
      throw error;
    }
  }
}

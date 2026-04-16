import * as studentService from "./student.service";
import * as teacherService from "./teacher.service";
import * as parentService from "./parent.service";
import * as adminService from "./admin.service";

/**
 * Unified Resend Email Service
 * Handles resending welcome emails for students, teachers, and parents
 */

export interface ResendEmailRequest {
  type: "student" | "teacher" | "parent" | "primary-admin";
  _id: string;
}

/**
 * Resend welcome email based on type
 * @param data - ResendEmailRequest with type and _id
 * @returns Promise with success message
 */
export const resendEmail = async (data: ResendEmailRequest) => {
  try {
    const { type, _id } = data;

    if (!type || !_id) {
      throw new Error("Type and _id are required");
    }

    // Validate type
    const validTypes = ["student", "teacher", "parent", "primary-admin"];
    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error(`Invalid type. Type must be one of: ${validTypes.join(", ")}`);
    }

    const normalizedType = type.toLowerCase() as
      | "student"
      | "teacher"
      | "parent"
      | "primary-admin";

    // Call appropriate service based on type
    switch (normalizedType) {
      case "student":
        return await studentService.resendStudentEmail(_id);
      case "teacher":
        return await teacherService.resendTeacherEmail(_id);
      case "parent":
        return await parentService.resendParentEmail(_id);
      case "primary-admin":
        return await adminService.resendPrimaryAdminEmail(_id);
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  } catch (error: any) {
    console.error("Resend email error:", error);
    throw new Error(`Failed to resend email: ${error.message}`);
  }
};


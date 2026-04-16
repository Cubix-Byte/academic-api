import { parseCSV, ParsedCSVRow } from "../utils/csvParser.util";
import { CreateStudentRequest } from "../types/student.types";
import { CreateTeacherRequest } from "../types/teacher.types";
import { CreateParentRequest } from "../types/parent.types";
import * as studentService from "./student.service";
import {
  createStudentRecord,
  deleteStudentRecord,
  addStudentToClass,
} from "./student.service";
import * as teacherService from "./teacher.service";
import * as parentService from "./parent.service";
import * as studentRepository from "../repositories/student.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as parentRepository from "../repositories/parent.repository";
import * as parentChildRepository from "../repositories/parentChild.repository";
import { UserApiIntegrationService } from "./userApiIntegration.service";
import * as classStudentRepository from "../repositories/classStudent.repository";
import { ClassRepository } from "../repositories/class.repository";
import mongoose from "mongoose";
import * as notificationService from "./notification.service";
import { generateRandomPassword } from "../utils/password.helper";
import { bulkAllocateInitialCredits, bulkUpdateWalletsWithParent } from "./monetizationApiIntegration.service";
import * as tenantService from "./tenant.service";
import { assertSeatAvailable } from "../utils/seatsNlicense.helper";
import { AutoIdCounter } from "../models/auto_id_counter.schema";
import type { ITeacher } from "../models";
import { STATUS } from "../utils/constants/status.constants";

/**
 * Bulk Upload Service
 * Handles CSV parsing and bulk creation for students, teachers, and parents
 */

/**
 * Helper function to get partner name from database
 * Queries tenants collection to get partnerId, then partners collection to get companyName
 */
async function getPartnerNameFromDatabase(
  tenantId: string,
  fallback: string = "Brighton AI"
): Promise<string> {
  try {
    const tenantsCollection = mongoose.connection.db?.collection('tenants');
    if (!tenantsCollection) {
      console.warn("⚠️ Tenants collection not available, using fallback");
      return fallback;
    }

    const tenantDoc = await tenantsCollection.findOne({
      _id: new mongoose.Types.ObjectId(tenantId),
      isActive: true,
      isDeleted: false
    });

    if (!tenantDoc?.partnerId) {
      console.warn("⚠️ No partnerId found in tenant document, using fallback");
      return fallback;
    }

    const partnersCollection = mongoose.connection.db?.collection('partners');
    if (!partnersCollection) {
      console.warn("⚠️ Partners collection not available, using fallback");
      return fallback;
    }

    const partnerDoc = await partnersCollection.findOne({
      _id: new mongoose.Types.ObjectId(tenantDoc.partnerId),
      isActive: true,
      isDeleted: false
    });

    if (partnerDoc?.companyName) {
      return partnerDoc.companyName;
    }

    return fallback;
  } catch (error: any) {
    console.warn("⚠️ Could not fetch partner data from database, using fallback:", error.message);
    return fallback;
  }
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BulkUploadResult {
  totalRows: number;
  successful: number;
  failed: number;
  errorRows: Array<{
    row: number;
    errors: ValidationError[];
    data?: any;
  }>;
}

/**
 * Transform CSV row to Student request format
 * Only includes fields with actual values (not empty strings)
 * This matches the behavior of single student creation
 */
function transformCSVRowToStudent(
  row: ParsedCSVRow,
  tenantId: string,
  tenantName: string
): CreateStudentRequest {
  // Map CSV column names (case-insensitive, spaces removed) to student fields
  const getField = (fieldName: string): string | undefined => {
    const keys = Object.keys(row);
    const key = keys.find(
      (k) => k.toLowerCase().replace(/\s+/g, "") === fieldName.toLowerCase()
    );
    const value = key ? row[key]?.trim() : undefined;
    // Return undefined for empty strings, not empty string
    return value && value.length > 0 ? value : undefined;
  };

  // Build student data object, only including fields with values
  const studentData: CreateStudentRequest = {
    // Required fields
    firstName: getField("firstname") || getField("firstName") || "",
    lastName: getField("lastname") || getField("lastName") || "",
    email: getField("email") || "",
    password: getField("password") || generateRandomPassword(), // Generate random password if not provided
    phone:
      getField("phone") ||
      getField("phonenumber") ||
      getField("phoneNumber") ||
      "",
    gender: (() => {
      const genderValue = getField("gender");
      if (!genderValue) return undefined;
      const normalized = genderValue.toLowerCase().trim();
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];
      return validGenders.includes(normalized) ? normalized as "male" | "female" | "other" | "prefer_not_to_say" : undefined;
    })(),
    admissionDate: getField("admissiondate")
      ? new Date(getField("admissiondate")!)
      : new Date(),

    // Tenant info
    tenantId,
    tenantName,
  };

  // Only include rollNumber if it's provided in CSV (optional for bulk upload)
  const rollNumber = getField("rollnumber") || getField("rollNumber");
  if (rollNumber && rollNumber.trim().length > 0) {
    studentData.rollNumber = rollNumber.trim();
  }

  // Only add optional fields if they have values (matches single create behavior)
  const optionalFields: Array<{
    key: keyof CreateStudentRequest;
    fieldNames: string[];
  }> = [
    { key: "address", fieldNames: ["address"] },
    { key: "classId", fieldNames: ["classid", "classId"] },
    { key: "className", fieldNames: ["classname", "className"] },
    { key: "currentGrade", fieldNames: ["currentgrade", "currentGrade"] },
    { key: "section", fieldNames: ["section"] },
    { key: "academicYear", fieldNames: ["academicyear", "academicYear"] },
    { key: "fatherName", fieldNames: ["fathername", "fatherName"] },
    { key: "motherName", fieldNames: ["mothername", "motherName"] },
    { key: "guardianName", fieldNames: ["guardianname", "guardianName"] },
    { key: "guardianPhone", fieldNames: ["guardianphone", "guardianPhone"] },
    {
      key: "emergencyContact",
      fieldNames: ["emergencycontact", "emergencyContact"],
    },
    { key: "emergencyPhone", fieldNames: ["emergencyphone", "emergencyPhone"] },
    { key: "previousSchool", fieldNames: ["previousschool", "previousSchool"] },
    { key: "previousGrade", fieldNames: ["previousgrade", "previousGrade"] },
    { key: "bloodGroup", fieldNames: ["bloodgroup", "bloodGroup"] },
    {
      key: "medicalConditions",
      fieldNames: ["medicalconditions", "medicalConditions"],
    },
    { key: "allergies", fieldNames: ["allergies"] },
    { key: "transportRoute", fieldNames: ["transportroute", "transportRoute"] },
    { key: "spouseNumber", fieldNames: ["spousenumber", "spouseNumber"] },
    {
      key: "transferCertificate",
      fieldNames: ["transfercertificate", "transferCertificate"],
    },
    {
      key: "birthCertificate",
      fieldNames: ["birthcertificate", "birthCertificate"],
    },
    { key: "feeStructure", fieldNames: ["feestructure", "feeStructure"] },
    { key: "scholarship", fieldNames: ["scholarship"] },
  ];

  optionalFields.forEach(({ key, fieldNames }) => {
    const value = fieldNames
      .map((name) => getField(name))
      .find((val) => val !== undefined);
    if (value !== undefined) {
      (studentData as any)[key] = value;
    }
  });

  // Handle status (default to "active" if not provided)
  const statusValue = getField("status");
  if (statusValue) {
    studentData.status = statusValue as any;
  } else {
    studentData.status = "active";
  }

  // Handle transportRequired (boolean)
  const transportRequiredValue =
    getField("transportrequired") || getField("transportRequired");
  if (transportRequiredValue) {
    studentData.transportRequired =
      transportRequiredValue.toLowerCase() === "true" ||
      transportRequiredValue.toLowerCase() === "1" ||
      transportRequiredValue.toLowerCase() === "yes";
  }

  // Handle paymentStatus (default to "pending" if not provided)
  const paymentStatusValue =
    getField("paymentstatus") || getField("paymentStatus");
  if (paymentStatusValue) {
    studentData.paymentStatus = paymentStatusValue as any;
  }

  return studentData;
}

/**
 * Transform CSV row to Teacher request format
 * Only includes fields with actual values (not empty strings)
 */
function transformCSVRowToTeacher(
  row: ParsedCSVRow,
  tenantId: string,
  tenantName: string
): CreateTeacherRequest {
  const getField = (fieldName: string): string | undefined => {
    const keys = Object.keys(row);
    const key = keys.find(
      (k) => k.toLowerCase().replace(/\s+/g, "") === fieldName.toLowerCase()
    );
    const value = key ? row[key]?.trim() : undefined;
    return value && value.length > 0 ? value : undefined;
  };

  const teacherData: CreateTeacherRequest = {
    // Required fields
    firstName: getField("firstname") || getField("firstName") || "",
    lastName: getField("lastname") || getField("lastName") || "",
    email: getField("email") || "",
    password: getField("password") || generateRandomPassword(), // Generate random password if not provided
    phoneNumber:
      getField("phonenumber") ||
      getField("phoneNumber") ||
      getField("phone") ||
      "",
    gender: (() => {
      const genderValue = getField("gender");
      if (!genderValue) return undefined;
      const normalized = genderValue.toLowerCase().trim();
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];
      return validGenders.includes(normalized) ? normalized as "male" | "female" | "other" | "prefer_not_to_say" : undefined;
    })(),
    address: getField("address") || "Not provided",
    joiningDate: getField("joiningdate")
      ? new Date(getField("joiningdate")!)
      : new Date(),

    // Tenant info
    tenantId,
    tenantName,
  };

  // Only add optional fields if they have values
  const optionalFields: Array<{
    key: keyof CreateTeacherRequest;
    fieldNames: string[];
  }> = [
    { key: "qualification", fieldNames: ["qualification"] },
    { key: "specialization", fieldNames: ["specialization"] },
    { key: "department", fieldNames: ["department"] },
    { key: "designation", fieldNames: ["designation"] },
    {
      key: "emergencyContact",
      fieldNames: ["emergencycontact", "emergencyContact"],
    },
    { key: "emergencyPhone", fieldNames: ["emergencyphone", "emergencyPhone"] },
  ];

  optionalFields.forEach(({ key, fieldNames }) => {
    const value = fieldNames
      .map((name) => getField(name))
      .find((val) => val !== undefined);
    if (value !== undefined) {
      (teacherData as any)[key] = value;
    }
  });

  // Handle experience (number)
  const experienceValue = getField("experience");
  if (experienceValue) {
    const parsed = parseInt(experienceValue);
    if (!isNaN(parsed)) {
      teacherData.experience = parsed;
    }
  }

  // Handle status (default to "active" if not provided)
  const statusValue = getField("status");
  if (statusValue) {
    teacherData.status = statusValue as any;
  } else {
    teacherData.status = "active";
  }

  return teacherData;
}

/**
 * Transform CSV row to Parent request format
 * Only includes fields with actual values (not empty strings)
 */
function transformCSVRowToParent(
  row: ParsedCSVRow,
  tenantId: string,
  tenantName: string
): CreateParentRequest {
  const getField = (fieldName: string): string | undefined => {
    const keys = Object.keys(row);
    const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, "");
    const key = keys.find(
      (k) => k.toLowerCase().replace(/\s+/g, "") === normalizedFieldName
    );
    const value = key ? row[key]?.trim() : undefined;
    return value && value.length > 0 ? value : undefined;
  };

  // Helper to find children field with flexible matching (handles typos like "chlidren")
  const getChildrenField = (): string | undefined => {
    const keys = Object.keys(row);
    // Try exact matches first
    const exactMatch = keys.find((k) => {
      const normalized = k.toLowerCase().replace(/\s+/g, "");
      return (
        normalized === "children" ||
        normalized === "studentids" ||
        normalized === "childrenids"
      );
    });
    if (exactMatch && row[exactMatch]?.trim()) {
      return row[exactMatch].trim();
    }

    // Try fuzzy matches for common typos (like "chlidren")
    const fuzzyMatch = keys.find((k) => {
      const normalized = k.toLowerCase().replace(/\s+/g, "");
      // Match if it contains "child" or "student" and is close to "children"
      return (
        (normalized.includes("child") || normalized.includes("student")) &&
        normalized.length >= 6 &&
        normalized.length <= 12
      );
    });
    if (fuzzyMatch && row[fuzzyMatch]?.trim()) {
      return row[fuzzyMatch].trim();
    }

    return undefined;
  };

  // Extract role value from CSV (can be undefined if missing/invalid)
  const roleValue = getField("role")?.toLowerCase();
  const extractedRole: "father" | "mother" | "guardian" | undefined =
    roleValue === "father" || roleValue === "mother" || roleValue === "guardian"
      ? (roleValue as "father" | "mother" | "guardian")
      : undefined; // Don't default - return undefined if role is missing or invalid

  const parentData: CreateParentRequest = {
    // Required fields
    firstName: getField("firstname") || getField("firstName") || "",
    lastName: getField("lastname") || getField("lastName") || "",
    email: getField("email") || "",
    password: getField("password") || generateRandomPassword(), // Generate random password if not provided
    role: extractedRole, // Required role field - must be provided (validated in validateParentDataForBulk)
    phoneNumber:
      getField("phonenumber") ||
      getField("phoneNumber") ||
      getField("phone") ||
      "",

    // Tenant info
    tenantId,
    tenantName,
  };

  // Handle gender based on role
  // If role is "guardian", gender is required (will be validated)
  // If role is "father" or "mother", gender should NOT be saved (remove it even if provided)
  if (extractedRole === "guardian") {
    // For guardian, get gender from CSV (will be validated later)
    const genderValue = getField("gender");
    if (genderValue) {
      const normalized = genderValue.toLowerCase().trim();
      const validGenders = ["male", "female", "other", "prefer_not_to_say"];
      if (validGenders.includes(normalized)) {
        (parentData as any).gender = normalized as "male" | "female" | "other" | "prefer_not_to_say";
      }
    }
    // If gender is missing or invalid, it will be caught in validation
  }
  // For father or mother, we don't set gender (it will be removed/ignored)

  // Only add optional fields if they have values
  const optionalFields: Array<{
    key: keyof CreateParentRequest;
    fieldNames: string[];
  }> = [
    { key: "address", fieldNames: ["address"] },
    { key: "occupation", fieldNames: ["occupation"] },
    { key: "workplace", fieldNames: ["workplace"] },
    { key: "workPhone", fieldNames: ["workphone", "workPhone"] },
  ];

  optionalFields.forEach(({ key, fieldNames }) => {
    const value = fieldNames
      .map((name) => getField(name))
      .find((val) => val !== undefined);
    if (value !== undefined) {
      (parentData as any)[key] = value;
    }
  });

  // Handle relationship (default to "guardian" if not provided)
  const relationshipValue = getField("relationship");
  if (relationshipValue) {
    parentData.relationship = relationshipValue as any;
  } else {
    parentData.relationship = "guardian";
  }

  // Handle status (default to "active" if not provided)
  const statusValue = getField("status");
  if (statusValue) {
    parentData.status = statusValue as any;
  } else {
    parentData.status = "active";
  }

  // Handle children/studentIds (comma-separated or semicolon-separated stdIds like STD-001, STD-002)
  // Support multiple column names: children, studentIds, childrenIds
  // Also handle common typos: chlidren (missing 'd'), chlidren (various typos)
  // NOTE: The CSV contains stdIds (human-readable like STD-001), not MongoDB ObjectIds
  // We'll convert stdIds to ObjectIds in the bulkUploadParents function

  // Try all possible field name variations (including typos)
  const childrenValue =
    getField("children") ||
    getField("chlidren") || // Handle typo: chlidren (missing 'd')
    getField("childern") || // Handle typo: childern (swapped letters)
    getField("studentids") ||
    getField("studentIds") ||
    getField("childrenids") ||
    getField("childrenIds") ||
    getField("childids") ||
    getField("childIds") ||
    getChildrenField(); // Fallback to fuzzy matching for any child-related field

  if (childrenValue) {
    // Split by comma or semicolon and trim each stdId, filter out empty strings
    // Note: If CSV has comma-separated values in a single cell, they should be quoted
    // If not quoted, use semicolon (;) as delimiter instead
    const delimiter = childrenValue.includes(";") ? ";" : ",";
    const stdIds = childrenValue
      .split(delimiter)
      .map((id: string) =>
        id
          .trim()
          .replace(/^["']|["']$/g, "")
          .toUpperCase()
      ) // Remove quotes, convert to uppercase
      .filter((id: string) => id.length > 0);

    if (stdIds.length > 0) {
      // Store stdIds temporarily - will be converted to ObjectIds in bulkUploadParents
      (parentData as any).__stdIds = stdIds;
    }
  }

  return parentData;
}

/**
 * In-memory only validation for student data (no DB/API calls).
 * Returns empty array if validation passes. Used for batch validation phase.
 */
function validateStudentDataInMemory(data: CreateStudentRequest): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.email || data.email.trim().length === 0) {
    errors.push({ field: "email", message: "Email is required for student creation" });
  }
  if (!data.password || data.password.trim().length === 0) {
    errors.push({ field: "password", message: "Password is required for student creation" });
  }
  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push({ field: "firstName", message: "First name is required for student creation" });
  }
  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push({ field: "lastName", message: "Last name is required for student creation" });
  }
  if (!data.gender || data.gender.trim().length === 0) {
    errors.push({ field: "gender", message: "Gender is required for student creation" });
  } else {
    const validGenders = ["male", "female", "other", "prefer_not_to_say"];
    const normalized = data.gender.toLowerCase().trim();
    if (!validGenders.includes(normalized)) {
      errors.push({ field: "gender", message: `Gender must be one of: ${validGenders.join(", ")}` });
    }
  }
  if (data.classId && data.classId.trim().length > 0 && (!data.rollNumber || data.rollNumber.trim().length === 0)) {
    errors.push({ field: "rollNumber", message: "Roll number is required when classId is provided" });
  }
  if (!data.phone || data.phone.trim().length === 0) {
    errors.push({ field: "phone", message: "Phone number is required for student creation" });
  }
  if (data.email && data.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }
  if (data.password && data.password.trim().length > 0 && data.password.length < 6) {
    errors.push({ field: "password", message: "Password must be at least 6 characters long" });
  }
  if (data.phone && data.phone.trim().length > 0 && !/^[\+]?[0-9\-\s]{10,20}$/.test(data.phone)) {
    errors.push({
      field: "phone",
      message: "Invalid phone number format. Must be 10-20 characters with optional + prefix",
    });
  }
  return errors;
}

/**
 * Validate student data and return all validation errors (for bulk upload)
 * Returns empty array if validation passes. Used when not using batch validation.
 */
async function validateStudentDataForBulk(
  data: CreateStudentRequest,
  tenantId: string
): Promise<ValidationError[]> {
  const errors = validateStudentDataInMemory(data);
  try {
    const validationPromises: Promise<any>[] = [
      studentRepository.findStudentByEmail(data.email!, tenantId),
      UserApiIntegrationService.checkUserExists(
        data.email!,
        data.email!.toLowerCase(),
        tenantId
      ),
    ];
    if (data.rollNumber && data.rollNumber.trim().length > 0) {
      validationPromises.push(
        studentRepository.findStudentByRollNumber(
          data.rollNumber,
          tenantId,
          data.classId
        )
      );
    }
    const results = await Promise.all(validationPromises);
    const existingEmail = results[0];
    const existingUser = results[1];
    const existingRollNumber =
      data.rollNumber && data.rollNumber.trim().length > 0 ? results[2] : null;

    if (existingEmail) {
      errors.push({
        field: "email",
        message: `Student with email ${data.email} already exists in this tenant`,
      });
    }
    if (data.rollNumber && data.rollNumber.trim().length > 0) {
      if (data.classId && data.classId.trim().length > 0) {
        const existingClassRoll =
          await classStudentRepository.findByClassAndRoll(
            tenantId,
            data.classId,
            data.rollNumber
          );
        if (existingClassRoll) {
          errors.push({
            field: "rollNumber",
            message: `Student with roll number ${data.rollNumber} already exists in this class for this tenant`,
          });
        }
      } else if (existingRollNumber) {
        errors.push({
          field: "rollNumber",
          message: `Student with roll number ${data.rollNumber} already exists for this tenant`,
        });
      }
    }
    if (existingUser.exists) {
      // Kept for internal validation; student check gives user-facing message
    }
  } catch (error: any) {
    errors.push({
      field: "validation",
      message: `Failed to validate student data: ${error.message}`,
    });
  }
  return errors;
}

/**
 * Bulk upload students from CSV
 * All-or-nothing approach: If any row fails validation, no rows are created.
 * Uses batch validation (1–3 queries) and insertMany for performance.
 */
export async function bulkUploadStudents(
  filePath: string,
  tenantId: string,
  tenantName: string
): Promise<BulkUploadResult> {
  const result: BulkUploadResult = {
    totalRows: 0,
    successful: 0,
    failed: 0,
    errorRows: [],
  };

  try {
    const parsed = await parseCSV(filePath);
    result.totalRows = parsed.totalRows;

    // PHASE 1a: Transform all rows and run in-memory validation only
    const validatedRows: Array<{
      rowNumber: number;
      studentData: CreateStudentRequest;
      originalRow: ParsedCSVRow;
    }> = [];
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 2;
      try {
        const studentData = transformCSVRowToStudent(row, tenantId, tenantName);
        const validationErrors = validateStudentDataInMemory(studentData);
        if (validationErrors.length > 0) {
          result.failed++;
          result.errorRows.push({ row: rowNumber, errors: validationErrors, data: row });
        } else {
          validatedRows.push({ rowNumber, studentData, originalRow: row });
        }
      } catch (error: any) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "validation", message: error.message || "Unknown error" }],
          data: row,
        });
      }
    }
    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // PHASE 1b: Batch uniqueness checks (2–3 queries total)
    const emails = validatedRows.map((r) => r.studentData.email!.trim().toLowerCase());
    const duplicateEmailsInCsv = new Set<string>();
    const emailCount = new Map<string, number>();
    for (const e of emails) {
      emailCount.set(e, (emailCount.get(e) || 0) + 1);
    }
    emailCount.forEach((count, e) => {
      if (count > 1) duplicateEmailsInCsv.add(e);
    });

    const [existingStudentEmails, existingUserEmails, existingClassRolls] = await Promise.all([
      studentRepository.findExistingStudentEmails(emails, tenantId),
      UserApiIntegrationService.checkUsersExistBatch(emails, tenantId),
      (async () => {
        const pairs = validatedRows
          .filter(
            (r) =>
              r.studentData.classId?.trim() &&
              r.studentData.rollNumber?.trim()
          )
          .map((r) => ({
            classId: r.studentData.classId!.trim(),
            rollNumber: r.studentData.rollNumber!.trim(),
          }));
        return classStudentRepository.findExistingClassRolls(tenantId, pairs);
      })(),
    ]);

    const existingEmailsUnion = new Set([
      ...existingStudentEmails,
      ...existingUserEmails,
    ]);
    for (const { rowNumber, studentData, originalRow } of validatedRows) {
      const emailLower = studentData.email!.trim().toLowerCase();
      const errs: ValidationError[] = [];
      if (existingEmailsUnion.has(emailLower)) {
        errs.push({
          field: "email",
          message: `Student with email ${studentData.email} already exists in this tenant`,
        });
      }
      if (duplicateEmailsInCsv.has(emailLower)) {
        errs.push({
          field: "email",
          message: "Duplicate email in upload file",
        });
      }
      if (
        studentData.classId?.trim() &&
        studentData.rollNumber?.trim()
      ) {
        const key = `${studentData.classId.trim()}:${studentData.rollNumber.trim()}`;
        if (existingClassRolls.has(key)) {
          errs.push({
            field: "rollNumber",
            message: `Student with roll number ${studentData.rollNumber} already exists in this class for this tenant`,
          });
        }
      }
      if (errs.length > 0) {
        result.failed++;
        result.errorRows.push({ row: rowNumber, errors: errs, data: originalRow });
      }
    }
    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    try {
      await assertSeatAvailable({
        tenantId,
        type: "student",
        requested: validatedRows.length,
      });
    } catch (seatError: any) {
      const message =
        seatError?.message ||
        "Student seats are at full capacity. Please increase seats to create more.";
      for (const { rowNumber, originalRow } of validatedRows) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "seats", message }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2a: Reserve stdId range and generate sharedIds
    const counter = await AutoIdCounter.findOneAndUpdate(
      { _id: "STD" },
      { $inc: { seq: validatedRows.length } },
      { upsert: true, new: true }
    ).lean() as { _id: string; seq: number } | null;
    const baseSeq = (counter?.seq ?? validatedRows.length) - validatedRows.length;
    const stdIds = validatedRows.map((_, i) =>
      `STD-${String(baseSeq + i + 1).padStart(3, "0")}`
    );
    const sharedIds = validatedRows.map(() => new mongoose.Types.ObjectId());

    // Race check: ensure no email was taken between validation and insert
    const existingAgain = await studentRepository.findExistingStudentEmails(emails, tenantId);
    if (existingAgain.size > 0) {
      const firstExisting = Array.from(existingAgain)[0];
      for (const { rowNumber, studentData, originalRow } of validatedRows) {
        if (existingAgain.has(studentData.email!.trim().toLowerCase())) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "email",
                message: `Student with email ${studentData.email} already exists in this tenant`,
              },
            ],
            data: originalRow,
          });
        }
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2b: Build student docs and insertMany
    const studentDocs = validatedRows.map(({ studentData }, i) => {
      const doc: any = {
        _id: sharedIds[i],
        userId: sharedIds[i],
        ...(studentData.studentId ? { studentId: studentData.studentId } : {}),
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        email: studentData.email,
        phone: studentData.phone,
        admissionDate: new Date(studentData.admissionDate || new Date()),
        tenantId,
        tenantName,
        address: studentData.address,
        gender: studentData.gender,
        spouseNumber: studentData.spouseNumber,
        className: studentData.className,
        currentGrade: studentData.currentGrade,
        section: studentData.section,
        academicYear: studentData.academicYear,
        status: studentData.status || "active",
        fatherName: studentData.fatherName,
        motherName: studentData.motherName,
        guardianName: studentData.guardianName,
        guardianPhone: studentData.guardianPhone,
        emergencyContact: studentData.emergencyContact,
        emergencyPhone: studentData.emergencyPhone,
        previousSchool: studentData.previousSchool,
        previousGrade: studentData.previousGrade,
        transferCertificate: studentData.transferCertificate,
        birthCertificate: studentData.birthCertificate,
        feeStructure: studentData.feeStructure,
        scholarship: studentData.scholarship,
        paymentStatus: studentData.paymentStatus || "pending",
        bloodGroup: studentData.bloodGroup,
        medicalConditions: studentData.medicalConditions,
        allergies: studentData.allergies,
        transportRequired: studentData.transportRequired ?? false,
        transportRoute: studentData.transportRoute,
        subjects: studentData.subjects || [],
        documents: studentData.documents || [],
        achievements: studentData.achievements || [],
        disciplinaryActions: studentData.disciplinaryActions || [],
        additionalInfo: studentData.additionalInfo || {},
        isActive: studentData.isActive !== undefined ? studentData.isActive : true,
        isDeleted: false,
        stdId: stdIds[i],
      };
      if (studentData.rollNumber?.trim()) doc.rollNumber = studentData.rollNumber.trim();
      if (studentData.classId?.trim()) doc.classId = studentData.classId.trim();
      return doc;
    });

    let insertedStudents: any[];
    try {
      insertedStudents = await studentRepository.insertManyStudents(studentDocs);
    } catch (insertError: any) {
      for (const { rowNumber, originalRow } of validatedRows) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "creation", message: insertError?.message || "Unknown error" }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2c: Bulk class assignment (group by classId, then bulkAddStudents + ClassStudent insertMany)
    try {
      const classRepository = new ClassRepository();
      const byClass = new Map<string, Array<{ studentId: string; stdId: string; rollNumber: string }>>();
      for (let i = 0; i < validatedRows.length; i++) {
        const { studentData } = validatedRows[i];
        const classId = studentData.classId?.trim();
        if (!classId) continue;
        const studentId = sharedIds[i].toString();
        const stdId = stdIds[i];
        const rollNumber = studentData.rollNumber?.trim() || "";
        if (!byClass.has(classId)) byClass.set(classId, []);
        byClass.get(classId)!.push({ studentId, stdId, rollNumber });
      }
      for (const [classId, students] of byClass) {
        const studentIds = students.map((s) => s.studentId);
        await classRepository.bulkAddStudents(classId, studentIds, tenantId);
      }
      const classStudentDocs: any[] = [];
      const tenantIdObj = mongoose.Types.ObjectId.isValid(tenantId)
        ? new mongoose.Types.ObjectId(tenantId)
        : tenantId;
      for (let i = 0; i < validatedRows.length; i++) {
        const { studentData } = validatedRows[i];
        const classId = studentData.classId?.trim();
        const rollNumber = studentData.rollNumber?.trim();
        if (!classId || !rollNumber || !stdIds[i]) continue;
        classStudentDocs.push({
          classId: new mongoose.Types.ObjectId(classId),
          studentId: sharedIds[i],
          stdId: stdIds[i],
          rollNumber,
          tenantId: tenantIdObj,
          tenantName: tenantName || "",
          createdBy: "academy-api",
          isActive: true,
          isDeleted: false,
        });
      }
      if (classStudentDocs.length > 0) {
        await classStudentRepository.createBulk(classStudentDocs);
      }
    } catch (classError: any) {
      for (const sharedId of sharedIds) {
        try {
          await deleteStudentRecord(sharedId);
        } catch (cleanupError) {
          console.error("Failed to cleanup student:", cleanupError);
        }
      }
      for (const { rowNumber, originalRow } of validatedRows) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "creation", message: classError?.message || "Class assignment failed" }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    const createdStudents: Array<{
      rowNumber: number;
      student: any;
      studentData: CreateStudentRequest;
      sharedId: any;
      originalRow: ParsedCSVRow;
    }> = validatedRows.map((v, i) => ({
      rowNumber: v.rowNumber,
      student: insertedStudents[i],
      studentData: v.studentData,
      sharedId: sharedIds[i],
      originalRow: v.originalRow,
    }));

    // Step 2b: Prepare all user data for batch creation
    const usersData = createdStudents.map(({ studentData, sharedId }) => {
      // Ensure password is always set (generate if missing) and update studentData for email consistency
      if (!studentData.password || studentData.password.trim().length === 0) {
        studentData.password = generateRandomPassword();
      }
      
      return {
        _id: sharedId.toString(),
        username: studentData.email!.toLowerCase(),
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        email: studentData.email,
        password: studentData.password, // Ensure password is always set
        phoneNumber: studentData.phone,
        gender: studentData.gender,
        tenantId: tenantId,
        tenantName: tenantName,
        userType: "student",
        roleName: "STUDENT",
        userAccessType: "private",
        isEmailVerified: false,
        isActive: true,
        createdBy: "academic-api",
      };
    });

    // Step 2c: Batch create all users in one call
    try {
      const bulkUserResponse = await UserApiIntegrationService.bulkCreateUsers(
        usersData
      );

      // Check if all users were created successfully
      const createdUsers =
        bulkUserResponse?.data?.created || bulkUserResponse?.created || [];
      const failedUsers =
        bulkUserResponse?.data?.failed || bulkUserResponse?.failed || [];

      // If any user creation failed, cleanup all records and return errors
      if (failedUsers.length > 0) {
        // Cleanup all created student records
        for (const { sharedId } of createdStudents) {
          try {
            await deleteStudentRecord(sharedId);
          } catch (cleanupError) {
            console.error("Failed to cleanup student:", cleanupError);
          }
        }

        // Map failed users to their rows with better error messages
        for (const failedUser of failedUsers) {
          const email = failedUser.data?.email || failedUser.email;
          const matchingStudent = createdStudents.find(
            (cs) => cs.studentData.email === email
          );
          if (matchingStudent) {
            result.failed++;
            
            // Parse error message to determine field and message
            let errorField = "userCreation";
            let errorMessage = failedUser.error || "Failed to create user in user-api";
            
            // Check for duplicate email/username errors
            if (failedUser.error?.includes("USERNAME_EXISTS") || 
                failedUser.error?.includes("EMAIL_EXISTS") ||
                failedUser.error?.includes("duplicate key") ||
                failedUser.error?.includes("already exists")) {
              errorField = "email";
              if (failedUser.error.includes("USERNAME_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("EMAIL_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("duplicate key")) {
                errorMessage = "Email already exists in the system";
              } else {
                errorMessage = "Email already exists in the system";
              }
            }
            
            result.errorRows.push({
              row: matchingStudent.rowNumber,
              errors: [
                {
                  field: errorField,
                  message: errorMessage,
                },
              ],
              data: matchingStudent.originalRow,
            });
          }
        }

        result.successful = 0;
        return result;
      }

      // All users created successfully
      result.successful = createdStudents.length;

      // ===== STEP 3: BULK ALLOCATE INITIAL CREDITS TO STUDENT WALLETS =====
      // Allocate free credits automatically when students are created (bulk operation)
      // Credits are based on tenant's AiPracticeExamePerYear from seatsNlicense
      // This is done synchronously - if it fails, we cleanup student records (all-or-nothing)
      try {
        // Fetch tenant data once to get AiPracticeExamePerYear
        const tenant = await tenantService.getTenantById(tenantId);
        const freeCredits = tenant?.seatsNlicense?.AiPracticeExamePerYear ?? 0;

        // Only allocate credits if value is greater than 0
        if (freeCredits > 0) {
          console.log(`💰 Bulk allocating ${freeCredits} credits to ${createdStudents.length} students...`);
          
          // Prepare allocations array for bulk operation
          const allocations = createdStudents.map(({ student }) => ({
            studentId: student._id.toString(),
            credits: freeCredits,
          }));

          // Call bulk allocation endpoint (all-or-nothing)
          const bulkCreditResult = await bulkAllocateInitialCredits(
            allocations,
            tenantId,
            tenantName,
            "system" // System allocation (not by parent)
          );

          // Check if any allocations failed (all-or-nothing scenario)
          if (bulkCreditResult.failed && bulkCreditResult.failed.length > 0) {
            console.error(`❌ Bulk credit allocation failed for ${bulkCreditResult.failed.length} students (all-or-nothing)`);
            
            // Cleanup all created student records and users (all-or-nothing)
            console.log(`🧹 Cleaning up ${createdStudents.length} students and users due to wallet creation failure...`);
            
            // Delete students and users in parallel for faster cleanup
            const cleanupPromises = createdStudents.map(async ({ sharedId }) => {
              try {
                // Delete student record
                await deleteStudentRecord(sharedId);
                // Delete user record
                await UserApiIntegrationService.deleteUser(sharedId.toString());
              } catch (cleanupError) {
                console.error(`Failed to cleanup student/user ${sharedId}:`, cleanupError);
              }
            });
            
            await Promise.all(cleanupPromises);
            console.log(`✅ Cleaned up ${createdStudents.length} students and users`);
            for (const { rowNumber, originalRow } of createdStudents) {
              result.failed++;
              result.errorRows.push({
                row: rowNumber,
                errors: [
                  {
                    field: "walletCreation",
                    message: "Failed to create student wallet and allocate credits (all-or-nothing)",
                  },
                ],
                data: originalRow,
              });
            }

            result.successful = 0;
            return result;
          }

          console.log(`✅ Successfully allocated ${freeCredits} credits to ${bulkCreditResult.created.length} student wallets`);
        } else {
          console.log(`ℹ️ No free credits allocated to students (AiPracticeExamePerYear is ${freeCredits} or not configured)`);
        }
      } catch (creditError: any) {
        // If bulk credit allocation fails, cleanup all records (all-or-nothing)
        console.error(`❌ Bulk credit allocation failed (all-or-nothing):`, creditError.message);
        
        // Cleanup all created student records and users (all-or-nothing)
        console.log(`🧹 Cleaning up ${createdStudents.length} students and users due to wallet creation failure...`);
        
        // Delete students and users in parallel for faster cleanup
        const cleanupPromises = createdStudents.map(async ({ sharedId }) => {
          try {
            // Delete student record
            await deleteStudentRecord(sharedId);
            // Delete user record
            await UserApiIntegrationService.deleteUser(sharedId.toString());
          } catch (cleanupError) {
            console.error(`Failed to cleanup student/user ${sharedId}:`, cleanupError);
          }
        });
        
        await Promise.all(cleanupPromises);
        console.log(`✅ Cleaned up ${createdStudents.length} students and users`);

        // Mark all as failed (all-or-nothing)
        for (const { rowNumber, originalRow } of createdStudents) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "walletCreation",
                message: creditError.message || "Failed to create student wallet and allocate credits",
              },
            ],
            data: originalRow,
          });
        }

        result.successful = 0;
        return result;
      }

      // ===== STEP 4: SEND BULK WELCOME EMAILS TO STUDENTS =====
      // Send emails asynchronously (don't block the response if email fails)
      try {
        const { generateLoginUrl } = require("../utils/email.helper");
        const loginUrl = generateLoginUrl(tenantName);
        
        // Get partner name once (reusable for all emails)
        const partnerName = await getPartnerNameFromDatabase(
          tenantId,
          tenantName || "Brighton AI"
        );

        // Prepare email data for all students
        // Match createdStudents with createdUsers by index (they should be in same order)
        const emailsData = createdStudents
          .filter((cs, index) => {
            // Only send if email and password exist
            if (!cs.studentData.email || !cs.studentData.password) {
              return false;
            }
            // Verify we have a corresponding user
            const user = createdUsers[index];
            return !!user;
          })
          .map(({ studentData, sharedId }, index) => {
            const userName = `${studentData.firstName} ${studentData.lastName}`;
            const createdUser = createdUsers[index];
            const userId = 
              createdUser?.data?.user?.id ||
              createdUser?.data?.id ||
              createdUser?.id ||
              createdUser?.data?.user?._id ||
              createdUser?.data?._id ||
              createdUser?._id ||
              sharedId.toString();

            return {
              recipientEmail: studentData.email!,
              templateName: "account-created",
              templateParams: {
                title: "Welcome onboard",
                userName: userName,
                role: "Student",
                email: studentData.email,
                password: studentData.password,
                loginUrl: loginUrl,
                tenantName: tenantName || "Brighton AI Education",
                partnerName: partnerName,
                features: [
                  "View and submit assignments online",
                  "Attempt exams and track your results",
                  "Check grades and academic performance"
                ],
              },
              receiverId: userId,
            };
          });

        // Only send if we have emails to send
        if (emailsData.length > 0) {
          console.log(`📧 Sending bulk welcome emails to ${emailsData.length} students...`);
          
          // Send bulk emails asynchronously - don't await to avoid blocking
          notificationService.sendBulkEmailsWithTemplate(
            emailsData,
            tenantId
          ).then(() => {
            console.log(`✅ Bulk welcome emails sent successfully to ${emailsData.length} students`);
          }).catch((emailError: any) => {
            // Log error but don't fail the bulk upload
            console.error(`⚠️ Failed to send bulk welcome emails:`, emailError.message);
          });
        } else {
          console.warn("⚠️ No emails to send (missing email or password for some students)");
        }
      } catch (emailError: any) {
        // Log error but don't fail the bulk upload
        console.error("⚠️ Error preparing bulk welcome emails:", emailError.message);
      }

      return result;
    } catch (error: any) {
      // If batch creation fails entirely, cleanup all records
      for (const { sharedId } of createdStudents) {
        try {
          await deleteStudentRecord(sharedId);
        } catch (cleanupError) {
          console.error("Failed to cleanup student:", cleanupError);
        }
      }

      // Add errors for all rows
      for (const { rowNumber, originalRow } of createdStudents) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            {
              field: "userCreation",
              message: error.message || "Failed to batch create users",
            },
          ],
          data: originalRow,
        });
      }

      result.successful = 0;
      return result;
    }
  } catch (error: any) {
    throw new Error(`Bulk upload failed: ${error.message}`);
  }
}

/**
 * In-memory validation for teacher data (no DB/API calls). Used for bulk upload Phase 1a.
 */
function validateTeacherDataInMemory(data: CreateTeacherRequest): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.email || data.email.trim().length === 0) {
    errors.push({ field: "email", message: "Email is required for teacher creation" });
  }
  if (!data.password || data.password.trim().length === 0) {
    errors.push({ field: "password", message: "Password is required for teacher creation" });
  }
  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push({ field: "firstName", message: "First name is required for teacher creation" });
  }
  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push({ field: "lastName", message: "Last name is required for teacher creation" });
  }
  if (!data.gender || data.gender.trim().length === 0) {
    errors.push({ field: "gender", message: "Gender is required for teacher creation" });
  } else {
    const validGenders = ["male", "female", "other", "prefer_not_to_say"];
    const normalizedGender = data.gender.toLowerCase().trim();
    if (!validGenders.includes(normalizedGender)) {
      errors.push({
        field: "gender",
        message: `Gender must be one of: ${validGenders.join(", ")}`,
      });
    }
  }
  if (data.email && data.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }
  if (data.password && data.password.trim().length > 0 && data.password.length < 6) {
    errors.push({
      field: "password",
      message: "Password must be at least 6 characters long",
    });
  }
  if (data.phoneNumber && data.phoneNumber.trim().length > 0 && !/^[\+]?[0-9\-\s]{10,20}$/.test(data.phoneNumber)) {
    errors.push({
      field: "phoneNumber",
      message:
        "Invalid phone number format. Must be 10-20 characters with optional + prefix",
    });
  }
  return errors;
}

/**
 * Validate teacher data and return all validation errors (for bulk upload)
 * Returns empty array if validation passes. Used for single-teacher flows; bulk uses in-memory + batch checks.
 */
async function validateTeacherDataForBulk(
  data: CreateTeacherRequest,
  tenantId: string
): Promise<ValidationError[]> {
  const errors = validateTeacherDataInMemory(data);
  if (errors.length > 0) return errors;
  try {
    const existingTeacherByEmail = await teacherRepository.findTeacherByEmail(
      data.email!,
      tenantId
    );
    if (existingTeacherByEmail) {
      errors.push({
        field: "email",
        message: `Teacher with email ${data.email} already exists in this tenant`,
      });
    }
    try {
      const userExistsCheck = await UserApiIntegrationService.checkUserExists(
        data.email!,
        data.email!.toLowerCase(),
        tenantId
      );
      if (userExistsCheck.exists) {
        // Don't add error - teacher check is sufficient for user feedback
      }
    } catch {
      // Ignore; teacher check is sufficient
    }
  } catch (error: any) {
    errors.push({
      field: "validation",
      message: `Failed to validate teacher data: ${error.message}`,
    });
  }
  return errors;
}

/**
 * Bulk upload teachers from CSV
 * All-or-nothing approach: If any row fails validation, no rows are created.
 * Uses batch validation (2 queries) and insertMany for performance (same level as student bulk upload).
 */
export async function bulkUploadTeachers(
  filePath: string,
  tenantId: string,
  tenantName: string
): Promise<BulkUploadResult> {
  const result: BulkUploadResult = {
    totalRows: 0,
    successful: 0,
    failed: 0,
    errorRows: [],
  };

  try {
    // Parse CSV
    const parsed = await parseCSV(filePath);
    result.totalRows = parsed.totalRows;

    // PHASE 1a: Transform all rows and run in-memory validation only
    const validatedRows: Array<{
      rowNumber: number;
      teacherData: CreateTeacherRequest;
      originalRow: ParsedCSVRow;
    }> = [];
    const emailMap = new Map<string, number[]>();

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 2;
      try {
        const teacherData = transformCSVRowToTeacher(row, tenantId, tenantName);
        if (teacherData.email) {
          const normalizedEmail = teacherData.email.toLowerCase().trim();
          if (!emailMap.has(normalizedEmail)) emailMap.set(normalizedEmail, []);
          emailMap.get(normalizedEmail)!.push(rowNumber);
        }
        const validationErrors = validateTeacherDataInMemory(teacherData);
        if (validationErrors.length > 0) {
          result.failed++;
          result.errorRows.push({ row: rowNumber, errors: validationErrors, data: row });
        } else {
          validatedRows.push({ rowNumber, teacherData, originalRow: row });
        }
      } catch (error: any) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "validation", message: error.message || "Unknown error" }],
          data: row,
        });
      }
    }

    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // PHASE 1b: Batch uniqueness checks (2 queries)
    const emails = validatedRows.map((r) => r.teacherData.email!.trim().toLowerCase());
    const duplicateEmailsInCsv = new Set<string>();
    emailMap.forEach((rowNumbers, email) => {
      if (rowNumbers.length > 1) duplicateEmailsInCsv.add(email);
    });

    const [existingTeacherEmails, existingUserEmails] = await Promise.all([
      teacherRepository.findExistingTeacherEmails(emails, tenantId),
      UserApiIntegrationService.checkUsersExistBatch(emails, tenantId),
    ]);
    const existingEmailsUnion = new Set([...existingTeacherEmails, ...existingUserEmails]);

    for (const { rowNumber, teacherData, originalRow } of validatedRows) {
      const emailLower = teacherData.email!.trim().toLowerCase();
      const errs: ValidationError[] = [];
      if (existingEmailsUnion.has(emailLower)) {
        errs.push({
          field: "email",
          message: `Teacher with email ${teacherData.email} already exists in this tenant`,
        });
      }
      if (duplicateEmailsInCsv.has(emailLower)) {
        errs.push({
          field: "email",
          message: "Duplicate email in upload file",
        });
      }
      if (errs.length > 0) {
        result.failed++;
        result.errorRows.push({ row: rowNumber, errors: errs, data: originalRow });
      }
    }

    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // Enforce seats/quota (0 means unlimited) - all-or-nothing
    try {
      await assertSeatAvailable({
        tenantId,
        type: "teacher",
        requested: validatedRows.length,
      });
    } catch (seatError: any) {
      const message =
        seatError?.message ||
        "Teacher seats are at full capacity. Please increase seats to create more.";
      for (const { rowNumber, originalRow } of validatedRows) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "seats", message }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2a: Reserve thrId range and generate sharedIds
    const mongoose = await import("mongoose");
    const counter = await AutoIdCounter.findOneAndUpdate(
      { _id: "THR" },
      { $inc: { seq: validatedRows.length } },
      { upsert: true, new: true }
    ).lean() as { _id: string; seq: number } | null;
    const baseSeq = (counter?.seq ?? validatedRows.length) - validatedRows.length;
    const thrIds = validatedRows.map((_, i) =>
      `THR-${String(baseSeq + i + 1).padStart(3, "0")}`
    );
    const sharedIds = validatedRows.map(() => new mongoose.Types.ObjectId());

    // Race check: ensure no email was taken between validation and insert
    const existingAgain = await teacherRepository.findExistingTeacherEmails(emails, tenantId);
    if (existingAgain.size > 0) {
      for (const { rowNumber, teacherData, originalRow } of validatedRows) {
        if (existingAgain.has(teacherData.email!.trim().toLowerCase())) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "email",
                message: `Teacher with email ${teacherData.email} already exists in this tenant`,
              },
            ],
            data: originalRow,
          });
        }
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2b: Build teacher docs and insertMany
    const teacherDocs: Partial<ITeacher>[] = validatedRows.map(({ teacherData }, i) => {
      const docs: { name: string; type: string; url: string; uploadedAt: Date }[] = Array.isArray(
        teacherData.documents
      )
        ? teacherData.documents
            .map((doc: any) => {
              if (!doc || typeof doc !== "object") return null;
              return {
                name: doc.name,
                type: doc.type,
                url: doc.url,
                uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
              };
            })
            .filter(
              (d): d is { name: string; type: string; url: string; uploadedAt: Date } =>
                d != null && !!d.name && !!d.type && !!d.url
            )
        : [];
      return {
        _id: sharedIds[i],
        thrId: thrIds[i],
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        email: teacherData.email,
        phoneNumber: teacherData.phoneNumber,
        address: teacherData.address || "Not provided",
        gender: teacherData.gender,
        joiningDate: new Date(teacherData.joiningDate || new Date()),
        qualification: teacherData.qualification,
        specialization: teacherData.specialization,
        experience: teacherData.experience,
        emergencyContact: teacherData.emergencyContact,
        emergencyPhone: teacherData.emergencyPhone,
        designation: teacherData.designation,
        demoPassword: teacherData.password,
        department: teacherData.department || "",
        salary: teacherData.salary || 0,
        bio: teacherData.bio || "",
        achievements: teacherData.achievements || [],
        certifications: teacherData.certifications || [],
        assignedClasses: [],
        assignedSubjects: [],
        documents: docs,
        status: "active" as const,
        tenantId,
        tenantName,
        createdBy: "academy-api",
        isActive: true,
        isDeleted: false,
      };
    });

    let insertedTeachers: any[];
    try {
      insertedTeachers = await teacherRepository.insertManyTeachers(teacherDocs);
    } catch (insertError: any) {
      let errorMessage = insertError?.message || "Unknown error";
      if (insertError?.code === 11000 && errorMessage.includes("employeeId")) {
        errorMessage =
          "Database migration required: Please restart the server to drop the old employeeId index. If the issue persists, manually drop the 'employeeId_1' index from the teachers collection in MongoDB.";
      }
      for (const { rowNumber, originalRow } of validatedRows) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "creation", message: errorMessage }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    const createdTeachers: Array<{
      rowNumber: number;
      teacher: any;
      teacherData: CreateTeacherRequest;
      sharedId: any;
      originalRow: ParsedCSVRow;
    }> = validatedRows.map((v, i) => ({
      rowNumber: v.rowNumber,
      teacher: insertedTeachers[i],
      teacherData: v.teacherData,
      sharedId: sharedIds[i],
      originalRow: v.originalRow,
    }));

    // Step 2b: Prepare all user data for batch creation
    const usersData = createdTeachers.map(({ teacherData, sharedId }) => {
      // Ensure password is always set (generate if missing) and update teacherData for email consistency
      if (!teacherData.password || teacherData.password.trim().length === 0) {
        teacherData.password = generateRandomPassword();
      }
      
      return {
        _id: sharedId.toString(),
        username: teacherData.email!.toLowerCase(),
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        email: teacherData.email,
        password: teacherData.password, // Ensure password is always set
        phoneNumber: teacherData.phoneNumber,
        tenantId: tenantId,
        tenantName: tenantName,
        userType: "teacher",
        roleName: "TEACHER",
        userAccessType: "private",
        isEmailVerified: false,
        isActive: true,
        createdBy: "academic-api",
      };
    });

    // Step 2c: Batch create all users in one call
    try {
      const bulkUserResponse = await UserApiIntegrationService.bulkCreateUsers(
        usersData
      );

      // Check if all users were created successfully
      const createdUsers =
        bulkUserResponse?.data?.created || bulkUserResponse?.created || [];
      const failedUsers =
        bulkUserResponse?.data?.failed || bulkUserResponse?.failed || [];

      // If any user creation failed, cleanup all records and return errors
      if (failedUsers.length > 0) {
        // Cleanup all created teacher records
        for (const { teacher } of createdTeachers) {
          try {
            await teacherRepository.softDeleteTeacherById(
              teacher._id.toString()
            );
          } catch (cleanupError) {
            console.error("Failed to cleanup teacher:", cleanupError);
          }
        }

        // Map failed users to their rows with better error messages
        for (const failedUser of failedUsers) {
          const email = failedUser.data?.email || failedUser.email;
          const matchingTeacher = createdTeachers.find(
            (ct) => ct.teacherData.email === email
          );
          if (matchingTeacher) {
            result.failed++;
            
            // Parse error message to determine field and message
            let errorField = "userCreation";
            let errorMessage = failedUser.error || "Failed to create user in user-api";
            
            // Check for duplicate email/username errors
            if (failedUser.error?.includes("USERNAME_EXISTS") || 
                failedUser.error?.includes("EMAIL_EXISTS") ||
                failedUser.error?.includes("duplicate key") ||
                failedUser.error?.includes("already exists")) {
              errorField = "email";
              if (failedUser.error.includes("USERNAME_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("EMAIL_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("duplicate key")) {
                errorMessage = "Email already exists in the system";
              } else {
                errorMessage = "Email already exists in the system";
              }
            }
            
            result.errorRows.push({
              row: matchingTeacher.rowNumber,
              errors: [
                {
                  field: errorField,
                  message: errorMessage,
                },
              ],
              data: matchingTeacher.originalRow,
            });
          }
        }

        result.successful = 0;
        return result;
      }

      // Step 2d: Bulk update teacher records with userId (one round-trip instead of N)
      const userIdUpdates = createdTeachers.map((createdTeacher, i) => {
        const createdUser = createdUsers[i];
        const userId =
          createdUser?.data?.user?.id ||
          createdUser?.data?.id ||
          createdUser?.id ||
          createdUser?.data?.user?._id ||
          createdUser?.data?._id ||
          createdUser?._id ||
          createdTeacher.sharedId.toString();
        return {
          teacherId: createdTeacher.teacher._id.toString(),
          userId,
        };
      });
      try {
        await teacherRepository.bulkUpdateUserIds(userIdUpdates);
      } catch (updateError) {
        console.error("Failed to bulk update teachers with userId:", updateError);
        // Not critical - teacher and user are created, just missing link
      }

      // All users created successfully
      result.successful = createdTeachers.length;

      // ===== STEP 3: SEND BULK WELCOME EMAILS TO TEACHERS =====
      // Send emails asynchronously (don't block the response if email fails)
      try {
        const loginUrl = process.env.LOGIN_URL || "http://localhost:3000/auth/login";
        
        // Get partner name once (reusable for all emails)
        const partnerName = await getPartnerNameFromDatabase(
          tenantId,
          tenantName || "Brighton AI"
        );

        // Prepare email data for all teachers
        // Match createdTeachers with createdUsers by index (they should be in same order)
        const emailsData = createdTeachers
          .filter((ct, index) => {
            // Only send if email and password exist
            if (!ct.teacherData.email || !ct.teacherData.password) {
              return false;
            }
            // Verify we have a corresponding user
            const user = createdUsers[index];
            return !!user;
          })
          .map(({ teacherData, sharedId }, index) => {
            const userName = `${teacherData.firstName} ${teacherData.lastName}`;
            const createdUser = createdUsers[index];
            const userId = 
              createdUser?.data?.user?.id ||
              createdUser?.data?.id ||
              createdUser?.id ||
              createdUser?.data?.user?._id ||
              createdUser?.data?._id ||
              createdUser?._id ||
              sharedId.toString();

            return {
              recipientEmail: teacherData.email!,
              templateName: "account-created",
              templateParams: {
                title: "Welcome onboard",
                userName: userName,
                role: "Teacher",
                email: teacherData.email,
                password: teacherData.password,
                loginUrl: loginUrl,
                tenantName: tenantName || "Brighton AI Education",
                partnerName: partnerName,
                features: [
                  "Create and manage assignments for your classes",
                  "Evaluate student submissions and assign grades",
                  "Track student performance and academic progress"
                ],
              },
              receiverId: userId,
            };
          });

        // Only send if we have emails to send
        if (emailsData.length > 0) {
          console.log(`📧 Sending bulk welcome emails to ${emailsData.length} teachers...`);
          
          // Send bulk emails asynchronously - don't await to avoid blocking
          notificationService.sendBulkEmailsWithTemplate(
            emailsData,
            tenantId
          ).then(() => {
            console.log(`✅ Bulk welcome emails sent successfully to ${emailsData.length} teachers`);
          }).catch((emailError: any) => {
            // Log error but don't fail the bulk upload
            console.error(`⚠️ Failed to send bulk welcome emails:`, emailError.message);
          });
        } else {
          console.warn("⚠️ No emails to send (missing email or password for some teachers)");
        }
      } catch (emailError: any) {
        // Log error but don't fail the bulk upload
        console.error("⚠️ Error preparing bulk welcome emails:", emailError.message);
      }

      return result;
    } catch (error: any) {
      // If batch creation fails entirely, cleanup all records
      for (const { teacher } of createdTeachers) {
        try {
          await teacherRepository.softDeleteTeacherById(teacher._id.toString());
        } catch (cleanupError) {
          console.error("Failed to cleanup teacher:", cleanupError);
        }
      }

      // Add errors for all rows
      for (const { rowNumber, originalRow } of createdTeachers) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            {
              field: "userCreation",
              message: error.message || "Failed to batch create users",
            },
          ],
          data: originalRow,
        });
      }

      result.successful = 0;
      return result;
    }
  } catch (error: any) {
    throw new Error(`Bulk upload failed: ${error.message}`);
  }
}

/**
 * In-memory validation for parent data (no DB/API calls). Used for bulk upload Phase 1a.
 */
function validateParentDataInMemory(data: CreateParentRequest): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.email || data.email.trim().length === 0) {
    errors.push({ field: "email", message: "Email is required for parent creation" });
  }
  if (!data.password || data.password.trim().length === 0) {
    errors.push({ field: "password", message: "Password is required for parent creation" });
  }
  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push({ field: "firstName", message: "First name is required for parent creation" });
  }
  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push({ field: "lastName", message: "Last name is required for parent creation" });
  }
  if (!data.role) {
    errors.push({
      field: "role",
      message: "Role is required for parent creation. Must be one of: father, mother, guardian",
    });
  } else {
    const validRoles = ["father", "mother", "guardian"];
    const normalizedRole = data.role.toLowerCase();
    if (!validRoles.includes(normalizedRole)) {
      errors.push({
        field: "role",
        message: `Invalid role. Role must be one of: ${validRoles.join(", ")}`,
      });
    } else {
      (data as any).role = normalizedRole;
    }
  }
  if (data.role) {
    const normalizedRole = data.role.toLowerCase();
    if (normalizedRole === "guardian") {
      if (!data.gender || (typeof data.gender === "string" && data.gender.trim().length === 0)) {
        errors.push({ field: "gender", message: "Gender is required when role is 'guardian'" });
      } else {
        const validGenders = ["male", "female", "other", "prefer_not_to_say"];
        const normalizedGender =
          typeof data.gender === "string"
            ? data.gender.toLowerCase().trim()
            : String(data.gender).toLowerCase().trim();
        if (!validGenders.includes(normalizedGender)) {
          errors.push({
            field: "gender",
            message: `Gender must be one of: ${validGenders.join(", ")}`,
          });
        } else {
          (data as any).gender = normalizedGender;
        }
      }
    } else {
      delete (data as any).gender;
    }
  }
  if (data.email && data.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: "email", message: "Invalid email format" });
  }
  if (data.password && data.password.trim().length > 0 && data.password.length < 6) {
    errors.push({
      field: "password",
      message: "Password must be at least 6 characters long",
    });
  }
  if (
    data.phoneNumber &&
    data.phoneNumber.trim().length > 0 &&
    !/^[\+]?[0-9\-\s]{10,20}$/.test(data.phoneNumber)
  ) {
    errors.push({
      field: "phoneNumber",
      message:
        "Invalid phone number format. Must be 10-20 characters with optional + prefix",
    });
  }
  return errors;
}

/**
 * Validate parent data and return all validation errors (for bulk upload)
 * Returns empty array if validation passes. Used for single-parent flows; bulk uses in-memory + batch checks.
 */
async function validateParentDataForBulk(
  data: CreateParentRequest,
  tenantId: string
): Promise<ValidationError[]> {
  const errors = validateParentDataInMemory(data);

  // Children/Student IDs validation - required field
  const childrenIdsForValidation =
    data.studentIds || data.childrenIds || data.children;
  if (
    !childrenIdsForValidation ||
    !Array.isArray(childrenIdsForValidation) ||
    childrenIdsForValidation.length === 0
  ) {
    errors.push({
      field: "children",
      message:
        "At least one child (student) must be assigned to the parent. Please provide studentIds, childrenIds, or children field with at least one student ID.",
    });
    return errors;
  }

    // Validate role conflicts with existing parents in database
    // Each child can have max 1 father, 1 mother, 1 guardian
    if (data.role) {
      const parentRole = data.role.toLowerCase();
      const roleConflicts: Array<{
        childId: string;
        childName?: string;
        childStdId?: string;
        existingParentName?: string;
      }> = [];

      for (const childId of childrenIdsForValidation) {
        try {
          // Validate child ID format
          if (!mongoose.Types.ObjectId.isValid(childId)) {
            continue; // Skip invalid IDs (already caught above)
          }

          // Get all existing parents for this child
          const existingParents =
            await parentChildRepository.findParentsByChildId(childId);

          // Check if any existing parent has the same role
          for (const existingParentChild of existingParents) {
            const existingParent = existingParentChild.parentId as any;

            // Check parent's role field (if populated) or relationship field
            const existingRole =
              existingParent?.role?.toLowerCase() ||
              existingParentChild.relationship?.toLowerCase();

            if (existingRole === parentRole) {
              // Get child name and stdId for better error message
              try {
                const child = await studentRepository.findStudentById(childId);
                const childName = child
                  ? `${child.firstName} ${child.lastName}`
                  : childId;
                const childStdId = (child as any)?.stdId || undefined;
                const existingParentName = existingParent
                  ? `${existingParent.firstName} ${existingParent.lastName}`
                  : "Unknown";

                roleConflicts.push({
                  childId,
                  childName,
                  childStdId,
                  existingParentName,
                });
                break; // Found conflict, no need to check other parents
              } catch (childError) {
                // If we can't get child name, still add the conflict
                roleConflicts.push({
                  childId,
                  childName: childId,
                  childStdId: undefined,
                  existingParentName: existingParent
                    ? `${existingParent.firstName} ${existingParent.lastName}`
                    : "Unknown",
                });
                break;
              }
            }
          }
        } catch (error: any) {
          // Skip errors during conflict check to collect all conflicts
          console.warn(
            `Error checking role conflict for child ${childId}:`,
            error.message
          );
        }
      }

      // If any conflicts found, add errors
      if (roleConflicts.length > 0) {
        const conflictMessages = roleConflicts.map((conflict) => {
          const roleDisplay =
            parentRole.charAt(0).toUpperCase() + parentRole.slice(1);
          const stdIdPart = conflict.childStdId ? `with ${conflict.childStdId} ` : "";
          
          if (conflict.childName && conflict.existingParentName) {
            return `Child ${stdIdPart}"${conflict.childName}" already has a ${roleDisplay} parent (${conflict.existingParentName})`;
          } else if (conflict.childName) {
            return `Child ${stdIdPart}"${conflict.childName}" already has a ${roleDisplay} parent`;
          } else {
            return `Child with ID "${conflict.childId}" already has a ${roleDisplay} parent`;
          }
        });

      // Simplified error message - show first conflict
      if (conflictMessages.length === 1) {
        errors.push({
          field: "children",
          message: conflictMessages[0],
        });
      } else {
        errors.push({
          field: "children",
          message:
            conflictMessages.slice(0, 3).join("; ") +
            (conflictMessages.length > 3
              ? `; and ${conflictMessages.length - 3} more`
              : ""),
        });
      }
    }
  }

  // Format validations (only if field exists)
  if (data.email && data.email.trim().length > 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({ field: "email", message: "Invalid email format" });
    }
  }

  if (data.password && data.password.trim().length > 0) {
    if (data.password.length < 6) {
      errors.push({
        field: "password",
        message: "Password must be at least 6 characters long",
      });
    }
  }

  if (data.phoneNumber && data.phoneNumber.trim().length > 0) {
    if (!/^[\+]?[0-9\-\s]{10,20}$/.test(data.phoneNumber)) {
      errors.push({
        field: "phoneNumber",
        message:
          "Invalid phone number format. Must be 10-20 characters with optional + prefix",
      });
    }
  }

  // Uniqueness validations for bulk upload
  // NOTE: We do NOT check for existing parents by email here because:
  // 1. Existing parents will be handled as UPDATES in Phase 1.6-1.7
  // 2. The bulk upload flow splits rows into newParents and existingParents
  // 3. Existing parents are allowed - they will be updated and new children will be linked

  // Only check for parentId conflicts (if provided) - this is a business rule constraint
  try {
    // Check for existing parent with same parentId (if parentId is provided)
    // Note: parentId is a business identifier, so if it exists, it's still a conflict even for updates
    if (data.parentId && data.parentId.trim().length > 0) {
      const existingParentByParentId =
        await parentRepository.findParentByParentId(data.parentId, tenantId);
      if (existingParentByParentId) {
        // Check if it's the same parent (by email) - if so, allow it (it's an update)
        const existingParentByEmail = await parentRepository.findParentByEmail(
          data.email!,
          tenantId
        );
        // Only error if parentId exists but belongs to a different parent (different email)
        if (
          existingParentByEmail &&
          existingParentByEmail._id.toString() !==
            existingParentByParentId._id.toString()
        ) {
          errors.push({
            field: "parentId",
            message: `Parent ID ${data.parentId} is already assigned to a different parent in this tenant`,
          });
        }
      }
    }

    // Check if user exists in user-api ONLY if parent doesn't exist locally
    // This catches edge cases where user exists but parent record is missing
    const existingParentByEmail = await parentRepository.findParentByEmail(
      data.email!,
      tenantId
    );

    // Only check user-api if parent doesn't exist locally (new parent scenario)
    // If parent exists locally, we'll update it (existing parent scenario)
    if (!existingParentByEmail) {
      const username = data.email!.toLowerCase();
      try {
        const userExistsCheck = await UserApiIntegrationService.checkUserExists(
          data.email!,
          username,
          tenantId
        );
        if (userExistsCheck.exists) {
          // User exists in user-api but parent doesn't exist locally
          // This is a conflict - user exists but parent record is missing
          errors.push({
            field: "email",
            message: `User with email ${data.email} already exists in user-api, but parent record is missing. Please contact support.`,
          });
        }
      } catch (checkError: any) {
        // If checkUserExists throws an error about user existing, add it
        if (
          checkError.message.includes("already exists") ||
          checkError.message.includes("USERNAME_EXISTS") ||
          checkError.message.includes("EMAIL_EXISTS") ||
          checkError.message.includes("exists in user-api")
        ) {
          errors.push({
            field: "email",
            message: `User with email ${data.email} already exists in user-api, but parent record is missing. Please contact support.`,
          });
        } else {
          // For other errors (like network issues), skip silently or log
          // Don't block bulk upload for network issues with user-api check
          console.warn(
            `Failed to check user existence for ${data.email}:`,
            checkError.message
          );
        }
      }
    }
  } catch (error: any) {
    errors.push({
      field: "validation",
      message: `Failed to validate parent data: ${error.message}`,
    });
  }

  return errors;
}

/**
 * Bulk upload parents from CSV
 * All-or-nothing approach: If any row fails validation, no rows are created
 */
export async function bulkUploadParents(
  filePath: string,
  tenantId: string,
  tenantName: string
): Promise<BulkUploadResult> {
  const result: BulkUploadResult = {
    totalRows: 0,
    successful: 0,
    failed: 0,
    errorRows: [],
  };

  try {
    // Parse CSV
    const parsed = await parseCSV(filePath);
    result.totalRows = parsed.totalRows;

    // PHASE 1a: Transform and in-memory validation only
    const validatedRows: Array<{
      rowNumber: number;
      parentData: CreateParentRequest;
      originalRow: ParsedCSVRow;
    }> = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const rowNumber = i + 2;
      try {
        const parentData = transformCSVRowToParent(row, tenantId, tenantName);
        const validationErrors = validateParentDataInMemory(parentData);
        if (validationErrors.length > 0) {
          result.failed++;
          result.errorRows.push({ row: rowNumber, errors: validationErrors, data: row });
        } else {
          validatedRows.push({ rowNumber, parentData, originalRow: row });
        }
      } catch (error: any) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "validation", message: error.message || "Unknown error" }],
          data: row,
        });
      }
    }

    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // PHASE 1b: Batch stdId resolution (one query for all stdIds)
    const allStdIds: string[] = [];
    for (const { parentData } of validatedRows) {
      const stdIds = (parentData as any).__stdIds;
      if (Array.isArray(stdIds)) for (const s of stdIds) if (s && String(s).trim()) allStdIds.push(String(s).trim());
    }
    const stdIdToStudentId = allStdIds.length > 0
      ? await studentRepository.findStudentsByStdIds([...new Set(allStdIds)], tenantId)
      : new Map<string, string>();

    for (const { rowNumber, parentData, originalRow } of validatedRows) {
      const stdIds = (parentData as any).__stdIds;
      if (!stdIds || !Array.isArray(stdIds) || stdIds.length === 0) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            {
              field: "children",
              message:
                "At least one child (student) must be assigned. Provide studentIds or children column with stdIds (e.g. STD-001, STD-002).",
            },
          ],
          data: originalRow,
        });
        continue;
      }
      const studentObjectIds: string[] = [];
      const invalidStdIds: string[] = [];
      for (const stdId of stdIds) {
        const sid = stdIdToStudentId.get(String(stdId).toUpperCase());
        if (sid) studentObjectIds.push(sid);
        else invalidStdIds.push(String(stdId));
      }
      if (invalidStdIds.length > 0) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            {
              field: "children",
              message: `Invalid or not found stdIds: ${invalidStdIds.join(", ")}. Ensure all stdIds exist in the same tenant.`,
            },
          ],
          data: originalRow,
        });
      } else if (studentObjectIds.length === 0) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            { field: "children", message: "No valid students found for the provided stdIds. At least one child is required." },
          ],
          data: originalRow,
        });
      } else {
        parentData.studentIds = studentObjectIds;
        delete (parentData as any).__stdIds;
      }
    }

    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // PHASE 1.5: Cross-row validation - Check for duplicate roles within CSV
    // Build map: childId → roles being assigned in this CSV batch
    const csvChildRoleMap = new Map<string, Map<string, number>>(); // childId → role → rowNumber
    const crossRowConflicts: Array<{
      rowNumber: number;
      error: ValidationError;
    }> = [];

    for (const { parentData, rowNumber } of validatedRows) {
      const role = parentData.role?.toLowerCase();
      const childrenIds =
        parentData.studentIds ||
        parentData.childrenIds ||
        (parentData as any).children ||
        [];

      // Track roles being assigned to children in this CSV
      for (const childId of childrenIds) {
        if (!csvChildRoleMap.has(childId)) {
          csvChildRoleMap.set(childId, new Map());
        }
        if (role) {
          const roleMap = csvChildRoleMap.get(childId)!;
          // If this role already exists in CSV for this child, mark as conflict
          if (roleMap.has(role)) {
            const conflictingRowNumber = roleMap.get(role)!;
            const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

            crossRowConflicts.push({
              rowNumber,
              error: {
                field: "children",
                message: `Child ID "${childId}" is being assigned a ${roleDisplay} parent in multiple rows of this CSV (rows ${conflictingRowNumber} and ${rowNumber}). Each child can have only one parent per role.`,
              },
            });
          } else {
            roleMap.set(role, rowNumber);
          }
        }
      }
    }

    // If any cross-row conflicts found, add to errors (all-or-nothing)
    if (crossRowConflicts.length > 0) {
      for (const conflict of crossRowConflicts) {
        const originalRow = validatedRows.find(
          (vr) => vr.rowNumber === conflict.rowNumber
        )?.originalRow;
        result.failed++;
        result.errorRows.push({
          row: conflict.rowNumber,
          errors: [conflict.error],
          data: originalRow || {},
        });
      }
      result.successful = 0;
      return result;
    }

    // PHASE 1.6: Fetch existing parents / user-api users / existing child roles + role conflict (BATCHED / parallel)
    const emailsInCSV = validatedRows
      .map((vr) => vr.parentData.email?.toLowerCase())
      .filter(Boolean) as string[];

    const parentIdsInCSV = validatedRows
      .map((v) => v.parentData.parentId?.trim())
      .filter(Boolean) as string[];

    const allChildIds: string[] = [];
    for (const { parentData } of validatedRows) {
      const ids =
        parentData.studentIds ||
        parentData.childrenIds ||
        (parentData as any).children ||
        [];
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (id && String(id).trim()) {
            allChildIds.push(String(id).trim());
          }
        }
      }
    }
    const uniqueChildIds = [...new Set(allChildIds)];

    const [
      existingParentsFromDb,
      existingUserEmailsList,
      existingRoleByChildId,
      parentIdToParent,
      existingRelationsByChildId,
    ] = await Promise.all([
      emailsInCSV.length > 0
        ? parentRepository.findParentsByEmails(emailsInCSV, tenantId)
        : Promise.resolve([]),
      emailsInCSV.length > 0
        ? UserApiIntegrationService.checkUsersExistBatch(emailsInCSV, tenantId)
        : Promise.resolve([]),
      uniqueChildIds.length > 0
        ? parentChildRepository.findParentChildRolesByChildIds(uniqueChildIds)
        : Promise.resolve(new Map<string, Set<string>>()),
      parentIdsInCSV.length > 0
        ? parentRepository.findParentsByParentIds(
            [...new Set(parentIdsInCSV)],
            tenantId
          )
        : Promise.resolve([]),
      uniqueChildIds.length > 0
        ? parentChildRepository.findParentChildRelationsByChildIds(
            uniqueChildIds
          )
        : Promise.resolve(
            new Map<string, Array<{ parentId: string; relationship: string }>>()
          ),
    ]);

    const existingParentsMap = new Map<string, any>(); // email (lowercase) → parent document
    for (const parent of (existingParentsFromDb as any[]) || []) {
      if (parent?.email) {
        existingParentsMap.set(String(parent.email).toLowerCase(), parent);
      }
    }

    const existingUserEmails = new Set(
      ((existingUserEmailsList as any[]) || []).map((e) =>
        String(e).toLowerCase()
      )
    );

    const parentIdMap = new Map<string, any>();
    for (const p of (parentIdToParent as any[]) || []) {
      if (p.parentId) parentIdMap.set(p.parentId, p);
    }

    for (const { rowNumber, parentData, originalRow } of validatedRows) {
      const email = parentData.email?.toLowerCase();
      const isExistingParent = email ? existingParentsMap.has(email) : false;
      if (!isExistingParent && email && existingUserEmails.has(email)) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [
            {
              field: "email",
              message: `User with email ${parentData.email} already exists. Parent record may be missing - contact support or use update flow.`,
            },
          ],
          data: originalRow,
        });
      }
      const role = parentData.role?.toLowerCase();
      const childIds = parentData.studentIds || parentData.childrenIds || (parentData as any).children || [];
      for (const cid of childIds) {
        const existingRoles = existingRoleByChildId.get(String(cid));
        if (existingRoles && role && existingRoles.has(role)) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "children",
                message: `Child already has a ${role.charAt(0).toUpperCase() + role.slice(1)} parent in this tenant.`,
              },
            ],
            data: originalRow,
          });
          break;
        }
      }
      if (parentData.parentId && parentData.parentId.trim()) {
        const existingByParentId = parentIdMap.get(parentData.parentId.trim());
        const existingByEmail = email ? existingParentsMap.get(email) : null;
        if (
          existingByParentId &&
          existingByEmail &&
          existingByParentId._id.toString() !== existingByEmail._id.toString()
        ) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "parentId",
                message: `Parent ID ${parentData.parentId} is already assigned to a different parent in this tenant.`,
              },
            ],
            data: originalRow,
          });
        }
      }
    }

    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // PHASE 1.7: Split validated rows into new and existing parents (batch role conflict for existing)
    const newParents: Array<{
      rowNumber: number;
      parentData: CreateParentRequest;
      originalRow: ParsedCSVRow;
    }> = [];

    const existingParents: Array<{
      rowNumber: number;
      parentData: CreateParentRequest;
      originalRow: ParsedCSVRow;
      existingParent: any; // Existing parent document
    }> = [];

    for (const { parentData, rowNumber, originalRow } of validatedRows) {
      const email = parentData.email?.toLowerCase();
      const existingParent = email ? existingParentsMap.get(email) : null;

      if (existingParent) {
        // Parent exists - will UPDATE; validate role conflicts in-memory using pre-fetched relations
        const newRole = parentData.role?.toLowerCase();
        const childrenIds =
          parentData.studentIds ||
          parentData.childrenIds ||
          (parentData as any).children ||
          [];
        let hasOtherParentWithNewRole = false;
        for (const childId of childrenIds) {
          const rels = existingRelationsByChildId.get(String(childId)) || [];
          const otherWithNewRole = rels.some(
            (r) =>
              r.parentId !== existingParent._id.toString() &&
              r.relationship === newRole
          );
          if (otherWithNewRole) {
            hasOtherParentWithNewRole = true;
            break;
          }
        }
        if (hasOtherParentWithNewRole) {
          const roleDisplay = newRole ? newRole.charAt(0).toUpperCase() + newRole.slice(1) : "Unknown";
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "children",
                message: `Cannot update parent role: a child already has a different ${roleDisplay} parent.`,
              },
            ],
            data: originalRow,
          });
        } else {
          existingParents.push({
            rowNumber,
            parentData,
            originalRow,
            existingParent,
          });
        }
      } else {
        // Parent doesn't exist - will CREATE
        // Edge Case 1 & 2: Already validated in Phase 1
        newParents.push({
          rowNumber,
          parentData,
          originalRow,
        });
      }
    }

    // If any validation failed after splitting, return (all-or-nothing)
    if (result.errorRows.length > 0) {
      result.successful = 0;
      return result;
    }

    // Enforce seats/quota for NEW parents only (0 means unlimited) - all-or-nothing
    try {
      await assertSeatAvailable({
        tenantId,
        type: "parent",
        requested: newParents.length,
      });
    } catch (seatError: any) {
      const message =
        seatError?.message ||
        "Parent seats are at full capacity. Please increase seats to create more.";
      for (const { rowNumber, originalRow } of newParents) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "seats", message }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }

    // PHASE 2: All validations passed, now create/update all rows
    const mongoose = await import("mongoose");

    const createdParents: Array<{
      rowNumber: number;
      parent: any;
      parentData: CreateParentRequest;
      sharedId: any;
      originalRow: ParsedCSVRow;
      parentChildIds: string[];
    }> = [];

    // Step 2a: Create new parents in bulk (insertMany + bulk ParentChild)
    if (newParents.length > 0) {
      const counter = await AutoIdCounter.findOneAndUpdate(
        { _id: "PRT" },
        { $inc: { seq: newParents.length } },
        { upsert: true, new: true }
      ).lean() as { _id: string; seq: number } | null;
      const baseSeq = (counter?.seq ?? newParents.length) - newParents.length;
      const prtIds = newParents.map((_, i) =>
        `PRT-${String(baseSeq + i + 1).padStart(3, "0")}`
      );
      const sharedIds = newParents.map(() => new mongoose.Types.ObjectId());

      const parentDocs = newParents.map(({ parentData }, i) => {
        const doc: any = {
          _id: sharedIds[i],
          prtId: prtIds[i],
          firstName: parentData.firstName,
          lastName: parentData.lastName,
          email: parentData.email,
          role: parentData.role,
          phoneNumber: parentData.phoneNumber,
          demoPassword: parentData.password,
          status: "active" as const,
          tenantId,
          tenantName,
          createdBy: "academy-api",
          isActive: true,
          isDeleted: false,
        };
        if (parentData.role?.toLowerCase() === "guardian" && parentData.gender)
          doc.gender = parentData.gender;
        if (parentData.address !== undefined) doc.address = parentData.address;
        if (parentData.profilePicture !== undefined) doc.profilePicture = parentData.profilePicture;
        if (parentData.parentId !== undefined) doc.parentId = parentData.parentId;
        if (parentData.occupation !== undefined) doc.occupation = parentData.occupation;
        if (parentData.relationship !== undefined) doc.relationship = parentData.relationship;
        if (parentData.maritalStatus !== undefined) doc.maritalStatus = parentData.maritalStatus;
        if (parentData.emergencyContact !== undefined) doc.emergencyContact = parentData.emergencyContact;
        if (parentData.emergencyPhone !== undefined) doc.emergencyPhone = parentData.emergencyPhone;
        return doc;
      });

      let insertedParents: any[];
      try {
        insertedParents = await parentRepository.insertManyParents(parentDocs);
      } catch (insertErr: any) {
        for (const { rowNumber, originalRow } of newParents) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [{ field: "creation", message: insertErr?.message || "Unknown error" }],
            data: originalRow,
          });
        }
        result.successful = 0;
        return result;
      }

      const linkCountPerParent = newParents.map(
        (p) => (p.parentData.studentIds || p.parentData.childrenIds || (p.parentData as any).children || []).length
      );
      const parentChildDocs: Partial<import("../models").IParentChild>[] = [];
      for (let i = 0; i < newParents.length; i++) {
        const role = newParents[i].parentData.role?.toLowerCase() || "other";
        const childIds =
          newParents[i].parentData.studentIds ||
          newParents[i].parentData.childrenIds ||
          (newParents[i].parentData as any).children ||
          [];
        for (const cid of childIds) {
          parentChildDocs.push({
            parentId: sharedIds[i],
            childId: new mongoose.Types.ObjectId(cid),
            tenantId,
            tenantName,
            relationship: role as "father" | "mother" | "guardian" | "other",
            isPrimary: false,
            status: STATUS.ACTIVE,
            isActive: true,
            isDeleted: false,
            createdBy: "academy-api",
          });
        }
      }

      let insertedRelations: any[];
      try {
        insertedRelations = await parentChildRepository.insertManyParentChildren(parentChildDocs);
      } catch (linkErr: any) {
        for (const p of insertedParents) {
          try {
            await parentRepository.softDeleteParentById(p._id.toString());
          } catch (_) {}
        }
        for (const { rowNumber, originalRow } of newParents) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [{ field: "children", message: linkErr?.message || "Failed to link children" }],
            data: originalRow,
          });
        }
        result.successful = 0;
        return result;
      }

      let idx = 0;
      for (let i = 0; i < newParents.length; i++) {
        const n = linkCountPerParent[i];
        const ids = insertedRelations.slice(idx, idx + n).map((r: any) => r._id.toString());
        idx += n;
        createdParents.push({
          rowNumber: newParents[i].rowNumber,
          parent: insertedParents[i],
          parentData: newParents[i].parentData,
          sharedId: sharedIds[i],
          originalRow: newParents[i].originalRow,
          parentChildIds: ids,
        });
      }
    }

    // Step 2b: Update existing parents and link their children (BATCHED - same level as student/teacher bulk)
    const updatedParents: Array<{
      rowNumber: number;
      parent: any;
      parentData: CreateParentRequest;
      originalRow: ParsedCSVRow;
      parentChildIds: string[];
    }> = [];

    if (existingParents.length > 0) {
      const existingParentIds = existingParents.map((e) => e.existingParent._id.toString());
      // Batch 1: Fetch all current ParentChild relations for these parents (one query)
      const relationsByParent = await parentChildRepository.findParentChildRelationsByParentIds(existingParentIds);
      const parentIdToRelations = new Map<string, Array<{ childId: string; relationship: string; _id: string }>>();
      const childIdsFromCurrentRelations = new Set<string>();
      for (const r of relationsByParent) {
        childIdsFromCurrentRelations.add(r.childId);
        if (!parentIdToRelations.has(r.parentId)) parentIdToRelations.set(r.parentId, []);
        parentIdToRelations.get(r.parentId)!.push({ childId: r.childId, relationship: r.relationship, _id: r._id });
      }
      const csvChildIdSet = new Set(allChildIds);
      const missingChildIds = [...childIdsFromCurrentRelations].filter((c) => !csvChildIdSet.has(c));
      let relationsByChildForRoleCheck = existingRelationsByChildId;
      if (missingChildIds.length > 0) {
        const extraRels = await parentChildRepository.findParentChildRelationsByChildIds(missingChildIds);
        relationsByChildForRoleCheck = new Map(existingRelationsByChildId);
        for (const [cid, arr] of extraRels) relationsByChildForRoleCheck.set(cid, arr);
      }

      // Role-change conflict check in memory
      const failedRoleConflictIndices = new Set<number>();
      for (let i = 0; i < existingParents.length; i++) {
        const { parentData, rowNumber, originalRow, existingParent } = existingParents[i];
        const existingParentRole = existingParent.role?.toLowerCase();
        const newRoleValue = parentData.role?.toLowerCase();
        const isRoleChanging = existingParentRole && newRoleValue && existingParentRole !== newRoleValue;
        if (!isRoleChanging) continue;
        const currentChildren = parentIdToRelations.get(existingParent._id.toString()) || [];
        for (const rel of currentChildren) {
          const relsForChild = relationsByChildForRoleCheck.get(rel.childId) || [];
          const otherWithNewRole = relsForChild.some(
            (r) => r.parentId !== existingParent._id.toString() && r.relationship === newRoleValue
          );
          if (otherWithNewRole) {
            const roleDisplay = newRoleValue ? newRoleValue.charAt(0).toUpperCase() + newRoleValue.slice(1) : "Unknown";
            result.failed++;
            result.errorRows.push({
              row: rowNumber,
              errors: [{ field: "children", message: `Cannot update parent role: a child already has a different ${roleDisplay} parent.` }],
              data: originalRow,
            });
            failedRoleConflictIndices.add(i);
            break;
          }
        }
      }

      const existingParentsToProcess = existingParents.filter((_, i) => !failedRoleConflictIndices.has(i));
      if (existingParentsToProcess.length > 0) {
        // Build parent updates and run bulk update (one round-trip)
        const parentUpdates = existingParentsToProcess.map(({ parentData, existingParent }) => {
          const updateData: any = {};
          if (parentData.firstName) updateData.firstName = parentData.firstName;
          if (parentData.lastName) updateData.lastName = parentData.lastName;
          if (parentData.phoneNumber) updateData.phoneNumber = parentData.phoneNumber;
          if (parentData.role) updateData.role = parentData.role.toLowerCase();
          if (parentData.address !== undefined) updateData.address = parentData.address;
          if (parentData.profilePicture !== undefined) updateData.profilePicture = parentData.profilePicture;
          if (parentData.occupation !== undefined) updateData.occupation = parentData.occupation;
          if (parentData.relationship !== undefined) updateData.relationship = parentData.relationship;
          if (parentData.maritalStatus !== undefined) updateData.maritalStatus = parentData.maritalStatus;
          if (parentData.emergencyContact !== undefined) updateData.emergencyContact = parentData.emergencyContact;
          if (parentData.emergencyPhone !== undefined) updateData.emergencyPhone = parentData.emergencyPhone;
          return { parentId: existingParent._id.toString(), updateData };
        });
        await parentRepository.bulkUpdateParents(parentUpdates);

        // Fetch updated parent docs (one query)
        const updatedParentDocs = await parentRepository.findParentsByIds(
          existingParentsToProcess.map((e) => e.existingParent._id.toString())
        );
        const parentDocMap = new Map<string, any>();
        for (const d of updatedParentDocs as any[]) {
          if (d._id) parentDocMap.set(d._id.toString(), d);
        }

        // Role-change: bulk update all ParentChild relationships for parents that changed role (one bulkWrite)
        const roleChangeUpdates: Array<{ parentId: string; relationship: string }> = [];
        for (const { parentData, existingParent } of existingParentsToProcess) {
          const existingParentRole = existingParent.role?.toLowerCase();
          const newRoleValue = parentData.role?.toLowerCase();
          const isRoleChanging = existingParentRole && newRoleValue && existingParentRole !== newRoleValue;
          if (isRoleChanging && newRoleValue && newRoleValue !== "other") {
            roleChangeUpdates.push({ parentId: existingParent._id.toString(), relationship: newRoleValue });
          }
        }
        if (roleChangeUpdates.length > 0) {
          await parentChildRepository.bulkUpdateRelationshipsByParentIds(roleChangeUpdates);
        }

        // Build flat list of (rowIndex, parentId, childId, role) for linking; childIds already validated in Phase 1b
        const allChildIdsFromExisting = new Set<string>();
        const pairs: Array<{ rowIndex: number; parentId: string; childId: string; role: string }> = [];
        for (let rowIndex = 0; rowIndex < existingParentsToProcess.length; rowIndex++) {
          const { parentData, existingParent } = existingParentsToProcess[rowIndex];
          const childrenToLink = parentData.studentIds || parentData.childrenIds || (parentData as any).children || [];
          const roleValue = parentData.role?.toLowerCase();
          const role = roleValue === "father" || roleValue === "mother" || roleValue === "guardian" ? roleValue : "other";
          const parentId = existingParent._id.toString();
          for (const childId of childrenToLink) {
            const cid = String(childId).trim();
            if (!mongoose.Types.ObjectId.isValid(cid)) continue;
            allChildIdsFromExisting.add(cid);
            pairs.push({ rowIndex, parentId, childId: cid, role });
          }
        }

        const processParentIds = existingParentsToProcess.map((e) => e.existingParent._id.toString());
        const existingLinks = await parentChildRepository.findParentChildByParentIdsAndChildIds(
          processParentIds,
          [...allChildIdsFromExisting]
        );
        const existingMap = new Map<string, { _id: string; relationship: string }>();
        for (const d of existingLinks) {
          existingMap.set(`${d.parentId}:${d.childId}`, { _id: d._id.toString(), relationship: d.relationship });
        }

        const toInsert: Array<{ rowIndex: number; parentId: string; childId: string; role: string }> = [];
        const toUpdate: Array<{ rowIndex: number; parentId: string; childId: string; role: string; existingId: string }> = [];
        for (const p of pairs) {
          const key = `${p.parentId}:${p.childId}`;
          const existing = existingMap.get(key);
          if (!existing) {
            toInsert.push(p);
          } else if (existing.relationship !== p.role) {
            toUpdate.push({ ...p, existingId: existing._id });
          }
        }

        const newParentChildDocs: Partial<import("../models").IParentChild>[] = toInsert.map((p) => ({
          parentId: new mongoose.Types.ObjectId(p.parentId),
          childId: new mongoose.Types.ObjectId(p.childId),
          tenantId,
          tenantName,
          relationship: p.role as "father" | "mother" | "guardian" | "other",
          isPrimary: false,
          status: STATUS.ACTIVE,
          isActive: true,
          isDeleted: false,
          createdBy: "academy-api",
        }));

        let insertedRelations: any[] = [];
        if (newParentChildDocs.length > 0) {
          insertedRelations = await parentChildRepository.insertManyParentChildren(newParentChildDocs);
        }
        if (toUpdate.length > 0) {
          await parentChildRepository.bulkUpdateParentChildRelationships(
            toUpdate.map((u) => ({ id: u.existingId, relationship: u.role }))
          );
        }

        const rowParentChildIds = new Map<number, string[]>();
        for (let k = 0; k < toInsert.length; k++) {
          const r = toInsert[k];
          if (!rowParentChildIds.has(r.rowIndex)) rowParentChildIds.set(r.rowIndex, []);
          rowParentChildIds.get(r.rowIndex)!.push((insertedRelations[k] as any)._id.toString());
        }
        for (const u of toUpdate) {
          if (!rowParentChildIds.has(u.rowIndex)) rowParentChildIds.set(u.rowIndex, []);
          rowParentChildIds.get(u.rowIndex)!.push(u.existingId);
        }

        for (let i = 0; i < existingParentsToProcess.length; i++) {
          const { rowNumber, parentData, originalRow, existingParent } = existingParentsToProcess[i];
          const parentId = existingParent._id.toString();
          const parent = parentDocMap.get(parentId) || existingParent;
          updatedParents.push({
            rowNumber,
            parent,
            parentData,
            originalRow,
            parentChildIds: rowParentChildIds.get(i) || [],
          });
        }
      }
    }

    // If any record creation/update failed, cleanup and return
    if (result.errorRows.length > 0) {
      // Cleanup created records (parents and their ParentChild relationships)
      for (const { parent, sharedId, parentChildIds } of createdParents) {
        try {
          // Cleanup ParentChild relationships first
          if (parentChildIds && parentChildIds.length > 0) {
            const ParentChild = (await import("../models")).ParentChild;
            await ParentChild.updateMany(
              { _id: { $in: parentChildIds }, isDeleted: false },
              {
                $set: {
                  isDeleted: true,
                  isActive: false,
                  updatedBy: "academy-api",
                },
              }
            );
          }
          // Then cleanup parent
          await parentRepository.softDeleteParentById(parent._id.toString());
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup parent and relationships:",
            cleanupError
          );
        }
      }

      // Cleanup updated records (only newly created ParentChild relationships)
      for (const { parentChildIds } of updatedParents) {
        try {
          if (parentChildIds && parentChildIds.length > 0) {
            const ParentChild = (await import("../models")).ParentChild;
            await ParentChild.updateMany(
              { _id: { $in: parentChildIds }, isDeleted: false },
              {
                $set: {
                  isDeleted: true,
                  isActive: false,
                  updatedBy: "academy-api",
                },
              }
            );
          }
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup updated parent relationships:",
            cleanupError
          );
        }
      }

      result.successful = 0;
      return result;
    }

    // Step 2c: Prepare all user data and batch create users (only when we have new parents)
    let createdUsers: any[] = [];
    if (createdParents.length > 0) {
    const usersData = createdParents.map(({ parentData, sharedId }) => {
      // Ensure password is always set (generate if missing) and update parentData for email consistency
      if (!parentData.password || parentData.password.trim().length === 0) {
        parentData.password = generateRandomPassword();
      }
      
      // Only include gender if role is guardian (gender is required for guardian, not saved for father/mother)
      const userData: any = {
        _id: sharedId.toString(),
        username: parentData.email!.toLowerCase(),
        firstName: parentData.firstName,
        lastName: parentData.lastName,
        email: parentData.email,
        password: parentData.password, // Ensure password is always set
        phoneNumber: parentData.phoneNumber,
        tenantId: tenantId,
        tenantName: tenantName,
        userType: "parent",
        roleName: "PARENT",
        userAccessType: "private",
        isEmailVerified: false,
        isActive: true,
        createdBy: "academic-api",
      };

      // Only add gender if role is guardian
      if (parentData.role?.toLowerCase() === 'guardian' && parentData.gender) {
        userData.gender = parentData.gender;
      }

      return userData;
    });

    // Step 2c: Batch create all users in one call
    try {
      const bulkUserResponse = await UserApiIntegrationService.bulkCreateUsers(
        usersData
      );

      // Check if all users were created successfully
      createdUsers =
        bulkUserResponse?.data?.created || bulkUserResponse?.created || [];
      const failedUsers =
        bulkUserResponse?.data?.failed || bulkUserResponse?.failed || [];

      // If any user creation failed, cleanup all records and return errors
      if (failedUsers.length > 0) {
        // Cleanup all created parent records and their ParentChild relationships
        for (const { parent, sharedId, parentChildIds } of createdParents) {
          try {
            // Cleanup ParentChild relationships first
            if (parentChildIds && parentChildIds.length > 0) {
              const ParentChild = (await import("../models")).ParentChild;
              await ParentChild.updateMany(
                { _id: { $in: parentChildIds }, isDeleted: false },
                {
                  $set: {
                    isDeleted: true,
                    isActive: false,
                    updatedBy: "academy-api",
                  },
                }
              );
            }
            // Then cleanup parent
            await parentRepository.softDeleteParentById(parent._id.toString());
          } catch (cleanupError) {
            console.error(
              "Failed to cleanup parent and relationships:",
              cleanupError
            );
          }
        }

        // Map failed users to their rows with better error messages
        for (const failedUser of failedUsers) {
          const email = failedUser.data?.email || failedUser.email;
          const matchingParent = createdParents.find(
            (cp) => cp.parentData.email === email
          );
          if (matchingParent) {
            result.failed++;
            
            // Parse error message to determine field and message
            let errorField = "userCreation";
            let errorMessage = failedUser.error || "Failed to create user in user-api";
            
            // Check for duplicate email/username errors
            if (failedUser.error?.includes("USERNAME_EXISTS") || 
                failedUser.error?.includes("EMAIL_EXISTS") ||
                failedUser.error?.includes("duplicate key") ||
                failedUser.error?.includes("already exists")) {
              errorField = "email";
              if (failedUser.error.includes("USERNAME_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("EMAIL_EXISTS")) {
                errorMessage = "Email already exists in the system";
              } else if (failedUser.error.includes("duplicate key")) {
                errorMessage = "Email already exists in the system";
              } else {
                errorMessage = "Email already exists in the system";
              }
            }
            
            result.errorRows.push({
              row: matchingParent.rowNumber,
              errors: [
                {
                  field: errorField,
                  message: errorMessage,
                },
              ],
              data: matchingParent.originalRow,
            });
          }
        }

        result.successful = 0;
        return result;
      }

      // Step 2d: Bulk update parent records with userId (one round-trip)
      const parentUserIdUpdates = createdParents.map((createdParent, i) => {
        const createdUser = createdUsers[i];
        const userId =
          createdUser?.data?.user?.id ||
          createdUser?.data?.id ||
          createdUser?.id ||
          createdUser?.data?.user?._id ||
          createdUser?.data?._id ||
          createdUser?._id ||
          createdParent.sharedId.toString();
        return {
          parentId: createdParent.parent._id.toString(),
          userId,
        };
      });
      try {
        await parentRepository.bulkUpdateUserIds(parentUserIdUpdates);
      } catch (updateError) {
        console.error("Failed to bulk update parents with userId:", updateError);
      }
    } catch (userCreateErr: any) {
      // Cleanup created parents and ParentChild on user creation failure
      for (const { parent, parentChildIds } of createdParents) {
        try {
          if (parentChildIds?.length > 0) {
            const ParentChild = (await import("../models")).ParentChild;
            await ParentChild.updateMany(
              { _id: { $in: parentChildIds }, isDeleted: false },
              { $set: { isDeleted: true, isActive: false, updatedBy: "academy-api" } }
            );
          }
          await parentRepository.softDeleteParentById(parent._id.toString());
        } catch (_) {}
      }
      for (const { rowNumber, originalRow } of createdParents) {
        result.failed++;
        result.errorRows.push({
          row: rowNumber,
          errors: [{ field: "userCreation", message: userCreateErr?.message || "Failed to create users" }],
          data: originalRow,
        });
      }
      result.successful = 0;
      return result;
    }
    }

    // All users created successfully (new + updated)
    result.successful = createdParents.length + updatedParents.length;

    // ===== STEP 3: BULK UPDATE STUDENT WALLETS WITH PARENT ID =====
      // Update student wallets with parentId when parent-child relationships are created
      // This is done synchronously - if it fails, we cleanup (all-or-nothing)
      try {
        // Collect all parent-child relationships for bulk wallet update
        const walletUpdates: Array<{ studentId: string; parentId: string }> = [];

        // From newly created parents
        for (const { parent, parentChildIds } of createdParents) {
          if (parentChildIds && parentChildIds.length > 0) {
            // Get child IDs from ParentChild relationships
            const ParentChild = (await import("../models")).ParentChild;
            const relationships = await ParentChild.find({
              _id: { $in: parentChildIds },
              isDeleted: false,
            }).select("childId").lean();

            relationships.forEach((rel: any) => {
              if (rel.childId) {
                walletUpdates.push({
                  studentId: rel.childId.toString(),
                  parentId: parent._id.toString(),
                });
              }
            });
          }
        }

        // From updated parents (newly linked children)
        for (const { parent, parentChildIds } of updatedParents) {
          if (parentChildIds && parentChildIds.length > 0) {
            // Get child IDs from ParentChild relationships
            const ParentChild = (await import("../models")).ParentChild;
            const relationships = await ParentChild.find({
              _id: { $in: parentChildIds },
              isDeleted: false,
            }).select("childId").lean();

            relationships.forEach((rel: any) => {
              if (rel.childId) {
                walletUpdates.push({
                  studentId: rel.childId.toString(),
                  parentId: parent._id.toString(),
                });
              }
            });
          }
        }

        // Bulk update wallets if we have any updates
        if (walletUpdates.length > 0) {
          console.log(`💰 Bulk updating ${walletUpdates.length} student wallets with parentId...`);
          
          const bulkWalletResult = await bulkUpdateWalletsWithParent(
            walletUpdates,
            tenantId
          );

          // Check if any updates failed (all-or-nothing scenario)
          if (bulkWalletResult.failed && bulkWalletResult.failed.length > 0) {
            console.error(`❌ Bulk wallet update failed for ${bulkWalletResult.failed.length} students (all-or-nothing)`);
            
            // Cleanup all created/updated parent records and relationships (all-or-nothing)
            for (const { parent, parentChildIds } of createdParents) {
              try {
                if (parentChildIds && parentChildIds.length > 0) {
                  const ParentChild = (await import("../models")).ParentChild;
                  await ParentChild.updateMany(
                    { _id: { $in: parentChildIds }, isDeleted: false },
                    {
                      $set: {
                        isDeleted: true,
                        isActive: false,
                        updatedBy: "academy-api",
                      },
                    }
                  );
                }
                await parentRepository.softDeleteParentById(parent._id.toString());
              } catch (cleanupError) {
                console.error("Failed to cleanup parent:", cleanupError);
              }
            }

            for (const { parent, parentChildIds } of updatedParents) {
              try {
                if (parentChildIds && parentChildIds.length > 0) {
                  const ParentChild = (await import("../models")).ParentChild;
                  await ParentChild.updateMany(
                    { _id: { $in: parentChildIds }, isDeleted: false },
                    {
                      $set: {
                        isDeleted: true,
                        isActive: false,
                        updatedBy: "academy-api",
                      },
                    }
                  );
                }
              } catch (cleanupError) {
                console.error("Failed to cleanup updated parent relationships:", cleanupError);
              }
            }

            // Mark all as failed
            for (const { rowNumber, originalRow } of [...createdParents, ...updatedParents]) {
              result.failed++;
              result.errorRows.push({
                row: rowNumber,
                errors: [
                  {
                    field: "walletUpdate",
                    message: "Failed to update student wallets with parentId (all-or-nothing)",
                  },
                ],
                data: originalRow,
              });
            }

            result.successful = 0;
            return result;
          }

          console.log(`✅ Successfully updated ${bulkWalletResult.updated.length} student wallets with parentId`);
        } else {
          console.log(`ℹ️ No student wallets to update (no parent-child relationships created)`);
        }
      } catch (walletError: any) {
        // If bulk wallet update fails, cleanup all records (all-or-nothing)
        console.error(`❌ Bulk wallet update failed (all-or-nothing):`, walletError.message);
        
        // Cleanup all created/updated parent records and relationships
        for (const { parent, parentChildIds } of createdParents) {
          try {
            if (parentChildIds && parentChildIds.length > 0) {
              const ParentChild = (await import("../models")).ParentChild;
              await ParentChild.updateMany(
                { _id: { $in: parentChildIds }, isDeleted: false },
                {
                  $set: {
                    isDeleted: true,
                    isActive: false,
                    updatedBy: "academy-api",
                  },
                }
              );
            }
            await parentRepository.softDeleteParentById(parent._id.toString());
          } catch (cleanupError) {
            console.error("Failed to cleanup parent:", cleanupError);
          }
        }

        for (const { parent, parentChildIds } of updatedParents) {
          try {
            if (parentChildIds && parentChildIds.length > 0) {
              const ParentChild = (await import("../models")).ParentChild;
              await ParentChild.updateMany(
                { _id: { $in: parentChildIds }, isDeleted: false },
                {
                  $set: {
                    isDeleted: true,
                    isActive: false,
                    updatedBy: "academy-api",
                  },
                }
              );
            }
          } catch (cleanupError) {
            console.error("Failed to cleanup updated parent relationships:", cleanupError);
          }
        }

        // Mark all as failed (all-or-nothing)
        for (const { rowNumber, originalRow } of [...createdParents, ...updatedParents]) {
          result.failed++;
          result.errorRows.push({
            row: rowNumber,
            errors: [
              {
                field: "walletUpdate",
                message: walletError.message || "Failed to update student wallets with parentId",
              },
            ],
            data: originalRow,
          });
        }

        result.successful = 0;
        return result;
      }

      // ===== STEP 4: SEND BULK WELCOME EMAILS TO NEWLY CREATED PARENTS =====
      // IMPORTANT: Only send emails to NEWLY CREATED parents, NOT to updated parents
      // Send emails asynchronously (don't block the response if email fails)
      try {
        const loginUrl = process.env.LOGIN_URL || "http://localhost:3000/auth/login";
        
        // Get partner name once (reusable for all emails)
        const partnerName = await getPartnerNameFromDatabase(
          tenantId,
          tenantName || "Brighton AI"
        );

        // Prepare email data for NEWLY CREATED parents only (not updated parents)
        // Match createdParents with createdUsers by index (they should be in same order)
        const emailsData = createdParents
          .filter((cp, index) => {
            // Only send if email and password exist
            if (!cp.parentData.email || !cp.parentData.password) {
              return false;
            }
            // Verify we have a corresponding user
            const user = createdUsers[index];
            return !!user;
          })
          .map(({ parentData, sharedId }, index) => {
            const userName = `${parentData.firstName} ${parentData.lastName}`;
            const createdUser = createdUsers[index];
            const userId = 
              createdUser?.data?.user?.id ||
              createdUser?.data?.id ||
              createdUser?.id ||
              createdUser?.data?.user?._id ||
              createdUser?.data?._id ||
              createdUser?._id ||
              sharedId.toString();

            return {
              recipientEmail: parentData.email!,
              templateName: "account-created",
              templateParams: {
                title: "Welcome onboard",
                userName: userName,
                role: "Parent",
                email: parentData.email,
                password: parentData.password,
                loginUrl: loginUrl,
                tenantName: tenantName || "Brighton AI Education",
                partnerName: partnerName,
                features: [
                  "View your child's academic performance and grades",
                  "Track assignments and exam progress",
                  "Stay informed about your child's school activities"
                ],
              },
              receiverId: userId,
            };
          });

        // Only send if we have emails to send
        if (emailsData.length > 0) {
          console.log(`📧 Sending bulk welcome emails to ${emailsData.length} newly created parents (${updatedParents.length} updated parents skipped)...`);
          
          // Send bulk emails asynchronously - don't await to avoid blocking
          notificationService.sendBulkEmailsWithTemplate(
            emailsData,
            tenantId
          ).then(() => {
            console.log(`✅ Bulk welcome emails sent successfully to ${emailsData.length} newly created parents`);
          }).catch((emailError: any) => {
            // Log error but don't fail the bulk upload
            console.error(`⚠️ Failed to send bulk welcome emails:`, emailError.message);
          });
        } else {
          console.warn("⚠️ No emails to send (missing email or password for some newly created parents)");
        }
      } catch (emailError: any) {
        // Log error but don't fail the bulk upload
        console.error("⚠️ Error preparing bulk welcome emails:", emailError.message);
      }

      return result;
  } catch (error: any) {
    throw new Error(`Bulk upload failed: ${error.message}`);
  }
  return result;
}

import mongoose from 'mongoose';
import {
  StudentGeneratedReport,
  Student,
  Exam,
  ExamStudent
} from '../models';
import { getStudentPdfReport } from './studentReport.service';

/**
 * Report Generator Service
 * Worker functions to pre-calculate and store student reports in the materialized view collection.
 */

/**
 * Generate and store a student report (comprehensive or subject-specific)
 * @param studentId - Student ID
 * @param classId - Class ID
 * @param tenantId - Tenant ID
 * @param subjectId - Optional subject ID (if null, generates comprehensive report)
 * @returns The generated report data
 */
export const generateAndStoreReport = async (
  studentId: string,
  classId: string,
  tenantId: string,
  subjectId?: string,
  examId?: string,
  forceRefresh: boolean = false
) => {
  try {
    console.log(`📊 [Worker] Generating report for Student: ${studentId}, Class: ${classId}, Subject: ${subjectId || 'ALL'}, Exam: ${examId || 'NONE'}`);

    // Call existing calculation logic
    const reportData = await getStudentPdfReport(studentId, classId, tenantId, subjectId, examId);

    // Determine report type
    let reportType = 'COMPREHENSIVE';
    if (examId) reportType = 'EXAM';
    else if (subjectId) reportType = 'SUBJECT';

    // Upsert the report in the collection
    const report = await StudentGeneratedReport.findOneAndUpdate(
      {
        studentId: new mongoose.Types.ObjectId(studentId),
        classId: new mongoose.Types.ObjectId(classId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        subjectId: subjectId ? new mongoose.Types.ObjectId(subjectId) : null,
        examId: examId ? new mongoose.Types.ObjectId(examId) : null
      },
      {
        $set: {
          reportType,
          data: reportData,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    console.log(`✅ [Worker] Report generated and stored: ${report?._id}`);
    return reportData;
  } catch (error) {
    console.error(`❌ [Worker] Error generating report for student ${studentId}:`, error);
    throw error;
  }
};

/**
 * Update student reports when an exam is released
 * Regenerates comprehensive report and subject-specific report (if applicable)
 * @param classId - Class ID
 * @param examId - Exam ID that was released
 */
export const updateStudentReportsOnExamRelease = async (
  classId: string,
  examId: string
) => {
  try {
    console.log(`🔄 Updating reports for class ${classId} after exam ${examId} release`);

    // Fetch exam details to get subject and tenant
    const exam = await Exam.findById(examId).select('subjectId tenantId');
    if (!exam) {
      console.warn(`⚠️ Exam ${examId} not found, skipping report update`);
      return;
    }

    const tenantId = exam.tenantId.toString();
    const subjectId = exam.subjectId?.toString();

    // Fetch all students who attempted this exam
    const examStudents = await ExamStudent.find({
      examId: new mongoose.Types.ObjectId(examId),
      gradingStatus: 'Completed'
    }).distinct('studentId');

    console.log(`📝 Found ${examStudents.length} students to update`);

    // Update reports for each student (run in parallel for performance)
    const updatePromises = examStudents.map(async (studentId) => {
      const studentIdStr = studentId.toString();
      
      // Always regenerate comprehensive report
      await generateAndStoreReport(studentIdStr, classId, tenantId, undefined, undefined, true);

      // If exam has a subject, also regenerate subject-specific report
      if (subjectId) {
        await generateAndStoreReport(studentIdStr, classId, tenantId, subjectId, undefined, true);
      }
    });

    await Promise.all(updatePromises);
    console.log(`✅ Updated reports for ${examStudents.length} students`);
  } catch (error) {
    console.error(`❌ Error updating reports on exam release:`, error);
    throw error;
  }
};

/**
 * Update student report when a credential is assigned
 * Updates comprehensive report and optionally subject-specific report
 * @param studentId - Student ID
 * @param subjectId - Optional Subject ID (if credential is tied to a subject)
 */
export const updateStudentReportOnCredential = async (studentId: string, subjectId?: string) => {
  try {
    console.log(`🏆 Updating report for student ${studentId} after credential assignment`);

    // Fetch student details to get class and tenant
    const student = await Student.findById(studentId).select('classId tenantId');
    if (!student || !student.classId || !student.tenantId) {
      console.warn(`⚠️ Student ${studentId} not found or missing details, skipping report update`);
      return;
    }

    const classId = student.classId.toString();
    const tenantId = student.tenantId.toString();

    // Regenerate comprehensive report (Always needed as credentials appear in overall stats)
    await generateAndStoreReport(studentId, classId, tenantId, undefined, undefined, true);

    // If subject is provided, regenerate subject-specific report (credentials stats appear there too)
    if (subjectId) {
      await generateAndStoreReport(studentId, classId, tenantId, subjectId, undefined, true);
    }

    console.log(`✅ Updated report(s) for student ${studentId}`);
  } catch (error) {
    console.error(`❌ Error updating report on credential assignment:`, error);
    throw error;
  }
};

/**
 * Batch regenerate reports for an entire class
 * Useful for initial seeding or manual refresh
 * @param classId - Class ID
 * @param tenantId - Tenant ID
 */
export const regenerateClassReports = async (classId: string, tenantId: string) => {
  try {
    console.log(`🔄 Regenerating all reports for class ${classId}`);

    // Fetch all students in the class
    const students = await Student.find({
      classId: classId,
      tenantId: tenantId,
      isDeleted: false,
      isActive: true
    }).select('_id');

    console.log(`📝 Found ${students.length} students in class`);

    // Regenerate comprehensive reports for all students
    const updatePromises = students.map((student) =>
      generateAndStoreReport(student._id.toString(), classId, tenantId, undefined, undefined, true)
    );

    await Promise.all(updatePromises);
    console.log(`✅ Regenerated reports for ${students.length} students`);
  } catch (error) {
    console.error(`❌ Error regenerating class reports:`, error);
    throw error;
  }
};

import mongoose, { Schema, Document } from 'mongoose';

/**
 * StudentGeneratedReport Schema
 * Stores pre-calculated reports for students (both Comprehensive and Subject-specific).
 * This acts as a Materialized View to avoid expensive aggregations on read.
 */

export interface IStudentGeneratedReport extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId; // If null, it's the Comprehensive Report. If set, it's a Subject Report.
  examId?: mongoose.Types.ObjectId; // If set, it's a specific Exam Report.
  reportType: 'COMPREHENSIVE' | 'SUBJECT' | 'EXAM';
  
  // Stores the complete JSON response required by the UI
  data: any; 
  
  createdAt: Date;
  updatedAt: Date;
}

const StudentGeneratedReportSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Student',
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Class',
    index: true
  },
  tenantId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    default: null,
    index: true
  },
  examId: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
    default: null,
    index: true
  },
  reportType: {
    type: String,
    enum: ['COMPREHENSIVE', 'SUBJECT', 'EXAM'],
    required: true
  },
  
  // We store the calculated data as a flexible Mixed type because the structure 
  // is complex (nested arrays/objects) and strictly defined in TypeScript interfaces.
  // Using Mixed allows distinct structures for Comprehensive vs Subject if needed, 
  // though we aim for consistency.
  data: {
    type: Schema.Types.Mixed,
    required: true
  }
}, { 
  timestamps: true, 
  collection: 'student_generated_reports' 
});

// Compound Indexes for fast fetching
// 1. Fetch specific report for a student
StudentGeneratedReportSchema.index({ studentId: 1, subjectId: 1, examId: 1 }, { unique: true });

// 2. Fetch all reports for a class
StudentGeneratedReportSchema.index({ classId: 1, subjectId: 1 });

export const StudentGeneratedReport = mongoose.model<IStudentGeneratedReport>('StudentGeneratedReport', StudentGeneratedReportSchema);
export default StudentGeneratedReport;

import { createStudentActivity } from "@/repositories/studentActivity.repository";
import mongoose, { Types } from "mongoose";

// Convert string IDs to ObjectId if they're not already
const toObjectId = (id: string | Types.ObjectId): Types.ObjectId => 
  id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

// Create a type that represents the input data for creating a new activity
interface ActivityInput {
  studentId: Types.ObjectId;
  activityType: 'ExamCompleted' | 'PracticeCompleted' | 'BadgeEarned' | 'CertificateEarned';
  activityDescription: string;
  relatedEntityId: Types.ObjectId;
  relatedEntityType: string;
  classId: Types.ObjectId;
  subjectId: Types.ObjectId;
  tenantId: Types.ObjectId;
  title?: string;
  status?: 'completed' | 'in-progress';
  score?: number;
  duration?: number;
}

/**
 * Activity Service - Handles all student activity tracking
 */
export const ActivityService = {
  /**
   * Log a student activity
   */
  async logActivity(activityData: Omit<ActivityInput, 'studentId' | 'relatedEntityId' | 'classId' | 'subjectId' | 'tenantId'> & {
    studentId: string | Types.ObjectId;
    relatedEntityId: string | Types.ObjectId;
    classId: string | Types.ObjectId;
    subjectId: string | Types.ObjectId;
    tenantId: string | Types.ObjectId;
  }) {
    try {
      // Convert all string IDs to ObjectId
      const data = {
        ...activityData,
        studentId: toObjectId(activityData.studentId),
        relatedEntityId: toObjectId(activityData.relatedEntityId),
        classId: toObjectId(activityData.classId),
        subjectId: toObjectId(activityData.subjectId),
        tenantId: toObjectId(activityData.tenantId),
      };
      
      await createStudentActivity(data);
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid breaking main operation
    }
  },

  /**
   * Log exam completion
   */
  async logExamCompletion(params: {
    studentId: mongoose.Types.ObjectId | string;
    examId: mongoose.Types.ObjectId | string;
    examName: string;
    classId: mongoose.Types.ObjectId | string;
    subjectId: mongoose.Types.ObjectId | string;
    tenantId: mongoose.Types.ObjectId | string;
    score?: number;
    duration?: number;
  }) {
    const activity: ActivityInput = {
      studentId: new mongoose.Types.ObjectId(params.studentId),
      activityType: 'ExamCompleted',
      activityDescription: `Completed exam: ${params.examName}`,
      relatedEntityId: new mongoose.Types.ObjectId(params.examId),
      relatedEntityType: 'Exam',
      classId: new mongoose.Types.ObjectId(params.classId),
      subjectId: new mongoose.Types.ObjectId(params.subjectId),
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      title: params.examName,
      status: 'completed',
    };

    if (params.score !== undefined) activity.score = params.score;
    if (params.duration !== undefined) activity.duration = params.duration;

    await this.logActivity(activity);
  },

  /**
   * Log practice session completion
   */
  async logPracticeSession(params: {
    studentId: mongoose.Types.ObjectId | string;
    practiceId: mongoose.Types.ObjectId | string;
    practiceName: string;
    classId: mongoose.Types.ObjectId | string;
    subjectId: mongoose.Types.ObjectId | string;
    tenantId: mongoose.Types.ObjectId | string;
    score?: number;
    duration?: number;
  }) {
    const activity: ActivityInput = {
      studentId: new mongoose.Types.ObjectId(params.studentId),
      activityType: 'PracticeCompleted',
      activityDescription: `Completed practice: ${params.practiceName}`,
      relatedEntityId: new mongoose.Types.ObjectId(params.practiceId),
      relatedEntityType: 'Practice',
      classId: new mongoose.Types.ObjectId(params.classId),
      subjectId: new mongoose.Types.ObjectId(params.subjectId),
      tenantId: new mongoose.Types.ObjectId(params.tenantId),
      title: params.practiceName,
      status: 'completed',
    };

    if (params.score !== undefined) activity.score = params.score;
    if (params.duration !== undefined) activity.duration = params.duration;

    await this.logActivity(activity);
  },

  /**
   * Log badge earned
   */
  /**
   * Log badge earned
   */
  async logBadgeEarned(params: {
    studentId: mongoose.Types.ObjectId | string;
    badgeId: mongoose.Types.ObjectId | string;
    badgeName: string;
    classId: mongoose.Types.ObjectId | string;
    subjectId: mongoose.Types.ObjectId | string;
    tenantId: mongoose.Types.ObjectId | string;
  }) {
    await this.logActivity({
      studentId: params.studentId,
      activityType: 'BadgeEarned',
      activityDescription: `Earned badge: ${params.badgeName}`,
      relatedEntityId: params.badgeId,
      relatedEntityType: 'Badge',
      classId: params.classId,
      subjectId: params.subjectId,
      tenantId: params.tenantId,
      title: params.badgeName,
      status: 'completed',
    });
  },

  /**
   * Log certificate earned
   */
  async logCertificateEarned(params: {
    studentId: mongoose.Types.ObjectId | string;
    certificateId: mongoose.Types.ObjectId | string;
    certificateName: string;
    classId: mongoose.Types.ObjectId | string;
    subjectId: mongoose.Types.ObjectId | string;
    tenantId: mongoose.Types.ObjectId | string;
  }) {
    await this.logActivity({
      studentId: params.studentId,
      activityType: 'CertificateEarned',
      activityDescription: `Earned certificate: ${params.certificateName}`,
      relatedEntityId: params.certificateId,
      relatedEntityType: 'Certificate',
      classId: params.classId,
      subjectId: params.subjectId,
      tenantId: params.tenantId,
      title: params.certificateName,
      status: 'completed',
    });
  },
};

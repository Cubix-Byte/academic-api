import { ExamBadge, IExamBadge } from '../models';

/**
 * Exam Badge Repository - Data access layer
 */

// Find badges by student
export const findBadgesByStudent = async (studentId: string): Promise<IExamBadge[]> => {
  try {
    return await ExamBadge.find({
      studentId: studentId,
      isDeleted: false
    }).sort({ earnedDate: -1 });
  } catch (error: any) {
    console.error('Error finding badges by student:', error);
    throw error;
  }
};

// Find badge by ID
export const findBadgeById = async (badgeId: string): Promise<IExamBadge | null> => {
  try {
    return await ExamBadge.findOne({
      _id: badgeId,
      isDeleted: false
    });
  } catch (error: any) {
    console.error('Error finding badge by ID:', error);
    throw error;
  }
};

// Count badges for student
export const countBadgesForStudent = async (studentId: string, isEarned?: boolean): Promise<number> => {
  try {
    const query: any = {
      studentId: studentId,
      isDeleted: false
    };
    if (isEarned !== undefined) {
      query.isEarned = isEarned;
    }
    return await ExamBadge.countDocuments(query);
  } catch (error: any) {
    console.error('Error counting badges for student:', error);
    throw error;
  }
};


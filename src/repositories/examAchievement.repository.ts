import { ExamAchievement, IExamAchievement } from '../models';

/**
 * Exam Achievement Repository - Data access layer
 */

// Find achievements by student
export const findAchievementsByStudent = async (studentId: string): Promise<IExamAchievement[]> => {
  try {
    return await ExamAchievement.find({
      studentId: studentId,
      isDeleted: false
    }).sort({ unlockedDate: -1 });
  } catch (error: any) {
    console.error('Error finding achievements by student:', error);
    throw error;
  }
};

// Find achievement by ID
export const findAchievementById = async (achievementId: string): Promise<IExamAchievement | null> => {
  try {
    return await ExamAchievement.findOne({
      _id: achievementId,
      isDeleted: false
    });
  } catch (error: any) {
    console.error('Error finding achievement by ID:', error);
    throw error;
  }
};

// Count achievements for student
export const countAchievementsForStudent = async (studentId: string, isUnlocked?: boolean): Promise<number> => {
  try {
    const query: any = {
      studentId: studentId,
      isDeleted: false
    };
    if (isUnlocked !== undefined) {
      query.isUnlocked = isUnlocked;
    }
    return await ExamAchievement.countDocuments(query);
  } catch (error: any) {
    console.error('Error counting achievements for student:', error);
    throw error;
  }
};


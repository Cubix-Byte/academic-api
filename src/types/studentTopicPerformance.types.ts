/**
 * Student Topic Performance Types - Interfaces for student topic performance statistics
 */

// Get Student Topic Statistics Request
export interface GetStudentTopicStatisticsRequest {
  studentId: string;
  classId: string;
  subjectId: string;
}

// Student Topic Statistics Response
export interface GetStudentTopicStatisticsResponse {
  success: boolean;
  message: string;
  data: {
    studentId: string;
    classId: string;
    subjectId: string;
    topics: Array<{
      topicName: string;
      totalExams: number;
      averagePerformance: number;
      totalMarksObtained: number;
      totalMarksPossible: number;
      exams: Array<{
        examId: string;
        examTitle: string;
        weightageInExam: number;
        performance: number;
        marksObtained: number;
        marksPossible: number;
      }>;
    }>;
  };
}



/**
 * Class Topic Performance Types - Interfaces for topic performance statistics
 */

// Get Topic Statistics Request
export interface GetTopicStatisticsRequest {
  classId: string;
  subjectId: string;
}

// Topic Statistics Response
export interface GetTopicStatisticsResponse {
  success: boolean;
  message: string;
  data: {
    classId: string;
    subjectId: string;
    topics: Array<{
      topicName: string;
      totalExams: number;
      averagePerformance: number;
      totalStudents: number;
      weightageAverage: number;
      exams: Array<{
        examId: string;
        examTitle: string;
        weightageInExam: number;
        averagePerformance: number;
        totalStudents: number;
        createdOn: Date | string;
      }>;
    }>;
  };
}


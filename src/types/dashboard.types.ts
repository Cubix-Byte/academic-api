/**
 * Dashboard Types - Request and Response interfaces for Dashboard statistics
 */

// Dashboard Statistics Response
export interface DashboardStatistics {
  totalStudentCount: number;
  teachersCount: number;
  certificatesCount: number;
  overallAverageScore?: number;
}


/**
 * Tenant Analytics Types
 * Types for tenant-level analytics API
 */

/**
 * Monthly trend data for a single month
 */
export interface MonthlyTrendData {
    month: string; // e.g., "Jan", "Feb", "Mar"
    teachers: number;
    students: number;
    parents: number;
    exams: number;
    credentials: number;
}

/**
 * Total counts for all entity types
 */
export interface TotalCounts {
    teachers: number;
    students: number;
    parents: number;
    exams: number;
    credentials: number;
    totalUsers: number;
    badges: number;
    awards: number;
    certificates: number;
}

/**
 * Tenant seat limits from seatsNlicense
 */
export interface TenantLimits {
    teachers: number;
    students: number;
    parents: number;
}

/**
 * Response data structure
 */
export interface TenantAnalyticsData {
    monthlyTrends: MonthlyTrendData[];
    totals: TotalCounts;
    limits: TenantLimits;
}

/**
 * Complete API response
 */
export interface GetTenantMonthlyTrendsResponse {
    success: boolean;
    message: string;
    data: TenantAnalyticsData;
}

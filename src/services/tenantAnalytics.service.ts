import mongoose from "mongoose";
import {
    GetTenantMonthlyTrendsResponse,
    MonthlyTrendData,
    TotalCounts,
    TenantLimits,
} from "@/types/tenantAnalytics.types";

/**
 * Tenant Analytics Service
 * Business logic for tenant-level analytics
 */

/**
 * Get tenant monthly trends and statistics
 * Returns monthly creation counts, total counts, and seat limits for a tenant
 */
export const getTenantMonthlyTrends = async (
    tenantId: string
): Promise<GetTenantMonthlyTrendsResponse> => {
    try {
        // Import models
        const { default: Teacher } = await import("../models/teacher.schema");
        const { Student } = await import("../models/student.schema");
        const { default: Parent } = await import("../models/parent.schema");
        const { Exam } = await import("../models/exam.schema");
        const { ExamCredential } = await import("../models/examCredential.schema");
        const { default: Tenant } = await import("../models/tenant.schema");
        const { default: CredentialTemplate } = await import("../models/credentialTemplate.schema");
        const { CredentialType } = await import("../utils/constants/credentialEnums");

        // Calculate date range for last 12 months
        const currentDate = new Date();
        const twelveMonthsAgo = new Date(currentDate);
        twelveMonthsAgo.setMonth(currentDate.getMonth() - 11);
        twelveMonthsAgo.setDate(1);
        twelveMonthsAgo.setHours(0, 0, 0, 0);

        // Month names for display
        const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];

        // Helper function to aggregate monthly data for a collection
        const getMonthlyData = async (Model: any, tenantIdField: string = "tenantId") => {
            const matchCondition: any = {
                createdAt: { $gte: twelveMonthsAgo },
                isDeleted: false,
            };

            // Handle different tenantId field types
            if (tenantIdField === "tenantId") {
                // For models with string tenantId (Teacher, Student, Parent)
                matchCondition.tenantId = tenantId;
            } else {
                // For models with ObjectId tenantId (Exam, ExamCredential)
                matchCondition.tenantId = new mongoose.Types.ObjectId(tenantId);
            }

            return await Model.aggregate([
                {
                    $match: matchCondition,
                },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 },
                },
            ]);
        };

        // Helper function to get total count for a collection
        const getTotalCount = async (Model: any, tenantIdField: string = "tenantId") => {
            const matchCondition: any = {
                isDeleted: false,
            };

            // Handle different tenantId field types
            if (tenantIdField === "tenantId") {
                matchCondition.tenantId = tenantId;
            } else {
                matchCondition.tenantId = new mongoose.Types.ObjectId(tenantId);
            }

            return await Model.countDocuments(matchCondition);
        };

        // Fetch monthly data for all collections in parallel
        const [
            teachersMonthly,
            studentsMonthly,
            parentsMonthly,
            examsMonthly,
            credentialsMonthly,
        ] = await Promise.all([
            getMonthlyData(Teacher, "tenantId"),
            getMonthlyData(Student, "tenantId"),
            getMonthlyData(Parent, "tenantId"),
            getMonthlyData(Exam, "tenantId_objectId"),
            getMonthlyData(ExamCredential, "tenantId_objectId"),
        ]);

        // Fetch total counts for all collections in parallel
        const [
            totalTeachers,
            totalStudents,
            totalParents,
            totalExams,
            totalCredentials,
        ] = await Promise.all([
            getTotalCount(Teacher, "tenantId"),
            getTotalCount(Student, "tenantId"),
            getTotalCount(Parent, "tenantId"),
            getTotalCount(Exam, "tenantId_objectId"),
            getTotalCount(ExamCredential, "tenantId_objectId"),
        ]);

        // Fetch credential template counts by type
        const credentialTemplateCounts = await CredentialTemplate.aggregate([
            {
                $match: {
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    isDeleted: false,
                },
            },
            {
                $group: {
                    _id: "$credentialType",
                    count: { $sum: 1 },
                },
            },
        ]);

        // Extract counts for each credential type
        const badgeCount = credentialTemplateCounts.find(
            (item) => item._id === CredentialType.BADGE
        )?.count || 0;
        const awardCount = credentialTemplateCounts.find(
            (item) => item._id === CredentialType.AWARD
        )?.count || 0;
        const certificateCount = credentialTemplateCounts.find(
            (item) => item._id === CredentialType.CERTIFICATE
        )?.count || 0;

        const totalUsers = totalTeachers + totalStudents + totalParents;

        // Fetch tenant limits
        const tenant = await Tenant.findOne({
            _id: new mongoose.Types.ObjectId(tenantId),
            isDeleted: false,
        }).lean();

        if (!tenant) {
            throw new Error("Tenant not found");
        }

        // Extract limits from seatsNlicense
        const limits: TenantLimits = {
            teachers: tenant.seatsNlicense?.teacherSeats || 0,
            students: tenant.seatsNlicense?.studentSeats || 0,
            parents: tenant.seatsNlicense?.parentSeats || 0,
        };

        // Build monthly trends array for last 12 months
        const monthlyTrends: MonthlyTrendData[] = [];

        for (let i = 11; i >= 0; i--) {
            const date = new Date(currentDate);
            date.setMonth(currentDate.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-based month

            // Find matching data for each collection
            const teacherData = teachersMonthly.find(
                (m: any) => m._id.year === year && m._id.month === month
            );
            const studentData = studentsMonthly.find(
                (m: any) => m._id.year === year && m._id.month === month
            );
            const parentData = parentsMonthly.find(
                (m: any) => m._id.year === year && m._id.month === month
            );
            const examData = examsMonthly.find(
                (m: any) => m._id.year === year && m._id.month === month
            );
            const credentialData = credentialsMonthly.find(
                (m: any) => m._id.year === year && m._id.month === month
            );

            monthlyTrends.push({
                month: monthNames[month - 1],
                teachers: teacherData ? teacherData.count : 0,
                students: studentData ? studentData.count : 0,
                parents: parentData ? parentData.count : 0,
                exams: examData ? examData.count : 0,
                credentials: credentialData ? credentialData.count : 0,
            });
        }

        // Build totals object
        const totals: TotalCounts = {
            teachers: totalTeachers,
            students: totalStudents,
            parents: totalParents,
            exams: totalExams,
            credentials: totalCredentials,
            totalUsers,
            badges: badgeCount,
            awards: awardCount,
            certificates: certificateCount,
        };

        return {
            success: true,
            message: "Tenant analytics retrieved successfully",
            data: {
                monthlyTrends,
                totals,
                limits,
            },
        };
    } catch (error: any) {
        console.error("Get tenant monthly trends error:", error);
        throw new Error(`Failed to get tenant analytics: ${error.message}`);
    }
};

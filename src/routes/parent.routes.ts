import { Router } from "express";
import * as parentController from "../controllers/v1/parent.controller";
import * as parentDashboardController from "../controllers/v1/parentDashboard.controller";
import * as parentChildReportController from "../controllers/v1/parentChildReport.controller";
import * as studentWalletController from "../controllers/v1/studentWallet.controller";
import { csvUpload } from "../middlewares/upload.middleware";

const router = Router();

/**
 * Parent Routes
 * All routes require authentication and tenant context
 */

// ============ PARENT PROFILE ROUTES ============
// Must be before /:id route to avoid route conflicts

// Get current parent's profile
router.get("/profile", parentController.getMyProfile);

// Update current parent's profile
router.put("/profile", parentController.updateMyProfile);

// ============ LEGACY PARENT ROUTES ============

// Create parent
router.post("/", parentController.createParent);

// Bulk upload parents from CSV
router.post(
  "/bulk-upload",
  csvUpload.single("file"),
  parentController.bulkUploadParents
);

// Get all parents
router.get("/", parentController.getAllParents);

// Get parent counts (total, active, inactive) - MUST come before /:id routes
router.get("/counts", parentController.getParentCounts);

// Get parent statistics
router.get("/statistics", parentController.getParentStatistics);

// Get all children's achievements (dashboard aggregation)
router.get(
  "/children/achievements/all",
  parentController.getAllChildrenAchievements
);

// Get combined activities of all children
router.get(
  "/children/activities",
  parentDashboardController.getChildrenActivities
);

// Get activities for a specific child
router.get(
  "/children/:childId/activities",
  parentDashboardController.getChildActivities
);

// Get parent by ID
router.get("/:id", parentController.getParentById);

// Update parent
router.put("/:id", parentController.updateParent);

// Delete parent
router.delete("/:id", parentController.deleteParent);

// Get child's achievements
router.get(
  "/children/:childId/achievements",
  parentController.getChildAchievements
);

// Get child's badges
router.get("/children/:childId/badges", parentController.getChildBadges);

// ============ PARENT DASHBOARD ROUTES ============

// Get parent dashboard overview
router.get(
  "/dashboard/overview",
  parentDashboardController.getParentDashboardOverview
);

// Get all children for parent
router.get("/dashboard/children", parentDashboardController.getParentChildren);

// Get all credit transactions for all children of a parent
router.get("/children/transactions", parentDashboardController.getChildrenTransactions);

// Get children's wallet balances
router.get(
  "/:parentId/children/wallets",
  studentWalletController.getChildrenWallets
);

// Get exam results for a specific child
router.get(
  "/dashboard/children/:childId/exam-results",
  parentDashboardController.getChildExamResults
);

// Get academic reports for a specific child
router.get(
  "/dashboard/children/:childId/academic-reports",
  parentDashboardController.getChildAcademicReports
);

// Get recent graded results for a specific child
router.get(
  "/children/:childId/recent-results",
  parentDashboardController.getChildRecentResults
);

// Get reports count by year for a specific child
router.get(
  "/children/:childId/reports-by-year",
  parentDashboardController.getReportsByYear
);

// Get teachers for a specific child
router.get(
  "/children/:childId/teachers",
  parentDashboardController.getChildTeachers
);

// Get subjects for a specific child
router.get(
  "/children/:childId/subjects",
  parentDashboardController.getChildSubjects
);

// Get leaderboard data for a specific child
router.get(
  "/children/:childId/leaderboard",
  parentDashboardController.getChildLeaderboard
);

// Get subject stats for a child (or all children if studentId not provided)
router.get(
  "/dashboard/subject-stats",
  parentDashboardController.getSubjectStats
);

// Get comprehensive report for a specific child
router.get(
  "/children/:childId/report",
  parentChildReportController.getChildReport
);

// Get child performance details (trends + summary for graph and table)
router.get(
  "/children/:childId/performance-details",
  parentChildReportController.getChildPerformanceDetails
);

// Get available semesters for a child based on admission date
router.get(
  "/children/:childId/semesters",
  parentChildReportController.getChildSemesters
);

// Get detailed subject performance for a child (View Details page)
router.get(
  "/children/:childId/subjects/:subjectId/details",
  parentChildReportController.getChildSubjectDetails
);

// Get monthly performance score for a subject
router.get(
  "/children/:childId/subjects/:subjectId/performance-score",
  parentChildReportController.getPerformanceScore
);

export default router;

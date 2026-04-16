import { Router } from "express";
import * as reportController from "../controllers/v1/report.controller";
// Note: Authentication is handled by global auth middleware in app.ts
// No need to import authenticateJWT middleware here

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Student progress and activity reports
 */

/**
 * @swagger
 * /api/v1/reports/students/{studentId}/progress:
 *   get:
 *     summary: Get student progress report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the student
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month (1-12) to get the report for (defaults to current month)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: Year to get the report for (defaults to current year)
 *     responses:
 *       200:
 *         description: Student progress report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentProgressReport'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/students/:studentId/progress",
  // Global auth middleware handles authentication - no need for explicit authenticate
  reportController.getStudentProgressReport
);

/**
 * @swagger
 * /api/v1/reports/students/{studentId}/activity:
 *   get:
 *     summary: Get student activity report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the student
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for the activity report (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for the activity report (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Student activity report
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/students/:studentId/activity",
  // Global auth middleware handles authentication - no need for explicit authenticate
  reportController.getStudentActivityReport
);

/**
 * @swagger
 * /api/v1/reports/students/{studentId}/subjects/{subjectId}:
 *   get:
 *     summary: Get subject performance report for a student
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the student
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subject
 *     responses:
 *       200:
 *         description: Subject performance report
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/students/:studentId/subjects/:subjectId",
  // Global auth middleware handles authentication - no need for explicit authenticate
  reportController.getSubjectPerformanceReport
);

/**
 * @swagger
 * /api/v1/reports/students/{studentId}/comprehensive:
 *   get:
 *     summary: Get comprehensive student report (PDF data)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the student
 *       - in: query
 *         name: subjectId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional ID of the subject to filter by
      - in: query
        name: classId
        required: false
        schema:
          type: string
        description: Optional ID of the class (overrides student's current class)
 *     responses:
 *       200:
 *         description: Comprehensive student report data
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/students/:studentId/comprehensive",
  // Global auth middleware handles authentication - no need for explicit authenticate
  reportController.getComprehensiveStudentReport
);

export default router;

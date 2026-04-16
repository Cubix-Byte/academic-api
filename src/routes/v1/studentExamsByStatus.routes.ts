import { Router } from "express";
import * as studentExamsByCategoryController from "../../controllers/v1/studentExamsByStatus.controller";

const router = Router();

// GET /api/v1/student-exams/by-category?examCategory=open|in-progress|performed|scheduled|expired
router.get(
  "/by-category",
  studentExamsByCategoryController.getStudentExamsByCategory
);

export default router;

import { Router } from "express";
import { ROUTES } from "@/utils/constants/routes";
import { ClassScheduleController } from "@/controllers/v1/classSchedule.controller";
import { validate } from "@/middlewares/validation.middleware";
import {
  createClassScheduleSchema,
  updateClassScheduleSchema,
  deleteClassScheduleSchema,
  getClassScheduleByIdSchema,
  listClassSchedulesSchema,
  getClassTimetableSchema,
  getTeacherTimetableSchema,
  getStudentTimetableSchema,
  getClassTimetableSummarySchema,
} from "@/utils/requestValidators/classSchedule.validator";

const router = Router();

// CRUD for individual schedule slots
router.post(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.ROOT,
  validate(createClassScheduleSchema),
  ClassScheduleController.create
);

router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.ROOT,
  validate(listClassSchedulesSchema),
  ClassScheduleController.list
);

router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.ID,
  validate(getClassScheduleByIdSchema),
  ClassScheduleController.getById
);

router.put(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.ID,
  validate(updateClassScheduleSchema),
  ClassScheduleController.update
);

router.delete(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.ID,
  validate(deleteClassScheduleSchema),
  ClassScheduleController.delete
);

// Timetable for a particular class (all days/slots for a given academic year)
router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.CLASS_TIMETABLE,
  validate(getClassTimetableSchema),
  ClassScheduleController.getClassTimetable
);

// Timetable for the logged-in teacher (all days/slots for a given academic year)
router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.TEACHER_TIMETABLE,
  validate(getTeacherTimetableSchema),
  ClassScheduleController.getTeacherTimetable
);

// Timetable for the logged-in student (current class and assigned subjects for a given academic year)
router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.STUDENT_TIMETABLE,
  validate(getStudentTimetableSchema),
  ClassScheduleController.getStudentTimetable
);

// Summary of class timetables (per class) for the tenant - PRIMARYADMIN only
router.get(
  ROUTES.CLASS_SCHEDULES.SUBROUTES.CLASS_TIMETABLE_SUMMARY,
  validate(getClassTimetableSummarySchema),
  ClassScheduleController.getClassTimetableSummary
);

export default router;



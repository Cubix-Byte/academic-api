import * as studentExamsRepository from "../repositories/studentExams.repository";
import * as batchRepository from "../repositories/batch.repository";
import * as teacherRepository from "../repositories/teacher.repository";
import * as examQuestionRepository from "../repositories/examQuestion.repository";

export const getStudentExamsByCategory = async (
  studentId: string,
  options: {
    pageNo: number;
    pageSize: number;
    filters: Record<string, any>;
    sort: Record<string, any>;
  }
) => {
  const { pageNo, pageSize, filters, sort } = options;

  // Extract and validate examCategory from filters
  const examCategory = filters.examCategory?.$eq;
  if (!examCategory) {
    throw new Error("examCategory is required in filters");
  }

  // Extract optional filters
  const subjectId = filters.subjectId?.$eq;
  const classId = filters.classId?.$eq;

  // Handle examTitle from $or array (when using __or__0 pattern) or direct $regex
  let examTitle: string | undefined;

  // Check $or array first (this is where __or__0 filters end up)
  if (Array.isArray(filters.$or)) {
    const examTitleCondition = filters.$or.find((condition: any) => condition.examTitle);
    if (examTitleCondition?.examTitle?.$regex) {
      examTitle = examTitleCondition.examTitle.$regex;
    }
  }
  // Fallback to direct examTitle filter
  else if (filters.examTitle) {
    if (filters.examTitle.$regex) {
      examTitle = filters.examTitle.$regex;
    }
  }

  const now = new Date();
  let exams = await studentExamsRepository.findExamsByStudent(studentId, {
    examType: "Official",
  });

  // Filter by subjectId if provided
  if (subjectId) {
    exams = exams.filter((examStudent) => {
      const exam = examStudent.examId as any;
      if (!exam) return false;

      // Get subjectId from exam (could be ObjectId or populated object)
      let examSubjectId = "";
      if (exam.subjectId) {
        if (typeof exam.subjectId === "object" && exam.subjectId._id) {
          examSubjectId = exam.subjectId._id.toString();
        } else {
          examSubjectId = exam.subjectId.toString();
        }
      }

      // Compare ObjectId strings
      return examSubjectId === subjectId;
    });
  }

  // Filter by classId if provided
  if (classId) {
    exams = exams.filter((examStudent) => {
      const exam = examStudent.examId as any;
      if (!exam) return false;

      // Get classId from exam
      const examClassId = exam.classId?.toString() || "";

      // Compare ObjectId strings
      return examClassId === classId;
    });
  }

  // Filter by examTitle if provided (case-insensitive regex search)
  if (examTitle) {
    const searchRegex = new RegExp(examTitle, 'i');
    exams = exams.filter((examStudent) => {
      const exam = examStudent.examId as any;
      if (!exam || !exam.examTitle) return false;

      // Match exam title against the search regex
      return searchRegex.test(exam.examTitle);
    });
  }

  // Extract all IDs for batch fetching
  const examIds = exams
    .map((es) => (es.examId as any)?._id?.toString())
    .filter(Boolean);
  const teacherIds = [
    ...new Set(
      exams
        .map((es) => (es.examId as any)?.teacherId?.toString())
        .filter(Boolean)
    ),
  ];
  const subjectIds = [
    ...new Set(
      exams
        .map((es) => {
          const exam = es.examId as any;
          if (exam?.subjectId) {
            return typeof exam.subjectId === "string"
              ? exam.subjectId
              : exam.subjectId?._id?.toString();
          }
          return null;
        })
        .filter(Boolean)
    ),
  ];
  const classIds = [
    ...new Set(
      exams
        .map((es) => {
          const exam = es.examId as any;
          return exam?.classId?.toString();
        })
        .filter(Boolean)
    ),
  ];

  // Batch fetch all related data
  const [teacherMap, subjectMap, classMap, questionCountMap, examAttemptMap] =
    await Promise.all([
      // Fetch all teachers
      (async () => {
        const teachers = await Promise.all(
          teacherIds.map((id) => teacherRepository.findTeacherById(id))
        );
        return new Map(teacherIds.map((id, index) => [id, teachers[index]]));
      })(),

      // Fetch all subjects
      (async () => {
        if (subjectIds.length === 0) return new Map();
        try {
          const subjectRepo = new (
            await import("../repositories/subject.repository")
          ).SubjectRepository();
          const tenantId = exams[0]?.tenantId?.toString() || "";
          if (!tenantId) return new Map();

          const subjects = await Promise.all(
            subjectIds.map((id) => subjectRepo.findById(id, tenantId))
          );
          return new Map(subjectIds.map((id, index) => [id, subjects[index]]));
        } catch (err) {
          console.warn("Could not fetch subjects:", err);
          return new Map();
        }
      })(),

      // Fetch all classes
      (async () => {
        if (classIds.length === 0) return new Map();
        try {
          const classRepo = new (
            await import("../repositories/class.repository")
          ).ClassRepository();
          const tenantId = exams[0]?.tenantId?.toString() || "";
          if (!tenantId) return new Map();

          const classes = await Promise.all(
            classIds.map((id) => classRepo.findById(id, tenantId))
          );
          return new Map(classIds.map((id, index) => [id, classes[index]]));
        } catch (err) {
          console.warn("Could not fetch classes:", err);
          return new Map();
        }
      })(),

      // Fetch question counts for all exams
      (async () => {
        const counts = await Promise.all(
          examIds.map((id) => examQuestionRepository.countExamQuestions(id))
        );
        return new Map(examIds.map((id, index) => [id, counts[index]]));
      })(),

      // Fetch exam attempts for performed exams (only needed for "performed" category)
      (async () => {
        // We need attempts for "performed" AND "expired" to distinguish auto-graded (missed) exams
        if (examCategory !== "performed" && examCategory !== "expired") return new Map();
        try {
          const examAttemptRepository = await import(
            "../repositories/examAttempt.repository"
          );
          // For performed/expired, we might need attempts for Completed exams
          const relevantExams = exams.filter(
            (es) => es.status === "Completed"
          );
          if (relevantExams.length === 0) return new Map();

          const attemptPromises = relevantExams.map((es) =>
            examAttemptRepository.findAttemptsByStudentAndExam(
              es.studentId.toString(),
              es.examId._id.toString()
            )
          );
          const attemptResults = await Promise.all(attemptPromises);

          const attemptMap = new Map();
          relevantExams.forEach((es, index) => {
            const examId = es.examId._id.toString();
            const attempts = attemptResults[index];
            attemptMap.set(
              examId,
              attempts && attempts.length > 0 ? attempts[0] : null
            );
          });
          return attemptMap;
        } catch (err) {
          console.warn("Could not fetch exam attempts:", err);
          return new Map();
        }
      })(),
    ]);

  const result: any[] = [];

  for (const examStudent of exams) {
    const exam = examStudent.examId as any;
    if (!exam || typeof exam !== "object") continue;

    const examId = exam._id?.toString();
    const teacherId = exam.teacherId?.toString();
    const subjectId =
      typeof exam.subjectId === "string"
        ? exam.subjectId
        : (exam.subjectId as any)?._id?.toString();
    const classId = exam.classId?.toString();

    // Get data from maps
    const teacherInfo = teacherId ? teacherMap.get(teacherId) : null;
    const subjectInfo = subjectId ? subjectMap.get(subjectId) : null;
    const classInfo = classId ? classMap.get(classId) : null;
    const questionsCount = examId ? questionCountMap.get(examId) || 0 : 0;
    
    // Get attempt info if available
    const attempt = examId ? examAttemptMap.get(examId) : null;
    const submitTime = attempt?.submittedAt;
    const attemptId = attempt?._id?.toString() || null;

    // Determine if this was a "System Auto-Graded / Missed" exam
    // Logic: Status is Completed, but SubmittedAt is STRICTLY after Exam EndTime
    const isAutoGradedMissed = 
      examStudent.status === "Completed" && 
      submitTime && 
      exam.endOn && 
      new Date(submitTime) > new Date(exam.endOn);

    // Get subject name
    let subjectName = "";
    if (
      exam.subjectId &&
      typeof exam.subjectId === "object" &&
      exam.subjectId.name
    ) {
      subjectName = exam.subjectId.name;
    } else if (subjectInfo?.name) {
      subjectName = subjectInfo.name;
    }

    // Get class name
    const className = classInfo?.name || "";

    const base = {
      examId: examId || "",
      title: exam.examTitle,
      subject: subjectName,
      className: className,
      createdBy: teacherInfo
        ? teacherInfo.firstName + " " + teacherInfo.lastName
        : undefined,
      startTime: exam.startOn,
      endTime: exam.endOn,
      duration: exam.durationInMinutes,
      totalQuestions: questionsCount,
      examType: exam.examType,
      examStatus: exam.examStatus,
      status: examStudent.status,
    };
    if (examCategory === "open") {
      if (
        exam.startOn < now &&
        exam.endOn > now &&
        examStudent.status === "Pending"
      ) {
        result.push(base);
      }
    } else if (examCategory === "in-progress") {
      // Commented out inProgress logic for now
      // ...
    } else if (examCategory === "performed") {
      // Show ONLY if completed AND NOT auto-missed
      if (examStudent.status === "Completed" && !isAutoGradedMissed) {
        result.push({
          ...base,
          attemptId, // Include attemptId for performed exams
          startExamOrContinue: false, // logic for this can be added as needed
          percentage: examStudent.percentage,
          submitTime,
        });
      }
    } else if (examCategory === "scheduled") {
      if (exam.startOn > now) {
        result.push(base);
      }
    } else if (examCategory === "expired") {
      // Show if Pending/Started expired, OR if Completed via auto-missed logic
      if (
        ((examStudent?.status === "Pending" ||
          examStudent?.status === "Started") &&
        exam.endOn < now) || 
        isAutoGradedMissed
      ) {
        result.push(base);
      }
    }
  }

  // Sort results based on sort parameter or category-specific defaults
  if (sort && Object.keys(sort).length > 0) {
    // Use provided sort parameter from buildQueryFromRequest
    result.sort((a, b) => {
      for (const [field, order] of Object.entries(sort)) {
        const valueA = a[field];
        const valueB = b[field];

        // Handle date fields
        const timeA = valueA ? new Date(valueA).getTime() : 0;
        const timeB = valueB ? new Date(valueB).getTime() : 0;

        const comparison = order === 1 ? timeA - timeB : timeB - timeA;
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  } else {
    // Fallback to category-specific default sorting
    if (examCategory === "performed") {
      // Sort by submit time (latest first)
      result.sort((a, b) => {
        const timeA = a.submitTime ? new Date(a.submitTime).getTime() : 0;
        const timeB = b.submitTime ? new Date(b.submitTime).getTime() : 0;
        return timeB - timeA; // Descending order (latest first)
      });
    } else if (examCategory === "expired") {
      // Sort by end time (latest first)
      result.sort((a, b) => {
        const timeA = a.endTime ? new Date(a.endTime).getTime() : 0;
        const timeB = b.endTime ? new Date(b.endTime).getTime() : 0;
        return timeB - timeA; // Descending order (latest first)
      });
    }
  }

  // Apply pagination
  const totalCount = result.length;
  const startIndex = (pageNo - 1) * pageSize;
  const paginatedResults = result.slice(startIndex, startIndex + pageSize);

  return {
    exams: paginatedResults,
    pagination: {
      total: totalCount,
      pageNo: pageNo,
      pageSize: pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};

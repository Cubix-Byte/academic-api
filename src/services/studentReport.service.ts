import mongoose from 'mongoose';
import {
  Student,
  Class,
  Subject,
  Exam,
  ExamAttempt,
  ExamAttemptLog,
  StudentPerformanceAnalytics,
  ExamStudent,
  ExamAnswer, // Added for Question Analysis
  ExamAchievement,
  ExamCredential,
  StudentGeneratedReport,
  StudentTopicPerformance,
  ClassTopicPerformance,
  GradingSystem, // Added for Dynamic Grading
  TeacherAssignClasses // Added for teacher subject filtering
} from '../models';
import {
  StudentData,
  MonthlyTrend,
  QuestionPerformance,
  PeerDistribution,
  OverallStats,
  AIInsights,
  TimeMetrics,
  SubjectDetail
} from '../types/studentReport.types';


/**
 * Service to generate comprehensive student academic reports
 */
export const getStudentPdfReport = async (
  studentId: string,
  classId: string,
  tenantId: string,
  subjectId?: string,
  examId?: string,
  requestingUserId?: string
): Promise<StudentData> => {

  // Validate ObjectIds to prevent 500 errors
  if (!mongoose.Types.ObjectId.isValid(studentId)) throw new Error(`Invalid studentId provided: ${studentId}`);
  if (!mongoose.Types.ObjectId.isValid(classId)) throw new Error(`Invalid classId provided: ${classId}`);
  if (!mongoose.Types.ObjectId.isValid(tenantId)) throw new Error(`Invalid tenantId provided: ${tenantId}`);
  if (subjectId && !mongoose.Types.ObjectId.isValid(subjectId)) throw new Error(`Invalid subjectId provided: ${subjectId}`);
  if (examId && !mongoose.Types.ObjectId.isValid(examId)) throw new Error(`Invalid examId provided: ${examId}`);

  // First, try to fetch pre-generated report from collection
  const existingReport = await StudentGeneratedReport.findOne({
    studentId: new mongoose.Types.ObjectId(studentId),
    classId: new mongoose.Types.ObjectId(classId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    subjectId: subjectId ? new mongoose.Types.ObjectId(subjectId) : null,
    examId: examId ? new mongoose.Types.ObjectId(examId) : null
  });

  // If report exists and is recent (less than 5 minutes old), return cached data
  //   if (existingReport && existingReport.updatedAt && !examId) {
  //     const ageInMinutes = (Date.now() - existingReport.updatedAt.getTime()) / (1000 * 60);
  //     if (ageInMinutes < 5 && existingReport.data) {
  //       console.log(`⚡ Returning cached report for student ${studentId}`);
  //       return existingReport.data as StudentData;
  //     }
  //   }


  // If no cached report or stale, calculate from scratch
  try {
    // Convert to ObjectIds for models that use ObjectId references
    const studentObjId = new mongoose.Types.ObjectId(studentId);
    const classObjId = new mongoose.Types.ObjectId(classId);
    const tenantObjId = new mongoose.Types.ObjectId(tenantId);
    const subjectObjId = subjectId ? new mongoose.Types.ObjectId(subjectId) : undefined;

    // 1. Fetch Basic Student Info (Student model uses String for tenantId)
    const student = await Student.findOne({ _id: studentObjId, tenantId: tenantId, isDeleted: false });
    if (!student) throw new Error('Student not found');

    // Class model uses ObjectId for tenantId
    const classData = await Class.findOne({ _id: classObjId, tenantId: tenantObjId });
    if (!classData) throw new Error('Class not found');

    let subjectData = null;
    if (subjectObjId) {
      subjectData = await Subject.findOne({ _id: subjectObjId, tenantId: tenantObjId });
    }

    // 2. Fetch Performance Analytics (Assume ObjectId for references)
    const analyticsList = await StudentPerformanceAnalytics.find({
      studentId: studentObjId,
      classId: classObjId,
      tenantId: tenantObjId,
      ...(subjectObjId ? { subjectId: subjectObjId } : {})
    }).sort({ lastCalculated: -1 });

    // 2a. Fetch Grading System
    const gradingSystem = await GradingSystem.findOne({
      tenantId: tenantObjId,
      isActive: true
    }).sort({ isDefault: -1 }); // Prefer default if multiple active (though typically 1)

    // 3. Fetch Exam History (Updated to match student.service.ts aggregation logic)
    const examHistoryPipeline: any[] = [
      {
        $match: {
          studentId: studentObjId,
          tenantId: tenantObjId,
          isActive: true, // We still filter by active exam students
          // Removed explicit gradingStatus check here to allow aggregation to determine valid exams
          // But typically we only want 'Completed' for reports. 
          // User's reference has gradingStatus: "Completed" in baseMatchStage.
          gradingStatus: 'Completed'
        }
      },
      {
        $lookup: {
          from: 'exams',
          localField: 'examId',
          foreignField: '_id',
          as: 'examData'
        }
      },
      { $unwind: { path: '$examData', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'examData.isDeleted': false,
          'examData.classId': classObjId, // Filter by Class Context
          'examData.examStatus': 'Released', // Ensure Exam is Released
          ...(subjectObjId ? { 'examData.subjectId': subjectObjId } : {}) // Filter by Subject if provided
        }
      },
      { $sort: { 'examData.startOn': -1 } } // Sort by exam date
    ];

    const aggregatedHistory = await ExamStudent.aggregate(examHistoryPipeline);

    // Map aggregation result to the expected format
    const validHistory = aggregatedHistory.map(es => ({
      examId: {
        ...es.examData, // Spread exam data to mimic populated object
        _id: es.examData._id, // Ensure ID is correct
        totalMarks: es.examData.totalMarks,
        passingMarks: es.examData.passingMarks || 35
      },
      percentage: es.percentage || 0,
      grade: es.grade || 'F',
      attemptedDate: es.updatedAt,
      timeTaken: 0,
      status: es.status,
      score: Math.round((es.percentage || 0) / 100 * (es.examData.totalMarks || 100)),
      totalMarks: es.examData.totalMarks,
      passingMarks: es.examData.passingMarks || 35
    }));

    const totalExams = validHistory.length;

    // 4. Fetch Class Context & Calculate Overall Stats Dynamically

    // A. Fetch Class Context (All Exams & Results for this Class)
    const allClassExams = await Exam.find({
      classId: classObjId,
      tenantId: tenantObjId,
      isDeleted: false
    }).select('_id totalMarks subjectId startOn examTitle');

    const classExamIds = allClassExams.map(e => e._id);

    // Fetch Class History (All students' results)
    const allClassResults = await ExamStudent.find({
      examId: { $in: classExamIds },
      gradingStatus: 'Completed',
      isActive: true
    }).lean();

    // Enrich class results for easy processing
    const enrichedClassHistory = allClassResults.map(r => {
      const exam = allClassExams.find(e => e._id.toString() === r.examId.toString());
      if (r.studentId.toString() === studentId) {
        console.log(`[DEBUG] enrichedClassHistory item for student:`, JSON.stringify({
          examId: r.examId,
          percentage: r.percentage,
          date: r.updatedAt,
          createdAt: r.createdAt,
          // mappedDate: r.date
        }));
      }
      return {
        ...r,
        score: Math.round((r.percentage || 0) / 100 * (exam?.totalMarks || 100)),
        percentage: r.percentage || 0,
        date: r.updatedAt,
        subjectId: exam?.subjectId?.toString(),
        totalPossibleMarks: exam?.totalMarks || 100
      };
    });

    // Fetch teacher's assigned subjects if requestingUserId is provided (for filtered rank calculation)
    let teacherSubjectIds: string[] = [];
    if (requestingUserId && !subjectId && mongoose.Types.ObjectId.isValid(requestingUserId)) {
      const requestingUserObjId = new mongoose.Types.ObjectId(requestingUserId);

      const teacherAssignments = await TeacherAssignClasses.find({
        teacherId: requestingUserObjId,
        classId: classObjId,
        tenantId: tenantObjId,
        isActive: true,
        isDeleted: false
      }).select('subjectId').lean();

      if (teacherAssignments.length > 0) {
        teacherSubjectIds = teacherAssignments
          .map((assignment: any) => assignment.subjectId?.toString())
          .filter((id: string | undefined): id is string => !!id);

        console.log(`🔐 Teacher ${requestingUserId} viewing student - Filtering rank by subjects:`, teacherSubjectIds);
      }
    }

    // Filter enrichedClassHistory by teacher's subjects if applicable
    const filteredClassHistory = teacherSubjectIds.length > 0
      ? enrichedClassHistory.filter(r => {
        const subId = r.subjectId;
        return subId && teacherSubjectIds.includes(subId);
      })
      : enrichedClassHistory;

    let overallPercentage = 0;
    let currentRank = 0;

    // B. Calculate Overall Percentage (Student)
    const totalScore = validHistory.reduce((acc, h: any) => acc + (h.score || 0), 0);
    const totalMaxMarks = validHistory.reduce((acc, h: any) => acc + (h.totalMarks || 0), 0);

    if (totalMaxMarks > 0) {
      overallPercentage = (totalScore / totalMaxMarks) * 100;
    }

    // Class Total Students — fetch before rank so fallback can use it when student has no exam data
    const totalStudents = await Student.countDocuments({ classId: classId, tenantId: tenantId, isDeleted: false, isActive: true });

    // C. Calculate Dynamic Rank (Class or Subject-specific)
    let subjectRank: number | undefined;

    if (subjectObjId) {
      // Calculate subject-specific rank
      subjectRank = calculateSubjectRank(studentId, subjectId!, enrichedClassHistory);
    } else {
      // Calculate overall class rank (filtered by teacher's subjects if applicable)
      // 1. Group allClassResults by student
      const classStudentData = filteredClassHistory.reduce((acc: any, r: any) => {
        const sid = r.studentId.toString();
        if (!acc[sid]) acc[sid] = { obtained: 0, total: 0 };
        const exam = allClassExams.find(e => e._id.toString() === r.examId.toString());
        acc[sid].obtained += (r.score || 0);
        acc[sid].total += (exam?.totalMarks || 100);
        return acc;
      }, {});

      // 2. Calculate average for each student (Weighted Avg of all exams)
      const classOveralls = Object.keys(classStudentData).map(sid => {
        const d = classStudentData[sid];
        const sOverall = d.total > 0 ? (d.obtained / d.total) * 100 : 0;
        return { sid, overall: sOverall };
      });

      // 3. Sort and Rank — if student has no exam data (not in list), assign last rank in class
      classOveralls.sort((a, b) => b.overall - a.overall);
      const rankIdx = classOveralls.findIndex(c => c.sid === studentId);
      currentRank = rankIdx !== -1 ? rankIdx + 1 : totalStudents; // No exam data → last in class
    }

    const passedExams = validHistory.filter((h: any) => h.percentage >= (h.passingMarks || 35)).length; // Dynamic pass mark
    const passRate = totalExams > 0 ? (passedExams / totalExams) * 100 : 0;


    // Fetch actual credentials (Badges, Certificates, Awards) from ExamCredential collection
    const allCredentials = await ExamCredential.find({
      studentId: studentObjId,
      tenantId: tenantObjId,
      isDeleted: false,
      isActive: true
    });

    // Categorize credentials
    const badgesCount = allCredentials.filter(c => c.credentialType?.toLowerCase() === 'badge').length;
    const certificatesCount = allCredentials.filter(c => c.credentialType?.toLowerCase() === 'certificate').length;
    const awardsCount = allCredentials.filter(c => c.credentialType?.toLowerCase() === 'award').length;
    const totalCreds = allCredentials.length;



    const overallStats: OverallStats = {
      percentage: Math.round(overallPercentage),
      grade: totalExams > 0 ? calculateGrade(overallPercentage, gradingSystem) : '--',
      classRank: currentRank,
      totalStudents,
      percentile: totalStudents > 0 ? Math.min(100, Math.max(0, Math.round(((totalStudents - currentRank + 1) / totalStudents) * 100))) : 0,
      totalExamsTaken: totalExams,
      passRate: Math.round(passRate),

      achievements: {
        total: totalCreds,
        badges: badgesCount,
        certificates: certificatesCount,
        awards: awardsCount
      }
    };



    // 5. Performance Trend (Monthly)
    const trendClassHistory = subjectObjId
      ? enrichedClassHistory.filter(h => h.subjectId === subjectObjId.toString())
      : enrichedClassHistory;

    const performanceTrend = calculateMonthlyTrend(validHistory, trendClassHistory);

    // 4a. Fetch Detailed Exam Attempts (for AI insights, time analysis)
    // We need the specific attempt data that corresponds to the completed exams
    const attemptMap = new Map(); // examId -> attempt
    const attempts = await ExamAttempt.find({
      studentId: studentObjId,
      examId: { $in: validHistory.map(h => (h.examId as any)._id) },
      attemptStatus: { $in: ['Submitted', 'Graded'] },
      isDeleted: false
    }).sort({ attemptNumber: -1 }); // Latest attempt first

    // Deduplicate attempts (keep latest per exam)
    const uniqueAttempts: any[] = [];
    attempts.forEach(att => {
      const eid = att.examId.toString();
      if (!attemptMap.has(eid)) {
        attemptMap.set(eid, att);
        uniqueAttempts.push(att);
      }
    });

    // Update validHistory with timeTaken from attempts
    validHistory.forEach(h => {
      const attempt = attemptMap.get((h.examId as any)._id.toString());
      if (attempt) {
        h.timeTaken = attempt.timeTakenInSeconds || 0;
      }
    });

    // 9. Subjects Detail (with Class Comparisons)
    // Calculate global time stats for the class
    // Calculate global time stats for the class (Scope: Total Assigned Exams)
    // Filter exams by teacher's subjects if applicable
    const filteredClassExamIds = teacherSubjectIds.length > 0
      ? allClassExams
        .filter(e => {
          const subId = typeof e.subjectId === 'string' ? e.subjectId : e.subjectId?.toString();
          return subId && teacherSubjectIds.includes(subId);
        })
        .map(e => e._id)
      : classExamIds;

    // 1. Total Time Spent by all students (filtered by teacher's subjects)
    const classTimeStats = await ExamAttempt.aggregate([
      { $match: { examId: { $in: filteredClassExamIds }, attemptStatus: { $in: ['Submitted', 'Graded'] } } },
      { $group: { _id: null, totalTime: { $sum: '$timeTakenInSeconds' } } }
    ]);
    const totalClassTime = classTimeStats[0]?.totalTime || 0;

    // 2. Total Assignments (Denominator) - Using ExamStudent count to match Score Analysis scope
    const totalClassAssignments = await ExamStudent.countDocuments({
      examId: { $in: filteredClassExamIds },
      gradingStatus: 'Completed',
      isActive: true
    });

    // Average time per assigned exam (includes 0s for non-attempts)
    const classAvgTime = totalClassAssignments > 0 ? totalClassTime / totalClassAssignments : 0;

    // Branch logic based on report type
    let subjects, exams, aiInsights;

    // ALWAYS calculate subjects for both types to ensure consistent data structure
    // If subjectId is present, this will return an array with just that one subject
    subjects = await getSubjectDetails(studentId, classId, tenantId, filterSubjects(validHistory, subjectId), enrichedClassHistory, gradingSystem);

    if (subjectObjId) {
      // Subject-specific report
      exams = await getExamDetails(studentId, classId, subjectId!, tenantId, validHistory, gradingSystem);

      // Single Exam Override Logic for Gap Analysis
      let attemptsForInsights = uniqueAttempts;
      let examsForInsights = exams;

      if (examId) {
        attemptsForInsights = uniqueAttempts.filter(a => a.examId.toString() === examId);
        // When focusing on one exam, passing only that exam to generateTopicBasedAIInsights ensures
        // the topic gap analysis is strictly derived from the topicBreakdown of that specific exam.
        examsForInsights = exams.filter(e => e.id === examId);

        // Update the main exams list to only include the specific exam as well
        exams = examsForInsights;
      }

      aiInsights = await generateTopicBasedAIInsights(attemptsForInsights, examsForInsights);
    } else {
      // Comprehensive report
      // subjects already calculated above
      aiInsights = await generateAIInsights(uniqueAttempts, analyticsList, subjects);
    }

    // Filter attempts history and class stats for single-exam specific metrics (Time, Question)
    // Also filter by teacher's subjects if applicable
    let analysisAttempts = uniqueAttempts;
    let analysisHistory = validHistory;
    let specificClassAvgTime = classAvgTime;

    // Filter by teacher's subjects first
    if (teacherSubjectIds.length > 0) {
      analysisAttempts = uniqueAttempts.filter(a => {
        const exam = allClassExams.find(e => e._id.toString() === a.examId.toString());
        const subId = typeof exam?.subjectId === 'string' ? exam.subjectId : exam?.subjectId?.toString();
        return subId && teacherSubjectIds.includes(subId);
      });
      analysisHistory = validHistory.filter(h => {
        const subId = (h.examId as any)?.subjectId?.toString();
        return subId && teacherSubjectIds.includes(subId);
      });
    }

    // Then filter by examId if specified
    if (examId) {
      analysisAttempts = analysisAttempts.filter(a => a.examId.toString() === examId);
      analysisHistory = analysisHistory.filter(h => (h.examId as any)._id.toString() === examId);

      // Calculate Specific Class Average Time for this Exam ONLY
      const singleExamClassStats = await ExamAttempt.aggregate([
        { $match: { examId: new mongoose.Types.ObjectId(examId), attemptStatus: { $in: ['Submitted', 'Graded'] } } },
        { $group: { _id: null, totalTime: { $sum: '$timeTakenInSeconds' } } }
      ]);
      const singleExamTotalTime = singleExamClassStats[0]?.totalTime || 0;

      const singleExamTotalAssignments = await ExamStudent.countDocuments({
        examId: new mongoose.Types.ObjectId(examId),
        gradingStatus: 'Completed',
        isActive: true
      });

      specificClassAvgTime = singleExamTotalAssignments > 0 ? singleExamTotalTime / singleExamTotalAssignments : 0;
    } else if (teacherSubjectIds.length > 0) {
      // Recalculate class average time for teacher's subjects only
      specificClassAvgTime = classAvgTime; // Already calculated with filtered exams above
    }

    const timeAnalysis = await generateTimeAnalysis(analysisAttempts, analysisHistory, specificClassAvgTime);

    // 7. Question Type Performance (Expensive Ops - Aggregation)
    // Use filtered attempt IDs for question performance
    const attemptIds = analysisAttempts.map(a => a._id);
    const questionTypePerformance = await getQuestionTypePerformance(attemptIds);

    // 8. Peer Distribution (Expensive Ops - Aggregation)
    // Peer distribution filtered by teacher's subjects if applicable
    const peerDistribution = await getPeerDistribution(
      classId,
      subjectId,
      tenantId,
      overallPercentage,
      teacherSubjectIds.length > 0 ? filteredClassExamIds : undefined
    );

    // Store the calculated report for future use
    const calculatedReport: any = {
      id: student._id.toString(),
      name: `${student.firstName} ${student.lastName}`,
      grade: classData.grade.toString(),
      ...(subjectObjId ? { subjectName: subjectData?.name } : { className: classData.name || '' }),
      stdId: student.stdId || '',
      rollNumber: student.rollNumber || '',
      overall: {
        ...overallStats,
        ...(subjectObjId ? { subjectRank } : { classRank: currentRank })
      },
      performanceTrend,
      aiInsights,
      timeAnalysis,
      questionTypePerformance,
      peerDistribution,
      subjects: subjects, // Always include subjects
      ...(subjectObjId ? { exams } : {})
    };

    // Save to collection for future requests
    const reportType = subjectId ? 'SUBJECT' : 'COMPREHENSIVE';
    await StudentGeneratedReport.findOneAndUpdate(
      {
        studentId: studentObjId,
        subjectId: subjectObjId || null
      },
      {
        $set: {
          classId: classObjId,
          tenantId: tenantObjId,
          reportType,
          data: calculatedReport,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    // Filter report data by teacher's assigned subjects if requestingUserId is provided
    // Note: Teacher filtering and rank calculation were already done earlier
    console.log(teacherSubjectIds);
    if (teacherSubjectIds.length > 0) {
      console.log(`🔐 Applying display filters for teacher's subjects:`, teacherSubjectIds);

      // Filter subjects array
      if (calculatedReport.subjects && Array.isArray(calculatedReport.subjects)) {
        console.log(`🔐 Pre-filter subjects count:`, calculatedReport.subjects);
        calculatedReport.subjects = calculatedReport.subjects.filter((subject: any) =>
          teacherSubjectIds.includes(subject.id)
        );
      }
      console.log(`🔐 Post-filter subjects count:`, calculatedReport.subjects.length);
      // RECALCULATE OVERALL STATS (KPIs) based on filtered subjects
      if (calculatedReport.subjects.length > 0) {
        // Calculate new overall percentage from filtered subjects
        const filteredAvgScore = calculatedReport.subjects.reduce(
          (sum: number, subject: any) => sum + (subject.score || 0),
          0
        ) / calculatedReport.subjects.length;

        const totalFilteredExams = calculatedReport.subjects.reduce(
          (sum: number, subject: any) => sum + (subject.exams?.length || 0),
          0
        );

        // Recalculate grade based on filtered average
        calculatedReport.overall.percentage = Math.round(filteredAvgScore);
        calculatedReport.overall.grade =
          totalFilteredExams > 0
            ? calculateGrade(filteredAvgScore, gradingSystem)
            : "--";

        // Recalculate total exams taken for teacher's subjects only
        calculatedReport.overall.totalExamsTaken = totalFilteredExams;

        // Recalculate pass rate based on filtered subjects' exams
        const allFilteredExams = calculatedReport.subjects.flatMap((subject: any) => subject.exams || []);
        const passedFilteredExams = allFilteredExams.filter((exam: any) => exam.score >= (exam.passingMarks || 35));
        calculatedReport.overall.passRate = allFilteredExams.length > 0
          ? Math.round((passedFilteredExams.length / allFilteredExams.length) * 100)
          : 0;

        // Note: classRank is now calculated based on teacher's subjects (done earlier)
        // Note: achievements remain as overall student achievements (not subject-specific)
      } else {
        // If no subjects match teacher's assignments, show zero stats
        calculatedReport.overall.percentage = 0;
        calculatedReport.overall.grade = 'N/A';
        calculatedReport.overall.totalExamsTaken = 0;
        calculatedReport.overall.passRate = 0;
      }

      // Filter aiInsights data (strongSubjects, weakSubjects, averageSubjects, gapAnalysisData)
      if (calculatedReport.aiInsights) {
        const filterSubjectInsights = (insights: any[] | undefined) => {
          return insights?.filter((item: any) => {
            const subjectDetail = calculatedReport.subjects?.find((s: any) => s.name === item.subject);
            return subjectDetail && teacherSubjectIds.includes(subjectDetail.id);
          });
        };

        calculatedReport.aiInsights.strongSubjects = filterSubjectInsights(calculatedReport.aiInsights.strongSubjects) || [];
        calculatedReport.aiInsights.weakSubjects = filterSubjectInsights(calculatedReport.aiInsights.weakSubjects) || [];
        calculatedReport.aiInsights.averageSubjects = filterSubjectInsights(calculatedReport.aiInsights.averageSubjects) || [];
        calculatedReport.aiInsights.gapAnalysisData = filterSubjectInsights(calculatedReport.aiInsights.gapAnalysisData) || [];

        // Handle singular strongest/weakest subject
        if (calculatedReport.aiInsights.strongestSubject) {
          const strongestSubjectDetail = calculatedReport.subjects?.find(
            (s: any) => s.name === calculatedReport.aiInsights.strongestSubject?.subject
          );
          if (!strongestSubjectDetail || !teacherSubjectIds.includes(strongestSubjectDetail.id)) {
            calculatedReport.aiInsights.strongestSubject = undefined;
          }
        }

        if (calculatedReport.aiInsights.weakestSubject) {
          const weakestSubjectDetail = calculatedReport.subjects?.find(
            (s: any) => s.name === calculatedReport.aiInsights.weakestSubject?.subject
          );
          if (!weakestSubjectDetail || !teacherSubjectIds.includes(weakestSubjectDetail.id)) {
            calculatedReport.aiInsights.weakestSubject = undefined;
          }
        }
      }

      // Filter and recalculate performanceTrend based on teacher's subjects
      if (calculatedReport.performanceTrend && Array.isArray(calculatedReport.performanceTrend)) {
        // Filter student history to only include teacher's subjects
        const filteredValidHistory = validHistory.filter((h: any) =>
          teacherSubjectIds.includes(h.examId?.subjectId?.toString())
        );

        // Filter class history to only include teacher's subjects
        const filteredClassHistory = enrichedClassHistory.filter((h: any) =>
          teacherSubjectIds.includes(h.subjectId)
        );

        // Recalculate monthly trend with filtered data
        if (filteredValidHistory.length > 0) {
          calculatedReport.performanceTrend = calculateMonthlyTrend(
            filteredValidHistory,
            filteredClassHistory
          );
        } else {
          // No exams in teacher's subjects
          calculatedReport.performanceTrend = [];
        }
      }

      // Filter timeAnalysis by teacher's subjects
      if (calculatedReport.timeAnalysis) {
        const filteredTimeAnalysis: any = { all: calculatedReport.timeAnalysis.all };

        Object.keys(calculatedReport.timeAnalysis).forEach(key => {
          if (key !== 'all') {
            // Check if this subject key is in teacher's subjects
            const subjectDetail = calculatedReport.subjects?.find((s: any) => s.id === key);
            if (subjectDetail && teacherSubjectIds.includes(key)) {
              filteredTimeAnalysis[key] = calculatedReport.timeAnalysis[key];
            }
          }
        });

        calculatedReport.timeAnalysis = filteredTimeAnalysis;
      }

      // Filter questionTypePerformance by teacher's subjects
      if (calculatedReport.questionTypePerformance) {
        const filteredQuestionTypePerformance: any = { all: calculatedReport.questionTypePerformance.all };

        Object.keys(calculatedReport.questionTypePerformance).forEach(key => {
          if (key !== 'all') {
            const subjectDetail = calculatedReport.subjects?.find((s: any) => s.id === key);
            if (subjectDetail && teacherSubjectIds.includes(key)) {
              filteredQuestionTypePerformance[key] = calculatedReport.questionTypePerformance[key];
            }
          }
        });

        calculatedReport.questionTypePerformance = filteredQuestionTypePerformance;
      }

      // Filter peerDistribution by teacher's subjects
      if (calculatedReport.peerDistribution) {
        const filteredPeerDistribution: any = { all: calculatedReport.peerDistribution.all };

        Object.keys(calculatedReport.peerDistribution).forEach(key => {
          if (key !== 'all') {
            const subjectDetail = calculatedReport.subjects?.find((s: any) => s.id === key);
            if (subjectDetail && teacherSubjectIds.includes(key)) {
              filteredPeerDistribution[key] = calculatedReport.peerDistribution[key];
            }
          }
        });

        calculatedReport.peerDistribution = filteredPeerDistribution;
      }
    }

    return calculatedReport as StudentData;

  } catch (error) {
    console.error('Error generating student PDF report:', error);
    throw error; // Re-throw to handle 500 downstream or let global handler catch
  }
};


// --- Helper Functions ---

function calculateGrade(percentage: number, gradingSystem: any): string {
  if (gradingSystem && gradingSystem.gradeRanges) {
    const range = gradingSystem.gradeRanges.find((r: any) => percentage >= r.minPercentage && percentage <= r.maxPercentage);
    if (range) return range.grade;
  }

  // Fallback if no grading system found
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

function calculateMonthlyTrend(studentHistory: any[], classHistory: any[]): MonthlyTrend[] {
  // Helper to get month key
  const getMonthKey = (d: any) => {
    const date = new Date(d);
    return date.toLocaleString('default', { month: 'short' });
  };
  console.log(studentHistory, "--------------------------student history-------------------")
  // Group Student Data
  const studentGrouped = studentHistory.reduce((acc: any, curr) => {
    const month = getMonthKey(curr.attemptedDate);
    if (!acc[month]) acc[month] = { obtained: 0, total: 0 };
    acc[month].obtained += (curr.score || 0);
    acc[month].total += (curr.totalMarks || 100);
    return acc;
  }, {});

  // Group Class Data (by Month) - Then by Student
  const classMonthMap = classHistory.reduce((acc: any, curr: any) => {
    const month = getMonthKey(curr.date);
    if (!acc[month]) acc[month] = [];
    acc[month].push(curr);
    return acc;
  }, {});

  const months = Object.keys(studentGrouped);

  return months.map(month => {
    const sData = studentGrouped[month];
    const score = sData.total > 0 ? Math.round((sData.obtained / sData.total) * 100) : 0;

    // Process Class Data for this month
    const cRecords = classMonthMap[month] || [];

    // Group by Student to find Student Averages for this month (Weighted)
    const classStudentMap = cRecords.reduce((acc: any, res: any) => {
      const sid = res.studentId.toString();
      if (!acc[sid]) acc[sid] = { obtained: 0, total: 0 };
      acc[sid].obtained += (res.score || 0);
      acc[sid].total += (res.totalPossibleMarks || 100); // Wait, enrichedClassHistory uses totalMarks? Let's check.
      // Looking at enrichedClassHistory (line 192), it calculates score based on exam.totalMarks. 
      // It might be better to store totalMarks in enrichedClassHistory too.
      return acc;
    }, {});

    // Calculate Weighted Average for every student in the class for this month
    const studentMonthlyAvgs = Object.values(classStudentMap).map((s: any) => s.total > 0 ? (s.obtained / s.total) * 100 : 0) as number[];

    // Class Stats based on Student Averages (Simple average of student weighted averages)
    const classAvg = studentMonthlyAvgs.length > 0
      ? Math.round(studentMonthlyAvgs.reduce((a, b) => a + b, 0) / studentMonthlyAvgs.length)
      : 0;
    console.log(studentMonthlyAvgs);
    const topScore = studentMonthlyAvgs.length > 0 ? Math.max(...studentMonthlyAvgs) : 0;
    console.log("----------------------------------------", studentMonthlyAvgs.length > 0 ? Math.max(...studentMonthlyAvgs) : 0)
    // Calculate Percentile (Student Monthly Avg vs Class Student Monthly Avgs)
    const sortedScores = studentMonthlyAvgs.sort((a, b) => a - b);
    const countBelowOrEqual = sortedScores.filter(s => s <= score).length;
    const percentile = sortedScores.length > 0
      ? Math.min(100, Math.max(0, Math.round((countBelowOrEqual / sortedScores.length) * 100)))
      : 0;

    return {
      month,
      score,
      classAvg,
      topScore: Math.round(topScore * 100) / 100, // Round to 2 decimals
      percentile
    };
  });
}

function filterSubjects(history: any[], subjectId?: string) {
  if (!subjectId) return history;
  return history.filter((h: any) => h.examId?.subjectId?.toString() === subjectId);
}

async function generateAIInsights(
  attempts: any[],
  analytics: any[],
  subjects: SubjectDetail[]
): Promise<AIInsights> {
  const latestAttempt = attempts[0];
  const weakTopicsMap = new Map();

  attempts.forEach(attempt => {
    attempt.weakTopics?.forEach((wt: any) => {
      if (!weakTopicsMap.has(wt.topic)) {
        weakTopicsMap.set(wt.topic, wt);
      }
    });
  });

  // Identify Strongest, Average, and Weakest Subjects (Threshold Based)
  // Strong: > 80%
  // Average: 50% < score <= 80%
  // Weak: <= 50%

  const strongSubjects: { subject: string; score: number; points: string[] }[] = [];
  const averageSubjects: { subject: string; score: number; points: string[] }[] = [];
  const weakSubjects: { subject: string; score: number; points: string[] }[] = [];

  // Helper to generate points
  const generatePoints = (s: SubjectDetail, type: 'Strong' | 'Average' | 'Weak') => {
    const points = [];
    if (type === 'Strong') {
      points.push("High accuracy rate");
      if (s.percentile >= 80) points.push("Top of the class");
      if (s.trend === 'Up') points.push("Improving consistently");
      else points.push("Consistent high performance");
    } else if (type === 'Average') {
      points.push("Steady performance");
      if (s.trend === 'Up') points.push("Showing improvement");
      else points.push("Maintain consistency");
    } else {
      points.push("Needs conceptual review");
      if (s.percentile < 50) points.push("Below class average");
      if (s.trend === 'Down') points.push("Performance is declining");
    }
    return points;
  };

  subjects.forEach(s => {
    const entry = {
      subject: s.name,
      score: s.score,
      points: generatePoints(s, s.score >= 80 ? 'Strong' : s.score >= 50 ? 'Average' : 'Weak')
    };

    if (s.score >= 80) {
      strongSubjects.push(entry);
    } else if (s.score >= 50) {
      averageSubjects.push(entry);
    } else {
      weakSubjects.push(entry);
    }
  });

  // Sort lists by score (Best to Worst for Strong/Average, Worst to Best for Weak?? Usually Descending score is fine)
  strongSubjects.sort((a, b) => b.score - a.score);
  averageSubjects.sort((a, b) => b.score - a.score);
  weakSubjects.sort((a, b) => a.score - b.score); // Weakest first for weak list? Or just consistent descending?
  // Let's sort Weakest by ascending score (lowest first) so 0 is at top

  // Determine singular Strongest/Weakest for backward compatibility/highlight
  let strongest = null;
  let weakest = null;

  // Pick top of Strong list, or top of Average if no Strong, etc.
  // ABSOLUTE STANDARD: Only pick from Strong list
  if (strongSubjects.length > 0) strongest = strongSubjects[0];

  // Pick top of Weak list (lowest score)
  // ABSOLUTE STANDARD: Only pick from Weak list
  if (weakSubjects.length > 0) weakest = weakSubjects[0]; // "Worst" of the weak (Ascending list)

  // Prevent Overlap: If Strongest and Weakest are same (impossible now with absolute standards as they are mutually exclusive ranges)
  // But keeping safeguard just in case thresholds change
  if (strongest && weakest && strongest.subject === weakest.subject) {
    if (strongest.score < 50) {
      strongest = null;
    } else {
      weakest = null;
    }
  }

  // Gap Analysis: Subject Score vs Class Average
  const gapAnalysisData = subjects.map(s => ({
    subject: s.name,
    score: s.score,
    classAvg: s.classAverage // Now dynamic
  }));

  return {
    overallFeedback: latestAttempt?.overallFeedback,
    teacherRecommendation: latestAttempt?.teacherFeedback,
    gapAnalysisData: gapAnalysisData.map(g => ({ subject: g.subject, score: g.score, classAvg: g.classAvg || 0 })), // Ensure classAvg is passed
    cognitiveAbilities: calculateCognitiveAbilities(analytics), // Dynamically generate based on analytics/data
    strongAreas: analytics.map(a => a.strongestArea).filter(Boolean),
    weakTopics: Array.from(weakTopicsMap.values()).slice(0, 5), // Keep existing weakTopics structure for now

    // New Lists
    strongSubjects,
    averageSubjects,
    weakSubjects,

    strongestSubject: strongest || undefined,
    weakestSubject: weakest || undefined
  };
}

/**
 * Format time in seconds to human-readable string
 * @param seconds - Time in seconds
 * @returns Formatted string: "Xs" if <60s, "Xmin Xs" if <60min, "XhXm" if >=60min
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  }
}

async function generateTimeAnalysis(attempts: any[], history: any[], classAvgTimeSeconds: number) {
  // Calculate Student Averages
  // Calculate Student Averages
  const totalTime = attempts.reduce((acc, curr) => acc + (curr.timeTakenInSeconds || 0), 0);

  // SCOPE FIX: Denominator is Total Assigned Exams (history.length), NOT attempts.length
  // This aligns with the "0% is a valid score for non-attempts" rule.
  const avgTime = history.length > 0 ? totalTime / history.length : 0;


  // Calculate total question count across all attempts
  let totalQuestions = 0;
  if (attempts.length > 0) {
    const attemptIds = attempts.map(a => a._id);

    // Count total questions across all attempts
    const questionCountResult = await ExamAnswer.aggregate([
      { $match: { attemptId: { $in: attemptIds } } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 }
        }
      }
    ]);

    if (questionCountResult.length > 0) {
      totalQuestions = questionCountResult[0].totalCount;
    } else {
      console.log(`  - ⚠️ No question data found in ExamAnswer`);
    }
  }

  const avgTimePerQuestion = totalQuestions > 0 ? totalTime / totalQuestions : 0;

  const classAvgTimeMins = Math.round(classAvgTimeSeconds / 60);

  return {
    'all': {
      averageTimePerExam: Math.round(avgTime),
      averageTimePerQuestion: Math.round(avgTimePerQuestion),
      totalTimeSpent: totalTime,
      efficiency: Math.min(100, Math.round((classAvgTimeSeconds / (avgTime || 1)) * 100)),
      timeComparison: {
        averageTimePerExam: Math.round(avgTime),
        averageTimePerQuestion: Math.round(avgTimePerQuestion),
        totalTimeSpent: totalTime,
      }
    }
  };
}

// Aggregation for Question Types
async function getQuestionTypePerformance(attemptIds: mongoose.Types.ObjectId[]): Promise<Record<string, QuestionPerformance[]>> {
  // ExamAnswer store individual answers with questionType field directly
  const pipeline: any[] = [
    { $match: { attemptId: { $in: attemptIds } } },
    {
      $group: {
        _id: '$questionType', // Group by type directly from ExamAnswer
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } }
      }
    }
  ];

  const results = await ExamAnswer.aggregate(pipeline);

  // Format Result
  const stats = results.map(r => ({
    type: r._id,
    total: r.total,
    correct: r.correct,
    percentage: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0
  }));

  return { 'all': stats };
}

// Aggregation for Peer Distribution (Class Level)
async function getPeerDistribution(
  classId: string,
  subjectId: string | undefined,
  tenantId: string,
  studentScore: number,
  filteredExamIds?: mongoose.Types.ObjectId[]
): Promise<Record<string, PeerDistribution[]>> {
  const match: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  // Use provided filtered exam IDs or fetch based on classId/subjectId
  let examIds: mongoose.Types.ObjectId[];
  if (filteredExamIds) {
    examIds = filteredExamIds;
  } else {
    const exams = await Exam.find({
      classId: new mongoose.Types.ObjectId(classId),
      ...(subjectId ? { subjectId: new mongoose.Types.ObjectId(subjectId) } : {})
    }).select('_id');
    examIds = exams.map(e => e._id);
  }

  const results = await ExamStudent.aggregate([
    {
      $match: {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        examId: { $in: examIds },
        gradingStatus: 'Completed',
        isActive: true
      }
    },
    {
      $lookup: {
        from: 'exams',
        localField: 'examId',
        foreignField: '_id',
        as: 'exam'
      }
    },
    { $unwind: '$exam' },
    {
      $group: {
        _id: "$studentId",
        totalObtainedMarks: {
          $sum: {
            $divide: [{ $multiply: ["$percentage", "$exam.totalMarks"] }, 100],
          },
        },
        totalPossibleMarks: { $sum: "$exam.totalMarks" },
      }
    },
    {
      $addFields: {
        studentAvg: {
          $cond: {
            if: { $gt: ["$totalPossibleMarks", 0] },
            then: {
              $multiply: [
                { $divide: ["$totalObtainedMarks", "$totalPossibleMarks"] },
                100,
              ],
            },
            else: 0,
          },
        },
      },
    },
    {
      $bucket: {
        groupBy: "$studentAvg",
        boundaries: [0, 20, 40, 60, 80, 101],
        default: "Other",
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  const formatted = results.map(r => {
    let label = "";
    let min = 0; let max = 0;
    if (r._id === 0) { label = "0-20%"; min = 0; max = 20; }
    else if (r._id === 20) { label = "21-40%"; min = 21; max = 40; }
    else if (r._id === 40) { label = "41-60%"; min = 41; max = 60; }
    else if (r._id === 60) { label = "61-80%"; min = 61; max = 80; }
    else if (r._id === 80) { label = "81-100%"; min = 81; max = 100; }

    // Check if student falls in this bucket
    const isStudentBucket = studentScore >= min && studentScore <= max;

    return { range: label, count: r.count, isStudentBucket };
  });

  // Ensure all buckets exist for UI consistency
  const buckets = ["0-20%", "21-40%", "41-60%", "61-80%", "81-100%"];
  const completeData = buckets.map(range => {
    const found = formatted.find(f => f.range === range);
    if (found) return found;

    // Determine if student is in this empty bucket
    let isStudent = false;
    if (range === "0-20%" && studentScore <= 20) isStudent = true;
    if (range === "21-40%" && studentScore > 20 && studentScore <= 40) isStudent = true;
    if (range === "41-60%" && studentScore > 40 && studentScore <= 60) isStudent = true;
    if (range === "61-80%" && studentScore > 60 && studentScore <= 80) isStudent = true;
    if (range === "81-100%" && studentScore > 80) isStudent = true;

    return { range, count: 0, isStudentBucket: isStudent };
  });

  return { 'all': completeData };
}

async function getSubjectDetails(studentId: string, classId: string, tenantId: string, history: any[], classHistory: any[], gradingSystem: any): Promise<SubjectDetail[]> {
  const subjects = await Subject.find({ tenantId });
  const subjectMap = new Map(subjects.map(s => [s._id.toString(), s.name]));

  // Group Student History by Subject
  const grouped = history.reduce((acc: any, h: any) => {
    const sid = h.examId?.subjectId?.toString();
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(h);
    return acc;
  }, {});

  return Object.keys(grouped).map(sid => {
    const hList = grouped[sid];
    const totalObtainedMarks = hList.reduce((a: number, b: any) => a + (b.score || 0), 0);
    const totalPossibleMarks = hList.reduce((a: number, b: any) => a + (b.totalMarks || 100), 0);
    const avgScore = totalPossibleMarks > 0 ? (totalObtainedMarks / totalPossibleMarks) * 100 : 0;

    // Calculate Class Stats for this Subject
    const classSubjectHistory = classHistory.filter((ch: any) => ch.subjectId === sid);

    // Group class history by student to find their averages (Weighted)
    const classStudentAvgs = Object.values(classSubjectHistory.reduce((acc: any, curr: any) => {
      if (!acc[curr.studentId]) { acc[curr.studentId] = { obtained: 0, total: 0 }; }
      acc[curr.studentId].obtained += (curr.score || 0);
      acc[curr.studentId].total += (curr.totalPossibleMarks || 100);
      return acc;
    }, {})).map((obj: any) => obj.total > 0 ? (obj.obtained / obj.total) * 100 : 0).sort((a: number, b: number) => b - a); // Descending

    const totalObtained = classSubjectHistory.reduce((a: number, b: any) => a + (b.score || 0), 0);
    const totalPossible = classSubjectHistory.reduce((a: number, b: any) => a + (b.totalPossibleMarks || 100), 0);
    const classAvg = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

    // Find Rank
    const rankIndex = classStudentAvgs.findIndex((s: number) => s <= avgScore);
    const rank = rankIndex === -1 ? classStudentAvgs.length + 1 : rankIndex + 1;

    // Percentile
    const total = classStudentAvgs.length;
    const percentile = total > 0 ? Math.min(100, Math.max(0, Math.round(((total - rank + 1) / total) * 100))) : 0;

    // Trend (Simple Compare last 2)
    const sortedHistory = hList.sort((a: any, b: any) => new Date(a.attemptedDate).getTime() - new Date(b.attemptedDate).getTime());
    let trend = 'Stable';
    if (sortedHistory.length >= 2) {
      const last = sortedHistory[sortedHistory.length - 1].percentage;
      const prev = sortedHistory[sortedHistory.length - 2].percentage;
      if (last > prev) trend = 'Up';
      else if (last < prev) trend = 'Down';
    }

    return {
      id: sid,
      name: subjectMap.get(sid) || 'Unknown',
      score: Math.round(avgScore),
      grade: calculateGrade(avgScore, gradingSystem),
      classRank: rank,
      totalStudents: total, // Passing total for UI (e.g. 2/5)
      percentile: percentile,
      trend: trend,
      classAverage: Math.round(classAvg), // New Field for Gap Analysis
      feedback: trend === 'Up' ? 'Making progress' : 'Needs attention',
      aiFeedback: percentile > 80 ? 'Excellent performance maintain it.' : 'Focus on revising core concepts.',
      weakTopics: [], // Would need Question analysis per subject
      strongTopics: [],
      exams: hList.map((h: any) => ({
        topic: h.examId?.examTitle || 'Exam',
        score: h.percentage,
        date: h.attemptedDate,
        teacherFeedback: h?.teacherFeedback || null
      })),
      monthlyPerformance: calculateMonthlyTrend(hList, classSubjectHistory)
    };
  });
}

/**
 * Get detailed exam information for subject-specific reports
 */
async function getExamDetails(
  studentId: string,
  classId: string,
  subjectId: string,
  tenantId: string,
  history: any[],
  gradingSystem: any
): Promise<import('../types/studentReport.types').ExamDetail[]> {
  const studentObjId = new mongoose.Types.ObjectId(studentId);
  const classObjId = new mongoose.Types.ObjectId(classId);
  const subjectObjId = new mongoose.Types.ObjectId(subjectId);
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);

  // 1. Get ALL released exams for this subject/class from Exam collection
  // This allows us to see exams the student missed, which is critical for gap analysis
  const allExams = await Exam.find({
    classId: classObjId,
    subjectId: subjectObjId,
    tenantId: tenantObjId,
    examStatus: 'Released',
    isDeleted: false
  }).sort({ startOn: -1 }).lean();

  if (!allExams.length) return [];

  // 2. Get student's attempts for these exams
  const examIds = allExams.map(e => e._id);
  const attempts = await ExamAttempt.find({
    studentId: studentObjId,
    examId: { $in: examIds },
    tenantId: tenantObjId,
    attemptStatus: { $in: ['Submitted', 'Graded'] }, // Consider submitted as well for time taken
    isDeleted: false
  }).sort({ attemptNumber: -1 }).lean();

  // Map attempts by examId (keep best if multiple, or latest? Using latest for now)
  const attemptMap = new Map();
  attempts.forEach((att: any) => {
    const eid = att.examId.toString();
    // Since sorted by attemptNumber descending, first one we see is latest
    if (!attemptMap.has(eid)) {
      attemptMap.set(eid, att);
    }
  });

  // 3. (New) Fetch Class Results for these exams to calculate Ranks
  // We do this in one bulk query to avoid N+1 problem
  const allClassResults = await ExamStudent.find({
    examId: { $in: examIds },
    classId: classObjId,
    gradingStatus: 'Completed',
    isActive: true
  }).select('examId studentId percentage').lean();

  // Group results by examId for fast lookup
  const examResultsMap = new Map<string, number[]>();
  allClassResults.forEach((r: any) => {
    const eid = r.examId.toString();
    if (!examResultsMap.has(eid)) {
      examResultsMap.set(eid, []);
    }
    examResultsMap.get(eid)!.push(r.percentage || 0);
  });

  // 4. Fetch Student Topic Performance for all these exams
  // This allows us to enrich the breakdown with actual scores
  const studentTopicPerf = await StudentTopicPerformance.find({
    studentId: studentObjId,
    examId: { $in: examIds }
  });

  // Create Map for fast lookup: Map<examId, Map<topicName, performance>>
  const topicPerfMap = new Map<string, Map<string, number>>();
  studentTopicPerf.forEach(p => {
    const eid = p.examId.toString();
    const tName = p.topicName;
    if (!topicPerfMap.has(eid)) topicPerfMap.set(eid, new Map());
    topicPerfMap.get(eid)!.set(tName, p.performance);
  });

  // 5. Merge Data
  const examDetails = await Promise.all(allExams.map(async (exam: any) => {
    const examId = exam._id.toString();
    const storedAttempt = attemptMap.get(examId);

    // Defaults if not attempted
    let score = 0;
    let percentage = 0;
    let obtainedMarks = 0;
    let timeTaken = 0;

    // Rank/Percentile Calculation
    let rank = 0;
    let percentile = 0;
    let totalStudents = 0;

    // Get peer scores for this exam
    const peerScores = examResultsMap.get(examId) || [];
    totalStudents = peerScores.length;

    // If student has an attempt/result
    if (storedAttempt) {
      percentage = storedAttempt.percentage || 0;
      score = Math.round(percentage); // integer score
      obtainedMarks = storedAttempt.obtainedMarks || 0;
      timeTaken = storedAttempt.timeTakenInSeconds || 0;

      // Calculate Rank
      // Sort scores descending
      peerScores.sort((a, b) => b - a);

      // Find index of student's score
      // We use the exact percentage from the attempt to find rank
      // If multiple students have same score, they share rank (standard competition ranking)
      const rankIndex = peerScores.findIndex(s => s === percentage);

      // If student's score isn't in top list (shouldn't happen if they are completed), 
      // fallback to finding where they would fit
      if (rankIndex !== -1) {
        rank = rankIndex + 1;
      } else {
        // Fallback if not found in list (e.g., list updated after attempt fetched?)
        rank = peerScores.filter(s => s > percentage).length + 1;
      }

      // Calculate Percentile
      // Formula: (Number of people below or equal / Total) * 100
      const countBelowOrEqual = peerScores.filter(s => s <= percentage).length;
      percentile = totalStudents > 0
        ? Math.min(100, Math.max(0, Math.round((countBelowOrEqual / totalStudents) * 100)))
        : 0;
    } else {
      // Not attempted, check if they were assigned and marked as 0
      // If the studentRecord exists in allClassResults with 0%, we should reflect that
      const studentRecord = allClassResults.find((r: any) => r.examId.toString() === examId && r.studentId.toString() === studentId);
      if (studentRecord) {
        // They are part of the class results (assigned but scored 0)
        percentage = studentRecord.percentage || 0;
        peerScores.sort((a, b) => b - a);
        const rankIndex = peerScores.findIndex(s => s === percentage);
        rank = rankIndex !== -1 ? rankIndex + 1 : peerScores.length; // rank last if 0

        const countBelowOrEqual = peerScores.filter(s => s <= percentage).length;
        percentile = totalStudents > 0
          ? Math.min(100, Math.max(0, Math.round((countBelowOrEqual / totalStudents) * 100)))
          : 0;
      }
    }
    // Calculate Class Average for this Exam
    const classAvgForExam = totalStudents > 0 ? Math.round(peerScores.reduce((a, b) => a + b, 0) / totalStudents) : 0;

    // Extract and Enrich topics from topicBreakdown
    const topicNames = exam.topicBreakdown ? exam.topicBreakdown.map((t: any) => t.topic) : [];
    const enrichedBreakdown = exam.topicBreakdown ? exam.topicBreakdown.map((t: any) => {
      const examIdStr = exam._id.toString();
      const topicName = t.topic;

      // Look up actual student score
      let studentTopicScore = 0;
      if (topicPerfMap.has(examIdStr) && topicPerfMap.get(examIdStr)!.has(topicName)) {
        studentTopicScore = topicPerfMap.get(examIdStr)!.get(topicName)!;
      }

      return {
        topic: topicName,
        percentage: studentTopicScore, // Actual student score
        weightage: t.percentage,       // Original structure weightage
        questionCount: t.questionCount,
        totalMarks: t.totalMarks
      };
    }) : [];

    return {
      id: examId,
      examTitle: exam.examTitle || 'Exam',
      score,
      percentage,
      grade: calculateGrade(percentage, gradingSystem),
      totalMarks: exam.totalMarks || 100,
      obtainedMarks: Math.round((percentage / 100) * (exam.totalMarks || 100)),
      rank,
      totalStudents,
      percentile,
      date: exam.releasedAt || exam.startOn || exam.createdAt,
      timeTaken,
      topics: topicNames,
      topicBreakdown: enrichedBreakdown,
      teacherFeedback: storedAttempt?.teacherFeedback || null,
      aiPerExamFeedback: storedAttempt?.overallAssessment || null, // Per-exam AI feedback from grading
      classAverage: classAvgForExam
    };
  }));

  return examDetails;
}

/**
 * Calculate subject-specific rank for a student
 */
function calculateSubjectRank(
  studentId: string,
  subjectId: string,
  classResults: any[]
): number {
  // Group results by student for this subject
  const studentExamData = new Map<string, any[]>();

  classResults.forEach(result => {
    const sid = result.studentId.toString();
    const subId = result.subjectId?.toString();

    if (subId === subjectId) {
      if (!studentExamData.has(sid)) {
        studentExamData.set(sid, []);
      }
      studentExamData.get(sid)!.push(result);
    }
  });

  // Calculate weighted average for each student
  const avgScores = Array.from(studentExamData.entries()).map(([sid, examData]) => {
    const totalObtained = examData.reduce((acc, curr: any) => acc + (curr.score || 0), 0);
    const totalPossible = examData.reduce((acc, curr: any) => acc + (curr.totalPossibleMarks || 100), 0);
    return {
      studentId: sid,
      avg: totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0
    };
  });

  // Sort by average descending
  avgScores.sort((a, b) => b.avg - a.avg);

  // Find student's rank
  const rankIndex = avgScores.findIndex(s => s.studentId === studentId);
  return rankIndex !== -1 ? rankIndex + 1 : avgScores.length + 1;
}

/**
 * Generate topic-based AI insights for subject-specific reports
 */
async function generateTopicBasedAIInsights(
  attempts: any[],
  exams: import('../types/studentReport.types').ExamDetail[]
): Promise<import('../types/studentReport.types').AIInsights> {
  const latestAttempt = attempts[0];

  // Extract IDs for querying
  const examIds = exams.map(e => new mongoose.Types.ObjectId(e.id));
  // Assuming all exams belong to same student/class/tenant context from the first attempt or passed down args
  // But attempts might be empty if no exams attempted. Use params from context if needed.
  // For now, rely on `studentId` and `classId` from the first valid attempt or we might need to pass them to this function.
  // Better to pass studentId, classId to function. But let's try to extract from available data.

  const contextAttempt = attempts[0];
  if (!contextAttempt && exams.length === 0) {
    // No data to generate insights
    return {
      overallFeedback: "No data available.",
      teacherRecommendation: "",
      gapAnalysisData: [],
      cognitiveAbilities: [],
      strongAreas: [],
      weakTopics: [],
      strongSubjects: [],
      weakSubjects: [],
      averageSubjects: [],
      strongestSubject: undefined,
      weakestSubject: undefined
    } as any;
  }

  const studentId = contextAttempt ? contextAttempt.studentId : null;
  const classId = contextAttempt ? contextAttempt.classId : null;

  // Map to store aggregated stats
  const topicStats = new Map<string, { totalScore: number; count: number; totalClassAvg: number; classCount: number }>();

  // 1. Fetch Student Performance for these exams
  if (studentId) {
    const studentPerf = await StudentTopicPerformance.find({
      studentId: studentId,
      examId: { $in: examIds }
    });

    studentPerf.forEach((p: any) => {
      const t = p.topicName;
      if (!topicStats.has(t)) topicStats.set(t, { totalScore: 0, count: 0, totalClassAvg: 0, classCount: 0 });
      const entry = topicStats.get(t)!;
      entry.totalScore += p.performance;
      entry.count += 1;
    });
  }

  // 2. Fetch Class Performance for these exams
  if (classId) {
    const classPerf = await ClassTopicPerformance.find({
      classId: classId,
      examId: { $in: examIds }
    });

    classPerf.forEach((p: any) => {
      const t = p.topicName;
      // Only care about topics relevant to student? Or all class topics? 
      // Ideally gap analysis shows where student stands on topics they faced.
      if (topicStats.has(t)) {
        const entry = topicStats.get(t)!;
        entry.totalClassAvg += p.averagePerformance;
        entry.classCount += 1;
      }
    });
  }

  const topicPerformance: import('../types/studentReport.types').TopicPerformance[] = [];

  topicStats.forEach((stats, topic) => {
    topicPerformance.push({
      topic: topic,
      score: Math.round(stats.totalScore / stats.count),
      classAvg: stats.classCount > 0 ? Math.round(stats.totalClassAvg / stats.classCount) : 0
    });
  });

  // Sort by score
  topicPerformance.sort((a, b) => b.score - a.score);

  // Filter into Strong (>80), Average (50-80), Weak (<50)
  const strongTopicsList: { topic: string; score: number; points: string[] }[] = [];
  const averageTopicsList: { topic: string; score: number; points: string[] }[] = [];
  const weakTopicsList: { topic: string; score: number; points: string[] }[] = [];

  topicPerformance.forEach(t => {
    const entry = {
      topic: t.topic,
      score: t.score,
      points: [
        t.score >= 80 ? "Strong Understanding" : t.score >= 50 ? "Average Understanding" : "Needs work",
        `Score: ${t.score}%`
      ]
    };

    if (t.score >= 80) {
      strongTopicsList.push(entry);
    } else if (t.score >= 50) {
      averageTopicsList.push(entry);
    } else {
      weakTopicsList.push(entry);
    }
  });

  // singular best/worst logic
  let strongestTopic = null;
  let weakestTopic = null;

  // determine strongest from Descending lists
  // ABSOLUTE STANDARD: Only from Strong Topics
  if (strongTopicsList.length > 0) strongestTopic = strongTopicsList[0];

  // determine weakest from Descending lists (before we re-sort weak list for UI)
  // ABSOLUTE STANDARD: Only from Weak Topics
  if (weakTopicsList.length > 0) weakestTopic = weakTopicsList[weakTopicsList.length - 1]; // "Worst" of weak (Descending list)

  // Now sort weak list Ascending for UI display (as usually requested: Weakest first)
  weakTopicsList.sort((a, b) => a.score - b.score);

  // Prevent Overlap (Implied by distinct ranges, but safeguard)
  if (strongestTopic && weakestTopic && strongestTopic.topic === weakestTopic.topic) {
    if (strongestTopic.score < 50) {
      strongestTopic = null;
    } else {
      weakestTopic = null;
    }
  }

  // If no topics found (rare), handle gracefully
  if (topicPerformance.length === 0) {
    return {
      overallFeedback: "No topic data available yet.",
      teacherRecommendation: "Complete more exams to see topic analysis.",
      gapAnalysisData: [],
      cognitiveAbilities: calculateCognitiveAbilities([]),
      strongAreas: [],
      weakTopics: [],
      strongestTopic: undefined,
      weakestTopic: undefined,
      strongSubjects: [],
      weakSubjects: [],
      averageSubjects: [],
      strongTopics: [],
      averageTopics: [],
      weakTopicsList: []
    };
  }

  return {
    overallFeedback: latestAttempt?.overallFeedback,
    teacherRecommendation: latestAttempt?.teacherFeedback,
    gapAnalysisData: topicPerformance,
    cognitiveAbilities: calculateCognitiveAbilities([] as any[]),
    strongAreas: strongestTopic ? [strongestTopic.topic] : [],
    weakTopics: weakestTopic ? [{ topic: weakestTopic.topic, performance: weakestTopic.score, suggestions: "Review core concepts" }] : [],

    // New Lists
    strongTopics: strongTopicsList,
    averageTopics: averageTopicsList,
    weakTopicsList: weakTopicsList,

    strongestTopic: strongestTopic || undefined,
    weakestTopic: weakestTopic || undefined
  };
}

/**
 * Calculate cognitive abilities based on analytics data
 * @param analyticsList - List of student performance analytics
 */
function calculateCognitiveAbilities(analyticsList: any[]): { skill: string; score: number }[] {
  // Placeholder implementation as per current requirements and data availability
  // In a future update, this will aggregate scores based on tags like 'Memory', 'Logic', 'Application'
  // from the analytics or exam data.
  return [];
}

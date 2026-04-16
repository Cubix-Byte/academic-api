// Centralized exports for all models
// Import models and interfaces from this file

// Original Models
export { default as Class } from "./class.schema";
export { default as Subject } from "./subject.schema";
export { default as Teacher } from "./teacher.schema";
export { default as Student } from "./student.schema";
export { default as Parent } from "./parent.schema";
export { default as ParentChild } from "./parentChild.schema";
export { default as Batch } from "./batch.schema";
export { default as ClassStudent } from "./class_student.schema";
export { default as Tenant } from "./tenant.schema";
export { default as Partner } from "./partner.schema";
export { default as Admin } from "./admin.schema";
export { default as User } from "./user.schema";
export { default as ClassSchedule } from "./classSchedule.schema";
export { default as ClassSession } from "./classSession.schema";
export { default as Attendance } from "./attendance.schema";

// Exam Management Models
export { default as ExamMode } from "./examMode.schema";
export { default as GradingSystem } from "./gradingSystem.schema";
export { default as Exam } from "./exam.schema";
export { default as ExamStudent } from "./examStudent.schema";
export { default as ExamQuestion } from "./examQuestion.schema";
export { default as ExamContent } from "./examContent.schema";
export { default as ExamBuilder } from "./examBuilder.schema";
export { default as ContentBuilder } from "./contentBuilder.schema";
export { default as ExamAIPromptHistory } from "./examAIPromptHistory.schema";
export { default as ExamAttempt } from "./examAttempt.schema";
export { default as ExamAnswer } from "./examAnswer.schema";
export { default as ExamAttemptLog } from "./examAttemptLog.schema";
export { default as ExamSettings } from "./examSettings.schema";
export { default as ExamCredential } from "./examCredential.schema";
export { default as ExamAchievement } from "./examAchievement.schema";
export { default as ExamBadge } from "./examBadge.schema";
export { default as CredentialTemplate } from "./credentialTemplate.schema";
export { default as TeacherCredentialAssignment } from "./teacherCredentialAssignment.schema";

// Credential & Feedback Models
export { default as AIFeedback } from "./aiFeedback.schema";
export { default as RecommendedResource } from "./recommendedResource.schema";
export { default as TeacherInbox } from "./teacherInbox.schema";
export { default as TeacherAssignClasses } from "./teacherAssignClasses.schema";
export { default as ContentLibrary } from "./contentLibrary.schema";
export { default as ContentLibraryContent } from "./contentLibraryContent.schema";
export { default as StudentFolder } from "./studentFolder.schema";
export { default as StudentContentRead } from "./studentContentRead.schema";
export { default as ClassTeacherFeedback } from "./classTeacherFeedback.schema";

// Analytics & Progress Models
export { default as ClassAnalytics } from "./classAnalytics.schema";
export { default as StudentActivityLog } from "./studentActivityLog.schema";
export { default as TeacherActivityLog } from "./teacherActivityLog.schema";
export { default as StudentPerformanceAnalytics } from "./studentPerformanceAnalytics.schema";
export { default as StudentExamProgress } from "./studentExamProgress.schema";
export { default as StudentRecommendation } from "./studentRecommendation.schema";
export { default as StudentSubjectProgress } from "./studentSubjectProgress.schema";
export { default as StudentExamHistory } from "./studentExamHistory.schema";
export { default as StudentCredentialProgress } from "./studentCredentialProgress.schema";
export { default as LessonProgress } from "./lessonProgress.schema";
// COMMENTED OUT: StudentWallet collection moved to Monetization-API
// export { default as StudentWallet } from "./studentWallet.schema";
export { default as CreditUsageTransaction } from "./creditUsageTransaction.schema";
export { default as StudentGeneratedReport } from "./studentGeneratedReport.schema";
export { default as StudentTopicPerformance } from "./studentTopicPerformance.schema";
export { default as ClassTopicPerformance } from "./classTopicPerformance.schema";

// Original Interfaces
export type { IClass } from "./class.schema";
export type { ISubject } from "./subject.schema";
export type { ITeacher } from "./teacher.schema";
export type { IStudent } from "./student.schema";
export type { IParent } from "./parent.schema";
export type { IParentChild } from "./parentChild.schema";
export type { IBatch } from "./batch.schema";
export type { IClassStudent } from "./class_student.schema";
export type { ITenant, ITenantPermission } from "./tenant.schema";
export type { IPartner } from "./partner.schema";
export type { IAdmin } from "./admin.schema";
export type { IUser } from "./user.schema";
export type { IClassSchedule } from "./classSchedule.schema";
export type { IClassSession } from "./classSession.schema";
export type { IAttendance } from "./attendance.schema";

// Exam Management Interfaces
export type { IExamMode } from "./examMode.schema";
export type { IGradingSystem } from "./gradingSystem.schema";
export type { IExam } from "./exam.schema";
export type { IExamStudent } from "./examStudent.schema";
export type { IExamQuestion, IQuestionOption } from "./examQuestion.schema";
export type { IExamContent } from "./examContent.schema";
export type { IExamBuilder, ConversationMessage } from "./examBuilder.schema";
export type { IContentBuilder } from "./contentBuilder.schema";
export type { IExamAIPromptHistory } from "./examAIPromptHistory.schema";
export type { IExamAttempt } from "./examAttempt.schema";
export type { IExamAnswer } from "./examAnswer.schema";
export type { IExamAttemptLog } from "./examAttemptLog.schema";
export type { IExamSettings } from "./examSettings.schema";
export type { IExamCredential } from "./examCredential.schema";
export type { IExamAchievement } from "./examAchievement.schema";
export type { IExamBadge } from "./examBadge.schema";
export type { ICredentialTemplate } from "./credentialTemplate.schema";
export type { ITeacherCredentialAssignment } from "./teacherCredentialAssignment.schema";

// Credential & Feedback Interfaces
export type { IAIFeedback } from "./aiFeedback.schema";
export type { IRecommendedResource } from "./recommendedResource.schema";
export type { ITeacherInbox } from "./teacherInbox.schema";
export type { ITeacherAssignClasses } from "./teacherAssignClasses.schema";
export type { IContentLibrary } from "./contentLibrary.schema";
export type { IContentLibraryContent } from "./contentLibraryContent.schema";
export type { IStudentFolder } from "./studentFolder.schema";
export type { IStudentContentRead } from "./studentContentRead.schema";

// Analytics & Progress Interfaces
export type { IClassAnalytics } from "./classAnalytics.schema";
export type { IStudentActivityLog } from "./studentActivityLog.schema";
export type { ITeacherActivityLog } from "./teacherActivityLog.schema";
export type { IStudentPerformanceAnalytics } from "./studentPerformanceAnalytics.schema";
export type { IStudentExamProgress } from "./studentExamProgress.schema";
export type { IStudentRecommendation } from "./studentRecommendation.schema";
export type {
  IStudentSubjectProgress,
  ITopicPerformance,
} from "./studentSubjectProgress.schema";
export type { IStudentExamHistory } from "./studentExamHistory.schema";
export type { IStudentCredentialProgress } from "./studentCredentialProgress.schema";
export type { ILessonProgress } from "./lessonProgress.schema";
// COMMENTED OUT: StudentWallet collection moved to Monetization-API
// export type { IStudentWallet } from "./studentWallet.schema";
export type { ICreditUsageTransaction } from "./creditUsageTransaction.schema";
export type { IStudentGeneratedReport } from "./studentGeneratedReport.schema";
export type { IStudentTopicPerformance } from "./studentTopicPerformance.schema";
export type { IClassTopicPerformance } from "./classTopicPerformance.schema";

// Announcements
export { default as Announcement } from "./announcement.schema";
export type { IAnnouncement } from "./announcement.schema";

// Communities
export { default as Community } from "./community.schema";
export type { ICommunity } from "./community.schema";
export { default as CommunityMember } from "./communityMember.schema";
export type { ICommunityMember } from "./communityMember.schema";
export { default as CommunityPost } from "./communityPost.schema";
export type { ICommunityPost, IAttachment } from "./communityPost.schema";
export { default as CommunityComment } from "./communityComment.schema";
export type { ICommunityComment } from "./communityComment.schema";

// Re-export base document from shared-lib
export { IBaseDocument, BaseDocumentSchema } from "../utils/shared-lib-imports";

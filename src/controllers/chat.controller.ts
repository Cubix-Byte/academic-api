import { Request as ExpRequest, Response as ExpResponse } from "express";
import mongoose from "mongoose";
import { sendSuccessResponse, sendErrorResponse, HttpStatusCodes, ResponseMessages } from "../utils/shared-lib-imports";
import Conversation from "../models/chat/conversation.schema";
import Message from "../models/chat/message.schema";
import ClassStudent from "../models/class_student.schema";
import { Class } from "../models/class.schema";
import Batch from "../models/batch.schema";
import { Subject } from "../models/subject.schema";
import Teacher from "../models/teacher.schema";
import ParentChild from "../models/parentChild.schema";
import Student from "../models/student.schema";

export class ChatController {
    /**
     * List all conversations for the logged-in user
     */
    static getConversations = async (req: ExpRequest, res: ExpResponse) => {
        try {
            const user = (req as any).user;
            const { tenantId } = user;
            const limitNum = Number(req.query.limit);
            const skipNum = Number(req.query.skip);
            const safeLimit =
                Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 20;
            const safeSkip = Number.isFinite(skipNum) && skipNum >= 0 ? skipNum : 0;

            console.log("🔍 [getConversations] User:", user.id, "limit:", safeLimit, "skip:", safeSkip);

            // Determine logged-in user's role
            const rawRole = (user.roleName || user.userType || "").toString().toUpperCase();
            const isTeacher = rawRole === "TEACHER";
            const isStudent = rawRole === "STUDENT";
            const isParent = rawRole === "PARENT";

            const conversations = await Conversation.find({
                $or: [
                    { "participants.teacherId": user.id },
                    { "participants.studentId": user.id },
                    { "participants.parentId": user.id }
                ],
                tenantId,
                isActive: true,
            })
            .populate({
                path: "participants.teacherId",
                select: "firstName lastName email phone profileImage assignedClasses assignedSubjects"
            })
            .populate({
                path: "participants.studentId",
                select: "firstName lastName email phone profileImage"
            })
            .populate({
                path: "participants.parentId",
                select: "firstName lastName email phoneNumber profileImage"
            })
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .skip(safeSkip)
            .limit(safeLimit)
            .lean();

            // ============================================
            // OPTIMIZED BULK QUERIES FOR CLASS & BATCH INFO
            // Only executed when teacher is logged in and there are student participants
            // ============================================
            let studentToClassMap = new Map<string, string>();
            let classToNameMap = new Map<string, string>();
            let classToBatchMap = new Map<string, string>();
            let batchToNameMap = new Map<string, string>();
            let studentToSubjectIdsMap = new Map<string, string[]>();
            let subjectIdToNameMap = new Map<string, string>();
            
            // Maps for teacher information
            let teacherToAssignedClassesMap = new Map<string, string[]>();
            let teacherToAssignedSubjectsMap = new Map<string, string[]>();
            
            // Maps for parent information
            let parentToChildrenMap = new Map<string, string[]>();
            let childIdToNameMap = new Map<string, { firstName: string; lastName: string }>();

            // ============================================
            // FETCH TEACHER INFORMATION (assignedClasses and assignedSubjects)
            // Executed for all conversations that have teachers
            // ============================================
            if (conversations.length > 0) {
                try {
                    // Extract unique teacher IDs from all conversations
                    const teacherIds = new Set<string>();
                    conversations.forEach((conv: any) => {
                        const teacherId = conv.participants?.teacherId?._id || 
                                        conv.participants?.teacherId?.id || 
                                        conv.participants?.teacherId;
                        if (teacherId) {
                            const teacherIdStr = String(teacherId);
                            if (mongoose.Types.ObjectId.isValid(teacherIdStr)) {
                                teacherIds.add(teacherIdStr);
                            }
                        }
                    });

                    if (teacherIds.size > 0) {
                        const teacherObjectIds = Array.from(teacherIds).map(id => new mongoose.Types.ObjectId(id));
                        
                        // Fetch teachers with assignedClasses and assignedSubjects
                        const teachers = await Teacher.find({
                            _id: { $in: teacherObjectIds },
                            isDeleted: false
                        })
                        .select("_id assignedClasses assignedSubjects")
                        .lean();

                        // Collect all unique class and subject IDs
                        const allClassIds = new Set<string>();
                        const allSubjectIds = new Set<string>();

                        teachers.forEach((teacher: any) => {
                            const tid = String(teacher._id);
                            
                            // Store assignedClasses for this teacher
                            if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses) && teacher.assignedClasses.length > 0) {
                                const validClassIds = teacher.assignedClasses
                                    .map((classId: any) => String(classId))
                                    .filter((classIdStr: string) => mongoose.Types.ObjectId.isValid(classIdStr));
                                if (validClassIds.length > 0) {
                                    teacherToAssignedClassesMap.set(tid, validClassIds);
                                    validClassIds.forEach((classIdStr: string) => allClassIds.add(classIdStr));
                                }
                            }
                            
                            // Store assignedSubjects for this teacher
                            if (teacher.assignedSubjects && Array.isArray(teacher.assignedSubjects) && teacher.assignedSubjects.length > 0) {
                                const validSubjectIds = teacher.assignedSubjects
                                    .map((subjectId: any) => String(subjectId))
                                    .filter((subjectIdStr: string) => mongoose.Types.ObjectId.isValid(subjectIdStr));
                                if (validSubjectIds.length > 0) {
                                    teacherToAssignedSubjectsMap.set(tid, validSubjectIds);
                                    validSubjectIds.forEach((subjectIdStr: string) => allSubjectIds.add(subjectIdStr));
                                }
                            }
                        });

                        // Fetch class names for assigned classes (if not already fetched)
                        if (allClassIds.size > 0) {
                            const classObjectIds = Array.from(allClassIds).map(id => new mongoose.Types.ObjectId(id));
                            const classes = await Class.find({
                                _id: { $in: classObjectIds },
                                isDeleted: false
                            })
                            .select("_id name")
                            .lean();

                            // Update classToNameMap with any new classes
                            classes.forEach((cls: any) => {
                                const cid = String(cls._id);
                                if (!classToNameMap.has(cid)) {
                                    classToNameMap.set(cid, cls.name || "");
                                }
                            });
                        }

                        // Fetch subject names for assigned subjects (if not already fetched)
                        if (allSubjectIds.size > 0) {
                            const subjectObjectIds = Array.from(allSubjectIds).map(id => new mongoose.Types.ObjectId(id));
                            const subjects = await Subject.find({
                                _id: { $in: subjectObjectIds },
                                isDeleted: false
                            })
                            .select("_id name")
                            .lean();

                            // Update subjectIdToNameMap with any new subjects
                            subjects.forEach((subject: any) => {
                                const sid = String(subject._id);
                                if (!subjectIdToNameMap.has(sid)) {
                                    subjectIdToNameMap.set(sid, subject.name || "");
                                }
                            });
                        }
                    }
                } catch (teacherError) {
                    // Log error but don't break the API - gracefully degrade
                    console.error("⚠️ [getConversations] Error fetching teacher info:", teacherError);
                }
            }

            // ============================================
            // FETCH PARENT INFORMATION (with children)
            // Executed for all conversations that have parents
            // ============================================
            if (conversations.length > 0) {
                try {
                    // Extract unique parent IDs from all conversations
                    const parentIds = new Set<string>();
                    conversations.forEach((conv: any) => {
                        if (conv.type === "teacher-parent") {
                            const parentId = conv.participants?.parentId?._id || 
                                            conv.participants?.parentId?.id || 
                                            conv.participants?.parentId;
                            if (parentId) {
                                const parentIdStr = String(parentId);
                                if (mongoose.Types.ObjectId.isValid(parentIdStr)) {
                                    parentIds.add(parentIdStr);
                                }
                            }
                        }
                    });

                    if (parentIds.size > 0) {
                        const parentObjectIds = Array.from(parentIds).map(id => new mongoose.Types.ObjectId(id));
                        
                        // Fetch parent-child relationships from junction table
                        const parentChildRelationships = await ParentChild.find({
                            parentId: { $in: parentObjectIds },
                            isDeleted: false,
                            isActive: true
                        })
                        .select("parentId childId")
                        .lean();

                        // Collect all unique child IDs
                        const childIds = new Set<string>();
                        
                        parentChildRelationships.forEach((rel: any) => {
                            const pid = String(rel.parentId);
                            const cid = String(rel.childId);
                            
                            if (mongoose.Types.ObjectId.isValid(cid)) {
                                // Add child to parent's children list
                                if (!parentToChildrenMap.has(pid)) {
                                    parentToChildrenMap.set(pid, []);
                                }
                                parentToChildrenMap.get(pid)!.push(cid);
                                childIds.add(cid);
                            }
                        });

                        // Fetch child information (firstName, lastName) from Student collection
                        if (childIds.size > 0) {
                            const childObjectIds = Array.from(childIds).map(id => new mongoose.Types.ObjectId(id));
                            const children = await Student.find({
                                _id: { $in: childObjectIds },
                                isDeleted: false
                            })
                            .select("_id firstName lastName")
                            .lean();

                            // Create childId -> { firstName, lastName } map
                            children.forEach((child: any) => {
                                const cid = String(child._id);
                                childIdToNameMap.set(cid, {
                                    firstName: child.firstName || "",
                                    lastName: child.lastName || ""
                                });
                            });
                        }
                    }
                } catch (parentError) {
                    // Log error but don't break the API - gracefully degrade
                    console.error("⚠️ [getConversations] Error fetching parent/children info:", parentError);
                }
            }

            if (isTeacher && conversations.length > 0) {
                try {
                    // Step 1: Extract unique student IDs from conversations (only teacher-student type)
                    const studentIds = new Set<string>();
                    conversations.forEach((conv: any) => {
                        if (conv.type === "teacher-student") {
                            const studentId = conv.participants?.studentId?._id || 
                                            conv.participants?.studentId?.id || 
                                            conv.participants?.studentId;
                            if (studentId) {
                                const studentIdStr = String(studentId);
                                // Validate ObjectId format before adding
                                if (mongoose.Types.ObjectId.isValid(studentIdStr)) {
                                    studentIds.add(studentIdStr);
                                }
                            }
                        }
                    });

                    // Only proceed if we have student IDs
                    if (studentIds.size > 0) {
                        const studentObjectIds = Array.from(studentIds).map(id => new mongoose.Types.ObjectId(id));

                        // Step 2: Bulk query - Get active class enrollments for all students
                        // Using lean() for better performance, only selecting needed fields
                        const activeClassStudents = await ClassStudent.find({
                            studentId: { $in: studentObjectIds },
                            enrollmentStatus: "active",
                            isDeleted: false
                        })
                        .select("studentId classId subjectIds") // Only select fields we need
                        .lean();

                        // Step 3: Create studentId -> classId map and studentId -> subjectIds map
                        const classIds = new Set<string>();
                        const subjectIds = new Set<string>();
                        activeClassStudents.forEach((cs: any) => {
                            const sid = String(cs.studentId);
                            const cid = String(cs.classId);
                            if (mongoose.Types.ObjectId.isValid(cid)) {
                                studentToClassMap.set(sid, cid);
                                classIds.add(cid);
                            }
                            // Store subjectIds for this student
                            if (cs.subjectIds && Array.isArray(cs.subjectIds) && cs.subjectIds.length > 0) {
                                const validSubjectIds = cs.subjectIds
                                    .map((subId: any) => String(subId))
                                    .filter((subIdStr: string) => mongoose.Types.ObjectId.isValid(subIdStr));
                                if (validSubjectIds.length > 0) {
                                    studentToSubjectIdsMap.set(sid, validSubjectIds);
                                    validSubjectIds.forEach((subIdStr: string) => subjectIds.add(subIdStr));
                                }
                            }
                        });

                        // Step 4: Bulk query - Get class details (only if we have classIds)
                        if (classIds.size > 0) {
                            const classObjectIds = Array.from(classIds).map(id => new mongoose.Types.ObjectId(id));
                            
                            // Optimized query: only select name and batchId, filter by isDeleted
                            const classes = await Class.find({
                                _id: { $in: classObjectIds },
                                isDeleted: false
                            })
                            .select("_id name batchId") // Minimal fields for performance
                            .lean();

                            // Step 5: Create classId -> className and classId -> batchId maps
                            const batchIds = new Set<string>();
                            classes.forEach((cls: any) => {
                                const cid = String(cls._id);
                                classToNameMap.set(cid, cls.name || "");
                                if (cls.batchId) {
                                    const bid = String(cls.batchId);
                                    if (mongoose.Types.ObjectId.isValid(bid)) {
                                        classToBatchMap.set(cid, bid);
                                        batchIds.add(bid);
                                    }
                                }
                            });

                            // Step 6: Bulk query - Get batch details (only if we have batchIds)
                            if (batchIds.size > 0) {
                                const batchObjectIds = Array.from(batchIds).map(id => new mongoose.Types.ObjectId(id));
                                
                                // Optimized query: only select batchName
                                const batches = await Batch.find({
                                    _id: { $in: batchObjectIds },
                                    isDeleted: false
                                })
                                .select("_id batchName") // Minimal fields for performance
                                .lean();

                                // Step 7: Create batchId -> batchName map
                                batches.forEach((batch: any) => {
                                    const bid = String(batch._id);
                                    batchToNameMap.set(bid, batch.batchName || "");
                                });
                            }
                        }

                        // Step 8: Bulk query - Get subject names (only if we have subjectIds)
                        if (subjectIds.size > 0) {
                            const subjectObjectIds = Array.from(subjectIds).map(id => new mongoose.Types.ObjectId(id));
                            
                            // Optimized query: only select name
                            const subjects = await Subject.find({
                                _id: { $in: subjectObjectIds },
                                isDeleted: false
                            })
                            .select("_id name") // Minimal fields for performance
                            .lean();

                            // Step 9: Create subjectId -> subjectName map
                            subjects.forEach((subject: any) => {
                                const sid = String(subject._id);
                                subjectIdToNameMap.set(sid, subject.name || "");
                            });
                        }
                    }
                } catch (classBatchError) {
                    // Log error but don't break the API - gracefully degrade
                    console.error("⚠️ [getConversations] Error fetching class/batch/subject info:", classBatchError);
                    // Maps will remain empty, className, batchName, and subjects will be null
                }
            }

            // Conditionally format participants: keep all IDs, but only add name for the "other" participant
            const formattedConversations = conversations.map((conv: any) => {
                const participants = conv.participants || {};
                
                // Extract IDs (handle both populated objects and raw IDs)
                const teacherId = participants.teacherId?._id || participants.teacherId?.id || participants.teacherId || null;
                const studentId = participants.studentId?._id || participants.studentId?.id || participants.studentId || null;
                const parentId = participants.parentId?._id || participants.parentId?.id || participants.parentId || null;

                // Build participants object - always include teacherId, and only ONE of studentId/parentId
                const formattedParticipants: any = {
                    teacherId,
                };

                if (studentId && conv.type === "teacher-student") {
                    formattedParticipants.studentId = studentId;
                } else if (parentId && conv.type === "teacher-parent") {
                    formattedParticipants.parentId = parentId;
                }

                // Conditionally add name only for the "other" participant based on logged-in user role
                if (isTeacher) {
                    // Teacher logged in → show student/parent name (the "other" participant), keeping only the appropriate key
                    if (conv.type === "teacher-student" && participants.studentId && typeof participants.studentId === "object") {
                        // Get class and batch info from lookup maps
                        const studentIdStr = String(studentId);
                        const classId = studentToClassMap.get(studentIdStr);
                        const className = classId ? (classToNameMap.get(classId) || null) : null;
                        const batchId = classId ? (classToBatchMap.get(classId) || null) : null;
                        const batchName = batchId ? (batchToNameMap.get(batchId) || null) : null;
                        
                        // Get subject names for this student
                        const subjectIdsForStudent = studentToSubjectIdsMap.get(studentIdStr) || [];
                        const subjects = subjectIdsForStudent
                            .map((subId: string) => {
                                const subjectName = subjectIdToNameMap.get(subId);
                                return subjectName ? { id: subId, name: subjectName } : null;
                            })
                            .filter((sub: any) => sub !== null);

                        formattedParticipants.studentId = {
                            id: studentId,
                            firstName: participants.studentId.firstName || null,
                            lastName: participants.studentId.lastName || null,
                            email: participants.studentId.email || null,
                            phone: participants.studentId.phone || null,
                            profileImage: participants.studentId.profileImage || null,
                            className: className,
                            batchName: batchName,
                            subjects: subjects,
                        };
                        delete formattedParticipants.parentId;
                    } else if (conv.type === "teacher-parent" && participants.parentId && typeof participants.parentId === "object") {
                        const parentIdStr = String(parentId);
                        
                        // Get children for this parent
                        const childIds = parentToChildrenMap.get(parentIdStr) || [];
                        const children = childIds
                            .map((childId: string) => {
                                const childInfo = childIdToNameMap.get(childId);
                                return childInfo ? {
                                    id: childId,
                                    firstName: childInfo.firstName,
                                    lastName: childInfo.lastName
                                } : null;
                            })
                            .filter((child: any) => child !== null);
                        
                        formattedParticipants.parentId = {
                            id: parentId,
                            firstName: participants.parentId.firstName || null,
                            lastName: participants.parentId.lastName || null,
                            email: participants.parentId.email || null,
                            phoneNumber: participants.parentId.phoneNumber || null,
                            profileImage: participants.parentId.profileImage || null,
                            children: children,
                        };
                        delete formattedParticipants.studentId;
                    }
                } else if (isStudent || isParent) {
                    // Student/Parent logged in → show teacher name (the "other" participant)
                    if (participants.teacherId && typeof participants.teacherId === "object") {
                        const teacherIdStr = String(teacherId);
                        
                        // Get assigned classes for this teacher
                        const assignedClassIds = teacherToAssignedClassesMap.get(teacherIdStr) || [];
                        const assignedClasses = assignedClassIds
                            .map((classId: string) => {
                                const className = classToNameMap.get(classId);
                                return className ? { id: classId, name: className } : null;
                            })
                            .filter((cls: any) => cls !== null);
                        
                        // Get assigned subjects for this teacher
                        const assignedSubjectIds = teacherToAssignedSubjectsMap.get(teacherIdStr) || [];
                        const assignedSubjects = assignedSubjectIds
                            .map((subjectId: string) => {
                                const subjectName = subjectIdToNameMap.get(subjectId);
                                return subjectName ? { id: subjectId, name: subjectName } : null;
                            })
                            .filter((sub: any) => sub !== null);
                        
                        formattedParticipants.teacherId = {
                            id: teacherId,
                            firstName: participants.teacherId.firstName || null,
                            lastName: participants.teacherId.lastName || null,
                            email: participants.teacherId.email || null,
                            phone: participants.teacherId.phone || null,
                            profileImage: participants.teacherId.profileImage || null,
                            assignedClasses: assignedClasses,
                            assignedSubjects: assignedSubjects,
                        };
                    }
                }

                return {
                    ...conv,
                    participants: formattedParticipants,
                };
            });

            return sendSuccessResponse(res, "Conversations retrieved successfully", formattedConversations);
        } catch (error) {
            console.error("ChatController.getConversations error:", error);
            return sendErrorResponse(res, "Failed to retrieve conversations", HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }
    };

    /**
     * Get a single conversation by ID
     */
    static getConversationById = async (req: ExpRequest, res: ExpResponse) => {
        try {
            const { conversationId } = req.params;
            const user = (req as any).user;
            const { tenantId } = user;

            console.log("🔍 [getConversationById] User:", user.id, "conversationId:", conversationId);

            // Determine logged-in user's role
            const rawRole = (user.roleName || user.userType || "").toString().toUpperCase();
            const isTeacher = rawRole === "TEACHER";
            const isStudent = rawRole === "STUDENT";
            const isParent = rawRole === "PARENT";

            // Find the conversation and verify access
            const conversation = await Conversation.findOne({
                _id: conversationId,
                $or: [
                    { "participants.teacherId": user.id },
                    { "participants.studentId": user.id },
                    { "participants.parentId": user.id }
                ],
                tenantId,
                isActive: true,
            })
            .populate({
                path: "participants.teacherId",
                select: "firstName lastName email phone profileImage assignedClasses assignedSubjects"
            })
            .populate({
                path: "participants.studentId",
                select: "firstName lastName email phone profileImage"
            })
            .populate({
                path: "participants.parentId",
                select: "firstName lastName email phoneNumber profileImage"
            })
            .populate("lastMessage")
            .lean();

            if (!conversation) {
                return sendErrorResponse(res, "Conversation not found or access denied", HttpStatusCodes.NOT_FOUND);
            }

            // Reuse the same formatting logic from getConversations
            const participants = conversation.participants as any;
            const teacherId = participants.teacherId?._id || participants.teacherId?.id || participants.teacherId;
            const studentId = participants.studentId?._id || participants.studentId?.id || participants.studentId;
            const parentId = participants.parentId?._id || participants.parentId?.id || participants.parentId;

            // Build lookup maps for class/batch/subject info (similar to getConversations)
            let studentToClassMap = new Map<string, string>();
            let classToNameMap = new Map<string, string>();
            let classToBatchMap = new Map<string, string>();
            let batchToNameMap = new Map<string, string>();
            let studentToSubjectIdsMap = new Map<string, string[]>();
            let subjectIdToNameMap = new Map<string, string>();
            let teacherToAssignedClassesMap = new Map<string, string[]>();
            let teacherToAssignedSubjectsMap = new Map<string, string[]>();
            let parentToChildrenMap = new Map<string, string[]>();
            let childIdToNameMap = new Map<string, { firstName: string; lastName: string }>();

            // Fetch class/batch/subject info if needed (only for teacher-student conversations)
            if (isTeacher && conversation.type === "teacher-student" && studentId) {
                try {
                    const studentIdStr = String(studentId);
                    if (!mongoose.Types.ObjectId.isValid(studentIdStr)) {
                        throw new Error("Invalid studentId");
                    }

                    const studentObjectId = new mongoose.Types.ObjectId(studentIdStr);
                    
                    // Get active class enrollment for this student (matching the pattern from getConversations)
                    const activeClassStudents = await ClassStudent.find({
                        studentId: studentObjectId,
                        enrollmentStatus: "active",
                        isDeleted: false
                    })
                    .select("studentId classId subjectIds")
                    .lean();

                    if (activeClassStudents && activeClassStudents.length > 0) {
                        const classStudent = activeClassStudents[0]; // Take the first active enrollment
                        const classIdStr = String(classStudent.classId);
                        
                        if (mongoose.Types.ObjectId.isValid(classIdStr)) {
                            studentToClassMap.set(studentIdStr, classIdStr);
                            
                            const classObjectId = new mongoose.Types.ObjectId(classIdStr);
                            const classDoc = await Class.findOne({
                                _id: classObjectId,
                                isDeleted: false
                            })
                            .select("_id name batchId")
                            .lean();
                            
                            if (classDoc) {
                                classToNameMap.set(classIdStr, (classDoc as any).name || "");
                                if ((classDoc as any).batchId) {
                                    const batchIdStr = String((classDoc as any).batchId);
                                    if (mongoose.Types.ObjectId.isValid(batchIdStr)) {
                                        classToBatchMap.set(classIdStr, batchIdStr);
                                        
                                        const batchObjectId = new mongoose.Types.ObjectId(batchIdStr);
                                        const batchDoc = await Batch.findOne({
                                            _id: batchObjectId,
                                            isDeleted: false
                                        })
                                        .select("_id batchName")
                                        .lean();
                                        
                                        if (batchDoc) {
                                            batchToNameMap.set(batchIdStr, (batchDoc as any).batchName || "");
                                        }
                                    }
                                }
                            }
                            
                            // Get subjects for this student from ClassStudent.subjectIds
                            if ((classStudent as any).subjectIds && Array.isArray((classStudent as any).subjectIds)) {
                                const subjectIds = (classStudent as any).subjectIds
                                    .map((subId: any) => String(subId))
                                    .filter((subIdStr: string) => mongoose.Types.ObjectId.isValid(subIdStr));
                                
                                if (subjectIds.length > 0) {
                                    studentToSubjectIdsMap.set(studentIdStr, subjectIds);
                                    
                                    const subjectObjectIds = subjectIds.map((id: string) => new mongoose.Types.ObjectId(id));
                                    const subjects = await Subject.find({
                                        _id: { $in: subjectObjectIds },
                                        isDeleted: false
                                    })
                                    .select("_id name")
                                    .lean();
                                    
                                    subjects.forEach((sub: any) => {
                                        subjectIdToNameMap.set(String(sub._id), sub.name || "");
                                    });
                                }
                            }
                        }
                    }
                } catch (classBatchError) {
                    console.error("⚠️ [getConversationById] Error fetching class/batch/subject info:", classBatchError);
                }
            }

            // Fetch teacher assigned classes/subjects if needed (for student/parent view)
            if ((isStudent || isParent) && teacherId) {
                try {
                    const teacherIdStr = String(teacherId);
                    const teacher = await Teacher.findById(teacherIdStr).select("assignedClasses assignedSubjects").lean();
                    
                    if (teacher) {
                        if (teacher.assignedClasses && Array.isArray(teacher.assignedClasses)) {
                            teacherToAssignedClassesMap.set(teacherIdStr, teacher.assignedClasses.map((c: any) => String(c)));
                            
                            const classIds = teacher.assignedClasses.map((c: any) => String(c));
                            const classes = await Class.find({ _id: { $in: classIds } }).select("name").lean();
                            classes.forEach((cls: any) => {
                                classToNameMap.set(String(cls._id), cls.name || "");
                            });
                        }
                        
                        if (teacher.assignedSubjects && Array.isArray(teacher.assignedSubjects)) {
                            teacherToAssignedSubjectsMap.set(teacherIdStr, teacher.assignedSubjects.map((s: any) => String(s)));
                            
                            const subjectIds = teacher.assignedSubjects.map((s: any) => String(s));
                            const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("name").lean();
                            subjects.forEach((sub: any) => {
                                subjectIdToNameMap.set(String(sub._id), sub.name || "");
                            });
                        }
                    }
                } catch (teacherError) {
                    console.error("⚠️ [getConversationById] Error fetching teacher info:", teacherError);
                }
            }

            // Fetch parent children info if needed (for teacher-parent conversations)
            if (isTeacher && conversation.type === "teacher-parent" && parentId) {
                try {
                    const parentIdStr = String(parentId);
                    const parentChildren = await ParentChild.find({ parentId: parentIdStr }).lean();
                    
                    const childIds: string[] = [];
                    parentChildren.forEach((pc: any) => {
                        if (pc.studentId) {
                            const childIdStr = String(pc.studentId);
                            childIds.push(childIdStr);
                            parentToChildrenMap.set(parentIdStr, childIds);
                        }
                    });
                    
                    if (childIds.length > 0) {
                        const children = await Student.find({ _id: { $in: childIds } }).select("firstName lastName").lean();
                        children.forEach((child: any) => {
                            childIdToNameMap.set(String(child._id), {
                                firstName: child.firstName || "",
                                lastName: child.lastName || ""
                            });
                        });
                    }
                } catch (parentError) {
                    console.error("⚠️ [getConversationById] Error fetching parent/children info:", parentError);
                }
            }

            // Format participants similar to getConversations
            const formattedParticipants: any = {
                teacherId,
            };

            if (studentId && conversation.type === "teacher-student") {
                formattedParticipants.studentId = studentId;
            } else if (parentId && conversation.type === "teacher-parent") {
                formattedParticipants.parentId = parentId;
            }

            // Conditionally add name only for the "other" participant based on logged-in user role
            if (isTeacher) {
                if (conversation.type === "teacher-student" && participants.studentId && typeof participants.studentId === "object") {
                    const studentIdStr = String(studentId);
                    const classId = studentToClassMap.get(studentIdStr);
                    const className = classId ? (classToNameMap.get(classId) || null) : null;
                    const batchId = classId ? (classToBatchMap.get(classId) || null) : null;
                    const batchName = batchId ? (batchToNameMap.get(batchId) || null) : null;
                    
                    const subjectIdsForStudent = studentToSubjectIdsMap.get(studentIdStr) || [];
                    const subjects = subjectIdsForStudent
                        .map((subId: string) => {
                            const subjectName = subjectIdToNameMap.get(subId);
                            return subjectName ? { id: subId, name: subjectName } : null;
                        })
                        .filter((sub: any) => sub !== null);

                    formattedParticipants.studentId = {
                        id: studentId,
                        firstName: participants.studentId.firstName || null,
                        lastName: participants.studentId.lastName || null,
                        email: participants.studentId.email || null,
                        phone: participants.studentId.phone || null,
                        profileImage: participants.studentId.profileImage || null,
                        className: className,
                        batchName: batchName,
                        subjects: subjects,
                    };
                    delete formattedParticipants.parentId;
                } else if (conversation.type === "teacher-parent" && participants.parentId && typeof participants.parentId === "object") {
                    const parentIdStr = String(parentId);
                    const childIds = parentToChildrenMap.get(parentIdStr) || [];
                    const children = childIds
                        .map((childId: string) => {
                            const childInfo = childIdToNameMap.get(childId);
                            return childInfo ? {
                                id: childId,
                                firstName: childInfo.firstName,
                                lastName: childInfo.lastName
                            } : null;
                        })
                        .filter((child: any) => child !== null);
                    
                    formattedParticipants.parentId = {
                        id: parentId,
                        firstName: participants.parentId.firstName || null,
                        lastName: participants.parentId.lastName || null,
                        email: participants.parentId.email || null,
                        phoneNumber: participants.parentId.phoneNumber || null,
                        profileImage: participants.parentId.profileImage || null,
                        children: children,
                    };
                    delete formattedParticipants.studentId;
                }
            } else if (isStudent || isParent) {
                if (participants.teacherId && typeof participants.teacherId === "object") {
                    const teacherIdStr = String(teacherId);
                    const assignedClassIds = teacherToAssignedClassesMap.get(teacherIdStr) || [];
                    const assignedClasses = assignedClassIds
                        .map((classId: string) => {
                            const className = classToNameMap.get(classId);
                            return className ? { id: classId, name: className } : null;
                        })
                        .filter((cls: any) => cls !== null);
                    
                    const assignedSubjectIds = teacherToAssignedSubjectsMap.get(teacherIdStr) || [];
                    const assignedSubjects = assignedSubjectIds
                        .map((subjectId: string) => {
                            const subjectName = subjectIdToNameMap.get(subjectId);
                            return subjectName ? { id: subjectId, name: subjectName } : null;
                        })
                        .filter((sub: any) => sub !== null);
                    
                    formattedParticipants.teacherId = {
                        id: teacherId,
                        firstName: participants.teacherId.firstName || null,
                        lastName: participants.teacherId.lastName || null,
                        email: participants.teacherId.email || null,
                        phone: participants.teacherId.phone || null,
                        profileImage: participants.teacherId.profileImage || null,
                        assignedClasses: assignedClasses,
                        assignedSubjects: assignedSubjects,
                    };
                }
            }

            const formattedConversation = {
                ...conversation,
                participants: formattedParticipants,
            };

            return sendSuccessResponse(res, "Conversation retrieved successfully", formattedConversation);
        } catch (error) {
            console.error("ChatController.getConversationById error:", error);
            return sendErrorResponse(res, "Failed to retrieve conversation", HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }
    };

    /**
     * Get message history for a specific conversation with pagination
     */
    static getMessages = async (req: ExpRequest, res: ExpResponse) => {
        try {
            const { conversationId } = req.params;
            const limitNum = Number(req.query.limit);
            const skipNum = Number(req.query.skip);
            const safeLimit =
                Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 20;
            const safeSkip = Number.isFinite(skipNum) && skipNum >= 0 ? skipNum : 0;
            const user = (req as any).user;

            // Verify participation
            const conversation = await Conversation.findOne({
                _id: conversationId,
                $or: [
                    { "participants.teacherId": user.id },
                    { "participants.studentId": user.id },
                    { "participants.parentId": user.id }
                ],
                tenantId: user.tenantId,
            });

            if (!conversation) {
                return sendErrorResponse(res, "Conversation not found or access denied", HttpStatusCodes.NOT_FOUND);
            }

            const messages = await Message.find({
                conversationId,
                tenantId: user.tenantId,
            })
                .sort({ createdAt: -1 })
                .skip(safeSkip)
                .limit(safeLimit)
                .lean();

            console.log("🔍 [getMessages] Query result:", {
                count: messages.length,
                conversationId,
                tenantId: user.tenantId,
                firstMessageId: messages[0]?._id
            });

            return sendSuccessResponse(res, "Messages retrieved successfully", messages.reverse());
        } catch (error) {
            console.error("ChatController.getMessages error:", error);
            return sendErrorResponse(res, "Failed to retrieve messages", HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }
    };

    /**
     * Start or get an existing 1-to-1 conversation
     */
    static startConversation = async (req: ExpRequest, res: ExpResponse) => {
        try {
            const { participantId, type } = req.body;
            const user = (req as any).user;

            if (!participantId || !type) {
                return sendErrorResponse(res, "Participant ID and type are required", HttpStatusCodes.BAD_REQUEST);
            }

            console.log(`🚀 [startConversation] Establishing ${type} chat between: ${user.id} and ${participantId}`);

            const participantsData: any = {};
            const query: any = {
                type,
                tenantId: user.tenantId,
            };

            // Normalize role name / userType for robust matching
            const rawRole = (user.roleName || user.userType || "").toString().toUpperCase();
            const isTeacher = rawRole === "TEACHER";
            const isStudent = rawRole === "STUDENT";
            const isParent = rawRole === "PARENT";

            // Normalize IDs to ObjectId to avoid type mismatches
            const loggedInUserId = new mongoose.Types.ObjectId(user.id);
            const otherParticipantId = new mongoose.Types.ObjectId(participantId);

            // Determine how to store participants based on logged-in user role and conversation type
            if (isTeacher) {
                // Logged-in Teacher → always goes into participants.teacherId
                participantsData.teacherId = loggedInUserId;
                query["participants.teacherId"] = loggedInUserId;

                if (type === "teacher-student") {
                    // Other user is the Student
                    participantsData.studentId = otherParticipantId;
                    query["participants.studentId"] = otherParticipantId;
                } else if (type === "teacher-parent") {
                    // Other user is the Parent
                    participantsData.parentId = otherParticipantId;
                    query["participants.parentId"] = otherParticipantId;
                }
            } else if (isStudent) {
                // Logged-in Student → always goes into participants.studentId
                if (type !== "teacher-student") {
                    return sendErrorResponse(res, "Invalid conversation type for student", HttpStatusCodes.BAD_REQUEST);
                }

                participantsData.studentId = loggedInUserId;
                participantsData.teacherId = otherParticipantId;
                query["participants.studentId"] = loggedInUserId;
                query["participants.teacherId"] = otherParticipantId;
            } else if (isParent) {
                // Logged-in Parent → always goes into participants.parentId
                if (type !== "teacher-parent") {
                    return sendErrorResponse(res, "Invalid conversation type for parent", HttpStatusCodes.BAD_REQUEST);
                }

                participantsData.parentId = loggedInUserId;
                participantsData.teacherId = otherParticipantId;
                query["participants.parentId"] = loggedInUserId;
                query["participants.teacherId"] = otherParticipantId;
            } else {
                // Fallback: if role is unknown, do not create conversation to avoid wrong mappings
                console.error("⛔ [startConversation] Unsupported user role for chat:", {
                    roleName: user.roleName,
                    userType: user.userType,
                });
                return sendErrorResponse(res, "Unsupported user role for conversation", HttpStatusCodes.FORBIDDEN);
            }


            // Check if conversation already exists
            let conversation = await Conversation.findOne(query);

            if (conversation) {
                console.log(`🔍 [startConversation] Found existing conversation: ${conversation._id}`);
            } else {
                console.log("🛠️ [startConversation] No existing conversation found. Attempting to create...");
                try {
                    conversation = await Conversation.create({
                        participants: participantsData,
                        type,
                        tenantId: user.tenantId,
                        unreadCount: new Map(),
                        createdBy: user.id,
                        updatedBy: user.id,
                    });
                    console.log(`✅ [startConversation] New conversation created: ${conversation._id}`);
                } catch (createError: any) {
                    console.error(`❌ [startConversation] Creation failed. Code: ${createError.code}, Message: ${createError.message}`);

                    // Handle race condition or lingering index issues
                    if (createError.code === 11000) {
                        console.log("🔄 [startConversation] Duplicate key detected. Searching again for matching conversation...");
                        conversation = await Conversation.findOne(query);

                        if (conversation) {
                            console.log(`🔍 [startConversation] Found conversation after duplicate error: ${conversation._id}`);
                        } else {
                            console.error("⚠️ [startConversation] Duplicate key error occurred, but could not find the matching conversation.");
                        }
                    } else {
                        throw createError;
                    }
                }
            }

            if (!conversation) {
                console.error("⛔ [startConversation] Failed to establish conversation: result is null");
                return sendErrorResponse(res, "Failed to establish conversation.", HttpStatusCodes.CONFLICT);
            }

            // Populate participant details for frontend display
            await conversation.populate("participants.teacherId", "firstName lastName username profilePicture userType");
            await conversation.populate("participants.studentId", "firstName lastName username profilePicture userType");
            await conversation.populate("participants.parentId", "firstName lastName username profilePicture userType");
            await conversation.populate("lastMessage");

            return sendSuccessResponse(res, "Conversation established", conversation);
        } catch (error) {
            console.error("ChatController.startConversation error:", error);
            return sendErrorResponse(res, "Failed to start conversation", HttpStatusCodes.INTERNAL_SERVER_ERROR);
        }
    };
}

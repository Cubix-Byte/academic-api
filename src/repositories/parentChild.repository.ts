import {
	ParentChild,
	IParentChild,
	Student,
	Class,
	TeacherAssignClasses,
} from '../models';
import mongoose from 'mongoose';
import { STATUS } from '../utils/constants/status.constants';

/**
 * Parent-Child Relationship Repository - Database operations for Parent-Child relationships
 */

// Find parent-child relationship by parent and child IDs
export const findParentChildRelationship = async (
	parentId: string,
	childId: string,
) => {
	if (
		!mongoose.Types.ObjectId.isValid(parentId) ||
		!mongoose.Types.ObjectId.isValid(childId)
	) {
		return null;
	}

	return await ParentChild.findOne({
		parentId: new mongoose.Types.ObjectId(parentId),
		childId: new mongoose.Types.ObjectId(childId),
		isActive: true,
		isDeleted: false,
	})
		.populate('parentId')
		.populate('childId');
};

// Create parent-child relationship
export const createParentChildRelationship = async (
	relationshipData: Partial<IParentChild>,
	session?: mongoose.ClientSession,
) => {
	const relationship = new ParentChild({
		...relationshipData,
		createdBy: 'academy-api',
		isActive: true,
		isDeleted: false,
	});

	if (session) {
		return await relationship.save({ session });
	}
	return await relationship.save();
};

// Find children by parent ID
export const findChildrenByParentId = async (parentId: string) => {
	if (!mongoose.Types.ObjectId.isValid(parentId)) {
		return [];
	}

	return await ParentChild.find({
		parentId: new mongoose.Types.ObjectId(parentId),
		isDeleted: false,
	})
		.populate('childId', 'firstName lastName email rollNumber classId profileImage studentId status isActive')
		.populate('parentId', 'firstName lastName email parentId')
		.sort({ createdAt: -1 })
		.lean();
};

// Find parents by child ID
export const findParentsByChildId = async (childId: string) => {
	if (!mongoose.Types.ObjectId.isValid(childId)) {
		return [];
	}

	return await ParentChild.find({
		childId: new mongoose.Types.ObjectId(childId),
		isActive: true,
		isDeleted: false,
	})
		.populate(
			'parentId',
			'firstName lastName email parentId occupation relationship role',
		)
		.populate('childId', 'firstName lastName email rollNumber')
		.sort({ isPrimary: -1, createdAt: -1 }) // Primary parent first
		.lean();
};

/**
 * Find existing parent-child roles by child IDs in one query (for bulk upload validation).
 * Returns Map of childId (string) -> Set of relationship/role strings (lowercase).
 */
export const findParentChildRolesByChildIds = async (
	childIds: string[],
): Promise<Map<string, Set<string>>> => {
	const map = new Map<string, Set<string>>();
	if (!childIds || childIds.length === 0) return map;
	const validIds = childIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
	if (validIds.length === 0) return map;
	const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
	const docs = await ParentChild.find(
		{ childId: { $in: objectIds }, isActive: true, isDeleted: false },
		{ childId: 1, relationship: 1 },
	)
		.lean()
		.exec();
	for (const d of docs as any[]) {
		if (!d.childId) continue;
		const cid = d.childId.toString();
		if (!map.has(cid)) map.set(cid, new Set());
		const role = (d.relationship || '').toLowerCase();
		if (role) map.get(cid)!.add(role);
	}
	return map;
};

/**
 * Find parent-child relations by child IDs (childId -> [{ parentId, relationship }]).
 * For existing-parent update validation: check if another parent has the new role.
 */
export const findParentChildRelationsByChildIds = async (
	childIds: string[],
): Promise<Map<string, Array<{ parentId: string; relationship: string }>>> => {
	const map = new Map<string, Array<{ parentId: string; relationship: string }>>();
	if (!childIds || childIds.length === 0) return map;
	const validIds = childIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
	if (validIds.length === 0) return map;
	const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
	const docs = await ParentChild.find(
		{ childId: { $in: objectIds }, isActive: true, isDeleted: false },
		{ childId: 1, parentId: 1, relationship: 1 },
	)
		.lean()
		.exec();
	for (const d of docs as any[]) {
		if (!d.childId) continue;
		const cid = d.childId.toString();
		const pid = (d.parentId && (d as any).parentId.toString()) || '';
		const rel = ((d as any).relationship || '').toLowerCase();
		if (!map.has(cid)) map.set(cid, []);
		map.get(cid)!.push({ parentId: pid, relationship: rel });
	}
	return map;
};

/**
 * Bulk insert parent-child relationships (for bulk upload).
 */
export const insertManyParentChildren = async (
	docs: Partial<IParentChild>[],
	session?: mongoose.ClientSession,
): Promise<IParentChild[]> => {
	if (!docs || docs.length === 0) return [];
	const options = session ? { session } : {};
	const inserted = await ParentChild.insertMany(docs, options);
	return inserted as IParentChild[];
};

/**
 * Find ParentChild docs by parent IDs and child IDs (for bulk upload - existing parents linking).
 * Returns lean docs; build map key = `${parentId}:${childId}` -> doc.
 */
export const findParentChildByParentIdsAndChildIds = async (
	parentIds: string[],
	childIds: string[],
): Promise<Array<{ _id: mongoose.Types.ObjectId; parentId: string; childId: string; relationship: string }>> => {
	if (!parentIds?.length || !childIds?.length) return [];
	const validParentIds = parentIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
	const validChildIds = childIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
	if (!validParentIds.length || !validChildIds.length) return [];
	const docs = await ParentChild.find(
		{ parentId: { $in: validParentIds }, childId: { $in: validChildIds }, isDeleted: false },
		{ _id: 1, parentId: 1, childId: 1, relationship: 1 },
	)
		.lean()
		.exec();
	return (docs as any[]).map((d) => ({
		_id: d._id,
		parentId: (d.parentId && d.parentId.toString()) || '',
		childId: (d.childId && d.childId.toString()) || '',
		relationship: (d.relationship || '').toLowerCase(),
	}));
};

/**
 * Find all ParentChild relations for given parent IDs (for bulk upload - role-change and linking).
 * Returns array of { parentId, childId, relationship, _id }.
 */
export const findParentChildRelationsByParentIds = async (
	parentIds: string[],
): Promise<Array<{ parentId: string; childId: string; relationship: string; _id: string }>> => {
	if (!parentIds?.length) return [];
	const validIds = parentIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
	if (!validIds.length) return [];
	const docs = await ParentChild.find(
		{ parentId: { $in: validIds }, isDeleted: false },
		{ _id: 1, parentId: 1, childId: 1, relationship: 1 },
	)
		.lean()
		.exec();
	return (docs as any[]).map((d) => ({
		parentId: (d.parentId && d.parentId.toString()) || '',
		childId: (d.childId && d.childId.toString()) || '',
		relationship: (d.relationship || '').toLowerCase(),
		_id: d._id.toString(),
	}));
};

/**
 * Bulk update relationship field by _id (for bulk upload - existing parent link role updates).
 */
export const bulkUpdateParentChildRelationships = async (
	updates: Array<{ id: string; relationship: string }>,
	session?: mongoose.ClientSession,
): Promise<void> => {
	if (!updates?.length) return;
	const bulkOps = updates
		.filter((u) => mongoose.Types.ObjectId.isValid(u.id))
		.map((u) => ({
			updateOne: {
				filter: { _id: new mongoose.Types.ObjectId(u.id), isDeleted: false },
				update: {
					$set: {
						relationship: u.relationship as 'father' | 'mother' | 'guardian' | 'other',
						updatedBy: 'academy-api',
						updatedAt: new Date(),
					},
				},
			},
		}));
	if (!bulkOps.length) return;
	const options: any = { ordered: false };
	if (session) options.session = session;
	await ParentChild.bulkWrite(bulkOps, options);
};

/**
 * Bulk update all ParentChild relationships for given parents to a new role (for role-change in bulk upload).
 */
export const bulkUpdateRelationshipsByParentIds = async (
	updates: Array<{ parentId: string; relationship: string }>,
	session?: mongoose.ClientSession,
): Promise<void> => {
	if (!updates?.length) return;
	const role = (r: string) => (['father', 'mother', 'guardian', 'other'].includes(r.toLowerCase()) ? r.toLowerCase() : 'other');
	const bulkOps = updates
		.filter((u) => mongoose.Types.ObjectId.isValid(u.parentId))
		.map((u) => ({
			updateMany: {
				filter: { parentId: new mongoose.Types.ObjectId(u.parentId), isDeleted: false },
				update: {
					$set: {
						relationship: role(u.relationship) as 'father' | 'mother' | 'guardian' | 'other',
						updatedBy: 'academy-api',
						updatedAt: new Date(),
					},
				},
			},
		}));
	if (!bulkOps.length) return;
	const options: any = { ordered: false };
	if (session) options.session = session;
	await ParentChild.bulkWrite(bulkOps, options);
};

// Update parent-child relationship
export const updateParentChildRelationship = async (
	relationshipId: string,
	updateData: Partial<IParentChild>,
) => {
	if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
		return null;
	}

	return await ParentChild.findByIdAndUpdate(
		relationshipId,
		{ $set: { ...updateData, updatedBy: 'academy-api' } },
		{ new: true, runValidators: true },
	)
		.populate('parentId')
		.populate('childId');
};

// Soft delete parent-child relationship
export const softDeleteParentChildRelationship = async (
	relationshipId: string,
) => {
	if (!mongoose.Types.ObjectId.isValid(relationshipId)) {
		return null;
	}

	return await ParentChild.findByIdAndUpdate(
		relationshipId,
		{
			$set: {
				isDeleted: true,
				isActive: false,
				updatedBy: 'academy-api',
			},
		},
		{ new: true },
	);
};

// Remove primary status from all parents of a child
export const removePrimaryStatusFromChild = async (childId: string) => {
	if (!mongoose.Types.ObjectId.isValid(childId)) {
		return;
	}

	await ParentChild.updateMany(
		{
			childId: new mongoose.Types.ObjectId(childId),
			isActive: true,
			isDeleted: false,
		},
		{
			$set: {
				isPrimary: false,
				updatedBy: 'academy-api',
			},
		},
	);
};

// Set primary parent for a child
export const setPrimaryParent = async (childId: string, parentId: string) => {
	if (
		!mongoose.Types.ObjectId.isValid(childId) ||
		!mongoose.Types.ObjectId.isValid(parentId)
	) {
		return null;
	}

	return await ParentChild.findOneAndUpdate(
		{
			childId: new mongoose.Types.ObjectId(childId),
			parentId: new mongoose.Types.ObjectId(parentId),
			isActive: true,
			isDeleted: false,
		},
		{
			$set: {
				isPrimary: true,
				updatedBy: 'academy-api',
			},
		},
		{ new: true },
	)
		.populate('parentId')
		.populate('childId');
};

// Get parent-child relationship statistics
export const getParentChildStatistics = async (tenantId?: string) => {
	const matchClause: any = {
		isActive: true,
		isDeleted: false,
	};

	if (tenantId) {
		matchClause.tenantId = tenantId;
	}

	const stats = await ParentChild.aggregate([
		{ $match: matchClause },
		{
			$group: {
				_id: {
					relationship: '$relationship',
					status: '$status',
				},
				count: { $sum: 1 },
			},
		},
	]);

	const result = {
		total: 0,
		byRelationship: {
			father: 0,
			mother: 0,
			guardian: 0,
			other: 0,
		},
		byStatus: {
			[STATUS.ACTIVE]: 0,
			[STATUS.INACTIVE]: 0,
		},
		primaryParents: 0,
	};

	stats.forEach((stat) => {
		result.total += stat.count;

		if (stat._id.relationship in result.byRelationship) {
			result.byRelationship[
				stat._id.relationship as keyof typeof result.byRelationship
			] += stat.count;
		}

		if (stat._id.status in result.byStatus) {
			result.byStatus[stat._id.status as keyof typeof result.byStatus] +=
				stat.count;
		}
	});

	// Get primary parents count
	const primaryCount = await ParentChild.countDocuments({
		...matchClause,
		isPrimary: true,
	});
	result.primaryParents = primaryCount;

	return result;
};

// Get child's subjects with assigned teachers
export const getChildSubjectsWithTeachers = async (
	childId: string,
	tenantId?: string,
) => {
	if (!mongoose.Types.ObjectId.isValid(childId)) {
		throw new Error('Invalid childId');
	}

	// Find student
	const student = await Student.findOne({
		_id: new mongoose.Types.ObjectId(childId),
		isDeleted: false,
		...(tenantId && { tenantId }),
	})
		.select('classId section')
		.lean();

	if (!student) {
		throw new Error('Student not found');
	}

	// Get ClassStudent record to get subjectIds assigned to this student
	// Note: class_students table doesn't have tenantId field, so we don't filter by it
	const ClassStudent = (await import('@/models/class_student.schema')).default;
	const classStudentRecord = await ClassStudent.findOne({
		studentId: new mongoose.Types.ObjectId(childId),
		classId: student.classId ? new mongoose.Types.ObjectId(student.classId) : null,
		isDeleted: false,
		enrollmentStatus: { $in: ['active', 'promoted'] },
	})
		.lean();

	// Get class info
	const classInfo = await Class.findOne({
		_id: student.classId,
		isDeleted: false,
	})
		.select('subjectIds')
		.lean();

	if (!classInfo) {
		throw new Error('Class information not found');
	}

	// Use ONLY subjectIds from class_students (assigned subjects)
	// Do NOT fallback to Class.subjectIds - only show subjects explicitly assigned to the student
	let subjectIds: mongoose.Types.ObjectId[] = [];
	const classStudentSubjectIds = (classStudentRecord as any)?.subjectIds;
	if (classStudentSubjectIds && Array.isArray(classStudentSubjectIds) && classStudentSubjectIds.length > 0) {
		subjectIds = classStudentSubjectIds.map((id: any) =>
			id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
		);
	}
	// If no subjectIds found in class_students, return empty array (student has no assigned subjects)

	// Populate subjects
	const Subject = (await import('@/models/subject.schema')).default;
	const populatedSubjects = await Subject.find({
		_id: { $in: subjectIds },
		isDeleted: false,
		isActive: true,
	})
		.select('name code description')
		.lean();

	// Get teacher assignments for the class (maps teacher <-> subject)
	const teacherAssignments = await TeacherAssignClasses.find({
		classId: student.classId,
		status: 'active',
		...(tenantId && { tenantId }),
	})
		.populate({
			path: 'teacherId',
			select: 'firstName lastName email',
		})
		.populate({
			path: 'subjectId',
			select: 'name code',
		})
		.lean();

	// Map subjects with their assigned teacher (if any)
	const subjectsWithTeachers = populatedSubjects.map(
		(subject: any) => {
			const subjectIdStr = subject._id.toString();

			const assignment = teacherAssignments.find((ta: any) => {
				const taSubjId = ta.subjectId?._id
					? ta.subjectId._id.toString()
					: ta.subjectId
						? ta.subjectId.toString()
						: null;
				return taSubjId === subjectIdStr;
			});

			return {
				subjectId: subject._id.toString(),
				subjectName: subject.name || null,
				subjectCode: subject.code || null,
				description: subject.description || null,
				teacher: assignment
					? {
						teacherId:
							(assignment.teacherId as any)?._id || assignment.teacherId,
						firstName: (assignment.teacherId as any)?.firstName || null,
						lastName: (assignment.teacherId as any)?.lastName || null,
						email: (assignment.teacherId as any)?.email || null,
					}
					: null,
			};
		},
	);

	// Count unique teachers (non-null teachers in the list)
	const uniqueTeacherIds = new Set(
		subjectsWithTeachers
			.filter((s: any) => s.teacher && s.teacher.teacherId)
			.map((s: any) => (s.teacher.teacherId as any).toString()),
	);
	const totalTeachers = uniqueTeacherIds.size;

	// Count total subjects
	const totalSubjects = subjectsWithTeachers.length;

	return {
		subjects: subjectsWithTeachers,
		totalSubjects,
		totalTeachers,
	};
};

// Find parent-child relationships with filters
export const findParentChildRelationships = async ({
	pageNo = 1,
	pageSize = 10,
	parentId,
	childId,
	relationship,
	status,
	tenantId,
}: {
	pageNo?: number;
	pageSize?: number;
	parentId?: string;
	childId?: string;
	relationship?: string;
	status?: string;
	tenantId?: string;
}) => {
	const skip = (pageNo - 1) * pageSize;

	const whereClause: any = {
		isActive: true,
		isDeleted: false,
	};

	if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
		whereClause.parentId = new mongoose.Types.ObjectId(parentId);
	}

	if (childId && mongoose.Types.ObjectId.isValid(childId)) {
		whereClause.childId = new mongoose.Types.ObjectId(childId);
	}

	if (relationship) {
		whereClause.relationship = relationship;
	}

	if (status) {
		whereClause.status = status;
	}

	if (tenantId) {
		whereClause.tenantId = tenantId;
	}

	return await ParentChild.find(whereClause)
		.populate('parentId', 'firstName lastName email parentId')
		.populate('childId', 'firstName lastName email rollNumber status isActive')
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(pageSize)
		.lean();
};

// Count parent-child relationships
export const countParentChildRelationships = async ({
	parentId,
	childId,
	relationship,
	status,
	tenantId,
}: {
	parentId?: string;
	childId?: string;
	relationship?: string;
	status?: string;
	tenantId?: string;
}) => {
	const whereClause: any = {
		isActive: true,
		isDeleted: false,
	};

	if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
		whereClause.parentId = new mongoose.Types.ObjectId(parentId);
	}

	if (childId && mongoose.Types.ObjectId.isValid(childId)) {
		whereClause.childId = new mongoose.Types.ObjectId(childId);
	}

	if (relationship) {
		whereClause.relationship = relationship;
	}

	if (status) {
		whereClause.status = status;
	}

	if (tenantId) {
		whereClause.tenantId = tenantId;
	}

	return await ParentChild.countDocuments(whereClause);
};

// Update status for all relationships of a child
export const updateStatusByChildId = async (
	childId: string,
	status: STATUS,
	isActive: boolean,
) => {
	if (!mongoose.Types.ObjectId.isValid(childId)) {
		return null;
	}

	return await ParentChild.updateMany(
		{ childId: new mongoose.Types.ObjectId(childId) },
		{
			$set: {
				status,
				isActive,
				updatedBy: 'academy-api',
			},
		},
	);
};

import { Exam, IExam } from '../models';
import { ExamStudent } from '../models';
import {
	CreateExamRequest,
	UpdateExamRequest,
	GetAllExamsRequest,
	ExamStatistics,
} from '../types/exam.types';
import mongoose from 'mongoose';
import { ExamEnums } from '../utils/shared-lib-imports';
import { retryOnWriteConflict } from '../utils/retry.util';

/**
 * Exam Repository - Data access layer for Exam management
 */


// Centralized helper to enforce tenant scoping and build filters consistently
function buildExamQuery(params: GetAllExamsRequest) {
	const {
		tenantId,
		teacherId,
		examStatus,
		examType,
		classId,
		subjectId,
		batchId,
		search,
		startDate,
		endDate,
	} = params as any;

	if (!tenantId) {
		throw new Error('tenantId is required');
	}

	const query: any = { isDeleted: false, tenantId };

	if (teacherId) query.teacherId = teacherId;
	if (examStatus) query.examStatus = examStatus;
	if (examType) query.examType = examType;
	if (classId) query.classId = classId;
	if (subjectId) query.subjectId = subjectId;
	if (batchId) query.batchId = batchId;
	if (search) {
		query.$or = [
			{ examTitle: { $regex: search, $options: 'i' } },
			{ description: { $regex: search, $options: 'i' } },
		];
	}

	// Optional date filters (filter by createdAt)
	if (startDate || endDate) {
		query.createdAt = {};
		if (startDate) query.createdAt.$gte = new Date(startDate);
		if (endDate) query.createdAt.$lte = new Date(endDate);
	}

	return query;
}

const ALLOWED_STATUSES: readonly string[] =
	(ExamEnums?.ExamStatus as readonly string[]) || [
		'Draft',
		'Unpublished',
		'Published',
		'Released',
		'In Progress',
		'Completed',
		'Cancelled',
	];

// Create new exam
export const createExam = async (
	data: CreateExamRequest & { tenantId: string; teacherId: string },
	session?: mongoose.ClientSession,
): Promise<IExam> => {
	try {
		const exam = new Exam(data);
		return await exam.save({ session });
	} catch (error: any) {
		console.error('Error creating exam:', error);
		throw error;
	}
};

// Find exam by ID
export const findExamById = async (
	id: string,
	session?: mongoose.ClientSession,
): Promise<IExam | null> => {
	// If session is provided, use it (transaction context) - don't retry as transaction handles it
	// If no session, use retry wrapper for standalone operations
	const executeQuery = async () => {
		try {
			const query = Exam.findOne({ _id: id, isDeleted: false })
				.populate('classId', 'name grade section academicYear')
				.populate('subjectId', 'name')
				.populate('batchId', 'batchName')
				.populate('examModeId', 'name');

			if (session) {
				query.session(session);
			}

			const exam = await query.lean();
			return exam as IExam | null;
		} catch (error: any) {
			console.error('Error finding exam by ID:', error);
			throw error;
		}
	};

	if (session) {
		// Within transaction, let transaction handle retries
		return await executeQuery();
	} else {
		// Standalone operation, use retry wrapper
		return retryOnWriteConflict(executeQuery);
	}
};

// Find exam by title and tenant
export const findExamByTitleAndTenant = async (
	examTitle: string,
	tenantId: string,
): Promise<IExam | null> => {
	try {
		return await Exam.findOne({
			examTitle: examTitle,
			tenantId: tenantId,
			isDeleted: false,
		});
	} catch (error: any) {
		console.error('Error finding exam by title and tenant:', error);
		throw error;
	}
};

// Find all exams with filters
export const findExams = async (
	params: GetAllExamsRequest,
): Promise<IExam[]> => {
	try {
		const { pageNo = 1, pageSize = 10 } = params as any;
		const query = buildExamQuery(params);

		// Calculate skip
		const skip = (pageNo - 1) * pageSize;

		// Execute query with population
		const exams = await Exam.find(query)
			.populate('classId', 'name grade section academicYear')
			.populate('subjectId', 'name')
			.populate('batchId', 'batchName')
			.populate('examModeId', 'name')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(pageSize)
			.lean();

		return exams as unknown as IExam[];
	} catch (error: any) {
		console.error('Error finding exams:', error);
		throw error;
	}
};

// Count exams with filters
export const countExams = async (
	params: GetAllExamsRequest,
): Promise<number> => {
	try {
		const query = buildExamQuery(params);

		return await Exam.countDocuments(query);
	} catch (error: any) {
		console.error('Error counting exams:', error);
		throw error;
	}
};

// Find all exams using generic dynamic filter pattern (filter + sort)
export const findExamsDynamic = async (params: {
	pageNo: number;
	pageSize: number;
	tenantId: string;
	teacherId?: string;
	query?: Record<string, any>;
	sort?: Record<string, any>;
}): Promise<{ exams: IExam[]; total: number }> => {
	try {
		const { pageNo = 1, pageSize = 10, tenantId, teacherId, query = {}, sort = { createdAt: -1 } } = params;
		const skip = (pageNo - 1) * pageSize;

		// Debug: Log incoming query to verify examModeId is present
		if (query.examModeId) {
			console.log('🔍 [findExamsDynamic] examModeId in query:', JSON.stringify(query.examModeId));
		}

		// Base query with tenant and not deleted (server-enforced)
		const baseQuery: any = {
			tenantId: new mongoose.Types.ObjectId(tenantId),
			isDeleted: false,
		};
		if (teacherId) {
			baseQuery.teacherId = new mongoose.Types.ObjectId(teacherId);
		}

		// Merge with provided filters (client may send isDeleted__eq, but baseQuery always wins)
		const processedQuery: any = { ...baseQuery };

		// Handle batchId filter specially: filter by classes in the batch, not by exam's batchId field
		let batchClassIds: mongoose.Types.ObjectId[] = [];
		if (query.batchId) {
			let batchIdValue: string | undefined;

			// Extract batchId value from query (handle both $eq operator and direct value)
			if (query.batchId && typeof query.batchId === 'object' && query.batchId.$eq !== undefined) {
				batchIdValue = typeof query.batchId.$eq === 'string' ? query.batchId.$eq : undefined;
			} else if (typeof query.batchId === 'string') {
				batchIdValue = query.batchId;
			}

			if (batchIdValue && mongoose.Types.ObjectId.isValid(batchIdValue)) {
				const { Class } = await import('../models');
				const classesInBatch = await Class.find({
					batchId: new mongoose.Types.ObjectId(batchIdValue),
					tenantId: new mongoose.Types.ObjectId(tenantId),
					isDeleted: false,
				}).select('_id').lean();

				batchClassIds = classesInBatch.map((cls: any) => cls._id);

				if (batchClassIds.length === 0) {
					// No classes in this batch, return empty result
					return { exams: [] as unknown as IExam[], total: 0 };
				}
			}
		}

		// ObjectId fields that need conversion (excluding batchId as it's handled above)
		const objectIdFields = ['classId', 'teacherId', 'subjectId', 'examModeId', 'tenantId'];

		// Process all query filters
		Object.keys(query).forEach((key) => {
			const value = query[key];

			// Never allow overriding tenant scoping or deletion constraint
			if (key === 'tenantId' || key === 'isDeleted') return;

			// Skip batchId as it's handled separately above
			if (key === 'batchId') return;

			if (objectIdFields.includes(key)) {
				// Handle $eq operator
				if (value && typeof value === 'object' && value.$eq !== undefined) {
					if (typeof value.$eq === 'string' && mongoose.Types.ObjectId.isValid(value.$eq)) {
						processedQuery[key] = new mongoose.Types.ObjectId(value.$eq);
					} else {
						processedQuery[key] = value;
					}
				} else if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
					processedQuery[key] = new mongoose.Types.ObjectId(value);
				} else if (value && typeof value === 'object' && value.$in) {
					const inArray = Array.isArray(value.$in) ? value.$in : value.$in.split(',');
					processedQuery[key] = {
						$in: inArray
							.filter((v: any) => mongoose.Types.ObjectId.isValid(v))
							.map((v: any) => new mongoose.Types.ObjectId(v))
					};
				} else if (value && typeof value === 'object' && (value.$ne || value.$gte || value.$lte)) {
					const processedValue: any = {};
					Object.keys(value).forEach((op) => {
						if (typeof value[op] === 'string' && mongoose.Types.ObjectId.isValid(value[op])) {
							processedValue[op] = new mongoose.Types.ObjectId(value[op]);
						} else {
							processedValue[op] = value[op];
						}
					});
					processedQuery[key] = processedValue;
				} else {
					processedQuery[key] = value;
				}
			} else {
				// Non-ObjectId fields (like examType, examStatus, etc.)
				// Handle $eq operator for string/enum fields
				if (value && typeof value === 'object' && value.$eq !== undefined) {
					processedQuery[key] = value.$eq;
				} else {
					processedQuery[key] = value;
				}
			}
		});

		// Debug: Log final processed query
		console.log('🔍 [findExamsDynamic] Final processed query:', JSON.stringify({
			...processedQuery,
			examModeId: processedQuery.examModeId ? processedQuery.examModeId.toString() : undefined,
			classId: processedQuery.classId ? (processedQuery.classId instanceof mongoose.Types.ObjectId ? processedQuery.classId.toString() : JSON.stringify(processedQuery.classId)) : undefined,
			subjectId: processedQuery.subjectId ? processedQuery.subjectId.toString() : undefined,
		}, null, 2));

		// Apply batchId filter by intersecting with classId filter
		if (batchClassIds.length > 0) {
			if (processedQuery.classId) {
				// If classId filter already exists, intersect with batchClassIds
				if (processedQuery.classId instanceof mongoose.Types.ObjectId) {
					// Single classId: check if it's in batchClassIds
					const classIdStr = processedQuery.classId.toString();
					const batchClassIdStrs = batchClassIds.map((id: any) => id.toString());
					if (!batchClassIdStrs.includes(classIdStr)) {
						// The requested classId is not in the batch, return empty result
						return { exams: [] as unknown as IExam[], total: 0 };
					}
					// Keep the existing classId filter as is (it's already valid)
				} else if (processedQuery.classId.$in) {
					// If it's an $in array, intersect with batchClassIds
					const existingIds = processedQuery.classId.$in;
					const batchClassIdStrs = batchClassIds.map((id: any) => id.toString());
					const validIds = existingIds.filter((id: any) =>
						batchClassIdStrs.includes(id.toString())
					);
					if (validIds.length === 0) {
						return { exams: [] as unknown as IExam[], total: 0 };
					}
					processedQuery.classId = { $in: validIds };
				}
			} else {
				// No existing classId filter, add batchClassIds as $in filter
				processedQuery.classId = { $in: batchClassIds };
			}
		}

		const exams = await Exam.find(processedQuery)
			.populate({
				path: 'classId',
				select: 'name grade section academicYear',
				match: { isDeleted: false }, // Filter out deleted classes
			})
			.populate('subjectId', 'name')
			.populate('batchId', 'batchName')
			.populate('examModeId', 'name')
			.sort(sort)
			.skip(skip)
			.limit(pageSize)
			.lean();

		// Filter out exams whose classes are deleted (classId will be null after populate with match)
		const filteredExams = exams.filter((exam: any) => exam.classId !== null && exam.classId !== undefined);

		// For count, we need to get the count of exams that have non-deleted classes
		// Since countDocuments doesn't support populate, we need to filter by classIds that are not deleted
		const { Class } = await import('../models');
		const activeClasses = await Class.find({
			tenantId: new mongoose.Types.ObjectId(tenantId),
			isDeleted: false,
		}).select('_id').lean();
		const activeClassIds = activeClasses.map((cls: any) => cls._id);

		// Build count query: merge with existing classId filter if present, otherwise add $in filter
		const countQuery: any = { ...processedQuery };

		if (activeClassIds.length === 0) {
			// If no active classes, return 0
			return { exams: [] as unknown as IExam[], total: 0 };
		}

		// If there's already a classId filter in processedQuery, intersect it with activeClassIds
		if (processedQuery.classId) {
			// Convert activeClassIds to strings for comparison (lean() returns plain objects)
			const activeClassIdStrs = activeClassIds.map((id: any) => id.toString());

			// If classId is already an ObjectId (single value), check if it's in activeClassIds
			if (processedQuery.classId instanceof mongoose.Types.ObjectId) {
				const classIdStr = processedQuery.classId.toString();
				if (!activeClassIdStrs.includes(classIdStr)) {
					// The requested classId is deleted, return 0
					return { exams: [] as unknown as IExam[], total: 0 };
				}
				// Keep the existing classId filter as is (it's already valid)
				countQuery.classId = processedQuery.classId;
			} else if (processedQuery.classId.$in) {
				// If it's an $in array, intersect with activeClassIds
				const existingIds = processedQuery.classId.$in;
				const existingIdStrs = existingIds.map((id: any) => id.toString());
				const validIds = existingIdStrs.filter((idStr: string) =>
					activeClassIdStrs.includes(idStr)
				);
				if (validIds.length === 0) {
					return { exams: [] as unknown as IExam[], total: 0 };
				}
				// Convert back to ObjectIds for countQuery
				countQuery.classId = { $in: validIds.map((idStr: string) => new mongoose.Types.ObjectId(idStr)) };
			} else {
				// Other operators - keep as is but add $in constraint (this case is rare)
				countQuery.classId = {
					...processedQuery.classId,
					$in: activeClassIds,
				};
			}
		} else {
			// No existing classId filter, add $in filter for active classes
			countQuery.classId = { $in: activeClassIds };
		}

		const total = await Exam.countDocuments(countQuery);

		return { exams: filteredExams as unknown as IExam[], total };
	} catch (error: any) {
		console.error('Error finding exams (dynamic):', error);
		throw error;
	}
};

// Find exam logs with basic fields and generic filters
export const findExamLogs = async (params: {
	pageNo: number;
	pageSize: number;
	tenantId: string;
	query?: Record<string, any>;
	sort?: Record<string, any>;
}): Promise<{ exams: IExam[]; total: number }> => {
	try {
		const { pageNo = 1, pageSize = 10, tenantId, query = {}, sort = { _id: -1 } } = params;
		const skip = (pageNo - 1) * pageSize;

		// Base query with tenant and not deleted
		const baseQuery: any = {
			tenantId: new mongoose.Types.ObjectId(tenantId),
			isDeleted: false,
		};

		// Process filters and convert ObjectId fields
		const processedQuery: any = { ...baseQuery };

		// ObjectId fields that need conversion
		const objectIdFields = ['classId', 'teacherId', 'subjectId', 'batchId'];

		Object.keys(query).forEach((key) => {
			const value = query[key];

			// Handle ObjectId fields
			if (objectIdFields.includes(key)) {
				// Handle $eq operator - extract value if it's an object with $eq
				if (value && typeof value === 'object' && value.$eq !== undefined) {
					// Convert string to ObjectId and simplify to direct value for better performance
					if (typeof value.$eq === 'string' && mongoose.Types.ObjectId.isValid(value.$eq)) {
						processedQuery[key] = new mongoose.Types.ObjectId(value.$eq);
					} else {
						processedQuery[key] = value;
					}
				} else if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
					// Direct string value - convert to ObjectId
					processedQuery[key] = new mongoose.Types.ObjectId(value);
				} else if (value && typeof value === 'object' && value.$in) {
					// Handle $in operator
					const inArray = Array.isArray(value.$in) ? value.$in : value.$in.split(',');
					processedQuery[key] = {
						$in: inArray
							.filter((v: any) => mongoose.Types.ObjectId.isValid(v))
							.map((v: any) => new mongoose.Types.ObjectId(v))
					};
				} else if (value && typeof value === 'object' && (value.$ne || value.$gte || value.$lte)) {
					// Handle other operators ($ne, $gte, $lte) - convert ObjectId values within
					const processedValue: any = {};
					Object.keys(value).forEach((op) => {
						if (typeof value[op] === 'string' && mongoose.Types.ObjectId.isValid(value[op])) {
							processedValue[op] = new mongoose.Types.ObjectId(value[op]);
						} else {
							processedValue[op] = value[op];
						}
					});
					processedQuery[key] = processedValue;
				} else {
					// Keep as is for complex queries
					processedQuery[key] = value;
				}
			} else {
				// Non-ObjectId fields - keep as is
				processedQuery[key] = value;
			}
		});

		// Use processed query
		const finalQuery = processedQuery;

		// Get total count
		const total = await Exam.countDocuments(finalQuery);

		// Get paginated exams with basic fields and populated names
		const exams = await Exam.find(finalQuery)
			.select('_id examTitle description examStatus examType classId subjectId batchId teacherId startOn endOn totalMarks durationInMinutes createdAt updatedAt')
			.populate('classId', 'name')
			.populate('subjectId', 'name')
			.populate('batchId', 'batchName')
			.sort(sort)
			.skip(skip)
			.limit(pageSize)
			.lean();

		return {
			exams: exams as unknown as IExam[],
			total,
		};
	} catch (error: any) {
		console.error('Error finding exam logs:', error);
		throw error;
	}
};

// Find quick exam list with limited fields (30 records max)
export const findQuickExamList = async (params: {
	tenantId: string;
	query?: Record<string, any>;
	sort?: Record<string, any>;
}): Promise<IExam[]> => {
	try {
		const { tenantId, query = {}, sort = { createdAt: -1 } } = params;
		const QUICK_LIST_LIMIT = 30;

		// Base query with tenant and not deleted
		const baseQuery: any = {
			tenantId: new mongoose.Types.ObjectId(tenantId),
			isDeleted: false,
		};

		// Merge with provided filters
		const finalQuery = { ...baseQuery, ...query };

		// Get exams with only required fields and populated names
		const exams = await Exam.find(finalQuery)
			.select('_id examTitle examType startOn classId subjectId')
			.populate('classId', 'name')
			.populate('subjectId', 'name')
			.sort(sort)
			.limit(QUICK_LIST_LIMIT)
			.lean();

		return exams as unknown as IExam[];
	} catch (error: any) {
		console.error('Error finding quick exam list:', error);
		throw error;
	}
};

// Update exam by ID
export const updateExamById = async (
	id: string,
	data: UpdateExamRequest,
	session?: mongoose.ClientSession,
): Promise<IExam | null> => {
	try {
		const options: any = { new: true, runValidators: true };
		if (session) {
			options.session = session;
		}
		return await Exam.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ $set: data },
			options,
		);
	} catch (error: any) {
		console.error('Error updating exam:', error);
		throw error;
	}
};

// Soft delete exam by ID
export const softDeleteExamById = async (id: string): Promise<IExam | null> => {
	try {
		return await Exam.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ $set: { isDeleted: true } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error soft deleting exam:', error);
		throw error;
	}
};

// Update exam status
export const updateExamStatus = async (
	id: string,
	status: string,
): Promise<IExam | null> => {
	try {
		if (!ALLOWED_STATUSES.includes(status)) {
			throw new Error('Invalid exam status');
		}
		return await Exam.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ $set: { examStatus: status } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating exam status:', error);
		throw error;
	}
};

// Update exam status and release date
export const updateExamStatusAndReleaseDate = async (
	id: string,
	status: string,
	releasedAt: Date,
): Promise<IExam | null> => {
	try {
		if (!ALLOWED_STATUSES.includes(status)) {
			throw new Error('Invalid exam status');
		}
		return await Exam.findOneAndUpdate(
			{ _id: id, isDeleted: false },
			{ $set: { examStatus: status, releasedAt } },
			{ new: true },
		);
	} catch (error: any) {
		console.error('Error updating exam status and release date:', error);
		throw error;
	}
};

// Get exam statistics
export const getExamStatistics = async (
	tenantId?: string,
	teacherId?: string,
	batchId?: string,
	examModeId?: string,
): Promise<ExamStatistics> => {
	try {
		if (!tenantId) {
			throw new Error('tenantId is required');
		}

		// TypeScript narrowing: after the check, tenantId is guaranteed to be string
		const validTenantId: string = tenantId;

		// Build query - filter by teacherId if provided (for TEACHER role)
		// Otherwise show all exams for the tenant (for ADMIN role)
		const matchQuery: any = {
			isDeleted: false,
			tenantId: validTenantId, // Mongoose will auto-convert string to ObjectId if needed
		};

		// Filter by teacherId if provided (when user is a TEACHER)
		if (teacherId) {
			matchQuery.teacherId = teacherId;
		}

		// Filter by examModeId if provided
		if (examModeId) {
			matchQuery.examModeId = mongoose.Types.ObjectId.isValid(examModeId)
				? new mongoose.Types.ObjectId(examModeId)
				: examModeId;
		}

		// Get batch class IDs if batchId is provided (reused for both matchQuery and average score calculation)
		let batchClassIds: any[] = [];
		if (batchId) {
			const { Class } = await import("../models");
			const classesInBatch = await Class.find({
				batchId: new mongoose.Types.ObjectId(batchId),
				isDeleted: false,
			}).select("_id").lean();

			batchClassIds = classesInBatch.map((cls: any) => cls._id);

			// If no classes in batch, return zeros
			if (batchClassIds.length === 0) {
				return {
					totalExams: 0,
					completed: 0,
					inProgress: 0,
					scheduled: 0,
					draft: 0,
					published: 0,
					released: 0,
					unpublished: 0,
					practiceExamCount: 0,
					officialExamCount: 0,
					overallAverageScore: undefined,
					byType: [],
					byStatus: [],
				};
			}

			// Filter exams by classes in the batch
			matchQuery.classId = { $in: batchClassIds };
		}

		// Get basic counts
		const total = await Exam.countDocuments(matchQuery);
		const completed = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Completed',
		});
		const inProgress = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'In Progress',
		});
		const draft = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Draft',
		});
		const published = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Published',
		});
		const unpublished = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Unpublished',
		});
		const released = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Released',
		});

		// Count scheduled (published but start date is in future)
		const now = new Date();
		const scheduled = await Exam.countDocuments({
			...matchQuery,
			examStatus: 'Published',
			startOn: { $gt: now },
		});

		// Get counts by type
		const byType = await Exam.aggregate([
			{ $match: matchQuery },
			{ $group: { _id: '$examType', count: { $sum: 1 } } },
			{ $project: { type: '$_id', count: 1, _id: 0 } },
		]);

		// Get counts by status
		const byStatus = await Exam.aggregate([
			{ $match: matchQuery },
			{ $group: { _id: '$examStatus', count: { $sum: 1 } } },
			{ $project: { status: '$_id', count: 1, _id: 0 } },
		]);

		// Count practice exams
		const practiceExamCount = await Exam.countDocuments({
			...matchQuery,
			examType: 'Practice',
		});

		// Count official exams
		const officialExamCount = await Exam.countDocuments({
			...matchQuery,
			examType: 'Official',
		});

		// Calculate overall average score from exam_students
		// If teacherId is provided, filter by exams belonging to that teacher
		const averageScoreMatch: any = {
			tenantId: new mongoose.Types.ObjectId(validTenantId),
			status: 'Completed',
			percentage: { $exists: true, $ne: null },
		};

		// Build exam filter for average score calculation
		const examFilterForAverage: any = {
			tenantId: validTenantId,
			isDeleted: false,
		};

		if (teacherId) {
			examFilterForAverage.teacherId = teacherId;
		}

		// Filter by examModeId if provided
		if (examModeId) {
			examFilterForAverage.examModeId = mongoose.Types.ObjectId.isValid(examModeId)
				? new mongoose.Types.ObjectId(examModeId)
				: examModeId;
		}

		// Filter by batchId if provided (reuse batchClassIds from above)
		if (batchId && batchClassIds.length > 0) {
			examFilterForAverage.classId = { $in: batchClassIds };
		}

		// If teacherId, batchId, or examModeId is provided, filter ExamStudent by exams matching the filter
		if (teacherId || batchId || examModeId) {
			// Get all examIds matching the filter
			const filteredExamIds = await Exam.find(examFilterForAverage).distinct('_id');

			// Filter ExamStudent by these examIds
			averageScoreMatch.examId = { $in: filteredExamIds };
		}

		const averageScoreResult = await ExamStudent.aggregate([
			{
				$match: averageScoreMatch,
			},
			{
				$group: {
					_id: null,
					averagePercentage: { $avg: '$percentage' },
				},
			},
		]);

		const overallAverageScore =
			averageScoreResult.length > 0 && averageScoreResult[0].averagePercentage
				? Math.round(averageScoreResult[0].averagePercentage * 100) / 100
				: undefined;

		return {
			totalExams: total,
			completed,
			inProgress,
			scheduled,
			draft,
			published,
			released,
			unpublished,
			practiceExamCount,
			officialExamCount,
			overallAverageScore,
			byType,
			byStatus,
		};
	} catch (error: any) {
		console.error('Error getting exam statistics:', error);
		throw error;
	}
};

// Find exams by teacher
export const findExamsByTeacher = async (
	teacherId: string,
	tenantId: string,
): Promise<IExam[]> => {
	try {
		return await Exam.find({
			teacherId: teacherId,
			tenantId: tenantId,
			isDeleted: false,
		}).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error finding exams by teacher:', error);
		throw error;
	}
};

// Check if exam belongs to teacher
export const checkExamOwnership = async (
	examId: string,
	teacherId: string,
): Promise<boolean> => {
	try {
		const exam = await Exam.findOne({
			_id: examId,
			teacherId: teacherId,
			isDeleted: false,
		});
		return !!exam;
	} catch (error: any) {
		console.error('Error checking exam ownership:', error);
		throw error;
	}
};

// Find exams by IDs
export const findExamsByIds = async (examIds: string[]): Promise<IExam[]> => {
	try {
		return await Exam.find({
			_id: { $in: examIds.map((id) => new mongoose.Types.ObjectId(id)) },
			isDeleted: false,
		}).sort({ createdAt: -1 });
	} catch (error: any) {
		console.error('Error finding exams by IDs:', error);
		throw error;
	}
};

// Find published exams by teacher with filters (for DDL list)
export const findPublishedExamsByTeacher = async (
	teacherId: string,
	tenantId: string,
	filters?: {
		id?: string;
		name?: string;
		classId?: string;
		subjectId?: string;
	},
): Promise<any[]> => {
	try {
		const query: any = {
			teacherId: teacherId,
			tenantId: tenantId,
			examStatus: 'Published',
			isDeleted: false,
		};

		// Apply filters
		if (filters?.id) {
			query._id = new mongoose.Types.ObjectId(filters.id);
		}
		if (filters?.name) {
			query.examTitle = { $regex: filters.name, $options: 'i' };
		}
		if (filters?.classId) {
			query.classId = new mongoose.Types.ObjectId(filters.classId);
		}
		if (filters?.subjectId) {
			query.subjectId = new mongoose.Types.ObjectId(filters.subjectId);
		}

		const exams = await Exam.find(query)
			.select('_id examTitle')
			.sort({ examTitle: 1 }) // Sort by exam title
			.lean();

		// Transform response to return only id and examTitle
		return exams.map((exam: any) => ({
			id: exam._id.toString(),
			examTitle: exam.examTitle,
		}));
	} catch (error: any) {
		console.error('Error finding published exams by teacher:', error);
		throw error;
	}
};

// Get school performance data for a specific month
export const getSchoolPerformanceData = async (params: {
	tenantId: string;
	monthStart: Date;
	monthEnd: Date;
}): Promise<Array<{ subjectId: string; subjectName: string; averagePercentage: number }>> => {
	try {
		const { tenantId, monthStart, monthEnd } = params;

		if (!tenantId) {
			throw new Error('TENANT_ID_REQUIRED');
		}

		// Optimized aggregation pipeline:
		// 1. Start from exam_students
		// 2. Join with exams to filter by month and examType
		// 3. Project percentage (0 if not completed)
		// 4. Group by subjectId and calculate average percentage
		const result = await ExamStudent.aggregate([
			// Stage 1: Match active students in tenant
			{
				$match: {
					tenantId: new mongoose.Types.ObjectId(tenantId),
					isActive: true,
				},
			},
			// Stage 2: Lookup exam to filter by examType, status and date
			{
				$lookup: {
					from: 'exams',
					localField: 'examId',
					foreignField: '_id',
					as: 'exam',
				},
			},
			// Stage 3: Unwind exam
			{
				$unwind: {
					path: '$exam',
					preserveNullAndEmptyArrays: false,
				},
			},
			// Stage 4: Filter by examType, status, grading status and month range
			{
				$match: {
					'exam.examType': 'Official',
					'exam.isDeleted': false,
					'exam.gradingTypeStatus': 'Completed', // Only include fully graded exams
					$or: [
						// Case 1: Use activity-based date (gradedAt) if available
						{ gradedAt: { $gte: monthStart, $lt: monthEnd } },
						// Case 2: Fallback for unattempted/historical data
						{
							$and: [
								{
									$or: [
										{ gradedAt: { $exists: false } },
										{ gradedAt: null },
									],
								},
								{
									'exam.startOn': {
										$gte: monthStart,
										$lt: monthEnd,
									},
								},
							],
						},
					],
				},
			},
			// Stage 5: Project obtained marks and total marks
			{
				$project: {
					subjectId: 1,
					obtainedMarks: {
						$cond: {
							if: { $eq: ['$status', 'Completed'] },
							// Calculate raw obtained marks from percentage: (percentage / 100) * totalMarks
							then: {
								$multiply: [
									{ $divide: [{ $ifNull: ['$percentage', 0] }, 100] },
									'$exam.totalMarks',
								],
							},
							else: 0, // 0 marks if not completed
						},
					},
					totalMarks: '$exam.totalMarks',
				},
			},
			// Stage 6: Group by subjectId and sum obtained and total marks
			{
				$group: {
					_id: '$subjectId',
					totalObtainedMarks: { $sum: '$obtainedMarks' },
					grandTotalPossibleMarks: { $sum: '$totalMarks' },
					subjectId: { $first: '$subjectId' },
				},
			},
			// Stage 7: Lookup subject name
			{
				$lookup: {
					from: 'subjects',
					localField: 'subjectId',
					foreignField: '_id',
					as: 'subject',
				},
			},
			// Stage 8: Unwind subject to get name
			{
				$unwind: {
					path: '$subject',
					preserveNullAndEmptyArrays: true,
				},
			},
			// Stage 9: Project final result with weighted average
			{
				$project: {
					_id: 0,
					subjectId: { $toString: '$_id' },
					subjectName: {
						$ifNull: ['$subject.name', 'Unknown Subject'],
					},
					averagePercentage: {
						$cond: {
							if: { $eq: ['$grandTotalPossibleMarks', 0] },
							then: 0,
							else: {
								$round: [
									{
										$multiply: [
											{
												$divide: [
													'$totalObtainedMarks',
													'$grandTotalPossibleMarks',
												],
											},
											100,
										],
									},
									2,
								],
							},
						},
					},
				},
			},
			// Stage 10: Sort by subject name
			{
				$sort: { subjectName: 1 },
			},
		]);

		return result;
	} catch (error: any) {
		console.error('Error getting school performance data:', error);
		throw error;
	}
};

/**
 * Get exams that just ended and are waiting to be graded
 */
export const findExamsNeedingGrading = async (from: Date, to: Date): Promise<IExam[]> => {
	try {
		const exams = await Exam.find({
			endOn: { $gte: from, $lt: to },
			examStatus: 'Published',
			isDeleted: false,
			gradingTypeStatus: 'Waiting for Grading',
		}).lean();

		return exams as IExam[];
	} catch (error: any) {
		console.error('Error finding exams needing grading:', error);
		throw error;
	}
};

/**
 * Get exams starting within a time range
 */
export const findExamsStartingInWindow = async (from: Date, to: Date): Promise<IExam[]> => {
	try {
		const exams = await Exam.find({
			startOn: { $gte: from, $lt: to },
			examStatus: 'Published',
			isDeleted: false,
		}).lean();

		return exams as IExam[];
	} catch (error: any) {
		console.error('Error finding exams starting in window:', error);
		throw error;
	}
};

/**
 * Get exams ending within a time range
 */
export const findExamsEndingInWindow = async (from: Date, to: Date): Promise<IExam[]> => {
	try {
		const exams = await Exam.find({
			endOn: { $gte: from, $lt: to },
			examStatus: 'Published',
			isDeleted: false,
		}).lean();

		return exams as IExam[];
	} catch (error: any) {
		console.error('Error finding exams ending in window:', error);
		throw error;
	}
};
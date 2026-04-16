import { ContentLibraryContent, IContentLibraryContent } from '../models';
import { ObjectId } from 'mongodb';
import { SortOrder } from 'mongoose';

export class ContentLibraryContentRepository {
	async create(
		data: Partial<IContentLibraryContent>,
	): Promise<IContentLibraryContent> {
		const entity = new ContentLibraryContent(data);
		return await entity.save();
	}

	async findById(
		id: string,
		tenantId: string,
		teacherId: string,
	): Promise<IContentLibraryContent | null> {
		// Use lean() to get plain objects, which makes it easier to add vectorId later
		return await ContentLibraryContent.findOne({
			_id: new ObjectId(id),
			tenantId: new ObjectId(tenantId),
			teacherId: new ObjectId(teacherId),
			isDeleted: false,
		}).lean();
	}

	async findAllByFolder(
		contentLibraryId: string,
		tenantId: string,
		teacherId: string,
		search?: string,
	): Promise<IContentLibraryContent[]> {
		const query: any = {
			contentLibraryId: new ObjectId(contentLibraryId),
			tenantId: new ObjectId(tenantId),
			teacherId: new ObjectId(teacherId),
			isDeleted: false,
		};
		if (search) {
			query.fileName = { $regex: search, $options: 'i' };
		}
		// Use lean() to get plain objects, which makes it easier to add vectorId later
		return await ContentLibraryContent.find(query).lean().sort({ createdAt: -1 });
	}

	async countByFolder(
		contentLibraryId: string,
		tenantId: string,
		teacherId: string,
	): Promise<number> {
		const query: any = {
			contentLibraryId: new ObjectId(contentLibraryId),
			tenantId: new ObjectId(tenantId),
			teacherId: new ObjectId(teacherId),
			isDeleted: false,
		};
		return await ContentLibraryContent.countDocuments(query);
	}

	async updateById(
		id: string,
		tenantId: string,
		teacherId: string,
		update: Partial<IContentLibraryContent>,
	): Promise<IContentLibraryContent | null> {
		return await ContentLibraryContent.findOneAndUpdate(
			{
				_id: new ObjectId(id),
				tenantId: new ObjectId(tenantId),
				teacherId: new ObjectId(teacherId),
				isDeleted: false,
			},
			{ ...update, updatedAt: new Date() },
			{ new: true },
		);
	}

	async deleteById(
		id: string,
		tenantId: string,
		teacherId: string,
	): Promise<IContentLibraryContent | null> {
		return await ContentLibraryContent.findOneAndUpdate(
			{
				_id: new ObjectId(id),
				tenantId: new ObjectId(tenantId),
				teacherId: new ObjectId(teacherId),
				isDeleted: false,
			},
			{ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() },
			{ new: true },
		);
	}

	async updateByContentId(
		contentId: string,
		update: Partial<IContentLibraryContent>,
	): Promise<IContentLibraryContent | null> {
		return await ContentLibraryContent.findOneAndUpdate(
			{
				contentId: contentId,
				isDeleted: false,
			},
			{ ...update, updatedAt: new Date() },
			{ new: true },
		);
	}

	async findAllByAssignedClassIds(
		classIds: string | string[],
		tenantId: string,
		params: {
			pageNo?: number;
			pageSize?: number;
			query?: Record<string, any>;
			sort?: Record<string, SortOrder>;
		},
	): Promise<{
		items: IContentLibraryContent[];
		total: number;
		pageNo: number;
		pageSize: number;
	}> {
		const pageNo = params.pageNo && params.pageNo > 0 ? params.pageNo : 1;
		const pageSize =
			params.pageSize && params.pageSize > 0 ? params.pageSize : 10;
		const skip = (pageNo - 1) * pageSize;

		// Normalize classIds to array for backward compatibility
		const classIdsArray = Array.isArray(classIds) ? classIds : [classIds];

		// Convert classIds to ObjectIds for MongoDB query
		const classObjectIds = classIdsArray.map(id => new ObjectId(id));

		// Build base query - content assigned to any of the classes and not deleted
		// MongoDB $in operator checks if any ObjectId in assignedClassIds array matches
		const baseQuery: any = {
			tenantId: new ObjectId(tenantId),
			assignedClassIds: { $in: classObjectIds },
			isAssigned: true,
			isDeleted: false,
		};

		// Apply subjectId filter (content.subjectId is ObjectId) - preferred over subject name
		const rawQuery = params.query || {};
		if (rawQuery.subjectId) {
			const sid = rawQuery.subjectId?.$eq ?? rawQuery.subjectId;
			const subjectIdStr = typeof sid === 'string' ? sid : (sid?.toString?.() ?? '');
			if (subjectIdStr && ObjectId.isValid(subjectIdStr)) {
				baseQuery.subjectId = new ObjectId(subjectIdStr);
			}
		}

		// Apply subject filter (content.subject is string name) only when subjectId not used
		if (rawQuery.subject && !baseQuery.subjectId) {
			const sub = rawQuery.subject?.$eq ?? rawQuery.subject;
			if (typeof sub === 'string' && sub.trim() !== '') {
				baseQuery.subject = sub.trim();
			}
		}

		// Merge with other filters (exclude subjectId/subject so baseQuery wins)
		const { subjectId, subject, ...restQuery } = rawQuery;
		const query = Object.keys(restQuery).length > 0
			? { ...restQuery, ...baseQuery }
			: baseQuery;

		// Debug: Log the final query
		console.log("🔍 [REPOSITORY] Final MongoDB query:", JSON.stringify(query, null, 2));

		const hasSort = params.sort && Object.keys(params.sort).length > 0;
		const sort: Record<string, SortOrder> = hasSort
			? params.sort!
			: ({ createdAt: -1 } as Record<string, SortOrder>);

		// Convert SortOrder to MongoDB format (1 or -1)
		const mongoSort: Record<string, 1 | -1> = {};
		Object.keys(sort).forEach((key) => {
			const value = sort[key];
			if (value === 1 || value === -1) {
				mongoSort[key] = value;
			} else if (value === "asc" || value === "ascending") {
				mongoSort[key] = 1;
			} else if (value === "desc" || value === "descending") {
				mongoSort[key] = -1;
			} else {
				mongoSort[key] = -1; // Default to descending
			}
		});

		// Query with deduplication: use aggregation to avoid duplicate content
		// if same content is assigned to multiple classes
		// This is more efficient than fetching all and filtering in memory
		const [itemsResult, totalResult] = await Promise.all([
			// Get distinct items with pagination
			ContentLibraryContent.aggregate([
				{ $match: query },
				{ $sort: mongoSort },
				{ $group: { _id: "$_id", doc: { $first: "$$ROOT" } } },
				{ $replaceRoot: { newRoot: "$doc" } },
				{ $sort: mongoSort }, // Re-sort after grouping
				{ $skip: skip },
				{ $limit: pageSize },
			]),
			// Count distinct items for accurate total
			ContentLibraryContent.aggregate([
				{ $match: query },
				{ $group: { _id: "$_id" } },
				{ $count: "total" }
			]),
		]);

		// Convert aggregation results to lean format
		const items = itemsResult.map((item: any) => {
			// Convert _id if it's an ObjectId
			if (item._id && typeof item._id === 'object') {
				item._id = item._id.toString();
			}
			return item;
		});

		const total = totalResult[0]?.total || 0;

		return { items, total, pageNo, pageSize };
	}

	/**
	 * Get aggregated stats for assigned content (by subject and file type).
	 * Deduplicates content that is assigned to multiple classes.
	 * When studentId is provided, includes unreadCount per subject and totalUnread (from student_content_reads).
	 */
	async getAssignedContentStats(
		classIds: string[],
		tenantId: string,
		params?: { query?: Record<string, unknown>; studentId?: string }
	): Promise<{
		total: number;
		totalUnread?: number;
		bySubject: Array<{
			subjectId: string;
			subjectName: string | null;
			count: number;
			unreadCount?: number;
			totalSizeInBytes: number;
			teachers: Array<{ id: string; name: string }>;
			byFileType: {
				pdf: number;
				doc: number;
				ppt: number;
				other: { images: number; txt: number; md: number; all: number };
			};
		}>;
		byFileType: {
			pdf: number;
			doc: number;
			ppt: number;
			other: { images: number; txt: number; md: number; all: number };
		};
	}> {
		const emptyOther = { images: 0, txt: 0, md: 0, all: 0 };
		if (!classIds.length) {
			return { total: 0, bySubject: [], byFileType: { pdf: 0, doc: 0, ppt: 0, other: emptyOther } };
		}

		const classObjectIds = classIds.map((id) => new ObjectId(id));
		const baseQuery: Record<string, unknown> = {
			tenantId: new ObjectId(tenantId),
			assignedClassIds: { $in: classObjectIds },
			isAssigned: true,
			isDeleted: false,
		};

		const rawQuery = params?.query || {};
		if (rawQuery.subjectId) {
			const sid = (rawQuery.subjectId as { $eq?: unknown })?.$eq ?? rawQuery.subjectId;
			const subjectIdStr = typeof sid === "string" ? sid : (sid as { toString?: () => string })?.toString?.() ?? "";
			if (subjectIdStr && ObjectId.isValid(subjectIdStr)) {
				(baseQuery as any).subjectId = new ObjectId(subjectIdStr);
			}
		}
		if (rawQuery.subject && !(baseQuery as any).subjectId) {
			const sub = (rawQuery.subject as { $eq?: string })?.$eq ?? rawQuery.subject;
			if (typeof sub === "string" && sub.trim() !== "") {
				(baseQuery as any).subject = sub.trim();
			}
		}

		const studentId = params?.studentId;
		const tenantObjId = new ObjectId(tenantId);

		// Add ft and ext first (lowercase fileType and extension from fileName), then category in a second stage so $ft and $ext are available.
		const addFtAndExt = {
			ft: { $toLower: { $ifNull: ["$fileType", ""] } },
			ext: { $toLower: { $arrayElemAt: [{ $split: [{ $ifNull: ["$fileName", ""] }, "."] }, -1] } },
		};
		// Category uses $ft and $ext from previous stage. Extension fallback when MIME is wrong/missing.
		const addCategory = {
			category: {
				$switch: {
					branches: [
						{ case: { $gte: [{ $indexOfBytes: ["$ft", "pdf"] }, 0] }, then: "pdf" },
						{ case: { $gte: [{ $indexOfBytes: ["$ft", "word"] }, 0] }, then: "doc" },
						{ case: { $gte: [{ $indexOfBytes: ["$ft", "msword"] }, 0] }, then: "doc" },
						{ case: { $gte: [{ $indexOfBytes: ["$ft", "presentation"] }, 0] }, then: "ppt" },
						{ case: { $gte: [{ $indexOfBytes: ["$ft", "powerpoint"] }, 0] }, then: "ppt" },
						{ case: { $or: [{ $eq: [{ $indexOfBytes: ["$ft", "image"] }, 0] }, { $in: ["$ext", ["png", "jpg", "jpeg", "tiff", "bmp", "gif", "webp"]] }] }, then: "other_image" },
						{ case: { $or: [{ $eq: [{ $indexOfBytes: ["$ft", "text/plain"] }, 0] }, { $eq: ["$ext", "txt"] }] }, then: "other_txt" },
						{ case: { $or: [{ $gte: [{ $indexOfBytes: ["$ft", "markdown"] }, 0] }, { $eq: ["$ext", "md"] }] }, then: "other_md" },
					],
					default: "other",
				},
			},
		};
		// Pipeline up to dedupe + category (and optional read lookup). Carry teacherId, fileSizeInBytes, fileName for per-subject stats.
		const afterGroup: any[] = [
			{
				$group: {
					_id: "$_id",
					subjectId: { $first: "$subjectId" },
					subject: { $first: "$subject" },
					fileType: { $first: "$fileType" },
					fileName: { $first: "$fileName" },
					tenantId: { $first: "$tenantId" },
					teacherId: { $first: "$teacherId" },
					fileSizeInBytes: { $first: "$fileSizeInBytes" },
				},
			},
			{ $addFields: addFtAndExt },
			{ $addFields: addCategory },
		];
		if (studentId) {
			afterGroup.push({
				$lookup: {
					from: "student_content_reads",
					let: { contentId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$contentId", "$$contentId"] },
										{ $eq: ["$studentId", new ObjectId(studentId)] },
										{ $eq: ["$tenantId", tenantObjId] },
									],
								},
							},
						},
						{ $limit: 1 },
						{ $project: { _id: 1 } },
					],
					as: "readRecord",
				},
			});
			afterGroup.push({ $addFields: { isRead: { $gt: [{ $size: "$readRecord" }, 0] } } });
		}

		const totalStage = studentId
			? [{ $group: { _id: null, count: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } } } }]
			: [{ $count: "count" }];

		const bySubjectPipeline: any[] = [
			{
				$lookup: {
					from: "subjects",
					let: { tenantId: "$tenantId", subjectName: "$subject" },
					pipeline: [
						{ $match: { $expr: { $and: [{ $eq: ["$tenantId", "$$tenantId"] }, { $eq: ["$name", "$$subjectName"] }] } } },
						{ $limit: 1 },
						{ $project: { _id: 1 } },
					],
					as: "subjResolved",
				},
			},
			{ $addFields: { resolvedSubjectId: { $ifNull: ["$subjectId", { $arrayElemAt: ["$subjResolved._id", 0] }] } } },
			{
				$group: {
					_id: "$resolvedSubjectId",
					subjectName: { $first: "$subject" },
					count: { $sum: 1 },
					totalSizeInBytes: { $sum: { $ifNull: ["$fileSizeInBytes", 0] } },
					teacherIds: { $addToSet: "$teacherId" },
					...(studentId ? { unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } } } : {}),
					pdf: { $sum: { $cond: [{ $eq: ["$category", "pdf"] }, 1, 0] } },
					doc: { $sum: { $cond: [{ $eq: ["$category", "doc"] }, 1, 0] } },
					ppt: { $sum: { $cond: [{ $eq: ["$category", "ppt"] }, 1, 0] } },
					other_image: { $sum: { $cond: [{ $eq: ["$category", "other_image"] }, 1, 0] } },
					other_txt: { $sum: { $cond: [{ $eq: ["$category", "other_txt"] }, 1, 0] } },
					other_md: { $sum: { $cond: [{ $eq: ["$category", "other_md"] }, 1, 0] } },
					other_rest: { $sum: { $cond: [{ $eq: ["$category", "other"] }, 1, 0] } },
				},
			},
			{ $match: { _id: { $ne: null } } },
			{ $sort: { _id: 1 } }, // deterministic order so subject cards don't jump on every request
			{ $lookup: { from: "subjects", localField: "_id", foreignField: "_id", as: "subj" } },
			{
				$lookup: {
					from: "teachers",
					let: { teacherIds: "$teacherIds" },
					pipeline: [
						{ $match: { $expr: { $in: ["$_id", "$$teacherIds"] } } },
						{ $project: { _id: 1, firstName: 1, lastName: 1 } },
					],
					as: "teacherDocs",
				},
			},
			{
				$addFields: {
					teachers: {
						$map: {
							input: "$teacherDocs",
							as: "t",
							in: {
								id: { $toString: "$$t._id" },
								name: {
									$trim: {
										input: {
											$concat: [
												{ $ifNull: ["$$t.firstName", ""] },
												" ",
												{ $ifNull: ["$$t.lastName", ""] },
											],
										},
									},
								},
							},
						},
					},
				},
			},
			{
				$project: {
					subjectId: { $toString: "$_id" },
					subjectName: { $cond: [{ $gt: [{ $size: "$subj" }, 0] }, { $arrayElemAt: ["$subj.name", 0] }, "$subjectName"] },
					count: 1,
					totalSizeInBytes: 1,
					teachers: 1,
					...(studentId ? { unreadCount: "$unread" } : {}),
					byFileType: {
						pdf: "$pdf",
						doc: "$doc",
						ppt: "$ppt",
						other: {
							images: "$other_image",
							txt: "$other_txt",
							md: "$other_md",
							all: { $add: ["$other_image", "$other_txt", "$other_md", "$other_rest"] },
						},
					},
					_id: 0,
				},
			},
		];

		const result = await ContentLibraryContent.aggregate([
			{ $match: baseQuery },
			...afterGroup,
			{
				$facet: {
					total: totalStage,
					bySubject: bySubjectPipeline,
					byFileType: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
				},
			},
		]);

		const totalDoc = result[0]?.total?.[0];
		const total = studentId ? (totalDoc?.count ?? 0) : (totalDoc?.count ?? 0);
		const totalUnread = studentId ? (totalDoc?.unread ?? 0) : undefined;
		const bySubjectRaw = result[0]?.bySubject ?? [];
		const byFileTypeRaw = result[0]?.byFileType ?? [];

		const defaultOther = { images: 0, txt: 0, md: 0, all: 0 };
		const bySubject = bySubjectRaw.map((s: {
			subjectId: string;
			subjectName: string | null;
			count: number;
			unreadCount?: number;
			totalSizeInBytes?: number;
			teachers?: Array<{ id: string; name: string }>;
			byFileType?: {
				pdf: number;
				doc: number;
				ppt: number;
				other: { images: number; txt: number; md: number; all: number };
			};
		}) => ({
			subjectId: s.subjectId,
			subjectName: s.subjectName ?? null,
			count: s.count,
			...(s.unreadCount !== undefined && { unreadCount: s.unreadCount }),
			totalSizeInBytes: s.totalSizeInBytes ?? 0,
			teachers: s.teachers ?? [],
			byFileType: s.byFileType ?? { pdf: 0, doc: 0, ppt: 0, other: defaultOther },
		}));

		const byFileType: {
			pdf: number;
			doc: number;
			ppt: number;
			other: { images: number; txt: number; md: number; all: number };
		} = { pdf: 0, doc: 0, ppt: 0, other: { images: 0, txt: 0, md: 0, all: 0 } };
		const otherCounts = { images: 0, txt: 0, md: 0, rest: 0 };
		for (const t of byFileTypeRaw) {
			const key = t._id as string;
			const count = t.count as number;
			if (key === "pdf" || key === "doc" || key === "ppt") {
				byFileType[key] = count;
			} else if (key === "other_image") otherCounts.images = count;
			else if (key === "other_txt") otherCounts.txt = count;
			else if (key === "other_md") otherCounts.md = count;
			else if (key === "other") otherCounts.rest = count;
		}
		byFileType.other = {
			images: otherCounts.images,
			txt: otherCounts.txt,
			md: otherCounts.md,
			all: otherCounts.images + otherCounts.txt + otherCounts.md + otherCounts.rest,
		};

		return { total, ...(totalUnread !== undefined && { totalUnread }), bySubject, byFileType };
	}
}

import {
	ContentLibrary,
	IContentLibrary,
} from '../models/contentLibrary.schema';
import { ObjectId } from 'mongodb';
import { SortOrder } from 'mongoose';

export class ContentLibraryRepository {
	async create(data: Partial<IContentLibrary>): Promise<IContentLibrary> {
		const entity = new ContentLibrary(data);
		return await entity.save();
	}

	async findById(
		id: string,
		tenantId: string,
		teacherId: string,
	): Promise<IContentLibrary | null> {
		return await ContentLibrary.findOne({
			_id: new ObjectId(id),
			tenantId: new ObjectId(tenantId),
			teacherId: new ObjectId(teacherId),
			isDeleted: false,
		});
	}

	async findAllPaged(
		tenantId: string,
		teacherId: string,
		params: {
			pageNo?: number;
			pageSize?: number;
			query?: Record<string, any>;
			sort?: Record<string, SortOrder>;
		},
	): Promise<{
		items: IContentLibrary[];
		total: number;
		pageNo: number;
		pageSize: number;
	}> {
		const pageNo = params.pageNo && params.pageNo > 0 ? params.pageNo : 1;
		const pageSize =
			params.pageSize && params.pageSize > 0 ? params.pageSize : 10;
		const skip = (pageNo - 1) * pageSize;

		// Build base query with tenant, teacher, and soft delete check
		const query: any = {
			tenantId: new ObjectId(tenantId),
			teacherId: new ObjectId(teacherId),
			isDeleted: false,
		};

		// Merge with filter query from buildQuery helper
		if (params.query) {
			Object.assign(query, params.query);
		}

		// Determine sort order - use provided sort or default to createdAt desc
		const hasSort = params.sort && Object.keys(params.sort).length > 0;
		const sort: Record<string, SortOrder> = hasSort
			? params.sort!
			: ({ createdAt: -1 } as Record<string, SortOrder>);

		const [items, total] = await Promise.all([
			ContentLibrary.find(query).sort(sort).skip(skip).limit(pageSize),
			ContentLibrary.countDocuments(query),
		]);

		return { items, total, pageNo, pageSize };
	}

	async updateById(
		id: string,
		tenantId: string,
		teacherId: string,
		update: Partial<IContentLibrary>,
	): Promise<IContentLibrary | null> {
		return await ContentLibrary.findOneAndUpdate(
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
	): Promise<IContentLibrary | null> {
		return await ContentLibrary.findOneAndUpdate(
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
}

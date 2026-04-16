import * as parentChildRepository from '../repositories/parentChild.repository';
import { IParentChild } from '@/models';
import mongoose from 'mongoose';
import { STATUS } from '../utils/constants/status.constants';

/**
 * Parent-Child Relationship Service - Business logic for parent-child relationships
 * Handles parent-child relationship operations
 */

// Create parent-child relationship
export const createParentChildRelationship = async (
	parentId: string,
	childId: string,
	relationship: 'father' | 'mother' | 'guardian' | 'other',
	tenantId: string,
	tenantName?: string,
	isPrimary: boolean = false,
	notes?: string,
) => {
	try {
		// Check if relationship already exists
		const existingRelationship =
			await parentChildRepository.findParentChildRelationship(
				parentId,
				childId,
			);

		if (existingRelationship) {
			throw new Error('Parent-child relationship already exists');
		}

		const relationshipData = {
			parentId: new mongoose.Types.ObjectId(parentId),
			childId: new mongoose.Types.ObjectId(childId),
			relationship,
			isPrimary,
			notes: notes || '',
			status: STATUS.ACTIVE,
			tenantId,
			tenantName: tenantName || 'Default School',
			createdBy: 'academy-api',
			isActive: true,
			isDeleted: false,
		};

		const parentChild =
			await parentChildRepository.createParentChildRelationship(
				relationshipData,
			);

		return {
			success: true,
			message: 'Parent-child relationship created successfully',
			data: parentChild,
		};
	} catch (error: any) {
		console.error('Create parent-child relationship error:', error);
		throw new Error(
			`Failed to create parent-child relationship: ${error.message}`,
		);
	}
};

// Get children by parent ID
export const getChildrenByParentId = async (parentId: string) => {
	try {
		const children = await parentChildRepository.findChildrenByParentId(
			parentId,
		);
		return {
			success: true,
			message: 'Children retrieved successfully',
			data: children,
		};
	} catch (error: any) {
		console.error('Get children by parent ID error:', error);
		throw new Error(`Failed to get children: ${error.message}`);
	}
};

// Get parents by child ID
export const getParentsByChildId = async (childId: string) => {
	try {
		const parents = await parentChildRepository.findParentsByChildId(childId);
		return {
			success: true,
			message: 'Parents retrieved successfully',
			data: parents,
		};
	} catch (error: any) {
		console.error('Get parents by child ID error:', error);
		throw new Error(`Failed to get parents: ${error.message}`);
	}
};

// Update parent-child relationship
export const updateParentChildRelationship = async (
	relationshipId: string,
	updateData: Partial<IParentChild>,
) => {
	try {
		const relationship =
			await parentChildRepository.updateParentChildRelationship(
				relationshipId,
				updateData,
			);

		if (!relationship) {
			throw new Error('Parent-child relationship not found');
		}

		return {
			success: true,
			message: 'Parent-child relationship updated successfully',
			data: relationship,
		};
	} catch (error: any) {
		console.error('Update parent-child relationship error:', error);
		throw new Error(
			`Failed to update parent-child relationship: ${error.message}`,
		);
	}
};

// Delete parent-child relationship
export const deleteParentChildRelationship = async (relationshipId: string) => {
	try {
		const relationship =
			await parentChildRepository.softDeleteParentChildRelationship(
				relationshipId,
			);

		if (!relationship) {
			throw new Error('Parent-child relationship not found');
		}

		return {
			success: true,
			message: 'Parent-child relationship deleted successfully',
			data: relationship,
		};
	} catch (error: any) {
		console.error('Delete parent-child relationship error:', error);
		throw new Error(
			`Failed to delete parent-child relationship: ${error.message}`,
		);
	}
};

// Set primary parent for a child
export const setPrimaryParent = async (childId: string, parentId: string) => {
	try {
		// First, remove primary status from all parents of this child
		await parentChildRepository.removePrimaryStatusFromChild(childId);

		// Then set the specified parent as primary
		const relationship = await parentChildRepository.setPrimaryParent(
			childId,
			parentId,
		);

		if (!relationship) {
			throw new Error('Parent-child relationship not found');
		}

		return {
			success: true,
			message: 'Primary parent set successfully',
			data: relationship,
		};
	} catch (error: any) {
		console.error('Set primary parent error:', error);
		throw new Error(`Failed to set primary parent: ${error.message}`);
	}
};

// Get parent-child relationship statistics
export const getParentChildStatistics = async (tenantId?: string) => {
	try {
		const stats = await parentChildRepository.getParentChildStatistics(
			tenantId,
		);
		return {
			success: true,
			data: stats,
		};
	} catch (error: any) {
		console.error('Get parent-child statistics error:', error);
		throw error;
	}
};

// Get child's subjects with assigned teachers
export const getChildSubjectsWithTeachers = async (
	childId: string,
	tenantId?: string,
) => {
	try {
		const subjectsWithTeachers =
			await parentChildRepository.getChildSubjectsWithTeachers(
				childId,
				tenantId,
			);
		return subjectsWithTeachers;
	} catch (error: any) {
		console.error('Error getting child subjects with teachers:', error);
		throw error;
	}
};

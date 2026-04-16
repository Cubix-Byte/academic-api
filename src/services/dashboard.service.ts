import { DashboardStatistics } from '@/types/dashboard.types';
import * as dashboardRepository from '../repositories/dashboard.repository';

/**
 * Dashboard Service - Business logic for Dashboard statistics
 */

// Get dashboard statistics
export const getDashboardStatistics = async (
	tenantId: string,
): Promise<DashboardStatistics> => {
	try {
		return await dashboardRepository.getDashboardStatistics(tenantId);
	} catch (error: any) {
		console.error('Error getting dashboard statistics:', error);
		throw error;
	}
};


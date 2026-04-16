import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../../services/dashboard.service';
import { sendSuccessResponse, sendErrorResponse, HttpStatusCodes } from 'shared-lib';

/**
 * Dashboard Controller - Handles dashboard statistics requests
 */

// Get dashboard statistics
export const getDashboardStatistics = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const tenantId = req.user?.tenantId;

		if (!tenantId) {
			return sendErrorResponse(
				res,
				'Tenant ID is required',
				HttpStatusCodes.BAD_REQUEST,
			);
		}

		const result = await dashboardService.getDashboardStatistics(tenantId);
		return sendSuccessResponse(
			res,
			'Dashboard statistics retrieved successfully',
			result,
		);
	} catch (error) {
		next(error);
	}
};


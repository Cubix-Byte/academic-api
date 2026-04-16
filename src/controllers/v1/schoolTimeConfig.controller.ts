import { Request, Response } from 'express';
import { TenantTimetableConfigService } from '../../services/schoolTimeConfig.service';

export class TenantTimetableConfigController {

    /**
     * GET /api/v1/school-time-configs
     */
    static async getConfig(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user?.tenantId;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: Missing tenant ID' });
            }

            const config = await TenantTimetableConfigService.getConfigByTenantId(tenantId);
            if (!config) {
                // No configuration found for this tenant: return OK with a "no data" message
                return res.status(200).json({
                    success: false,
                    message: 'No tenant timetable configuration available',
                    data: null
                });
            }

            return res.status(200).json({ success: true, data: config });
        } catch (error: any) {
            console.error('Error fetching TenantTimetableConfig:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
        }
    }

    /**
     * POST /api/v1/school-time-configs
     */
    static async createTimeTableConfig(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user?.tenantId;
            const role = (req as any).user?.roleName || (req as any).user?.role;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: Missing tenant ID' });
            }
            if (role !== 'PRIMARYADMIN' && role !== 'primaryadmin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Only primaryadmin can modify tenant timetable configurations' });
            }

            const config = await TenantTimetableConfigService.createConfig(tenantId, req.body);
            return res.status(201).json({
                success: true,
                message: 'Tenant timetable configuration created successfully',
                data: config
            });
        } catch (error: any) {
            console.error('Error creating TenantTimetableConfig:', error);
            if (error.message.includes('already exists')) {
                return res.status(409).json({ success: false, message: error.message });
            }
            return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
        }
    }

    /**
     * PUT /api/v1/school-time-configs/update-school-time-configs
     */
    static async updateTimeTableConfig(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user?.tenantId;
            const role = (req as any).user?.roleName || (req as any).user?.role;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: Missing tenant ID' });
            }
            if (role !== 'PRIMARYADMIN' && role !== 'primaryadmin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Only primaryadmin can modify tenant timetable configurations' });
            }

            const config = await TenantTimetableConfigService.updateConfig(tenantId, req.body);
            return res.status(200).json({
                success: true,
                message: 'Tenant timetable configuration updated successfully',
                data: config
            });
        } catch (error: any) {
            console.error('Error updating TenantTimetableConfig:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
        }
    }

    /**
     * DELETE /api/v1/school-time-configs
     */
    static async deleteConfig(req: Request, res: Response) {
        try {
            const tenantId = (req as any).user?.tenantId;
            const role = (req as any).user?.roleName || (req as any).user?.role;
            if (!tenantId) {
                return res.status(401).json({ success: false, message: 'Unauthorized: Missing tenant ID' });
            }
            if (role !== 'PRIMARYADMIN' && role !== 'primaryadmin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Only primaryadmin can modify tenant timetable configurations' });
            }

            const deletedConfig = await TenantTimetableConfigService.deleteConfig(tenantId);
            if (!deletedConfig) {
                return res.status(404).json({ success: false, message: 'Tenant timetable configuration not found' });
            }

            return res.status(200).json({ success: true, message: 'Tenant timetable configuration deleted successfully' });
        } catch (error: any) {
            console.error('Error deleting TenantTimetableConfig:', error);
            return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
        }
    }
}

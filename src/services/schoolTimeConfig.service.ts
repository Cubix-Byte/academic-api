import mongoose from 'mongoose';
import { TenantTimetableConfig } from '../models/schoolTimeConfig.schema';

export class TenantTimetableConfigService {
    /**
     * Retrieves the school time configuration for a given tenant.
     * @param tenantId The tenant's Object ID
     */
    static async getConfigByTenantId(tenantId: string | mongoose.Types.ObjectId) {
        return await TenantTimetableConfig.findOne({ tenantId });
    }

    /**
     * Creates a new configuration for the given tenant. Throws an error if one already exists.
     * @param tenantId The tenant's Object ID
     * @param data The validated payload data
     */
    static async createConfig(tenantId: string | mongoose.Types.ObjectId, data: any) {
        const existingConfig = await this.getConfigByTenantId(tenantId);
        if (existingConfig) {
            throw new Error('Tenant timetable configuration already exists. Please use the update endpoint instead.');
        }

        const newConfig = new TenantTimetableConfig({ ...data, tenantId });
        return await newConfig.save();
    }

    /**
     * Updates an existing configuration for the given tenant.
     * @param tenantId The tenant's Object ID
     * @param data The validated payload data
     */
    static async updateConfig(tenantId: string | mongoose.Types.ObjectId, data: any) {
        const existingConfig = await this.getConfigByTenantId(tenantId);
        if (!existingConfig) {
            throw new Error('Tenant timetable configuration not found. Please create one first.');
        }

        return await TenantTimetableConfig.findOneAndUpdate(
            { tenantId },
            { ...data, tenantId },
            { new: true, runValidators: true }
        );
    }

    /**
     * Deletes the school time configuration for a given tenant.
     * @param tenantId The tenant's Object ID
     */
    static async deleteConfig(tenantId: string | mongoose.Types.ObjectId) {
        return await TenantTimetableConfig.findOneAndDelete({ tenantId });
    }
}

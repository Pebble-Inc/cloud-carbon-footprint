/*
 * © 2023 Thoughtworks, Inc.
 */

import {
  ITenantConfig,
  TenantConfig,
  validateTenantConfig,
  Logger,
} from '@cloud-carbon-footprint/common'

export class TenantConfigService {
  private readonly logger: Logger

  constructor() {
    this.logger = new Logger('TenantConfigService')
  }

  async createConfig(config: Partial<ITenantConfig>): Promise<ITenantConfig> {
    try {
      validateTenantConfig(config)
      const tenantConfig = new TenantConfig(config)
      const savedConfig = await tenantConfig.save()
      this.logger.info(`Created configuration for tenant: ${config.tenantId}`)
      return savedConfig.toObject()
    } catch (error) {
      this.logger.error('Error creating tenant configuration:', error)
      throw error
    }
  }

  async getConfig(tenantId: string): Promise<ITenantConfig | null> {
    try {
      const config = await TenantConfig.findOne({ tenantId }).lean()
      if (!config) {
        this.logger.warn(`No configuration found for tenant: ${tenantId}`)
        return null
      }
      return config
    } catch (error) {
      this.logger.error('Error fetching tenant configuration:', error)
      throw error
    }
  }

  async updateConfig(
    tenantId: string,
    config: Partial<ITenantConfig>,
  ): Promise<ITenantConfig | null> {
    try {
      const updatedConfig = await TenantConfig.findOneAndUpdate(
        { tenantId },
        { ...config, updatedAt: new Date() },
        { new: true, lean: true },
      )

      if (updatedConfig) {
        this.logger.info(`Updated configuration for tenant: ${tenantId}`)
        return updatedConfig
      }
      return null
    } catch (error) {
      this.logger.error('Error updating tenant configuration:', error)
      throw error
    }
  }

  async deleteConfig(tenantId: string): Promise<boolean> {
    try {
      const result = await TenantConfig.deleteOne({ tenantId })
      const deleted = result.deletedCount > 0

      if (deleted) {
        this.logger.info(`Deleted configuration for tenant: ${tenantId}`)
      }
      return deleted
    } catch (error) {
      this.logger.error('Error deleting tenant configuration:', error)
      throw error
    }
  }

  async listConfigs(filters?: { tenantId?: string }): Promise<ITenantConfig[]> {
    try {
      const configs = await TenantConfig.find(filters || {}).lean()
      return configs
    } catch (error) {
      this.logger.error('Error listing tenant configurations:', error)
      throw error
    }
  }
}

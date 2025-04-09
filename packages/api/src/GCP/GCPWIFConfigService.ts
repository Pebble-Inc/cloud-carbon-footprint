/*
 * © 2024 Thoughtworks, Inc.
 */

import { Logger } from '@cloud-carbon-footprint/common'
import { IGCPWIFConfig, GCPWIFConfig } from './IGCPWIFConfig'

export default class GCPWIFConfigService {
  private readonly logger: Logger

  constructor() {
    this.logger = new Logger('GCPWIFConfigService')
  }

  async createConfig(config: Partial<IGCPWIFConfig>): Promise<IGCPWIFConfig> {
    try {
      const gcpWIFConfig = new GCPWIFConfig(config)
      const savedConfig = await gcpWIFConfig.save()
      this.logger.info(`Created GCP WIF configuration for tenant: ${config.tenantId}`)
      return savedConfig.toObject()
    } catch (error) {
      this.logger.error('Error creating GCP WIF configuration:', error)
      throw error
    }
  }

  async getConfig(configId: string): Promise<IGCPWIFConfig | null> {
    try {
      const config = await GCPWIFConfig.findOne({ configId }).lean()
      if (!config) {
        this.logger.warn(`No GCP WIF configuration found for configId: ${configId}`)
        return null
      }
      return config
    } catch (error) {
      this.logger.error('Error fetching GCP WIF configuration:', error)
      throw error
    }
  }

  async getConfigsByTenantId(tenantId: string): Promise<IGCPWIFConfig[]> {
    try {
      const configs = await GCPWIFConfig.find({ tenantId }).lean()
      return configs
    } catch (error) {
      this.logger.error('Error fetching GCP WIF configurations:', error)
      throw error
    }
  }

  async updateConfig(
    configId: string,
    config: Partial<IGCPWIFConfig>,
  ): Promise<IGCPWIFConfig | null> {
    try {
      const updatedConfig = await GCPWIFConfig.findOneAndUpdate(
        { configId },
        { ...config, updatedAt: new Date() },
        { new: true, lean: true },
      )

      if (updatedConfig) {
        this.logger.info(`Updated GCP WIF configuration for configId: ${configId}`)
        return updatedConfig
      }
      return null
    } catch (error) {
      this.logger.error('Error updating GCP WIF configuration:', error)
      throw error
    }
  }

  async deleteConfig(configId: string): Promise<boolean> {
    try {
      const result = await GCPWIFConfig.deleteOne({ configId })
      const deleted = result.deletedCount > 0

      if (deleted) {
        this.logger.info(`Deleted GCP WIF configuration for configId: ${configId}`)
      }
      return deleted
    } catch (error) {
      this.logger.error('Error deleting GCP WIF configuration:', error)
      throw error
    }
  }
} 
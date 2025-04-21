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

  private validateWIFConfig(config: Partial<IGCPWIFConfig>): void {
    if (!config.config) {
      throw new Error('WIF config is required')
    }

    const requiredFields = [
      'universe_domain',
      'type',
      'audience',
      'subject_token_type',
      'service_account_impersonation_url',
      'token_url',
    ]

    const missingFields = requiredFields.filter(
      (field) => !config.config[field],
    )

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required WIF config fields: ${missingFields.join(', ')}`,
      )
    }

    if (!config.config.credential_source) {
      throw new Error('credential_source is required in WIF config')
    }

    const requiredCredentialSourceFields = [
      'environment_id',
      'region_url',
      'url',
      'regional_cred_verification_url',
    ]

    const missingCredentialSourceFields = requiredCredentialSourceFields.filter(
      (field) => !config.config.credential_source[field],
    )

    if (missingCredentialSourceFields.length > 0) {
      throw new Error(
        `Missing required credential_source fields: ${missingCredentialSourceFields.join(
          ', ',
        )}`,
      )
    }
  }

  async createConfig(config: Partial<IGCPWIFConfig>): Promise<IGCPWIFConfig> {
    try {
      this.validateWIFConfig(config)
      const gcpWIFConfig = new GCPWIFConfig(config)
      const savedConfig = await gcpWIFConfig.save()
      this.logger.info(
        `Created GCP WIF configuration for tenant: ${config.tenantId}`,
      )
      return savedConfig.toObject()
    } catch (error) {
      this.logger.error('Error creating GCP WIF configuration:', error)
      throw error
    }
  }

  async getConfig(wifConfigId: string): Promise<IGCPWIFConfig | null> {
    try {
      const config = await GCPWIFConfig.findOne({ wifConfigId }).lean()
      if (!config) {
        this.logger.warn(
          `No GCP WIF configuration found for wifConfigId: ${wifConfigId}`,
        )
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
    wifConfigId: string,
    config: Partial<IGCPWIFConfig>,
  ): Promise<IGCPWIFConfig | null> {
    try {
      this.validateWIFConfig(config)
      const updatedConfig = await GCPWIFConfig.findOneAndUpdate(
        { wifConfigId },
        { ...config, updatedAt: new Date() },
        { new: true, lean: true },
      )

      if (updatedConfig) {
        this.logger.info(
          `Updated GCP WIF configuration for wifConfigId: ${wifConfigId}`,
        )
        return updatedConfig
      }
      return null
    } catch (error) {
      this.logger.error('Error updating GCP WIF configuration:', error)
      throw error
    }
  }

  async deleteConfig(wifConfigId: string): Promise<boolean> {
    try {
      const result = await GCPWIFConfig.deleteOne({ wifConfigId })
      const deleted = result.deletedCount > 0

      if (deleted) {
        this.logger.info(
          `Deleted GCP WIF configuration for wifConfigId: ${wifConfigId}`,
        )
      }
      return deleted
    } catch (error) {
      this.logger.error('Error deleting GCP WIF configuration:', error)
      throw error
    }
  }
}

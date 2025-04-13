/*
 * © 2024 Thoughtworks, Inc.
 */

import { GoogleAuth } from 'google-auth-library'
import { GoogleAuthClient } from '@cloud-carbon-footprint/common'
import { Logger } from '@cloud-carbon-footprint/common'
import GCPWIFConfigService from './GCPWIFConfigService'
import { IGCPWIFConfig } from './IGCPWIFConfig'

export default class FalconGCPAuthService {
  private readonly logger: Logger
  private readonly gcpWIFConfigService: GCPWIFConfigService

  constructor() {
    this.logger = new Logger('FalconGCPAuthService')
    this.gcpWIFConfigService = new GCPWIFConfigService()
  }

  async getAuthenticatedClient(configId: string): Promise<GoogleAuthClient> {
    try {
      const config = await this.gcpWIFConfigService.getConfig(configId)
      if (!config) {
        throw new Error(`No GCP WIF configuration found for configId: ${configId}`)
      }

      const auth = new GoogleAuth({
        credentials: config.config,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })

      return await auth.getClient()
    } catch (error) {
      this.logger.error('Error getting authenticated client:', error)
      throw error
    }
  }

  async getAuthenticatedClientForTenant(tenantId: string): Promise<GoogleAuthClient> {
    try {
      const configs = await this.gcpWIFConfigService.getConfigsByTenantId(tenantId)
      if (!configs || configs.length === 0) {
        throw new Error(`No GCP WIF configurations found for tenant: ${tenantId}`)
      }

      // For now, we'll use the first config. In the future, we might want to handle multiple configs
      const config = configs[0]
      return this.getAuthenticatedClient(config.wifConfigId)
    } catch (error) {
      this.logger.error('Error getting authenticated client for tenant:', error)
      throw error
    }
  }
} 
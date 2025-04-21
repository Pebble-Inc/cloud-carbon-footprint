/*
 * © 2024 Thoughtworks, Inc.
 */

import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'
import {
  GoogleAuthClient,
  Logger,
  configLoader,
} from '@cloud-carbon-footprint/common'
import { GoogleAuth } from 'google-auth-library'
import GCPWIFConfigService from './GCPWIFConfigService'
import { IGCPWIFConfig } from './IGCPWIFConfig'
import { BigQuery } from '@google-cloud/bigquery'

export default class FalconGCPAuthService {
  private readonly logger: Logger
  private readonly wifConfigService: GCPWIFConfigService

  constructor() {
    this.logger = new Logger('FalconGCPAuthService')
    this.wifConfigService = new GCPWIFConfigService()
  }

  private async getAWSIdentity(): Promise<string> {
    try {
      const credentials = await fromNodeProviderChain()()
      const stsClient = new STSClient({
        credentials,
        region: process.env.AWS_REGION || 'us-east-1',
      })
      const command = new GetCallerIdentityCommand({})
      const response = await stsClient.send(command)
      return response.Arn || ''
    } catch (error) {
      this.logger.error('Error getting AWS identity:', error)
      throw error
    }
  }

  async getWIFConfig(wifConfigId: string): Promise<IGCPWIFConfig> {
    try {
      const wifConfig = await this.wifConfigService.getConfig(wifConfigId)
      if (!wifConfig) {
        throw new Error(`No WIF configuration found for ID: ${wifConfigId}`)
      }
      return wifConfig
    } catch (error) {
      this.logger.error('Error getting WIF configuration:', error)
      throw error
    }
  }

  async getAuthenticatedClient(wifConfigId: string): Promise<GoogleAuthClient> {
    try {
      const wifConfig = await this.wifConfigService.getConfig(wifConfigId)
      if (!wifConfig) {
        throw new Error(`No WIF configuration found for ID: ${wifConfigId}`)
      }

      // Verify AWS identity
      const awsIdentity = await this.getAWSIdentity()
      this.logger.info(`Authenticating with AWS identity: ${awsIdentity}`)

      // Initialize GoogleAuth with WIF config
      const auth = new GoogleAuth({
        credentials: wifConfig.config,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      })
      const googleAuthClient: GoogleAuthClient = await auth.getClient()

      return googleAuthClient
    } catch (error) {
      this.logger.error('Error getting authenticated client:', error)
      throw error
    }
  }

  async getBigQueryClient(wifConfigId: string): Promise<BigQuery> {
    try {
      this.logger.info('Getting WIF configuration for BigQuery client...')
      const wifConfig = await this.wifConfigService.getConfig(wifConfigId)
      if (!wifConfig) {
        throw new Error(`No WIF configuration found for ID: ${wifConfigId}`)
      }

      // Use US multi-region for BigQuery operations
      const bqRegion = 'US'
      this.logger.info(`Initializing BigQuery client in region: ${bqRegion}`)

      const bigquery = new BigQuery({
        projectId: configLoader().GCP.BILLING_PROJECT_ID,
        location: bqRegion,
        credentials: {
          ...wifConfig.config,
          credential_source: {
            ...wifConfig.config.credential_source,
            imdsv2_session_token_url: 'http://169.254.169.254/latest/api/token',
          },
        },
      })

      this.logger.info('Successfully created BigQuery client')
      return bigquery
    } catch (error) {
      this.logger.error('Error creating BigQuery client:', error)
      throw error
    }
  }
}

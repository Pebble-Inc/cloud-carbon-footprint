/*
 * © 2021 Thoughtworks, Inc.
 */

import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

import {
  CCFConfig,
  AccountDetails,
  Logger,
} from '@cloud-carbon-footprint/common'

import { appendToInlinePolicy } from './utils/iamUtils'
import { ClientSecretCredential } from '@azure/identity'
import dotenv from 'dotenv'
import FalconGCPAuthService from './GCP/FalconGCPAuthService'

dotenv.config()

export default class TestConnectionService {
  private readonly serviceLogger: Logger

  constructor() {
    this.serviceLogger = new Logger('TestConnectionService')
  }

  async testConnection(config: CCFConfig): Promise<void> {
    if (config.AWS) {
      return this.testAWSConnection(config.AWS)
    }

    if (config.GCP) {
      return this.testGCPConnection(config.GCP)
    }

    if (config.AZURE) {
      return this.testAzureConnection(config.AZURE)
    }

    throw new Error('No valid configuration provided')
  }

  async testAWSConnection(awsConfig: CCFConfig['AWS']): Promise<void> {
    if (!awsConfig) {
      throw new Error('AWS configuration is required')
    }

    const accounts = awsConfig.accounts || []
    let accountsToTest: AccountDetails[] = []

    if (accounts.length === 0) {
      // If no accounts provided, use billing account details
      if (!awsConfig.BILLING_ACCOUNT_ID) {
        throw new Error(
          'Either accounts or BILLING_ACCOUNT_ID must be provided',
        )
      }
      accountsToTest = [
        {
          id: awsConfig.BILLING_ACCOUNT_ID,
          name: awsConfig.BILLING_ACCOUNT_NAME || awsConfig.BILLING_ACCOUNT_ID,
        },
      ]
    } else {
      accountsToTest = accounts as AccountDetails[]
    }

    this.serviceLogger.info('Starting AWS connection test...')

    // Test connection for each account
    for (const account of accountsToTest) {
      try {
        this.serviceLogger.info(`Testing connection for account: ${account.id}`)
        // Ensure inline policy is attached before assuming role
        this.serviceLogger.info(
          `aws-account---${account.id},from env   >> ccf-role-----${process.env.CCF_ROLE}, ENV----${process.env.ENV}`,
        )
        await appendToInlinePolicy(
          account.id,
          process.env.ENV,
          process.env.CCF_ROLE,
        )
        this.serviceLogger.info(
          `Inline policy attached for account: ${account.id}`,
        )
        await new Promise((resolve) => setTimeout(resolve, 5000))
        const credentialsProvider = fromTemporaryCredentials({
          clientConfig: { region: 'us-east-1' },
          params: {
            RoleArn: `arn:aws:iam::${account.id}:role/${process.env.CCF_ROLE}`,
            RoleSessionName: `${account.id}-${process.env.CCF_ROLE}`,
          },
        })
        // Test credentials by calling the provider function
        try {
          const credentials = await credentialsProvider()
          console.log('✅ Successfully assumed role', credentials)
        } catch (err) {
          console.error(`❌ Failed to assume role: ${err.message}`, err)
        }

        // If we get here, it means the credentials were successfully assumed
        this.serviceLogger.info(
          `Successfully connected to AWS account: ${account.id}`,
        )
      } catch (error) {
        this.serviceLogger.error(
          `Connection test failed for account ${account.id}`,
          error,
        )
        throw new Error(
          `Failed to connect to AWS account ${account.id}: ${error.message}`,
        )
      }
    }

    this.serviceLogger.info('AWS connection test completed successfully')
  }

  async testGCPConnection(
    gcpConfig: CCFConfig['GCP'] & { WIF_CONFIG_ID?: string },
  ): Promise<void> {
    if (!gcpConfig) {
      throw new Error('GCP configuration is required')
    }

    // Check if the WIF_CONFIG_ID is provided
    if (!gcpConfig.WIF_CONFIG_ID) {
      throw new Error(
        'GCP WIF_CONFIG_ID is required for Workload Identity Federation',
      )
    }

    this.serviceLogger.info('Starting GCP Workload Identity Federation test...')

    try {
      // Create GCP auth service
      const gcpAuthService = new FalconGCPAuthService()

      // Try to get the WIF config
      this.serviceLogger.info(
        `Retrieving WIF configuration for ID: ${gcpConfig.WIF_CONFIG_ID}...`,
      )
      await gcpAuthService.getWIFConfig(gcpConfig.WIF_CONFIG_ID)
      this.serviceLogger.info('Successfully retrieved WIF configuration')

      // Try to get an authenticated client - this internally tests AWS metadata access
      this.serviceLogger.info('Attempting to get authenticated GCP client...')
      const authClient = await gcpAuthService.getAuthenticatedClient(
        gcpConfig.WIF_CONFIG_ID,
      )

      // Test auth client by getting a token
      this.serviceLogger.info(
        'Testing authentication by requesting access token...',
      )
      const token = await authClient.getAccessToken()

      if (!token || !token.token) {
        throw new Error('Failed to obtain GCP access token')
      }

      this.serviceLogger.info('✅ Successfully obtained GCP access token')
      this.serviceLogger.info(
        'GCP Workload Identity Federation test completed successfully',
      )
    } catch (error) {
      this.serviceLogger.error('GCP connection test failed:', error)
      throw new Error(`Failed to connect to GCP: ${error.message}`)
    }
  }

  async testAzureConnection(azureConfig: CCFConfig['AZURE']): Promise<void> {
    if (!azureConfig) {
      throw new Error('Azure configuration is required')
    }

    const { authentication } = azureConfig

    if (!authentication) {
      throw new Error('Azure authentication configuration is required')
    }

    // Check required authentication parameters for default case
    if (
      !authentication.clientId ||
      !authentication.clientSecret ||
      !authentication.tenantId
    ) {
      throw new Error(
        'Azure client ID, client secret, and tenant ID are required',
      )
    }

    this.serviceLogger.info('Starting Azure connection test...')

    try {
      // Create Azure credentials using the default case
      const credentials = new ClientSecretCredential(
        authentication.tenantId,
        authentication.clientId,
        authentication.clientSecret,
      )

      // Test the credentials by attempting to get a token
      // This will throw if credentials are invalid
      await credentials.getToken('https://management.azure.com/.default')

      this.serviceLogger.info('Successfully connected to Azure')
    } catch (error) {
      this.serviceLogger.error('Azure connection test failed', error)
      throw new Error(`Failed to connect to Azure: ${error.message}`)
    }

    this.serviceLogger.info('Azure connection test completed successfully')
  }
}

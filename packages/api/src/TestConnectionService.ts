/*
 * © 2021 Thoughtworks, Inc.
 */

import { ChainableTemporaryCredentials } from 'aws-sdk'
import {
  CCFConfig,
  AccountDetails,
  Logger,
} from '@cloud-carbon-footprint/common'
import { ClientSecretCredential } from '@azure/identity'

import { attachInlinePolicy } from "./utils/iamUtils";
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
        await attachInlinePolicy(account.id)
        this.serviceLogger.info(`Inline policy attached for account: ${account.id}`)
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const credentials = new ChainableTemporaryCredentials({
          params: {
            RoleArn: `arn:aws:iam::${account.id}:role/ccf-external-role-master-tenant`,
            RoleSessionName: `${account.id}-ccf-external-role-master-tenant`,
          },
        })

        // Test credentials using get() with callback
        await new Promise((resolve, reject) => {
          credentials.get((err) => {
            if (err) {
              reject(err)
              return
            }
            resolve(null)
          })
        })

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

  async testGCPConnection(gcpConfig: CCFConfig['GCP']): Promise<void> {
    if (!gcpConfig) {
      throw new Error('GCP configuration is required')
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

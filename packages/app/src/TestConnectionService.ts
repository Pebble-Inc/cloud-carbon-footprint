/*
 * © 2021 Thoughtworks, Inc.
 */

import { AWSAccount } from '@cloud-carbon-footprint/aws'
import {
  CCFConfig,
  AccountDetails,
  configLoader,
  Logger,
  GroupBy,
} from '@cloud-carbon-footprint/common'

export class TestConnectionService {
  private readonly serviceLogger: Logger

  constructor() {
    this.serviceLogger = new Logger('TestConnectionService')
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

    // Use default services if none provided
    const defaultConfig = configLoader()
    const currentRegions =
      awsConfig.CURRENT_REGIONS || defaultConfig.AWS.CURRENT_REGIONS

    this.serviceLogger.info('Starting AWS connection test...')

    // Test connection for each account
    for (const account of accountsToTest) {
      try {
        this.serviceLogger.info(`Testing connection for account: ${account.id}`)

        // Create AWS account instance to test credentials
        const awsAccount = new AWSAccount(
          account.id,
          account.name || account.id,
          currentRegions,
        )

        // Test service access by getting services
        const region = currentRegions[0]
        this.serviceLogger.info(`Testing AWS services in region: ${region}`)

        // Test actual AWS access by making a real API call
        const endDate = new Date()
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 1)

        this.serviceLogger.info(
          `Testing data access from ${startDate.toISOString()} to ${endDate.toISOString()}`,
        )

        const data = await awsAccount.getDataForRegion(
          region,
          startDate,
          endDate,
          GroupBy.day,
        )

        this.serviceLogger.info(
          `Data access test result: ${JSON.stringify(data)}`,
        )

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
}

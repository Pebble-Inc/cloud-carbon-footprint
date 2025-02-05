/*
 * © 2021 Thoughtworks, Inc.
 */

import { AWSAccount } from '@cloud-carbon-footprint/aws'
import {
  CCFConfig,
  AccountDetails,
  configLoader,
} from '@cloud-carbon-footprint/common'

export class TestConnectionService {
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

    // Test connection for each account
    for (const account of accountsToTest) {
      try {
        // Create AWS account instance to test credentials
        const awsAccount = new AWSAccount(
          account.id,
          account.name || account.id,
          currentRegions,
        )

        // Test service access by getting services
        const region = currentRegions[0]
        await awsAccount.getServices(region)
      } catch (error) {
        throw new Error(
          `Failed to connect to AWS account ${account.id}: ${error.message}`,
        )
      }
    }
  }
}

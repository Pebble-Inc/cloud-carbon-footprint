/*
 * © 2024 Thoughtworks, Inc.
 */

import {
  IAMClient,
  GetRoleCommand,
  UpdateAssumeRolePolicyCommand,
} from '@aws-sdk/client-iam'
import { IGCPWIFConfig } from '../GCP/IGCPWIFConfig'
import dotenv from 'dotenv'
import { Logger } from '@cloud-carbon-footprint/common'

dotenv.config()

const roleMap = {
  dev: 'pebble-dev-ecs-exec-role20241211135546171100000002',
  prod: 'pebble-prod-ecs-exec-role20250120114714445800000002',
}

export class TrustRelationshipManager {
  private iamClient: IAMClient
  private ecsRoleName: string
  private logger: Logger

  constructor() {
    this.iamClient = new IAMClient({
      region: process.env.AWS_REGION || 'us-east-1', // Specify a default region
    })
    this.ecsRoleName = roleMap[process.env.ENV || 'dev']
    this.logger = new Logger('TrustRelationshipManager')
  }

  /**
   * Adds a GCP Workload Identity Federation trust relationship to the ECS task execution role
   * @param wifConfig The GCP WIF configuration containing the audience value
   * @returns Promise resolving to success status and message
   */
  public async addGCPWIFTrustRelationship(
    wifConfig: IGCPWIFConfig['config'],
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.info('Starting GCP WIF trust relationship update')
      this.logger.info(`Environment: ${process.env.ENV || 'dev'}`)
      this.logger.info(`Target ECS role name: ${this.ecsRoleName}`)
      this.logger.info(`WIF config audience: ${wifConfig.audience}`)
      this.logger.info(`WIF config type: ${wifConfig.type}`)
      this.logger.info(
        `WIF config subject_token_type: ${wifConfig.subject_token_type}`,
      )

      // Get the current role policy
      this.logger.info(`Retrieving role policy for: ${this.ecsRoleName}`)
      const getRoleCommand = new GetRoleCommand({ RoleName: this.ecsRoleName })
      const roleData = await this.iamClient.send(getRoleCommand)
      this.logger.info('Successfully retrieved role data')

      if (!roleData.Role?.AssumeRolePolicyDocument) {
        this.logger.error(
          `No AssumeRolePolicyDocument found for role: ${this.ecsRoleName}`,
          new Error('Missing policy document'),
        )
        throw new Error(
          `Could not retrieve trust policy for role: ${this.ecsRoleName}`,
        )
      }

      this.logger.info('Parsing AssumeRolePolicyDocument')
      // Parse the policy document
      const assumeRolePolicyDocument = JSON.parse(
        decodeURIComponent(roleData.Role.AssumeRolePolicyDocument),
      )
      this.logger.info(
        `Current policy version: ${assumeRolePolicyDocument.Version}`,
      )
      this.logger.info(
        `Number of statements in policy: ${assumeRolePolicyDocument.Statement.length}`,
      )
      this.logger.info(
        `Current policy statements: ${JSON.stringify(
          assumeRolePolicyDocument.Statement,
        )}`,
      )

      // Create the new GCP WIF trust relationship statement
      this.logger.info('Creating GCP WIF trust relationship statement')
      const gcpWifStatement = {
        Effect: 'Allow',
        Principal: {
          Federated: 'accounts.google.com',
        },
        Action: 'sts:AssumeRoleWithWebIdentity',
        Condition: {
          StringEquals: {
            'accounts.google.com:aud': wifConfig.audience,
          },
        },
      }
      this.logger.info(
        `New GCP WIF statement: ${JSON.stringify(gcpWifStatement)}`,
      )

      // Check if a GCP WIF trust relationship already exists with the same audience
      this.logger.info(
        'Checking if trust relationship with the same audience exists',
      )
      const existingStatementIndex =
        assumeRolePolicyDocument.Statement.findIndex(
          (statement: any) =>
            statement.Principal?.Federated === 'accounts.google.com' &&
            statement.Action === 'sts:AssumeRoleWithWebIdentity' &&
            statement.Condition?.StringEquals?.['accounts.google.com:aud'] ===
              wifConfig.audience,
        )
      this.logger.info(
        `Existing statement index with same audience: ${existingStatementIndex}`,
      )

      // If the exact trust relationship already exists, return success
      if (existingStatementIndex >= 0) {
        this.logger.info(
          `Trust relationship with audience '${wifConfig.audience}' already exists, no update needed`,
        )
        return {
          success: true,
          message: `Trust relationship with audience '${wifConfig.audience}' already exists.`,
        }
      }

      // Always add a new statement for a new audience - don't update existing ones
      this.logger.info(
        `Adding new trust relationship with audience '${wifConfig.audience}'`,
      )
      assumeRolePolicyDocument.Statement.push(gcpWifStatement)

      // Make sure the Version is set correctly
      this.logger.info(
        `Setting policy version to: ${
          assumeRolePolicyDocument.Version || '2012-10-17'
        }`,
      )
      assumeRolePolicyDocument.Version =
        assumeRolePolicyDocument.Version || '2012-10-17'

      // Update the role policy
      this.logger.info('Preparing to update assume role policy')
      const policyToUpdate = JSON.stringify(assumeRolePolicyDocument)
      this.logger.info(`Policy document to update: ${policyToUpdate}`)

      const updateCommand = new UpdateAssumeRolePolicyCommand({
        RoleName: this.ecsRoleName,
        PolicyDocument: policyToUpdate,
      })

      this.logger.info('Sending update assume role policy command')
      await this.iamClient.send(updateCommand)
      this.logger.info('Successfully updated assume role policy')

      this.logger.info(
        `Completed trust relationship update for role '${this.ecsRoleName}' with audience '${wifConfig.audience}'`,
      )
      return {
        success: true,
        message: `Successfully added new trust relationship for role '${this.ecsRoleName}' with audience '${wifConfig.audience}'.`,
      }
    } catch (error) {
      this.logger.error(
        `Error updating trust relationship: ${error.message}`,
        error,
      )
      if (error.Code) {
        this.logger.error(
          `AWS Error Code: ${error.Code}`,
          new Error('AWS API Error'),
        )
      }
      if (error.requestId) {
        this.logger.error(
          `AWS Request ID: ${error.requestId}`,
          new Error('AWS Request Error'),
        )
      }
      console.error('Error updating trust relationship:', error)
      throw new Error(`Failed to update trust relationship: ${error.message}`)
    }
  }
}

export default TrustRelationshipManager

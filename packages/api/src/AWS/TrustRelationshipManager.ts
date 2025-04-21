/*
 * © 2024 Thoughtworks, Inc.
 */

import {
  IAMClient,
  GetRoleCommand,
  UpdateAssumeRolePolicyCommand,
} from '@aws-sdk/client-iam'
import { IGCPWIFConfig } from '../GCP/IGCPWIFConfig'

export class TrustRelationshipManager {
  private iamClient: IAMClient

  constructor() {
    this.iamClient = new IAMClient({})
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
      // Get the current task execution role name from the environment
      const roleName = process.env.AWS_ROLE_NAME || 'ecsTaskExecutionRole'

      // Get the current role policy
      const getRoleCommand = new GetRoleCommand({ RoleName: roleName })
      const roleData = await this.iamClient.send(getRoleCommand)

      if (!roleData.Role?.AssumeRolePolicyDocument) {
        throw new Error(`Could not retrieve trust policy for role: ${roleName}`)
      }

      // Parse the policy document
      const assumeRolePolicyDocument = JSON.parse(
        decodeURIComponent(roleData.Role.AssumeRolePolicyDocument),
      )

      // Create the new GCP WIF trust relationship statement
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

      // Check if a GCP WIF trust relationship already exists with the same audience
      const existingStatementIndex =
        assumeRolePolicyDocument.Statement.findIndex(
          (statement: any) =>
            statement.Principal?.Federated === 'accounts.google.com' &&
            statement.Action === 'sts:AssumeRoleWithWebIdentity' &&
            statement.Condition?.StringEquals?.['accounts.google.com:aud'] ===
              wifConfig.audience,
        )

      // If the exact trust relationship already exists, return success
      if (existingStatementIndex >= 0) {
        return {
          success: true,
          message: `Trust relationship with audience '${wifConfig.audience}' already exists.`,
        }
      }

      // Check if a GCP WIF trust relationship exists with a different audience
      const existingGcpStatementIndex =
        assumeRolePolicyDocument.Statement.findIndex(
          (statement: any) =>
            statement.Principal?.Federated === 'accounts.google.com' &&
            statement.Action === 'sts:AssumeRoleWithWebIdentity',
        )

      // If a GCP WIF trust relationship with a different audience exists, update it
      if (existingGcpStatementIndex >= 0) {
        assumeRolePolicyDocument.Statement[
          existingGcpStatementIndex
        ].Condition.StringEquals['accounts.google.com:aud'] = wifConfig.audience
      } else {
        // Otherwise, add the new statement to the policy
        assumeRolePolicyDocument.Statement.push(gcpWifStatement)
      }

      // Make sure the Version is set correctly
      assumeRolePolicyDocument.Version =
        assumeRolePolicyDocument.Version || '2012-10-17'

      // Update the role policy
      const updateCommand = new UpdateAssumeRolePolicyCommand({
        RoleName: roleName,
        PolicyDocument: JSON.stringify(assumeRolePolicyDocument),
      })
      await this.iamClient.send(updateCommand)

      return {
        success: true,
        message: `Successfully updated trust relationship for role '${roleName}' with audience '${wifConfig.audience}'.`,
      }
    } catch (error) {
      console.error('Error updating trust relationship:', error)
      throw new Error(`Failed to update trust relationship: ${error.message}`)
    }
  }
}

export default TrustRelationshipManager

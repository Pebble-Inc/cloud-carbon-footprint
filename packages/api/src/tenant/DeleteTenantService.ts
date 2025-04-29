import { Logger } from '@cloud-carbon-footprint/common'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import {
  CloudFormationClient,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} from '@aws-sdk/client-cloudformation'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import {
  CostAndUsageReportServiceClient as CurClient,
  DescribeReportDefinitionsCommand,
  DeleteReportDefinitionCommand,
} from '@aws-sdk/client-cost-and-usage-report-service'

export class DeleteTenantService {
  private readonly logger = new Logger('DeleteTenantService')

  async DeleteTenant(awsAccountId: string, region: string) {
    this.logger.info(`Starting cleanup for tenant ${awsAccountId} in ${region}`)

    // 0. Read the role name from env
    const tenantRoleName = process.env.CCF_ROLE
    if (!tenantRoleName) {
      throw new Error('Environment variable CCF_ROLE is not set')
    }
    const roleArn = `arn:aws:iam::${awsAccountId}:role/${tenantRoleName}`
    this.logger.info(`Assuming role ${roleArn}`)

    // 1. Assume the external role
    const sts = new STSClient({ region })
    const assume = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'delete-tenant-session',
      })
    )
    const creds = {
      accessKeyId: assume.Credentials!.AccessKeyId!,
      secretAccessKey: assume.Credentials!.SecretAccessKey!,
      sessionToken: assume.Credentials!.SessionToken!,
    }
    const clientConfig = { region, credentials: creds }

    // 2. Clean the two known S3 buckets
    const s3 = new S3Client(clientConfig)
    const bucketNames = [
      `ccf-cost-usage-report-output-${awsAccountId}`,
    ]

    for (const bucket of bucketNames) {
      try {
        this.logger.info(`Cleaning bucket ${bucket}…`)
        let token: string | undefined
        let deletedCount = 0

        do {
          const list = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
          )
          token = list.NextContinuationToken ?? undefined

          if (list.Contents && list.Contents.length > 0) {
            const toDelete = list.Contents.map(o => ({ Key: o.Key! }))
            await s3.send(
              new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: toDelete } })
            )
            deletedCount += toDelete.length
          }
        } while (token)

        this.logger.info(`Bucket ${bucket} emptied (${deletedCount} objects removed).`)
      } catch (err) {
        this.logger.warn(`Could not clean bucket ${bucket}: ${(err as Error).message}`)
      }
    }

    // 3. Delete the Cost & Usage Report definition
    const cur = new CurClient(clientConfig)
    const expectedReportName = `ccf_cost_usage-report-${awsAccountId}`
    try {
      this.logger.info(`Looking for CUR report ${expectedReportName}`)
      const defs = await cur.send(new DescribeReportDefinitionsCommand({}))
      for (const def of defs.ReportDefinitions ?? []) {
        if (def.ReportName === expectedReportName) {
          this.logger.info(`Deleting CUR report '${def.ReportName}'…`)
          await cur.send(new DeleteReportDefinitionCommand({ ReportName: def.ReportName! }))
          this.logger.info(`Report '${def.ReportName}' deleted.`)
        }
      }
    }catch (e: unknown) {
        const err = e as Error
        this.logger.error(
          `Failed to delete CUR report: ${err.message}`,
          err
        )
      }
    // 4. Delete the CloudFormation stack named "ccf"
    const cf = new CloudFormationClient(clientConfig)
    const stackName = 'ccf'
    this.logger.info(`Deleting CloudFormation stack '${stackName}'…`)
    await cf.send(new DeleteStackCommand({ StackName: stackName,RoleARN: roleArn }))
    await waitUntilStackDeleteComplete(
      { client: cf, maxWaitTime: 600 },
      { StackName: stackName }
    )
    this.logger.info(`Stack '${stackName}' fully deleted.`)
  }
}
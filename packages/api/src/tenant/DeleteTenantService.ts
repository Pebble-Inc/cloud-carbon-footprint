import { Injectable, Logger } from '@nestjs/common';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import {
  CloudFormationClient,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} from '@aws-sdk/client-cloudformation';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import {
  CostAndUsageReportServiceClient as CurClient,
  DescribeReportDefinitionsCommand,
  DeleteReportDefinitionCommand,
} from '@aws-sdk/client-cost-and-usage-report-service';

@Injectable()
export class DeleteTenantService {
  private readonly logger = new Logger(DeleteTenantService.name);

  async DeleteTenant(awsAccountId: string, region: string) {
    // 0. Read the role name from env
    const tenantRoleName = process.env.CCF_ROLE;
    if (!tenantRoleName) {
      throw new Error('Environment variable CCF_ROLE is not set');
    }
    const roleArn = `arn:aws:iam::${awsAccountId}:role/${tenantRoleName}`;

    // 1. Assume the external role
    const sts = new STSClient({ region });
    const assume = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'delete-tenant-session',
      })
    );
    const creds = {
      accessKeyId: assume.Credentials!.AccessKeyId!,
      secretAccessKey: assume.Credentials!.SecretAccessKey!,
      sessionToken: assume.Credentials!.SessionToken!,
    };
    const clientConfig = { region, credentials: creds };

    // 2. Clean the two known S3 buckets
    const s3 = new S3Client(clientConfig);
    const bucketNames = [
      `ccf-athena-query-${awsAccountId}`,
      `ccf-cost-usage-report-output-${awsAccountId}`,
    ];

    for (const bucket of bucketNames) {
      try {
        this.logger.log(`Cleaning bucket ${bucket}…`);
        let token: string | undefined;

        do {
          const list = await s3.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              ContinuationToken: token,
            })
          );
          token = list.NextContinuationToken ?? undefined;

          if (list.Contents && list.Contents.length > 0) {
            const toDelete = list.Contents.map((o) => ({ Key: o.Key! }));
            await s3.send(
              new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: toDelete },
              })
            );
            this.logger.log(` → Deleted ${toDelete.length} objects`);
          }
        } while (token);

        this.logger.log(`Bucket ${bucket} emptied.`);
      } catch (err) {
        this.logger.warn(`Could not clean bucket ${bucket}: ${(err as Error).message}`);
      }
    }

    // 3. Delete the Cost & Usage Report definition
    const cur = new CurClient(clientConfig);
    const expectedReportName = `ccf_cost_usage-report-${awsAccountId}`;
    try {
      const defs = await cur.send(new DescribeReportDefinitionsCommand({}));
      for (const def of defs.ReportDefinitions ?? []) {
        if (def.ReportName === expectedReportName) {
          this.logger.log(`Deleting CUR report '${def.ReportName}'…`);
          await cur.send(
            new DeleteReportDefinitionCommand({ ReportName: def.ReportName! })
          );
          this.logger.log(`Report '${def.ReportName}' deleted.`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to delete CUR report: ${(e as Error).message}`);
    }

    // 4. Delete the CloudFormation stack named "ccf"
    const cf = new CloudFormationClient(clientConfig);
    const stackName = 'ccf';
    this.logger.log(`Deleting CloudFormation stack '${stackName}'…`);
    await cf.send(new DeleteStackCommand({ StackName: stackName }));
    await waitUntilStackDeleteComplete(
      { client: cf, maxWaitTime: 600 },
      { StackName: stackName }
    );
    this.logger.log(`Stack '${stackName}' fully deleted.`);
  }
}
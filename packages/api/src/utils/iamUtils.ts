import { IAMClient, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

// Read values from .env
const awsRegion = process.env.AWS_REGION || "us-east-1";
const ecsRoleName = "pebble-dev-ecs-exec-role20241211135546171100000002";
const tenantRoleName = "ccf-external-role-master-tenant";


if (!ecsRoleName || !tenantRoleName) {
    console.error("❌ Error: ECS_ROLE_NAME or TENANT_ROLE_NAME is missing in .env file");
    process.exit(1);
}


// Initialize IAM client
const client = new IAMClient({ region: awsRegion });

/**
 * Attaches an inline policy to the ECS IAM role, allowing it to assume a tenant's role.
 * @param tenantAccountId - The AWS Account ID of the tenant
 */
export async function attachInlinePolicy(tenantAccountId: string): Promise<void> {
    const policyName = `AssumeTenantRolePolicy-${tenantAccountId}`;
    const targetRoleArn = `arn:aws:iam::${tenantAccountId}:role/${tenantRoleName}`;

    const policyDocument = {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Action: "sts:AssumeRole",
                Resource: targetRoleArn
            }
        ]
    };

    const params = {
        RoleName: ecsRoleName, // Use ECS role name from .env
        PolicyName: policyName,
        PolicyDocument: JSON.stringify(policyDocument)
    };

    try {
        const command = new PutRolePolicyCommand(params);
        await client.send(command);
        console.log(`✅ Successfully attached policy '${policyName}' to role '${ecsRoleName}'`);
    } catch (error) {
        console.error(`❌ Failed to attach policy:`, error);
        throw error; // Re-throw the error for the API to handle
    }
}
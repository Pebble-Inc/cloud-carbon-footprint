import { IAMClient, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

// Read values from .env
const awsRegion = process.env.AWS_REGION || "us-east-1";
const ecsRoleName = process.env.ECS_ROLE_NAME;

if (!ecsRoleName) {
    console.error("❌ Error: ECS_ROLE_NAME is missing in .env file");
    process.exit(1);
}

// Log AWS credentials and region for debugging
console.log("AWS Region:", awsRegion);
console.log("ECS Role Name:", ecsRoleName);
console.log("AWS Access Key ID:", process.env.AWS_ACCESS_KEY_ID ? "***" : "Not Found");
console.log("AWS Secret Access Key:", process.env.AWS_SECRET_ACCESS_KEY ? "***" : "Not Found");

// Initialize IAM client
const client = new IAMClient({ region: awsRegion });

/**
 * Attaches an inline policy to the ECS IAM role, allowing it to assume a tenant's role.
 * @param tenantAccountId - The AWS Account ID of the tenant
 * @param tenantRoleName - The role name in the tenant's AWS account
 */
export async function attachInlinePolicy(tenantAccountId: string, tenantRoleName: string): Promise<void> {
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
        RoleName: ecsRoleName,
        PolicyName: policyName,
        PolicyDocument: JSON.stringify(policyDocument)
    };

    try {
        const command = new PutRolePolicyCommand(params);
        await client.send(command);
        console.log(`✅ Successfully attached policy '${policyName}' to role '${ecsRoleName}'`);
    } catch (error) {
        console.error(`❌ Failed to attach policy:`, error);
    }
}
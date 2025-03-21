import { IAMClient, GetRolePolicyCommand, PutRolePolicyCommand } from "@aws-sdk/client-iam";
import dotenv from "dotenv";

dotenv.config();

const awsRegion = process.env.AWS_REGION || "us-east-1";
const ecsRoleNameDev = "pebble-dev-ecs-exec-role20241211135546171100000002";
const ecsRoleNameProd = "pebble-dev-ecs-exec-role20241211135546171100000002";
const tenantRoleName = "ccf-external-role-master-tenant";

// if (!ecsRoleNameDev || !tenantRoleName || ecsRoleNameProd ) {
//     console.error("❌ Error: ECS_ROLE_NAME or TENANT_ROLE_NAME is missing in .env file");
//     process.exit(1);
// }

// Initialize IAM client
const client = new IAMClient({ region: awsRegion });

/**
 * Appends a new tenant role ARN to an existing inline policy.
 * @param tenantAccountId - The AWS Account ID of the tenant
 */
export async function appendToInlinePolicy(tenantAccountId: string,envVal: string): Promise<void> {
    const policyName = `CCFAssumeTenantRolePolicy`;
    const targetRoleArn = `arn:aws:iam::${tenantAccountId}:role/${tenantRoleName}`;
    let role=""
    if (envVal=="dev"){
        role=ecsRoleNameDev
        console.error(`✅  ${role} ENV found Proceeding to the test Conection! `);
    }else if (envVal=="prod"){
        role=ecsRoleNameProd
        console.error(`✅  ${role} ENV found Proceeding to the test Conection! `);
    }else{
        console.error(`❌ Failed to update policy ENV not found`);
    }
    try {
        // Step 1: Fetch existing policy
        const getPolicyCommand = new GetRolePolicyCommand({
            RoleName: role,
            PolicyName: policyName,
        });

        let existingPolicyDocument;
        try {
            const response = await client.send(getPolicyCommand);
            existingPolicyDocument = JSON.parse(decodeURIComponent(response.PolicyDocument || "{}"));
        } catch (error) {
            if ((error as any).name === "NoSuchEntityException") {
                console.log(`ℹ️ No existing policy found. Creating a new one.`);
                existingPolicyDocument = { Version: "2012-10-17", Statement: [] };
            } else {
                throw error;
            }
        }

        // Step 2: Update the policy by adding the new ARN if it's not already included
        let statement = existingPolicyDocument.Statement.find((stmt: any) => stmt.Action === "sts:AssumeRole");

        if (!statement) {
            statement = { Effect: "Allow", Action: "sts:AssumeRole", Resource: [] };
            existingPolicyDocument.Statement.push(statement);
        }

        if (!statement.Resource.includes(targetRoleArn)) {
            statement.Resource = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
            statement.Resource.push(targetRoleArn);
        }

        // Step 3: Apply updated policy
        const updatedPolicyDocument = JSON.stringify(existingPolicyDocument);

        const putPolicyCommand = new PutRolePolicyCommand({
            RoleName: role,
            PolicyName: policyName,
            PolicyDocument: updatedPolicyDocument,
        });

        await client.send(putPolicyCommand);
        console.log(`✅ Successfully updated policy '${policyName}' for role '${role}'`);

    } catch (error) {
        console.error(`❌ Failed to update policy:`, error);
        throw new Error(`Failed to update policy: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
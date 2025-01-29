/*
 * © 2023 Thoughtworks, Inc.
 */

import mongoose, { Schema } from 'mongoose'
import { CCFConfig } from './Config'
import { AWS_RECOMMENDATIONS_SERVICES } from './RecommendationsService'

// Base interface without Document properties
export interface ITenantConfig {
  tenantId: string
  createdAt: Date
  updatedAt: Date
  configDoc: {
    AWS?: CCFConfig['AWS']
    GCP?: CCFConfig['GCP']
    AZURE?: CCFConfig['AZURE']
    ALI?: CCFConfig['ALI']
    LOGGING_MODE?: string
    ELECTRICITY_MAPS_TOKEN?: string
  }
}

// Create the schema
const tenantConfigSchema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true },
    configDoc: {
      AWS: {
        type: {
          INCLUDE_ESTIMATES: { type: Boolean, default: true },
          USE_BILLING_DATA: { type: Boolean, default: false },
          BILLING_ACCOUNT_ID: { type: String, default: '' },
          BILLING_ACCOUNT_NAME: { type: String, default: '' },
          ATHENA_DB_NAME: { type: String, default: '' },
          ATHENA_DB_TABLE: { type: String, default: '' },
          ATHENA_QUERY_RESULT_LOCATION: { type: String, default: '' },
          ATHENA_REGION: { type: String, default: '' },
          RECOMMENDATIONS_SERVICE: {
            type: String,
            default: AWS_RECOMMENDATIONS_SERVICES.RightSizing,
          },
          COMPUTE_OPTIMIZER_BUCKET: { type: String, default: '' },
          CURRENT_SERVICES: {
            type: [
              {
                key: String,
                name: String,
              },
            ],
            default: [
              { key: 'ebs', name: 'EBS' },
              { key: 's3', name: 'S3' },
              { key: 'ec2', name: 'EC2' },
              { key: 'elasticache', name: 'ElastiCache' },
              { key: 'rds', name: 'RDS' },
              { key: 'lambda', name: 'Lambda' },
            ],
          },
          CURRENT_REGIONS: {
            type: [String],
            default: [
              'us-east-1',
              'us-east-2',
              'us-west-1',
              'us-west-2',
              'ap-south-1',
              'ap-northeast-2',
              'ap-southeast-1',
              'ap-southeast-2',
              'ap-northeast-1',
              'ca-central-1',
              'eu-central-1',
              'eu-west-1',
              'eu-west-2',
              'eu-west-3',
              'eu-north-1',
              'sa-east-1',
            ],
          },
          RESOURCE_TAG_NAMES: { type: [String], default: [] },
          accounts: {
            type: [
              {
                id: String,
                name: String,
              },
            ],
            default: [],
          },
        },
        required: false,
      },
      GCP: {
        type: {
          NAME: { type: String, default: 'GCP' },
          CURRENT_SERVICES: {
            type: [
              {
                key: String,
                name: String,
              },
            ],
            default: [{ key: 'computeEngine', name: 'ComputeEngine' }],
          },
          CURRENT_REGIONS: {
            type: [String],
            default: ['us-east1', 'us-central1', 'us-west1'],
          },
          projects: { type: Schema.Types.Mixed, default: [] },
          USE_CARBON_FREE_ENERGY_PERCENTAGE: { type: Boolean, default: false },
          INCLUDE_ESTIMATES: { type: Boolean, default: true },
          USE_BILLING_DATA: { type: Boolean, default: false },
          VCPUS_PER_CLOUD_COMPOSER_ENVIRONMENT: { type: Number, default: 14 },
          VCPUS_PER_GKE_CLUSTER: { type: Number, default: 3 },
          BIG_QUERY_TABLE: { type: String, default: '' },
          BILLING_PROJECT_ID: { type: String, default: '' },
          BILLING_PROJECT_NAME: { type: String, default: '' },
          CACHE_BUCKET_NAME: { type: String, default: '' },
          RESOURCE_TAG_NAMES: { type: [String], default: [] },
        },
        required: false,
      },
      AZURE: {
        type: {
          INCLUDE_ESTIMATES: { type: Boolean, default: true },
          USE_BILLING_DATA: { type: Boolean, default: false },
          authentication: {
            mode: { type: String, default: 'default' },
            clientId: { type: String, default: '' },
            clientSecret: { type: String, default: '' },
            certificatePath: { type: String, default: '' },
            tenantId: { type: String, default: '' },
          },
          RESOURCE_TAG_NAMES: { type: [String], default: [] },
          CONSUMPTION_CHUNKS_DAYS: { type: Number, default: 0 },
          SUBSCRIPTION_CHUNKS: { type: Number, default: 10 },
          SUBSCRIPTIONS: { type: [String], default: [] },
        },
        required: false,
      },
      ALI: {
        type: {
          NAME: { type: String, default: 'AliCloud' },
          INCLUDE_ESTIMATES: { type: Boolean, default: true },
          authentication: {
            accessKeyId: { type: String, default: '' },
            accessKeySecret: { type: String, default: '' },
          },
        },
        required: false,
      },
      LOGGING_MODE: { type: String, default: '' },
      ELECTRICITY_MAPS_TOKEN: { type: String, default: '' },
    },
  },
  { timestamps: true },
)

// Create the model type
export type TenantConfigDocument = mongoose.Document & ITenantConfig

// Create the model
export const TenantConfig = mongoose.model<TenantConfigDocument>(
  'TenantConfig',
  tenantConfigSchema,
  'tenantconfigs',
)

export interface TenantConfigFilters {
  tenantId?: string
}

export const validateTenantConfig = (config: Partial<ITenantConfig>): void => {
  if (!config.tenantId) {
    throw new Error('Tenant ID is required')
  }

  if (
    config.configDoc?.AWS?.authentication &&
    !config.configDoc?.AWS?.authentication?.mode
  ) {
    throw new Error(
      'AWS authentication mode is required when AWS authentication is provided',
    )
  }

  if (
    config.configDoc?.AZURE?.authentication &&
    !config.configDoc?.AZURE?.authentication?.mode
  ) {
    throw new Error(
      'Azure authentication mode is required when Azure authentication is provided',
    )
  }
}

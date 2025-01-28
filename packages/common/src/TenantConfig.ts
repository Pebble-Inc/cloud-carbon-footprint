/*
 * © 2023 Thoughtworks, Inc.
 */

import mongoose, { Schema } from 'mongoose'
import { CCFConfig } from './Config'

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
          INCLUDE_ESTIMATES: Boolean,
          USE_BILLING_DATA: Boolean,
          BILLING_ACCOUNT_ID: String,
          BILLING_ACCOUNT_NAME: String,
          ATHENA_DB_NAME: String,
          ATHENA_DB_TABLE: String,
          ATHENA_QUERY_RESULT_LOCATION: String,
          ATHENA_REGION: String,
          IS_AWS_GLOBAL: Boolean,
          NAME: String,
          RECOMMENDATIONS_SERVICE: String,
          COMPUTE_OPTIMIZER_BUCKET: String,
          CURRENT_SERVICES: [{ key: String, name: String }],
          CURRENT_REGIONS: [String],
          RESOURCE_TAG_NAMES: [String],
          accounts: Schema.Types.Mixed, // AccountDetailsOrIdList can be array or object
          authentication: {
            mode: String,
            options: Schema.Types.Mixed,
          },
        },
        required: false,
      },
      GCP: {
        type: {
          NAME: String,
          CURRENT_SERVICES: [{ key: String, name: String }],
          CURRENT_REGIONS: [String],
          projects: Schema.Types.Mixed,
          USE_CARBON_FREE_ENERGY_PERCENTAGE: Boolean,
          INCLUDE_ESTIMATES: Boolean,
          USE_BILLING_DATA: Boolean,
          BIG_QUERY_TABLE: String,
          BILLING_PROJECT_ID: String,
          BILLING_PROJECT_NAME: String,
          CACHE_BUCKET_NAME: String,
          VCPUS_PER_CLOUD_COMPOSER_ENVIRONMENT: Number,
          VCPUS_PER_GKE_CLUSTER: Number,
          RESOURCE_TAG_NAMES: [String],
        },
        required: false,
      },
      AZURE: {
        type: {
          INCLUDE_ESTIMATES: Boolean,
          USE_BILLING_DATA: Boolean,
          authentication: {
            mode: String,
            clientId: String,
            clientSecret: String,
            certificatePath: String,
            tenantId: String,
          },
          RESOURCE_TAG_NAMES: [String],
          CONSUMPTION_CHUNKS_DAYS: Number,
          SUBSCRIPTION_CHUNKS: Number,
          SUBSCRIPTIONS: [String],
        },
        required: false,
      },
      ALI: {
        type: {
          NAME: String,
          INCLUDE_ESTIMATES: Boolean,
          authentication: {
            accessKeyId: String,
            accessKeySecret: String,
          },
        },
        required: false,
      },
      LOGGING_MODE: String,
      ELECTRICITY_MAPS_TOKEN: String,
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

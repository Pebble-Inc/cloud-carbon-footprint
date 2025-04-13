/*
 * © 2024 Thoughtworks, Inc.
 */

import mongoose, { Schema } from 'mongoose'

export interface IGCPWIFConfig {
  wifConfigId: string
  tenantId: string
  createdAt: Date
  updatedAt: Date
  config: {
    universe_domain: string
    type: string
    audience: string
    subject_token_type: string
    service_account_impersonation_url: string
    token_url: string
    credential_source: {
      environment_id: string
      region_url: string
      url: string
      regional_cred_verification_url: string
    }
  }
}

const gcpWIFConfigSchema = new Schema(
  {
    wifConfigId: {
      type: String,
      required: true,
      unique: true,
      default: () => generateConfigId(),
    },
    tenantId: { 
      type: String, 
      required: true,
      index: true 
    },
    config: {
      universe_domain: { type: String, required: true },
      type: { type: String, required: true },
      audience: { type: String, required: true },
      subject_token_type: { type: String, required: true },
      service_account_impersonation_url: { type: String, required: true },
      token_url: { type: String, required: true },
      credential_source: {
        environment_id: { type: String, required: true },
        region_url: { type: String, required: true },
        url: { type: String, required: true },
        regional_cred_verification_url: { type: String, required: true },
      },
    },
  },
  { timestamps: true },
)

export type GCPWIFConfigDocument = mongoose.Document & IGCPWIFConfig

export const GCPWIFConfig = mongoose.model<GCPWIFConfigDocument>(
  'GCPWIFConfig',
  gcpWIFConfigSchema,
  'gcpwifconfigs',
)

const generateConfigId = (): string => {
  return new mongoose.Types.ObjectId().toString()
} 
/*
 * © 2024 Thoughtworks, Inc.
 */

import mongoose, { Schema } from 'mongoose'

export interface IOnPremiseData {
  uploadId: string
  tenantId: string
  cpuDescription: string
  memory: number
  machineType: string
  startTime: Date
  endTime: Date
  country: string
  region: string
  machineName?: string
  cost?: number
  cpuUtilization?: number
  powerUsageEffectiveness?: number
  dailyUptime: number
  weeklyUptime: number
  monthlyUptime: number
  annualUptime: number
  createdAt: Date
  updatedAt: Date
}

const onPremiseDataSchema = new Schema(
  {
    uploadId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    cpuDescription: {
      type: String,
      required: true,
    },
    memory: {
      type: Number,
      required: true,
    },
    machineType: {
      type: String,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    country: {
      type: String,
      required: true,
    },
    region: {
      type: String,
    },
    machineName: {
      type: String,
    },
    cost: {
      type: Number,
    },
    cpuUtilization: {
      type: Number,
    },
    powerUsageEffectiveness: {
      type: Number,
    },
    dailyUptime: {
      type: Number,
    },
    weeklyUptime: {
      type: Number,
    },
    monthlyUptime: {
      type: Number,
    },
    annualUptime: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
)

// Create compound index for tenantId and date range queries
onPremiseDataSchema.index({ tenantId: 1, startTime: 1, endTime: 1 })

export type OnPremiseDataDocument = mongoose.Document & IOnPremiseData

export const OnPremiseData = mongoose.model<OnPremiseDataDocument>(
  'OnPremiseData',
  onPremiseDataSchema,
  'onpremisedata',
)

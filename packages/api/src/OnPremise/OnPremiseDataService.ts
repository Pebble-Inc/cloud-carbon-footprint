/*
 * © 2024 Thoughtworks, Inc.
 */

import { Logger } from '@cloud-carbon-footprint/common'
import { IOnPremiseData, OnPremiseData } from './IOnPremiseData'
import { parse } from 'csv-parse/sync'

export default class OnPremiseDataService {
  private readonly logger: Logger

  constructor() {
    this.logger = new Logger('OnPremiseDataService')
  }

  private generateUploadId(): string {
    return new Date().getTime().toString()
  }

  private validateOnPremiseData(data: Partial<IOnPremiseData>): void {
    const requiredFields = [
      'cpuDescription',
      'memory',
      'machineType',
      'startTime',
      'endTime',
      'country',
      'region',
      'dailyUptime',
      'weeklyUptime',
      'monthlyUptime',
      'annualUptime',
    ]

    const missingFields = requiredFields.filter((field) => !data[field])

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }
  }

  async uploadCSV(fileBuffer: Buffer): Promise<string> {
    try {
      const uploadId = this.generateUploadId()
      const records = parse(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
      })

      const onPremiseDataRecords = records.map((record: any) => {
        const data: Partial<IOnPremiseData> = {
          uploadId,
          cpuDescription: record.cpuDescription,
          memory: Number(record.memory),
          machineType: record.machineType,
          startTime: new Date(record.startTime),
          endTime: new Date(record.endTime),
          country: record.country,
          region: record.region,
          dailyUptime: Number(record.dailyUptime),
          weeklyUptime: Number(record.weeklyUptime),
          monthlyUptime: Number(record.monthlyUptime),
          annualUptime: Number(record.annualUptime),
        }

        if (record.machineName) data.machineName = record.machineName
        if (record.cost) data.cost = Number(record.cost)
        if (record.cpuUtilization)
          data.cpuUtilization = Number(record.cpuUtilization)
        if (record.powerUsageEffectiveness)
          data.powerUsageEffectiveness = Number(record.powerUsageEffectiveness)

        this.validateOnPremiseData(data)
        return data
      })

      await OnPremiseData.insertMany(onPremiseDataRecords)
      this.logger.info(`Successfully uploaded CSV with uploadId: ${uploadId}`)
      return uploadId
    } catch (error) {
      this.logger.error('Error uploading CSV:', error)
      throw error
    }
  }

  async getDataByUploadId(uploadId: string): Promise<IOnPremiseData[]> {
    try {
      const data = await OnPremiseData.find({ uploadId }).lean()
      if (!data.length) {
        this.logger.warn(`No data found for uploadId: ${uploadId}`)
        return []
      }
      return data
    } catch (error) {
      this.logger.error('Error fetching on-premise data:', error)
      throw error
    }
  }

  async deleteDataByUploadId(uploadId: string): Promise<boolean> {
    try {
      const result = await OnPremiseData.deleteMany({ uploadId })
      const deleted = result.deletedCount > 0

      if (deleted) {
        this.logger.info(`Deleted data for uploadId: ${uploadId}`)
      }
      return deleted
    } catch (error) {
      this.logger.error('Error deleting on-premise data:', error)
      throw error
    }
  }
}

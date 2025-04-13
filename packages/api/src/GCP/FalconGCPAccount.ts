/*
 * © 2021 Thoughtworks, Inc.
 */

import { v3 } from '@google-cloud/monitoring'
import { ClientOptions } from 'google-gax'
import { BigQuery } from '@google-cloud/bigquery'
import { ProjectsClient } from '@google-cloud/resource-manager'
import { RecommenderClient } from '@google-cloud/recommender'
import {
  InstancesClient,
  DisksClient,
  AddressesClient,
  ImagesClient,
  MachineTypesClient,
} from '@google-cloud/compute'
import { GoogleAuthClient, LookupTableOutput, LookupTableInput, Logger } from '@cloud-carbon-footprint/common'
import {
  ICloudService,
  Region,
  ComputeEstimator,
  StorageEstimator,
  NetworkingEstimator,
  MemoryEstimator,
  UnknownEstimator,
  CloudProviderAccount,
  EmbodiedEmissionsEstimator,
} from '@cloud-carbon-footprint/core'
import {
  configLoader,
  EstimationResult,
  RecommendationResult,
  GroupBy,
} from '@cloud-carbon-footprint/common'
import { BillingExportTable, ComputeEngine } from '@cloud-carbon-footprint/gcp'
import { GCP_CLOUD_CONSTANTS, getGCPEmissionsFactors } from '@cloud-carbon-footprint/gcp'
import { ServiceWrapper } from './lib/ServiceWrapper'
import { Recommendations } from './lib/Recommendations'
import FalconGCPAuthService from './FalconGCPAuthService'
import { AuthClientWrapper } from './lib/AuthClientWrapper'
import axios from 'axios'
import http from 'http'

export default class FalconGCPAccount extends CloudProviderAccount {
  private googleAuthClient: GoogleAuthClient | null = null
  private authService: FalconGCPAuthService
  private readonly logger: Logger

  constructor(
    public id: string,
    public name: string,
    private regions: string[],
    private wifConfigId: string,
  ) {
    super()
    this.authService = new FalconGCPAuthService()
    this.logger = new Logger('FalconGCPAccount')
  }

  private async getIMDSv2Token(): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = http.request({
        hostname: '169.254.169.254',
        path: '/latest/api/token',
        method: 'PUT',
        timeout: 5000,
        headers: {
          'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Token request failed with status: ${response.statusCode}`))
          return
        }

        let data = ''
        response.on('data', (chunk) => data += chunk)
        response.on('end', () => resolve(data))
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('Token request timed out'))
      })

      request.end()
    })
  }

  private async httpGet(path: string): Promise<string> {
    try {
      // Get IMDSv2 token first
      const token = await this.getIMDSv2Token()
      
      return new Promise((resolve, reject) => {
        const request = http.get({
          hostname: '169.254.169.254',
          path: path,
          timeout: 5000,
          headers: {
            'X-aws-ec2-metadata-token': token
          }
        }, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Request failed with status: ${response.statusCode}`))
            return
          }

          let data = ''
          response.on('data', (chunk) => data += chunk)
          response.on('end', () => resolve(data))
        })

        request.on('error', reject)
        request.on('timeout', () => {
          request.destroy()
          reject(new Error('Request timed out'))
        })
      })
    } catch (error) {
      this.logger.error(`Error in httpGet for path ${path}:`, error)
      throw error
    }
  }

  private async testAWSMetadataAccess(): Promise<void> {
    try {
      this.logger.info('Testing AWS metadata service access...')
      
      // Test IMDSv2 token first
      this.logger.info('Getting IMDSv2 token...')
      await this.getIMDSv2Token()
      this.logger.info('Successfully obtained IMDSv2 token')
      
      // Test region access
      this.logger.info('Testing region endpoint...')
      const region = await this.httpGet('/latest/meta-data/placement/availability-zone')
      this.logger.info(`Successfully accessed region: ${region}`)
      
      // Test credentials access
      this.logger.info('Testing credentials endpoint...')
      const roleName = await this.httpGet('/latest/meta-data/iam/security-credentials')
      this.logger.info(`Successfully accessed credentials path, found role: ${roleName}`)
      
      // Test specific role credentials
      this.logger.info(`Testing role credentials for: ${roleName}`)
      const credentials = await this.httpGet(`/latest/meta-data/iam/security-credentials/${roleName}`)
      this.logger.info('Successfully accessed role credentials')
      
    } catch (error) {
      this.logger.error(`AWS metadata service test failed: ${error.message}`, error)
      throw new Error(`AWS metadata service access failed: ${error.message}`)
    }
  }

  private async getAuthClient(): Promise<GoogleAuthClient> {
    if (!this.googleAuthClient) {
      this.googleAuthClient = await this.authService.getAuthenticatedClient(this.wifConfigId)
    }
    return this.googleAuthClient
  }

  private async getWrappedAuthClient(): Promise<AuthClientWrapper> {
    const authClient = await this.getAuthClient()
    return new AuthClientWrapper(authClient)
  }

  async getDataForRegions(
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
    const authClient = await this.getWrappedAuthClient()
    const options: ClientOptions = {
      projectId: this.id,
      authClient,
    }
    const estimationResults = await Promise.all(
      this.regions.map(async (regionId) => {
        return await this.getDataForRegion(
          regionId,
          startDate,
          endDate,
          grouping,
        )
      }),
    )
    return estimationResults.flat()
  }

  async getDataForRegion(
    regionId: string,
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
    const gcpServices = this.getServices()
    const gcpConstants = {
      minWatts: GCP_CLOUD_CONSTANTS.MIN_WATTS_MEDIAN,
      maxWatts: GCP_CLOUD_CONSTANTS.MAX_WATTS_MEDIAN,
      powerUsageEffectiveness: GCP_CLOUD_CONSTANTS.getPUE(),
    }
    const region = new Region(
      regionId,
      gcpServices,
      getGCPEmissionsFactors(),
      gcpConstants,
    )
    return await this.getRegionData('GCP', region, startDate, endDate, grouping)
  }

  private async testBigQueryAccess(): Promise<void> {
    try {
      // First test AWS metadata access
      await this.testAWSMetadataAccess()
      
      this.logger.info('Testing BigQuery access...')
      const authClient = await this.getWrappedAuthClient()
      const bigquery = new BigQuery({ 
        projectId: this.id,
        authClient,
      })

      // Test dataset listing
      this.logger.info('Testing dataset listing...')
      const [datasets] = await bigquery.getDatasets()
      this.logger.info(`Successfully listed ${datasets.length} datasets`)

      // Test simple query
      this.logger.info('Testing simple query execution...')
      const tableName = configLoader().GCP.BIG_QUERY_TABLE
      const query = `SELECT COUNT(*) as count FROM \`${tableName}\` LIMIT 1`
      
      this.logger.info('Creating query job...')
      const [job] = await bigquery.createQueryJob({
        query,
        location: 'US'
      })
      
      this.logger.info('Getting query results...')
      const [rows] = await job.getQueryResults()
      this.logger.info(`Query successful. Row count: ${rows[0].count}`)

    } catch (error) {
      this.logger.error('BigQuery test failed:', error)
      if (error.response?.data) {
        this.logger.error('Error response:', error.response.data)
      }
      throw error
    }
  }

  async getDataFromBillingExportTable(
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
    try {
      // Run test before actual query
      await this.testBigQueryAccess()
      
      this.logger.info('Proceeding with main billing data query...')
      const authClient = await this.getWrappedAuthClient()
      const bigquery = new BigQuery({ 
        projectId: this.id,
        authClient,
      })
      
      const billingExportTableService = new BillingExportTable(
        new ComputeEstimator(),
        new StorageEstimator(GCP_CLOUD_CONSTANTS.SSDCOEFFICIENT),
        new StorageEstimator(GCP_CLOUD_CONSTANTS.HDDCOEFFICIENT),
        new NetworkingEstimator(GCP_CLOUD_CONSTANTS.NETWORKING_COEFFICIENT),
        new MemoryEstimator(GCP_CLOUD_CONSTANTS.MEMORY_COEFFICIENT),
        new UnknownEstimator(GCP_CLOUD_CONSTANTS.ESTIMATE_UNKNOWN_USAGE_BY),
        new EmbodiedEmissionsEstimator(
          GCP_CLOUD_CONSTANTS.SERVER_EXPECTED_LIFESPAN,
        ),
        bigquery,
      )
      
      return await billingExportTableService.getEstimates(
        startDate,
        endDate,
        grouping,
      )
    } catch (error) {
      this.logger.error('Error in getDataFromBillingExportTable:', error)
      throw error
    }
  }

  static async getBillingExportDataFromInputData(
    inputData: LookupTableInput[],
  ): Promise<LookupTableOutput[]> {
    const billingExportTableService = new BillingExportTable(
      new ComputeEstimator(),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.SSDCOEFFICIENT),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.HDDCOEFFICIENT),
      new NetworkingEstimator(GCP_CLOUD_CONSTANTS.NETWORKING_COEFFICIENT),
      new MemoryEstimator(GCP_CLOUD_CONSTANTS.MEMORY_COEFFICIENT),
      new UnknownEstimator(GCP_CLOUD_CONSTANTS.ESTIMATE_UNKNOWN_USAGE_BY),
      new EmbodiedEmissionsEstimator(
        GCP_CLOUD_CONSTANTS.SERVER_EXPECTED_LIFESPAN,
      ),
    )
    return await billingExportTableService.getEstimatesFromInputData(inputData)
  }

  getServices(): ICloudService[] {
    return configLoader().GCP.CURRENT_SERVICES.map(({ key }) => {
      return this.getService(key)
    })
  }

  async getDataForRecommendations(): Promise<RecommendationResult[]> {
    const authClient = await this.getWrappedAuthClient()

    const serviceWrapper = new ServiceWrapper(
      new ProjectsClient(),
      authClient,
      new InstancesClient(),
      new DisksClient(),
      new AddressesClient(),
      new ImagesClient(),
      new MachineTypesClient(),
      new RecommenderClient(),
    )

    const recommendations = new Recommendations(
      new ComputeEstimator(),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.HDDCOEFFICIENT),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.SSDCOEFFICIENT),
      serviceWrapper,
    )

    return await recommendations.getRecommendations()
  }

  private getService(key: string): ICloudService {
    if (this.services[key] === undefined)
      throw new Error('Unsupported service: ' + key)
    const options: ClientOptions = {
      projectId: this.id,
      authClient: this.googleAuthClient ? new AuthClientWrapper(this.googleAuthClient) : undefined,
    }
    return this.services[key](options)
  }

  private services: {
    [id: string]: (options: ClientOptions) => ICloudService
  } = {
    computeEngine: (options) => {
      return new ComputeEngine(new v3.MetricServiceClient(options))
    },
  }
}

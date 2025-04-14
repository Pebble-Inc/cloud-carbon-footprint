/*
 * © 2021 Thoughtworks, Inc.
 */

import {
  configLoader,
  EstimationResult, GoogleAuthClient, GroupBy, Logger, LookupTableInput, LookupTableOutput, RecommendationResult
} from '@cloud-carbon-footprint/common'
import {
  CloudProviderAccount,
  ComputeEstimator,
  EmbodiedEmissionsEstimator,
  ICloudService,
  MemoryEstimator,
  NetworkingEstimator,
  Region,
  StorageEstimator,
  UnknownEstimator,
} from '@cloud-carbon-footprint/core'
import { BillingExportTable, ComputeEngine, GCP_CLOUD_CONSTANTS, getGCPEmissionsFactors } from '@cloud-carbon-footprint/gcp'
import { BigQuery } from '@google-cloud/bigquery'
import {
  AddressesClient,
  DisksClient,
  ImagesClient,
  InstancesClient,
  MachineTypesClient,
} from '@google-cloud/compute'
import { v3 } from '@google-cloud/monitoring'
import { RecommenderClient } from '@google-cloud/recommender'
import { ProjectsClient } from '@google-cloud/resource-manager'
import { ClientOptions } from 'google-gax'
import http from 'http'
import FalconGCPAuthService from './FalconGCPAuthService'
import { AuthClientWrapper } from './lib/AuthClientWrapper'
import { Recommendations } from './lib/Recommendations'
import { ServiceWrapper } from './lib/ServiceWrapper'

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
    this.logger.info('Getting IMDSv2 token...')
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
          const error = new Error(`Token request failed with status: ${response.statusCode}`)
          this.logger.error('Token request failed', error)
          reject(error)
          return
        }

        let data = ''
        response.on('data', (chunk) => data += chunk)
        response.on('end', () => {
          this.logger.info('Successfully obtained IMDSv2 token')
          resolve(data)
        })
      })

      request.on('error', (error) => {
        this.logger.error('Error getting IMDSv2 token', error)
        reject(error)
      })
      request.on('timeout', () => {
        const error = new Error('Token request timed out')
        this.logger.error('IMDSv2 token request timed out', error)
        request.destroy()
        reject(error)
      })

      request.end()
    })
  }

  private async httpGet(path: string): Promise<string> {
    this.logger.info(`Making HTTP GET request to ${path}`)
    try {
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
            const error = new Error(`Request failed with status: ${response.statusCode}`)
            this.logger.error('Request failed', error)
            reject(error)
            return
          }

          let data = ''
          response.on('data', (chunk) => data += chunk)
          response.on('end', () => {
            this.logger.info(`Successfully retrieved data from ${path}`)
            resolve(data)
          })
        })

        request.on('error', (error) => {
          this.logger.error(`Error in httpGet for path ${path}`, error)
          reject(error)
        })
        request.on('timeout', () => {
          const error = new Error('Request timed out')
          this.logger.error(`Request timed out for path ${path}`, error)
          request.destroy()
          reject(error)
        })
      })
    } catch (error) {
      this.logger.error(`Error in httpGet for path ${path}`, error)
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
    this.logger.info('Getting auth client...')
    if (!this.googleAuthClient) {
      this.logger.info('No existing auth client, creating new one...')
      const auth = await this.authService.getAuthenticatedClient(this.wifConfigId)
      this.logger.info('Successfully obtained authenticated client')
      this.googleAuthClient = auth
    } else {
      this.logger.info('Using existing auth client')
    }
    return this.googleAuthClient
  }

  private async getWrappedAuthClient(): Promise<AuthClientWrapper> {
    this.logger.info('Getting wrapped auth client...')
    const authClient = await this.getAuthClient()
    const wrappedClient = new AuthClientWrapper(authClient)
    this.logger.info('Successfully created wrapped auth client')
    return wrappedClient
  }

  async getDataForRegions(
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
    this.logger.info('Getting data for regions...')
    const authClient = await this.getWrappedAuthClient()
    const options: ClientOptions = {
      projectId: this.id,
      authClient,
    }
    this.logger.info(`Using project ID: ${this.id}`)
    
    const estimationResults = await Promise.all(
      this.regions.map(async (regionId) => {
        this.logger.info(`Processing region: ${regionId}`)
        return await this.getDataForRegion(
          regionId,
          startDate,
          endDate,
          grouping,
        )
      }),
    )
    this.logger.info(`Completed processing ${estimationResults.length} regions`)
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
      
      // Get WIF configuration
      this.logger.info('Getting WIF configuration...')
      const wifConfig = await this.authService.getWIFConfig(this.wifConfigId)

      // Get region using our working method
      this.logger.info('Getting AWS region...')
      const region = await this.httpGet('/latest/meta-data/placement/availability-zone')
      const awsRegion = region.slice(0, -1) // Remove availability zone letter
      this.logger.info(`Using AWS region: ${awsRegion}`)
      
      // Try direct initialization with external account config
      this.logger.info('Testing BigQuery with external account configuration...')
      const bigqueryDirect = new BigQuery({ 
        projectId: this.id,
        location: awsRegion,
        credentials: {
          ...wifConfig.config,
          credential_source: {
            ...wifConfig.config.credential_source,
            region_url: undefined, // Disable automatic region fetching
            imdsv2_session_token_url: 'http://169.254.169.254/latest/api/token'
          }
        }
      })

      // Test dataset listing with direct config
      this.logger.info('Testing dataset listing with external account config...')
      try {
        const [datasets] = await bigqueryDirect.getDatasets()
        this.logger.info(`Successfully listed ${datasets.length} datasets using external account config`)
        return
      } catch (error) {
        this.logger.error('Failed to list datasets with external account config:', error)
        
        // Fallback to original auth client approach
        this.logger.info('Falling back to auth client approach...')
        const authClient = await this.getWrappedAuthClient()
        const bigquery = new BigQuery({ 
          projectId: this.id,
          location: awsRegion,
          authClient,
        })
        
        const [datasets] = await bigquery.getDatasets()
        this.logger.info(`Successfully listed ${datasets.length} datasets using auth client`)
      }

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

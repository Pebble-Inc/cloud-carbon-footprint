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
import { GoogleAuthClient, LookupTableOutput, LookupTableInput } from '@cloud-carbon-footprint/common'
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

export default class FalconGCPAccount extends CloudProviderAccount {
  private googleAuthClient: GoogleAuthClient | null = null
  private authService: FalconGCPAuthService

  constructor(
    public id: string,
    public name: string,
    private regions: string[],
    private wifConfigId: string,
  ) {
    super()
    this.authService = new FalconGCPAuthService()
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

  async getDataFromBillingExportTable(
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
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

/*
 * © 2024 Thoughtworks, Inc.
 */

import { v3 } from '@google-cloud/monitoring'
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
  Logger,
} from '@cloud-carbon-footprint/common'
import { BillingExportTable, ComputeEngine, Recommendations } from '@cloud-carbon-footprint/gcp'
import { GCP_CLOUD_CONSTANTS, getGCPEmissionsFactors } from '@cloud-carbon-footprint/gcp'

export default class FalconGCPAccount extends CloudProviderAccount {
  private readonly logger: Logger
  private readonly bigQuery: BigQuery
  private readonly monitoring: v3.MetricServiceClient
  private readonly projects: ProjectsClient
  private readonly recommender: RecommenderClient
  private readonly instances: InstancesClient
  private readonly disks: DisksClient
  private readonly addresses: AddressesClient
  private readonly images: ImagesClient
  private readonly machineTypes: MachineTypesClient

  constructor(
    public id: string,
    public name: string,
    private regions: string[],
    clients: {
      bigQuery: BigQuery
      monitoring: v3.MetricServiceClient
      projects: ProjectsClient
      recommender: RecommenderClient
      instances: InstancesClient
      disks: DisksClient
      addresses: AddressesClient
      images: ImagesClient
      machineTypes: MachineTypesClient
    }
  ) {
    super()
    this.logger = new Logger('FalconGCPAccount')
    this.bigQuery = clients.bigQuery
    this.monitoring = clients.monitoring
    this.projects = clients.projects
    this.recommender = clients.recommender
    this.instances = clients.instances
    this.disks = clients.disks
    this.addresses = clients.addresses
    this.images = clients.images
    this.machineTypes = clients.machineTypes
  }

  async getDataForRegions(
    startDate: Date,
    endDate: Date,
    grouping: GroupBy,
  ): Promise<EstimationResult[]> {
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
      this.bigQuery,
    )
    return await billingExportTableService.getEstimates(
      startDate,
      endDate,
      grouping,
    )
  }

  getServices(): ICloudService[] {
    return configLoader().GCP.CURRENT_SERVICES.map(({ key }) => {
      return this.getService(key)
    })
  }

  async getDataForRecommendations(): Promise<RecommendationResult[]> {
    const recommendations = new Recommendations(
      new ComputeEstimator(),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.HDDCOEFFICIENT),
      new StorageEstimator(GCP_CLOUD_CONSTANTS.SSDCOEFFICIENT),
      {
        getActiveProjectsAndZones: async () => {
          // Implement using this.projects client
          return []
        },
        getInstanceDetails: async (projectId: string, instanceId: string, zone: string) => {
          const [instance] = await this.instances.get({
            project: projectId,
            zone,
            instance: instanceId,
          })
          return instance
        },
        getMachineTypeDetails: async (projectId: string, machineType: string, zone: string) => {
          const [machineTypeDetails] = await this.machineTypes.get({
            project: projectId,
            zone,
            machineType,
          })
          return machineTypeDetails
        },
        getImageDetails: async (projectId: string, imageId: string) => {
          const [image] = await this.images.get({
            project: projectId,
            image: imageId,
          })
          return image
        },
      },
    )

    return await recommendations.getRecommendations()
  }

  private getService(key: string): ICloudService {
    if (key === 'computeEngine') {
      return new ComputeEngine(this.monitoring)
    }
    throw new Error('Unsupported service: ' + key)
  }
} 
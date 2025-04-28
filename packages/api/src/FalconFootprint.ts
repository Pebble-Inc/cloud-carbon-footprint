/*
 * © 2024 Thoughtworks, Inc.
 */

import {
  configLoader,
  EstimationResult,
  GroupBy,
  RecommendationResult,
  RecommendationsRequestValidationError,
} from '@cloud-carbon-footprint/common'
import {
  createValidRecommendationsRequest,
  FootprintEstimatesRawRequest,
  Tags,
} from '@cloud-carbon-footprint/app'
import { Logger } from '@cloud-carbon-footprint/common'
import { createValidFootprintRequest } from '@cloud-carbon-footprint/app'
import { App } from '@cloud-carbon-footprint/app'
import { setConfig } from '@cloud-carbon-footprint/common'
import TenantConfigService from './TenantConfigServiceApi'
import {
  EstimationRequestValidationError,
  PartialDataError,
} from '@cloud-carbon-footprint/common'
import { mergeConfig } from './mergeConfig'
import { ITenantConfig } from './ITenantConfig'
import FalconGCPAccount from './GCP/FalconGCPAccount'
import { AccountDetails } from '@cloud-carbon-footprint/common'
interface EstimationRequest {
  startDate: Date
  endDate: Date
  cloudProviderToSeed?: string
  ignoreCache: boolean
  groupBy?: string
  limit?: number
  skip?: number
  cloudProviders?: string[]
  accounts?: string[]
  services?: string[]
  regions?: string[]
  tags?: Tags
}

export interface FootprintV2EstimatesRawRequest {
  startDate?: string
  endDate?: string
  cloudProviderToSeed?: string
  ignoreCache?: string
  groupBy?: string
  limit?: string
  skip?: string
  cloudProviders?: string[]
  accounts?: string[]
  services?: string[]
  regions?: string[]
  tags?: Tags
  configs?: string[]
  tenantId: string
}

export interface RecommendationsV2RawRequest {
  awsRecommendationTarget?: string
  configs?: string[]
  tenantId: string
}

export class FalconFootprint {
  private logger: Logger
  private tenantConfigService: TenantConfigService
  private readonly serviceNameMappings: Record<string, Record<string, string>> =
    {
      AWS: {
        s3: 'AmazonS3',
        ec2: 'AmazonEC2',
        lambda: 'AWSLambda',
        rds: 'AmazonRDS',
        elasticache: 'AmazonElastiCache',
        ebs: 'AmazonEBS',
      },
      GCP: {
        computeEngine: 'ComputeEngine',
      },
      AZURE: {
        virtualmachine: 'VirtualMachine',
      },
      ALI: {
        compute: 'AliCompute',
      },
    }

  constructor() {
    this.logger = new Logger('FalconFootprint')
    this.tenantConfigService = new TenantConfigService()
  }

  public async processFootprintRequest(
    rawRequest: FootprintV2EstimatesRawRequest,
  ): Promise<EstimationResult[]> {
    const tenantId = rawRequest.tenantId
    if (!tenantId) {
      throw new Error('Tenant ID parameter not specified')
    }

    const allTenantConfigs =
      await this.tenantConfigService.getConfigsByTenantId(tenantId)

    const { configs, ...rest } = rawRequest
    const estimationResults: EstimationResult[] = []

    const configsToUse =
      configs && configs.length > 0
        ? allTenantConfigs.filter((config) => configs.includes(config.configId))
        : allTenantConfigs

    const initialConfig = configLoader()

    for (const config of configsToUse) {
      try {
        if (!config) {
          throw new Error(
            `Configuration not found for account: ${config.configId}`,
          )
        }

        const footprintApp = new App()
        setConfig(initialConfig)
        const newConfig = mergeConfig(config.configDoc)
        setConfig(newConfig)

        const estimationRequest = createValidFootprintRequest({
          ...rest,
        })
        const results = await (this.isGCPConfig(config)
          ? this.getGCPData(config, estimationRequest)
          : footprintApp.getCostAndEstimates(estimationRequest))
        const filteredResults = this.applyFilters(results, rawRequest)
        estimationResults.push(...filteredResults)
      } catch (e) {
        this.logger.info(`Error processing config ${JSON.stringify(config)}:`)
        this.logger.error(`Error processing config ${config.configId}:`, e)
        if (e instanceof EstimationRequestValidationError) {
          throw new Error(
            `Invalid request for config ${config.configId}: ${e.message}`,
          )
        } else if (e instanceof PartialDataError) {
          throw new Error(
            `Partial data error for config ${config.configId}: ${e.message}`,
          )
        } else {
          throw new Error(
            `Internal server error processing config ${config.configId}`,
          )
        }
      }
    }

    return estimationResults
  }

  private applyFilters(
    results: EstimationResult[],
    request: FootprintEstimatesRawRequest,
  ): EstimationResult[] {
    const { services } = request

    return results.map((result) => ({
      ...result,
      serviceEstimates: result.serviceEstimates.filter((estimate) => {
        // Skip filtering if no services specified
        if (!services || services.length === 0) {
          return true
        }

        // Get the cloud provider for this estimate
        const cloudProvider = estimate.cloudProvider

        // If no mapping exists for this cloud provider, keep all estimates
        if (!this.serviceNameMappings[cloudProvider]) {
          return true
        }

        // Get the mapping for this cloud provider
        const providerMappings = this.serviceNameMappings[cloudProvider]

        // Check if any of the requested service keys map to this service name
        // If a requested service has no mapping, keep those estimates
        return services.some((requestedKey) => {
          const mappedName = providerMappings[requestedKey.toLowerCase()]
          // If no mapping exists for this service key, keep the estimate
          if (!mappedName) {
            return true
          }
          return mappedName === estimate.serviceName
        })
      }),
    }))
  }

  public async processRecommendationsRequest(
    rawRequest: RecommendationsV2RawRequest,
  ): Promise<RecommendationResult[]> {
    const tenantId = rawRequest.tenantId
    if (!tenantId) {
      throw new Error('Tenant ID parameter not specified')
    }

    const allTenantConfigs =
      await this.tenantConfigService.getConfigsByTenantId(tenantId)
    const { configs, ...rest } = rawRequest
    const recommendationsResults: RecommendationResult[] = []

    const configsToUse =
      configs && configs.length > 0
        ? allTenantConfigs.filter((config) => configs.includes(config.configId))
        : allTenantConfigs

    const initialConfig = configLoader()

    for (const config of configsToUse) {
      try {
        if (!config) {
          throw new Error(
            `Configuration not found for config: ${config.configId}`,
          )
        }

        // Handle GCP recommendations separately if GCP is configured
        if (config.configDoc.GCP) {
          // const gcpConfig = config.configDoc.GCP
          // const gcpAccount = await this.gcpAccountFactory.createGCPAccount(
          //   config.configId,
          //   gcpConfig.BILLING_PROJECT_ID,
          //   gcpConfig.CURRENT_REGIONS,
          // )
          // const gcpRecommendations =
          //   await gcpAccount.getDataForRecommendations()
          // recommendationsResults.push(...gcpRecommendations)
        } else {
          // Handle other cloud providers as before
          const footprintApp = new App()
          setConfig(initialConfig)
          const newConfig = mergeConfig(config.configDoc)
          setConfig(newConfig)
          const recommendationsRequest = createValidRecommendationsRequest(rest)
          const results = await footprintApp.getRecommendations(
            recommendationsRequest,
          )
          recommendationsResults.push(...results)
        }
      } catch (e) {
        this.logger.error(
          `Error processing recommendations for config ${config.configId}:`,
          e,
        )
        if (e instanceof RecommendationsRequestValidationError) {
          throw new Error(
            `Invalid request for config ${config.configId}: ${e.message}`,
          )
        } else {
          throw new Error(
            `Internal server error processing config ${config.configId}`,
          )
        }
      }
    }

    return recommendationsResults
  }

  private async getGCPData(
    config: ITenantConfig,
    request: EstimationRequest,
  ): Promise<EstimationResult[]> {
    const { GCP } = config.configDoc
    const gcpResults: EstimationResult[] = []

    const { startDate, endDate } = request
    const grouping = request.groupBy as GroupBy

    if (!GCP?.BILLING_PROJECT_ID) {
      this.logger.info(
        'No GCP Billing Project ID found, skipping GCP Estimates',
      )
      return []
    }
    this.logger.info(`GCP Config: ${JSON.stringify(GCP)}`)

    if (GCP?.INCLUDE_ESTIMATES) {
      this.logger.info('Starting GCP Estimations')
      if (GCP?.USE_BILLING_DATA) {
        const estimates = await new FalconGCPAccount(
          GCP.BILLING_PROJECT_ID,
          GCP.BILLING_PROJECT_NAME,
          [],
          GCP.WIF_CONFIG_ID,
        ).getDataFromBillingExportTable(startDate, endDate, grouping)
        gcpResults.push(...estimates)
      } else if (GCP?.projects.length) {
        const googleProjectDetails = GCP.projects as AccountDetails[]
        // Resolve GCP Estimates asynchronously
        for (const project of googleProjectDetails) {
          const estimates = await Promise.all(
            await new FalconGCPAccount(
              project.id,
              project.name,
              GCP.CURRENT_REGIONS,
              GCP.WIF_CONFIG_ID,
            ).getDataForRegions(startDate, endDate, grouping),
          )
          gcpResults.push(...estimates)
        }
      }
      this.logger.info('Finished GCP Estimations')
    }
    this.logger.info(
      `GCP Results before filtering: ${JSON.stringify(gcpResults)}`,
    )
    return gcpResults
  }

  private isGCPConfig(config: ITenantConfig): boolean {
    return Boolean(config.configDoc.GCP?.BILLING_PROJECT_ID)
  }
}

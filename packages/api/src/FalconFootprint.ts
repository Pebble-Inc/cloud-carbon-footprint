import {
  EstimationResult,
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
import { mergeConfig, setConfig } from '@cloud-carbon-footprint/common'
import TenantConfigService from './TenantConfigServiceApi'
import {
  EstimationRequestValidationError,
  PartialDataError,
} from '@cloud-carbon-footprint/common'

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

    for (const config of configsToUse) {
      try {
        if (!config) {
          throw new Error(
            `Configuration not found for account: ${config.configId}`,
          )
        }

        const footprintApp = new App()
        const newConfig = mergeConfig(config.configDoc)
        setConfig(newConfig)
        const estimationRequest = createValidFootprintRequest({
          ...rest,
        })
        const results = await footprintApp.getCostAndEstimates(
          estimationRequest,
        )

        // Apply filters before adding to results
        const filteredResults = this.applyFilters(results, rawRequest)
        estimationResults.push(...filteredResults)
      } catch (e) {
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
        // Apply service filter if specified
        if (services && services.length > 0) {
          return services.includes(estimate.serviceName)
        }
        return true
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

    for (const config of configsToUse) {
      try {
        if (!config) {
          throw new Error(
            `Configuration not found for config: ${config.configId}`,
          )
        }

        const footprintApp = new App()
        const newConfig = mergeConfig(config.configDoc)
        setConfig(newConfig)
        const recommendationsRequest = createValidRecommendationsRequest(rest)
        const results = await footprintApp.getRecommendations(
          recommendationsRequest,
        )
        recommendationsResults.push(...results)
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
}

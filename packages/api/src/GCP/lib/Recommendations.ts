/*
 * © 2021 Thoughtworks, Inc.
 */
import {
  ComputeEstimator,
  StorageEstimator,
} from '@cloud-carbon-footprint/core'
import { ServiceWrapper } from './ServiceWrapper'
import { RECOMMENDATION_TYPES } from './RecommendationsTypes'
import { RecommendationResult } from '@cloud-carbon-footprint/common'

export class Recommendations {
  constructor(
    private readonly computeEstimator: ComputeEstimator,
    private readonly ssdStorageEstimator: StorageEstimator,
    private readonly hddStorageEstimator: StorageEstimator,
    private readonly serviceWrapper: ServiceWrapper,
  ) {}

  async getRecommendations(): Promise<RecommendationResult[]> {
    const activeProjectsAndZones = await this.serviceWrapper.getActiveProjectsAndZones()
    const recommendations = []

    for (const project of activeProjectsAndZones) {
      const recommenderIds = Object.values(RECOMMENDATION_TYPES)
      const projectRecommendations = await this.serviceWrapper.getRecommendationsForRecommenderIds(
        project.id,
        project.zones[0],
        recommenderIds,
      )
      recommendations.push(...projectRecommendations)
    }

    return recommendations
  }
} 
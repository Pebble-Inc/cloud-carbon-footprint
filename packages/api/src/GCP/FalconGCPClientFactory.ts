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
import FalconGCPAuthService from './FalconGCPAuthService'

export default class FalconGCPClientFactory {
  private readonly authService: FalconGCPAuthService

  constructor() {
    this.authService = new FalconGCPAuthService()
  }

  async createBigQueryClient(configId: string): Promise<BigQuery> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new BigQuery({ auth })
  }

  async createMonitoringClient(configId: string): Promise<v3.MetricServiceClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new v3.MetricServiceClient({ auth })
  }

  async createProjectsClient(configId: string): Promise<ProjectsClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new ProjectsClient({ auth })
  }

  async createRecommenderClient(configId: string): Promise<RecommenderClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new RecommenderClient({ auth })
  }

  async createInstancesClient(configId: string): Promise<InstancesClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new InstancesClient({ auth })
  }

  async createDisksClient(configId: string): Promise<DisksClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new DisksClient({ auth })
  }

  async createAddressesClient(configId: string): Promise<AddressesClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new AddressesClient({ auth })
  }

  async createImagesClient(configId: string): Promise<ImagesClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new ImagesClient({ auth })
  }

  async createMachineTypesClient(configId: string): Promise<MachineTypesClient> {
    const auth = await this.authService.getAuthenticatedClient(configId)
    return new MachineTypesClient({ auth })
  }
} 
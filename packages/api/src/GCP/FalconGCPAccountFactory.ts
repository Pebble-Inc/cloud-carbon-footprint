/*
 * © 2024 Thoughtworks, Inc.
 */

import FalconGCPClientFactory from './FalconGCPClientFactory'
import { Logger } from '@cloud-carbon-footprint/common'
import FalconGCPAccount from './FalconGCPAccount'

export default class FalconGCPAccountFactory {
  private readonly logger: Logger
  private readonly clientFactory: FalconGCPClientFactory

  constructor() {
    this.logger = new Logger('FalconGCPAccountFactory')
    this.clientFactory = new FalconGCPClientFactory()
  }

  async createGCPAccount(
    configId: string,
    projectId: string,
    regions: string[],
  ): Promise<FalconGCPAccount> {
    try {
      const bigQuery = await this.clientFactory.createBigQueryClient(configId)
      const monitoring = await this.clientFactory.createMonitoringClient(configId)
      const projects = await this.clientFactory.createProjectsClient(configId)
      const recommender = await this.clientFactory.createRecommenderClient(configId)
      const instances = await this.clientFactory.createInstancesClient(configId)
      const disks = await this.clientFactory.createDisksClient(configId)
      const addresses = await this.clientFactory.createAddressesClient(configId)
      const images = await this.clientFactory.createImagesClient(configId)
      const machineTypes = await this.clientFactory.createMachineTypesClient(configId)

      return new FalconGCPAccount(projectId, 'GCP Account', regions, {
        bigQuery,
        monitoring,
        projects,
        recommender,
        instances,
        disks,
        addresses,
        images,
        machineTypes,
      })
    } catch (error) {
      this.logger.error('Error creating FalconGCPAccount:', error)
      throw error
    }
  }
} 
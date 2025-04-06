/*
 * © 2023 Thoughtworks, Inc.
 */

import express from 'express'
import mongoose from 'mongoose'

import {
  App,
  createValidFootprintRequest,
  createValidRecommendationsRequest,
  FootprintEstimatesRawRequest,
  RecommendationsRawRequest,
  Tags,
} from '@cloud-carbon-footprint/app'

import TenantConfigService from './TenantConfigServiceApi'
import TestConnectionService from './TestConnectionService'
import {
  EstimationRequestValidationError,
  Logger,
  PartialDataError,
  RecommendationsRequestValidationError,
  configLoader,
  setConfig,
} from '@cloud-carbon-footprint/common'

import { mergeConfig } from './mergeConfig'
import { FalconFootprint } from './FalconFootprint'

const apiLogger = new Logger('api')

/**
 * Middleware that loads configuration based on x-config-id header.
 * If no config ID is provided or no configuration is found, falls back to environment variables.
 */
export const TenantConfigMiddleware = async function (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  const configId = req.headers['x-config-id'] as string

  if (!configId) {
    apiLogger.info(
      'No config ID provided, using default environment configuration',
    )
    return next()
  }

  try {
    const tenantConfigService = new TenantConfigService()
    const config = await tenantConfigService.getConfigById(configId)

    if (!config) {
      apiLogger.warn(`No configuration found for configId: ${configId}`)
      return next()
    }

    const newConfig = mergeConfig(config.configDoc)
    setConfig(newConfig)
    next()
  } catch (error) {
    apiLogger.error('Error loading configuration:', error)
    res.status(500).json({ error: 'Error loading configuration' })
  }
}

/**
 * Handles the fetching and calculations of cloud footprint estimates for a given date range.
 *
 * @async
 * @param {express.Request} req - The Express request object containing the request parameters.
 * @returns A response object with the calculated raw footprint estimates.
 */
export const FootprintApiMiddleware = async function (
  req: express.Request,
  res: express.Response,
): Promise<void> {
  // Set the request time out to 10 minutes to allow the request enough time to complete.
  req.socket.setTimeout(1000 * 60 * 10)
  const rawRequest: FootprintEstimatesRawRequest = {
    startDate: req.query.start?.toString(),
    endDate: req.query.end?.toString(),
    ignoreCache: req.query.ignoreCache?.toString(),
    groupBy: req.query.groupBy?.toString(),
    limit: req.query.limit?.toString(),
    skip: req.query.skip?.toString(),
    cloudProviders: req.query.cloudProviders as string[],
    accounts: req.query.accounts as string[],
    services: req.query.services as string[],
    regions: req.query.regions as string[],
    tags: req.query.tags as Tags,
  }
  apiLogger.info(`Footprint API request started.`)
  apiLogger.info(
    `**debug: config in footprint middleware: ${JSON.stringify(
      configLoader(),
    )}`,
  )
  if (!rawRequest.groupBy) {
    apiLogger.warn('GroupBy parameter not specified, adopting default "day"')
    rawRequest.groupBy = 'day'
  }
  const footprintApp = new App()
  try {
    const estimationRequest = createValidFootprintRequest(rawRequest)
    const estimationResults = await footprintApp.getCostAndEstimates(
      estimationRequest,
    )
    res.json(estimationResults)
  } catch (e) {
    apiLogger.error(`Unable to process footprint request.`, e)
    if (
      e.constructor.name ===
      EstimationRequestValidationError.prototype.constructor.name
    ) {
      res.status(400).send(e.message)
    } else if (
      e.constructor.name === PartialDataError.prototype.constructor.name
    ) {
      res.status(416).send(e.message)
    } else res.status(500).send('Internal Server Error')
  }
}

/**
 * Handles the fetching of emissions factors for all regions.
 *
 * @async
 * @returns A response object with the mapped emissions factors for each supported cloud provider region.
 */
export const EmissionsApiMiddleware = async function (
  _req: express.Request,
  res: express.Response,
): Promise<void> {
  apiLogger.info(`Regions emissions factors API request started`)
  const footprintApp = new App()
  try {
    const emissionsResults = await footprintApp.getEmissionsFactors()
    res.json(emissionsResults)
  } catch (e) {
    apiLogger.error(`Unable to process regions emissions factors request.`, e)
    res.status(500).send('Internal Server Error')
  }
}

/**
 * Handles the fetching of cost saving recommendations along with their calculated carbon and energy savings.
 *
 * @async
 * @param {express.Request} req - The Express request object containing the request parameters.
 * @returns A response object with the fetched recommendations and their calculated carbon and energy savings.
 */
export const RecommendationsApiMiddleware = async function (
  req: express.Request,
  res: express.Response,
): Promise<void> {
  const rawRequest: RecommendationsRawRequest = {
    awsRecommendationTarget: req.query.awsRecommendationTarget?.toString(),
  }
  apiLogger.info(`Recommendations API request started`)
  const footprintApp = new App()
  try {
    const estimationRequest = createValidRecommendationsRequest(rawRequest)
    const recommendations = await footprintApp.getRecommendations(
      estimationRequest,
    )
    res.json(recommendations)
  } catch (e) {
    apiLogger.error(`Unable to process recommendations request.`, e)
    if (
      e.constructor.name ===
      RecommendationsRequestValidationError.prototype.constructor.name
    ) {
      res.status(400).send(e.message)
    } else {
      res.status(500).send('Internal Server Error')
    }
  }
}

export const TestConnectionMiddleware = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    // Skip tenant config validation and directly test the AWS connection
    const { configDoc } = req.body
    const testConnectionService = new TestConnectionService()

    // Only test AWS connection for now
    await testConnectionService.testConnection(configDoc)

    res.json({
      success: true,
      message: 'Successfully connected!',
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(400).json({ error: errorMessage })
  }
}

export const HealthCheckMiddleware = async (
  _req: express.Request,
  res: express.Response,
): Promise<void> => {
  const apiLogger = new Logger('HealthCheck')
  const healthStatus = {
    serverAccess: true,
    databaseConnection: false,
    environment: process.env,
    timestamp: new Date().toISOString(),
  }

  try {
    // Log all environment variables
    apiLogger.info('Environment Variables')

    // Check database connection
    try {
      // This will throw an error if mongoose isn't connected
      await mongoose.connection.db.admin().ping()
      healthStatus.databaseConnection = true
      apiLogger.info('Database connection is healthy')
    } catch (error) {
      apiLogger.error('Database connection check failed:', error)
    }

    res.json(healthStatus)
  } catch (error) {
    apiLogger.error('Health check failed:', error)
    res.status(500).json({
      serverAccess: false,
      databaseConnection: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * V2 version of the Footprint API middleware that handles the fetching and calculations of cloud footprint estimates.
 * This version bypasses the tenant middleware and uses direct configuration.
 *
 * @async
 * @param {express.Request} req - The Express request object containing the request parameters.
 * @returns A response object with the calculated raw footprint estimates.
 */
export const FootprintV2ApiMiddleware = async function (
  req: express.Request,
  res: express.Response,
): Promise<void> {
  // Set the request time out to 10 minutes to allow the request enough time to complete.
  req.socket.setTimeout(1000 * 60 * 10)
  const rawRequest: FootprintEstimatesRawRequest = {
    startDate: req.query.start?.toString(),
    endDate: req.query.end?.toString(),
    ignoreCache: req.query.ignoreCache?.toString(),
    groupBy: req.query.groupBy?.toString(),
    limit: req.query.limit?.toString(),
    skip: req.query.skip?.toString(),
    cloudProviders: req.query.cloudProviders as string[],
    accounts: req.query.accounts as string[],
    services: req.query.services as string[],
    regions: req.query.regions as string[],
    tags: req.query.tags as Tags,
  }

  if (!rawRequest.groupBy) {
    apiLogger.warn('GroupBy parameter not specified, adopting default "day"')
    rawRequest.groupBy = 'day'
  }

  const falconFootprint = new FalconFootprint()
  try {
    const estimationResults = await falconFootprint.processFootprintRequest(
      rawRequest,
    )
    res.status(200).json(estimationResults)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    if (errorMessage.includes('Accounts parameter not specified')) {
      res.status(400).json({ error: errorMessage })
    } else if (errorMessage.includes('Invalid request')) {
      res.status(400).json({ error: errorMessage })
    } else if (errorMessage.includes('Partial data error')) {
      res.status(416).json({ error: errorMessage })
    } else {
      res.status(500).json({ error: errorMessage })
    }
  }
}

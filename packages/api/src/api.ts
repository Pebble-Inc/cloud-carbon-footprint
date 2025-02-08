/*
 * © 2021 Thoughtworks, Inc.
 */

import express from 'express'
import { setConfig, CCFConfig } from '@cloud-carbon-footprint/common'
import { TenantConfigService } from '@cloud-carbon-footprint/app'
import {
  FootprintApiMiddleware,
  EmissionsApiMiddleware,
  RecommendationsApiMiddleware,
  TenantMiddleware,
  TestConnectionMiddleware,
  HealthCheckMiddleware,
} from './middleware'

export const createRouter = (config?: CCFConfig) => {
  setConfig(config)
  const router = express.Router()

  console.log('Debug: TenantConfigService type:', typeof TenantConfigService)
  console.log('Debug: TenantConfigService:', TenantConfigService)
  console.log(
    'Debug: TenantConfigService prototype:',
    TenantConfigService.prototype,
  )

  const tenantConfigService = new TenantConfigService()

  // POST /tenant-configs endpoint before applying tenant middleware
  /**
   * @openapi
   * /api/tenant-configs:
   *  post:
   *     tags:
   *     - Tenant Configuration
   *     summary: Creates a new tenant configuration
   *     description: Creates a new tenant configuration with cloud provider settings
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - tenantId
   *             properties:
   *               tenantId:
   *                 type: string
   *                 description: Unique identifier for the tenant
   *               configDoc:
   *                 type: object
   *                 properties:
   *                   AWS:
   *                     type: object
   *                     properties:
   *                       INCLUDE_ESTIMATES:
   *                         type: boolean
   *                         description: Whether to include AWS in estimation requests
   *                       USE_BILLING_DATA:
   *                         type: boolean
   *                         description: Whether to use billing data for estimates
   *                       BILLING_ACCOUNT_ID:
   *                         type: string
   *                         description: AWS billing account ID
   *                       BILLING_ACCOUNT_NAME:
   *                         type: string
   *                         description: AWS billing account name
   *                       ATHENA_DB_NAME:
   *                         type: string
   *                         description: Athena database name for billing data
   *                       ATHENA_DB_TABLE:
   *                         type: string
   *                         description: Athena table name for billing data
   *                       ATHENA_QUERY_RESULT_LOCATION:
   *                         type: string
   *                         description: S3 location for Athena query results
   *                       ATHENA_REGION:
   *                         type: string
   *                         description: AWS region where Athena is configured
   *                       RECOMMENDATIONS_SERVICE:
   *                         type: string
   *                         description: AWS recommendations service to use
   *                       COMPUTE_OPTIMIZER_BUCKET:
   *                         type: string
   *                         description: S3 bucket for compute optimizer recommendations
   *                       CURRENT_SERVICES:
   *                         type: array
   *                         description: List of AWS services to monitor
   *                         items:
   *                           type: object
   *                           properties:
   *                             key:
   *                               type: string
   *                             name:
   *                               type: string
   *                       CURRENT_REGIONS:
   *                         type: array
   *                         description: List of AWS regions to monitor
   *                         items:
   *                           type: string
   *                       RESOURCE_TAG_NAMES:
   *                         type: array
   *                         description: List of resource tag names to monitor
   *                         items:
   *                           type: string
   *                       accounts:
   *                         type: array
   *                         description: List of AWS accounts to monitor
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                               description: AWS account ID
   *                             name:
   *                               type: string
   *                               description: AWS account name
   *                   GCP:
   *                     type: object
   *                     properties:
   *                       NAME:
   *                         type: string
   *                         description: Name for GCP configuration
   *                       INCLUDE_ESTIMATES:
   *                         type: boolean
   *                         description: Whether to include GCP in estimation requests
   *                       USE_BILLING_DATA:
   *                         type: boolean
   *                         description: Whether to use billing data for estimates
   *                       USE_CARBON_FREE_ENERGY_PERCENTAGE:
   *                         type: boolean
   *                         description: Whether to use carbon free energy percentage data
   *                       VCPUS_PER_CLOUD_COMPOSER_ENVIRONMENT:
   *                         type: number
   *                         description: Number of vCPUs per Cloud Composer environment
   *                       VCPUS_PER_GKE_CLUSTER:
   *                         type: number
   *                         description: Number of vCPUs per GKE cluster
   *                       BIG_QUERY_TABLE:
   *                         type: string
   *                         description: BigQuery table for billing data
   *                       BILLING_PROJECT_ID:
   *                         type: string
   *                         description: GCP billing project ID
   *                       BILLING_PROJECT_NAME:
   *                         type: string
   *                         description: GCP billing project name
   *                       CACHE_BUCKET_NAME:
   *                         type: string
   *                         description: GCS bucket name for caching
   *                       RESOURCE_TAG_NAMES:
   *                         type: array
   *                         description: List of resource tag names to monitor
   *                         items:
   *                           type: string
   *                       CURRENT_SERVICES:
   *                         type: array
   *                         description: List of GCP services to monitor
   *                         items:
   *                           type: object
   *                           properties:
   *                             key:
   *                               type: string
   *                             name:
   *                               type: string
   *                       CURRENT_REGIONS:
   *                         type: array
   *                         description: List of GCP regions to monitor
   *                         items:
   *                           type: string
   *                       projects:
   *                         type: array
   *                         description: List of GCP projects
   *                   AZURE:
   *                     type: object
   *                     properties:
   *                       INCLUDE_ESTIMATES:
   *                         type: boolean
   *                         description: Whether to include Azure in estimation requests
   *                       USE_BILLING_DATA:
   *                         type: boolean
   *                         description: Whether to use billing data for estimates
   *                       authentication:
   *                         type: object
   *                         properties:
   *                           mode:
   *                             type: string
   *                             description: Authentication mode for Azure
   *                           clientId:
   *                             type: string
   *                             description: Azure client ID
   *                           clientSecret:
   *                             type: string
   *                             description: Azure client secret
   *                           certificatePath:
   *                             type: string
   *                             description: Path to Azure certificate
   *                           tenantId:
   *                             type: string
   *                             description: Azure tenant ID
   *                       RESOURCE_TAG_NAMES:
   *                         type: array
   *                         description: List of resource tag names to monitor
   *                         items:
   *                           type: string
   *                       CONSUMPTION_CHUNKS_DAYS:
   *                         type: number
   *                         description: Number of days per consumption chunk
   *                       SUBSCRIPTION_CHUNKS:
   *                         type: number
   *                         description: Number of subscription chunks
   *                       SUBSCRIPTIONS:
   *                         type: array
   *                         description: List of Azure subscriptions
   *                         items:
   *                           type: string
   *                   ALI:
   *                     type: object
   *                     properties:
   *                       NAME:
   *                         type: string
   *                         description: Name for AliCloud configuration
   *                       INCLUDE_ESTIMATES:
   *                         type: boolean
   *                         description: Whether to include AliCloud in estimation requests
   *                       authentication:
   *                         type: object
   *                         properties:
   *                           accessKeyId:
   *                             type: string
   *                             description: AliCloud access key ID
   *                           accessKeySecret:
   *                             type: string
   *                             description: AliCloud access key secret
   *                   LOGGING_MODE:
   *                     type: string
   *                     description: Logging mode configuration
   *                   ELECTRICITY_MAPS_TOKEN:
   *                     type: string
   *                     description: Token for Electricity Maps API
   *     responses:
   *       201:
   *         description: Tenant configuration created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 tenantId:
   *                   type: string
   *                 configDoc:
   *                   type: object
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                 updatedAt:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       500:
   *         description: Internal server error
   */
  router.post(
    '/tenant-configs',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const config = await tenantConfigService.createConfig(req.body)
        res.status(201).json(config)
      } catch (error) {
        res.status(400).json({ error: error.message })
      }
    },
  )

  /**
   * @openapi
   * /api/test-connection:
   *  post:
   *     tags:
   *     - Tenant Configuration
   *     summary: Tests connection to cloud provider services
   *     description: Tests if the provided configuration can successfully connect to and access required cloud provider services
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - tenantId
   *             properties:
   *               tenantId:
   *                 type: string
   *                 description: Unique identifier for the tenant
   *               configDoc:
   *                 type: object
   *                 properties:
   *                   AWS:
   *                     type: object
   *                     properties:
   *                       INCLUDE_ESTIMATES:
   *                         type: boolean
   *                       USE_BILLING_DATA:
   *                         type: boolean
   *                       authentication:
   *                         type: object
   *                         properties:
   *                           mode:
   *                             type: string
   *                             enum: [default, AWS, GCP, EC2-METADATA, ECS-METADATA]
   *                           options:
   *                             type: object
   *                             properties:
   *                               targetRoleName:
   *                                 type: string
   *                               proxyAccountId:
   *                                 type: string
   *                               proxyRoleName:
   *                                 type: string
   *                       accounts:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                             name:
   *                               type: string
   *     responses:
   *       200:
   *         description: Connection test successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: Invalid configuration or connection test failed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       500:
   *         description: Internal server error
   */
  router.post('/test-connection', TestConnectionMiddleware)

  /**
   * @openapi
   * /api/tenant-configs/{tenantId}:
   *  get:
   *     tags:
   *     - Tenant Configuration
   *     summary: Gets a tenant configuration
   *     description: Retrieves the configuration for a specific tenant
   *     parameters:
   *       - name: tenantId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the tenant to retrieve configuration for
   *     responses:
   *       200:
   *         description: Success
   *       404:
   *         description: Tenant configuration not found
   *       500:
   *         description: Internal server error
   */
  router.get(
    '/tenant-configs/:tenantId',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const config = await tenantConfigService.getConfig(req.params.tenantId)
        if (!config) {
          res.status(404).json({ error: 'Tenant configuration not found' })
          return
        }
        res.json(config)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    },
  )

  /**
   * @openapi
   * /api/tenant-configs/{tenantId}:
   *  put:
   *     tags:
   *     - Tenant Configuration
   *     summary: Updates a tenant configuration
   *     description: Updates the configuration for a specific tenant
   *     parameters:
   *       - name: tenantId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the tenant to update configuration for
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               AWS:
   *                 type: object
   *               GCP:
   *                 type: object
   *               AZURE:
   *                 type: object
   *     responses:
   *       200:
   *         description: Configuration updated successfully
   *       404:
   *         description: Tenant configuration not found
   *       500:
   *         description: Internal server error
   */
  router.put(
    '/tenant-configs/:tenantId',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const config = await tenantConfigService.updateConfig(
          req.params.tenantId,
          req.body,
        )
        if (!config) {
          res.status(404).json({ error: 'Tenant configuration not found' })
          return
        }
        res.json(config)
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    },
  )

  /**
   * @openapi
   * /api/tenant-configs/{tenantId}:
   *  delete:
   *     tags:
   *     - Tenant Configuration
   *     summary: Deletes a tenant configuration
   *     description: Deletes the configuration for a specific tenant
   *     parameters:
   *       - name: tenantId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the tenant to delete configuration for
   *     responses:
   *       204:
   *         description: Configuration deleted successfully
   *       404:
   *         description: Tenant configuration not found
   *       500:
   *         description: Internal server error
   */
  router.delete(
    '/tenant-configs/:tenantId',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const deleted = await tenantConfigService.deleteConfig(
          req.params.tenantId,
        )
        if (!deleted) {
          res.status(404).json({ error: 'Tenant configuration not found' })
          return
        }
        res.status(204).send()
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    },
  )

  // Apply tenant middleware to all other endpoints
  router.use(TenantMiddleware)

  /**
   * @openapi
   * /api/footprint:
   *  get:
   *     tags:
   *     - Footprint
   *     summary: Gets calculated energy and carbon estimates for a given date range
   *     produces:
   *       - application/json
   *     parameters:
   *      - name: x-tenant-id
   *        in: header
   *        required: true
   *        schema:
   *          type: string
   *        description: Tenant identifier
   *      - name: start
   *        in: query
   *        description: The start date for the footprint; e.g. 2022-10-18
   *        schema:
   *          type: string
   *        required: true
   *      - name: end
   *        in: query
   *        schema:
   *          type: string
   *        description: The end date for the footprint
   *        required: true
   *      - name: ignoreCache
   *        in: query
   *        schema:
   *          type: boolean
   *          default: false
   *        required: false
   *      - name: groupBy
   *        in: query
   *        schema:
   *          type: string
   *          default: day
   *        required: false
   *      - name: limit
   *        in: query
   *        schema:
   *          type: number
   *          default: 50000
   *        description: The maximum number of estimates to return (MongoDB only, ignoreCache=false)
   *        required: false
   *      - name: skip
   *        in: query
   *        schema:
   *          type: number
   *          default: 0
   *        description: The maximum number of estimates to skip over (MongoDB only, ignoreCache=false)
   *        required: false
   *      - name: cloudProviders
   *        in: query
   *        schema:
   *          type: array
   *          items:
   *            type: string
   *        description: List of Cloud Providers to include in estimates (MongoDB only, Filter)
   *        required: false
   *      - name: accounts
   *        in: query
   *        schema:
   *          type: array
   *          items:
   *            type: string
   *        description: List of accounts to include in estimates (MongoDB only, Filter)
   *        required: false
   *      - name: services
   *        in: query
   *        schema:
   *          type: array
   *          items:
   *            type: string
   *        description: List of services to include in estimates (MongoDB only, Filter)
   *        required: false
   *      - name: regions
   *        in: query
   *        schema:
   *          type: array
   *          items:
   *            type: string
   *        description: List of regions to include in estimates (MongoDB only, Filter)
   *        required: false
   *      - name: tags
   *        in: query
   *        schema:
   *          type: object
   *          additionalProperties:
   *            type: string
   *        description: List of resource tags to include in estimates (MongoDB only, Filter)
   *        required: false
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *          application/json:
   *            schema:
   *                type: array
   *                items:
   *                  $ref: '#/components/schemas/FootprintResponse'
   *       400:
   *         description: Bad request
   *       416:
   *         description: Partial Data Error
   *       500:
   *         description: Internal Server Error
   */
  router.get('/footprint', FootprintApiMiddleware)

  /**
   * @openapi
   * /api/regions/emissions-factors:
   *  get:
   *     tags:
   *     - Emissions Factors
   *     description: Gets the carbon intensity (co2e/kWh) of all cloud provider regions
   *     parameters:
   *      - name: x-tenant-id
   *        in: header
   *        required: true
   *        schema:
   *          type: string
   *        description: Tenant identifier
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *            schema:
   *              type: array
   *              items:
   *                $ref: '#/components/schemas/EmissionResponse'
   */
  router.get('/regions/emissions-factors', EmissionsApiMiddleware)

  /**
   * @openapi
   * /api/recommendations:
   *  get:
   *     tags:
   *     - Recommendations
   *     description: Gets recommendations from cloud providers and their estimated carbon and energy impact
   *     parameters:
   *      - name: x-tenant-id
   *        in: header
   *        required: true
   *        schema:
   *          type: string
   *        description: Tenant identifier
   *      - name: awsRecommendationTarget
   *        in: query
   *        description: Defines whether targeted AWS recommendations should be within the same family
   *        schema:
   *          type: string
   *          enum: [SAME_INSTANCE_FAMILY, CROSS_INSTANCE_FAMILY]
   *        required: true
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *            schema:
   *              type: array
   *              items:
   *                $ref: '#/components/schemas/RecommendationsResponse'
   */
  router.get('/recommendations', RecommendationsApiMiddleware)

  /**
   * @openapi
   * /api/healthz:
   *  get:
   *     tags:
   *     - Healthcheck
   *     description: Checks if the app is up and running, database is connected, and logs environment variables
   *     responses:
   *       200:
   *         description: Success response with health status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 serverAccess:
   *                   type: boolean
   *                   description: Whether the server is accessible
   *                 databaseConnection:
   *                   type: boolean
   *                   description: Whether the database connection is healthy
   *                 environment:
   *                   type: object
   *                   description: Environment variables
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Time of the health check
   *       500:
   *         description: Server error response
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 serverAccess:
   *                   type: boolean
   *                 databaseConnection:
   *                   type: boolean
   *                 error:
   *                   type: string
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  router.get('/healthz', HealthCheckMiddleware)

  return router
}

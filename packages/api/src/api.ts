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
} from './middleware'

export const createRouter = (config?: CCFConfig) => {
  setConfig(config)
  const router = express.Router()
  const tenantConfigService = new TenantConfigService()

  // Apply tenant middleware to all existing endpoints
  router.use(TenantMiddleware)

  /**
   * @openapi
   * /api/tenant-configs:
   *  post:
   *     tags:
   *     - Tenant Configuration
   *     summary: Creates a new tenant configuration
   *     description: Creates a new tenant configuration with the provided settings
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
   *               AWS:
   *                 type: object
   *                 description: AWS-specific configuration
   *               GCP:
   *                 type: object
   *                 description: GCP-specific configuration
   *               AZURE:
   *                 type: object
   *                 description: Azure-specific configuration
   *     responses:
   *       201:
   *         description: Tenant configuration created successfully
   *       400:
   *         description: Invalid request body
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
   *     description: Responds if the app is up and running
   *     responses:
   *       200:
   *         description: Responds "OK" if app is up and running
   */
  router.get('/healthz', (req: express.Request, res: express.Response) => {
    res.status(200).send('OK')
  })

  return router
}

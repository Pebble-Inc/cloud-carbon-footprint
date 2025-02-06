/*
 * © 2021 Thoughtworks, Inc.
 */

import { Express, Request, Response } from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Logger } from '@cloud-carbon-footprint/common'
const serverLogger = new Logger('server')

const version = '1.6.0'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CCF API Docs',
      version,
    },
    schemes: ['http', 'https'],
  },
  apis: ['./src/api.ts', './src/utils/schemas.yaml'],
}

const swaggerSpec = swaggerJsdoc(options)

function swaggerDocs(app: Express, port: number) {
  // Enable CORS for swagger docs
  const swaggerUiOptions = {
    swaggerOptions: {
      url: `/docs.json`,
    },
    explorer: true,
  }

  // Swagger page with CORS enabled
  app.use(
    '/docs',
    (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept',
      )
      next()
    },
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  )

  // Docs in JSON format with CORS enabled
  app.get('/docs.json', (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept',
    )
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  serverLogger.info(`Documentation available at http://localhost:${port}/docs`)
}

export default swaggerDocs

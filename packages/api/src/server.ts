if (process.env.NODE_ENV === 'production') {
  require('module-alias/register')
}

import express from 'express'
import helmet from 'helmet'
import cors, { CorsOptions } from 'cors'
import mongoose from 'mongoose'
import fs from 'fs'

import { createRouter } from './api'
import {
  Logger,
  configLoader,
  CCFConfig,
  setConfig,
} from '@cloud-carbon-footprint/common'
import { MongoDbCacheManager } from '@cloud-carbon-footprint/app'
import swaggerDocs from './utils/swagger'
import auth from './utils/auth'

const port = process.env.PORT || 4000
const httpApp = express()
const serverLogger = new Logger('Server')

const DOCUMENTDB = {
  URI: 'mongodb://docdb-2025-01-27-19-05-01.cluster-cviym42omp5c.us-east-1.docdb.amazonaws.com:27017',
  SSL_CA_FILE: '/usr/src/app/certs/global-bundle.pem',
  USERNAME: 'pebbledevccf',
  PASSWORD: 'PasswordPebblePassword',
}

/**
 * Establishes database connections based on TENANT_DB configuration
 * @param config - The application configuration
 * @throws Error if connection fails or invalid TENANT_DB configuration
 */
const connectToDatabase = async (config: CCFConfig): Promise<void> => {
  await mongoose.connect(DOCUMENTDB?.URI, {
    serverSelectionTimeoutMS: 5000,
    tls: true,
    tlsCAFile: DOCUMENTDB?.SSL_CA_FILE,
    authSource: 'admin',
    user: DOCUMENTDB?.USERNAME,
    pass: DOCUMENTDB?.PASSWORD,
    retryWrites: false, // DocumentDB doesn't support retryWrites
  })
  serverLogger.info('Successfully connected to DocumentDB using Mongoose')
}

/**
 * Disconnects from the database based on TENANT_DB configuration
 * @param config - The application configuration
 */
const disconnectFromDatabase = async (config: CCFConfig): Promise<void> => {
  await mongoose.disconnect()
}

if (process.env.NODE_ENV === 'production') {
  httpApp.use(auth)
}

httpApp.use(helmet())

// Add JSON body parser middleware
httpApp.use(express.json())

// Health Check Route with /api prefix
httpApp.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() })
})

// Convert server startup to async function
const startServer = async () => {
  const config = configLoader()
  setConfig(config)

  serverLogger.info('**Debug: Configuration loaded:**')
  serverLogger.info(`${JSON.stringify(config)}`)
  serverLogger.info('**End of Configuration**')

  try {
    // Establish database connection
    await connectToDatabase(config)

    if (process.env.ENABLE_CORS) {
      const corsOptions: CorsOptions = {
        optionsSuccessStatus: 200,
      }

      if (process.env.CORS_ALLOW_ORIGIN) {
        serverLogger.info(
          'Allowing CORS requests from origin(s) ' +
            process.env.CORS_ALLOW_ORIGIN,
        )
        corsOptions.origin = process.env.CORS_ALLOW_ORIGIN.split(',')
      }

      httpApp.use(cors(corsOptions))
    }

    httpApp.use('/api', createRouter())

    httpApp.listen(port, () => {
      serverLogger.info(
        `Cloud Carbon Footprint Server listening at http://localhost:${port}`,
      )
      swaggerDocs(httpApp, Number(port))
    })
  } catch (error) {
    serverLogger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start server
startServer().catch((error) => {
  serverLogger.error('Failed to start server:', error)
  process.exit(1)
})

// Instructions for graceful shutdown
process.on('SIGINT', async () => {
  const config = configLoader()
  await disconnectFromDatabase(config)
  serverLogger.info('Cloud Carbon Footprint Server shutting down...')
  process.exit()
})
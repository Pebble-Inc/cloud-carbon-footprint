/*
 * © 2021 Thoughtworks, Inc.
 */

if (process.env.NODE_ENV === 'production') {
  require('module-alias/register')
}

import express from 'express'
import helmet from 'helmet'
import cors, { CorsOptions } from 'cors'
import mongoose from 'mongoose'

import { createRouter } from './api'
import { Logger, configLoader, CCFConfig } from '@cloud-carbon-footprint/common'
import { MongoDbCacheManager } from '@cloud-carbon-footprint/app'
import { DocumentDbCacheManager } from '@cloud-carbon-footprint/app'
import swaggerDocs from './utils/swagger'
import auth from './utils/auth'

const port = process.env.PORT || 4000
const httpApp = express()
const serverLogger = new Logger('Server')

/**
 * Establishes database connections based on TENANT_DB configuration
 * @param config - The application configuration
 * @throws Error if connection fails or invalid TENANT_DB configuration
 */
const connectToDatabase = async (config: CCFConfig): Promise<void> => {
  // Debug logging for all relevant environment variables
  serverLogger.info('Debug: Environment Variables:')
  serverLogger.info('----------------------------------------')
  serverLogger.info(`TENANT_DB: "${config.TENANT_DB}"`)
  serverLogger.info(
    `DOCUMENTDB_URI: "${config.DOCUMENTDB?.URI?.substring(0, 20)}..."`,
  ) // Only show start of URI for security
  serverLogger.info(
    `DOCUMENTDB_SSL_CA_FILE exists: ${!!config.DOCUMENTDB?.SSL_CA_FILE}`,
  )
  serverLogger.info(
    `DOCUMENTDB_USERNAME exists: ${!!config.DOCUMENTDB?.USERNAME}`,
  )
  serverLogger.info(
    `DOCUMENTDB_PASSWORD exists: ${!!config.DOCUMENTDB?.PASSWORD}`,
  )
  serverLogger.info('----------------------------------------')

  if (config.TENANT_DB === 'MONGODB') {
    // Connect to MongoDB using Mongoose
    await mongoose.connect(config.MONGODB.URI, {
      serverSelectionTimeoutMS: 5000,
    })
    serverLogger.info('Successfully connected to MongoDB using Mongoose')

    // Also connect using MongoDbCacheManager for cache operations
    await MongoDbCacheManager.createDbConnection()
    serverLogger.info('Successfully connected MongoDB for cache operations')
  } else if (config.TENANT_DB === 'DOCUMENTDB') {
    // Connect to DocumentDB using Mongoose with SSL configuration
    await mongoose.connect(config.DOCUMENTDB.URI, {
      serverSelectionTimeoutMS: 5000,
      tls: true,
      tlsCAFile: config.DOCUMENTDB.SSL_CA_FILE,
      authSource: 'admin',
      user: config.DOCUMENTDB.USERNAME,
      pass: config.DOCUMENTDB.PASSWORD,
      retryWrites: false, // DocumentDB doesn't support retryWrites
    })
    serverLogger.info('Successfully connected to DocumentDB using Mongoose')

    // Also connect using DocumentDbCacheManager for cache operations
    await DocumentDbCacheManager.createDbConnection()
    serverLogger.info(
      'Successfully connected to DocumentDB for tenant and cache operations',
    )
  } else {
    throw new Error(`Invalid TENANT_DB configuration: ${config.TENANT_DB}`)
  }
}

/**
 * Disconnects from the database based on TENANT_DB configuration
 * @param config - The application configuration
 */
const disconnectFromDatabase = async (config: CCFConfig): Promise<void> => {
  if (config.TENANT_DB === 'MONGODB') {
    await mongoose.disconnect()
    await MongoDbCacheManager.mongoClient.close()
    serverLogger.info('\nMongoDB connections closed')
  } else if (config.TENANT_DB === 'DOCUMENTDB') {
    await mongoose.disconnect()
    await DocumentDbCacheManager.mongoClient.close()
    serverLogger.info('\nDocumentDB connection closed')
  }
}

if (process.env.NODE_ENV === 'production') {
  httpApp.use(auth)
}

httpApp.use(helmet())

// Add JSON body parser middleware
httpApp.use(express.json())

// Convert server startup to async function
const startServer = async () => {
  const config = configLoader()

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

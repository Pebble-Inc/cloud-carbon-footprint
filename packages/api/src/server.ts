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
import { Logger, configLoader } from '@cloud-carbon-footprint/common'
import { MongoDbCacheManager } from '@cloud-carbon-footprint/app'
import swaggerDocs from './utils/swagger'
import auth from './utils/auth'

const port = process.env.PORT || 4000
const httpApp = express()
const serverLogger = new Logger('Server')

if (process.env.NODE_ENV === 'production') {
  httpApp.use(auth)
}

httpApp.use(helmet())

// Add JSON body parser middleware
httpApp.use(express.json())

// Convert server startup to async function
const startServer = async () => {
  // Establish Mongo Connection if cache method selected
  if (configLoader()?.CACHE_MODE === 'MONGODB') {
    try {
      // Connect to MongoDB using Mongoose
      await mongoose.connect(configLoader().MONGODB.URI, {
        serverSelectionTimeoutMS: 5000,
      })
      serverLogger.info('Successfully connected to MongoDB using Mongoose')

      // Also connect using MongoDbCacheManager for cache operations
      await MongoDbCacheManager.createDbConnection()
    } catch (error) {
      serverLogger.error('Failed to connect to MongoDB:', error)
      process.exit(1)
    }
  }

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
}

// Start server
startServer().catch((error) => {
  serverLogger.error('Failed to start server:', error)
  process.exit(1)
})

// Instructions for graceful shutdown
process.on('SIGINT', async () => {
  if (configLoader()?.CACHE_MODE === 'MONGODB') {
    await mongoose.disconnect()
    await MongoDbCacheManager.mongoClient.close()
    serverLogger.info('\nMongoDB connections closed')
  }
  serverLogger.info('Cloud Carbon Footprint Server shutting down...')
  process.exit()
})

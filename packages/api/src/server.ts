if (process.env.NODE_ENV === 'production') {
  require('module-alias/register')
}

import cors, { CorsOptions } from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'

import { Logger, configLoader, setConfig } from '@cloud-carbon-footprint/common'
import { createRouter } from './api'
import auth from './utils/auth'
import swaggerDocs from './utils/swagger'

const port = process.env.PORT || 4000
const httpApp = express()
const serverLogger = new Logger('Server')

const DOCUMENTDB = {
URI: 'mongodb://docdb-2025-01-27-19-05-01.cluster-cviym42omp5c.us-east-1.docdb.amazonaws.com:27017',
SSL_CA_FILE: '/usr/src/app/certs/global-bundle.pem',
USERNAME: 'pebbledevccf',
PASSWORD: 'PasswordPebblePassword',
}

// const DOCUMENTDB ={
//   URI: process.env.DOCUMENTDB_URI,
//   USERNAME: process.env.DOCUMENTDB_USERNAME,
//   PASSWORD: process.env.DOCUMENTDB_PASSWORD,
// }

/**
 * Establishes database connections based on TENANT_DB configuration
 * @param config - The application configuration
 * @throws Error if connection fails or invalid TENANT_DB configuration
 */
const connectToDatabase = async (): Promise<void> => {
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
const disconnectFromDatabase = async (): Promise<void> => {
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

  try {
    // Establish database connection
    await connectToDatabase()

    // Configure CORS
    const corsOptions: CorsOptions = {
      optionsSuccessStatus: 200,
      origin: [
        /\.gopebble\.com$/,  // Allow all gopebble.com subdomains
        /^https?:\/\/localhost(:\d+)?$/  // Allow any localhost protocol and port
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-tenant-id',
        'x-config-id'
      ],
      credentials: true,
      maxAge: 86400 // 24 hours
    }

    httpApp.use(cors(corsOptions))
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
  await disconnectFromDatabase()
  serverLogger.info('Cloud Carbon Footprint Server shutting down...')
  process.exit()
})

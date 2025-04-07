import { Pool } from 'pg'
import dotenv from 'dotenv'
import { Logger } from '@cloud-carbon-footprint/common'

dotenv.config()

export default class TenantDBService {
  private readonly pool: Pool
  private readonly serviceLogger: Logger

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    })
    this.serviceLogger = new Logger('TenantDBService')
  }

  async addTenant(
    awsAccountId: string,
    region: string,
    env: string
  ): Promise<number> {
    this.serviceLogger.info(
      `Adding tenant for AWS account: ${awsAccountId} in region: ${region} on env: ${env}`
    )

    try {
      const query = `
        INSERT INTO my_table (aws_account_id, region, env)
        VALUES ($1, $2, $3)
        RETURNING id;
      `
      const values = [awsAccountId, region, env]
      const result = await this.pool.query<{ id: number }>(query, values)

      const tenantId = result.rows[0].id
      this.serviceLogger.info(`Tenant added successfully with id: ${tenantId}`)
      return tenantId
    } catch (error) {
      this.serviceLogger.error('Error inserting tenant data:', error)
      throw error
    }
  }
}
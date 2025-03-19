import { TenantConfig, generateConfigId } from './ITenantConfig'

/**
 * Service for handling database migrations
 */
export default class Migration {
  /**
   * Migrates existing TenantConfig documents to include configId
   * Assumes index dropping and creation is handled separately via CLI
   * @returns Object with migration results
   */
  public async migrateConfigId(): Promise<{
    success: boolean
    message: string
    count: number
  }> {
    try {
      // Find all documents that don't have a configId
      const documents = await TenantConfig.find({
        configId: { $exists: false },
      })

      // Log the number of documents that need migration
      console.log(`Found ${documents.length} documents to migrate`)

      // Update each document with a new configId
      for (const doc of documents) {
        doc.configId = generateConfigId()
        await doc.save()
      }

      return {
        success: true,
        message: 'Successfully migrated documents to include configId',
        count: documents.length,
      }
    } catch (error) {
      console.error('Migration error:', error)
      throw new Error(`Migration failed: ${error.message}`)
    }
  }
}

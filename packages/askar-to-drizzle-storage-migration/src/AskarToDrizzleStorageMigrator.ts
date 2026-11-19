import { AskarModule, AskarModuleConfig, AskarStoreManager, recordToInstance } from '@credo-ts/askar'
import {
  Agent,
  AgentContext,
  type AgentDependencies,
  BaseRecord,
  CacheModule,
  ConsoleLogger,
  InMemoryLruCache,
  type Logger,
  LogLevel,
  StorageVersionRecord,
} from '@credo-ts/core'
import {
  BaseDrizzleRecordAdapter,
  DrizzleStorageModule,
  DrizzleStorageModuleConfig,
  sortAdaptersByForeignKeys,
} from '@credo-ts/drizzle-storage'
import { TenantsModule } from '@credo-ts/tenants'
import {
  type Askar,
  EntryList,
  EntryListHandle,
  type EntryObject,
  ScanHandle,
  type Store,
} from '@openwallet-foundation/askar-shared'
import { AskarToDrizzleStorageMigrationError } from './errors/AskarToDrizzleStorageMigrationError'

interface ScanOptions {
  askar: Askar
  store: Store
  profile?: string
  askarContext: AgentContext
}

/**
 * Migration class to move storage from Askar to Drizzle. Note that this does not migrate
 * the KMS part of Askar (the keys), and only the normal record storage.
 *
 * No backups are created during the process. The askar store is only used for reading, the
 * drizzle store is also used for writing. Ensure the drizzle target is empty when starting the
 * migration.
 *
 * Note that if you were previously using `AskarMultiWalletDatabaseScheme.DatabasePerWallet`, that all storage will be moved
 * to a single database. You can still keep using multiiple databases for the Askar storage, but Drizzle only supports
 * a single database per main agent instance (including sub agents for tenants).
 */
export class AskarToDrizzleStorageMigrator {
  private drizzleAgent = new Agent({
    dependencies: this.agentDependencies,
    config: {
      logger: this.logger,
    },
    modules: this.tenantsModule
      ? {
          drizzle: this.drizzleModule,
          tenants: this.tenantsModule,
          cache: new CacheModule({ cache: new InMemoryLruCache({ limit: 500 }) }),
        }
      : {
          drizzle: this.drizzleModule,
        },
  })

  public askarAgent = new Agent({
    modules: this.tenantsModule
      ? {
          askar: this.askarModule,
          tenants: this.tenantsModule,
          cache: new CacheModule({ cache: new InMemoryLruCache({ limit: 500 }) }),
        }
      : {
          askar: this.askarModule,
        },
    config: {
      logger: this.logger,
    },
    dependencies: this.agentDependencies,
  })

  private drizzleConfig = this.drizzleAgent.context.resolve(DrizzleStorageModuleConfig)
  private drizzleAdapters = sortAdaptersByForeignKeys(this.drizzleConfig.adapters)

  private constructor(
    private drizzleModule: DrizzleStorageModule,
    private askarModule: AskarModule,
    private agentDependencies: AgentDependencies,
    private logger: Logger,
    private skipMigrationforMissingAdapter: boolean,
    private tenantsModule?: TenantsModule
  ) {}

  public static async initialize({
    drizzleModule,
    askarModule,
    agentDependencies,
    logger = new ConsoleLogger(LogLevel.Off),
    skipMigrationForMissingAdapter = false,
    tenantsModule,
  }: {
    drizzleModule: DrizzleStorageModule
    askarModule: AskarModule
    agentDependencies: AgentDependencies
    logger: Logger
    tenantsModule?: TenantsModule

    /**
     * When set to `true`, the migration of any records in the Askar store that don't
     * have an adapter registered will be skipped. Note that this can be dangerous and
     * result in loss of data in the new store. Use this only if you have records with a
     * category in your askar store, for which there is no adapter registered, and should
     * not be migrated.
     *
     * @default false
     */
    skipMigrationForMissingAdapter?: boolean
  }) {
    if (!askarModule.config.enableStorage) {
      throw new AskarToDrizzleStorageMigrationError(
        'Askar module has enableStorage set to false. Make sure the storage is enabled on the askar module'
      )
    }

    const migrator = new AskarToDrizzleStorageMigrator(
      drizzleModule,
      askarModule,
      agentDependencies,
      logger,
      skipMigrationForMissingAdapter,
      tenantsModule
    )

    return migrator
  }

  private getAdapterForRecordType(recordType: string) {
    const adapter = this.drizzleAdapters.find((adapter) => adapter.recordClass.type === recordType)
    if (!adapter) {
      return null
    }

    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    return adapter as BaseDrizzleRecordAdapter<BaseRecord, any, any, any, any>
  }

  public async migrate() {
    try {
      await this.drizzleAgent.initialize()
      this.logger.info('Successfully initialized drizzle agent')
      await this.askarAgent.initialize()
      this.logger.info('Successfully initialized askar agent')

      this.logger.info('Starting migration of default agent context')
      await this.migrateForContext({
        askarContext: this.askarAgent.context,
        drizzleContext: this.drizzleAgent.context,
      })
      this.logger.info('Succesfully migrated default agent context')

      if (this.tenantsModule) {
        const askarAgentWithTenants = this.askarAgent as Agent<{ tenants: TenantsModule }>
        const drizzleAgentWithTenants = this.drizzleAgent as Agent<{ tenants: TenantsModule }>

        this.logger.info('Detected tenants module, migrating tenants context')
        const allTenants = await askarAgentWithTenants.modules.tenants.getAllTenants()

        this.logger.debug(`Retrieved '${allTenants.length}' tenant records to migrate.`)

        for (const tenant of allTenants) {
          this.logger.info(`Starting migration of tenant '${tenant.id}'`)

          // NOTE: we create a nested withTenantAgent, as we need to have the context for both the askar and drizzle module/agent.
          // Using `withTenantAgent` ensures the session is always correctly closed, so it's the safest way
          await askarAgentWithTenants.modules.tenants.withTenantAgent(
            { tenantId: tenant.id },
            async (askarTenantAgent) => {
              await drizzleAgentWithTenants.modules.tenants.withTenantAgent(
                { tenantId: tenant.id },
                (drizzleTenantAgent) =>
                  this.migrateForContext({
                    askarContext: askarTenantAgent.context,
                    drizzleContext: drizzleTenantAgent.context,
                  })
              )
            }
          )
          this.logger.info(`Succesfully migrated tenant '${tenant.id}'`)
        }
      }
    } finally {
      if (this.drizzleAgent.isInitialized) {
        await this.drizzleAgent.shutdown()
      }

      if (this.askarAgent.isInitialized) {
        await this.askarAgent.shutdown()
      }
    }
  }

  public async deleteStorageRecords() {
    try {
      await this.askarAgent.initialize()
      this.logger.info('Successfully initialized askar agent')

      if (this.tenantsModule) {
        const askarAgentWithTenants = this.askarAgent as Agent<{ tenants: TenantsModule }>

        this.logger.info('Detected tenants module, deleting tenant records')
        const allTenants = await askarAgentWithTenants.modules.tenants.getAllTenants()

        this.logger.debug(`Retrieved '${allTenants.length}' tenants to delete non-KMS storage for.`)

        for (const tenant of allTenants) {
          this.logger.info(`Starting deletion of non-KMS records for tenant '${tenant.id}'`)

          // NOTE: we create a nested withTenantAgent, as we need to have the context for both the askar and drizzle module/agent.
          // Using `withTenantAgent` ensures the session is always correctly closed, so it's the safest way
          await askarAgentWithTenants.modules.tenants.withTenantAgent(
            { tenantId: tenant.id },
            async (askarTenantAgent) =>
              this.deleteForContext({
                askarContext: askarTenantAgent.context,
              })
          )
          this.logger.info(`Succesfully removed non-KMS records for tenant '${tenant.id}'`)
        }
      }

      this.logger.info('Starting deletion of non-KMS records for default agent context')
      await this.deleteForContext({
        askarContext: this.askarAgent.context,
      })
      this.logger.info('Succesfully removed non-KMS records for default agent context')
    } finally {
      if (this.askarAgent.isInitialized) {
        await this.askarAgent.shutdown()
      }
    }
  }

  private async migrateForContext({
    drizzleContext,
    askarContext,
  }: {
    drizzleContext: AgentContext
    askarContext: AgentContext
  }) {
    try {
      const storeManager = askarContext.resolve(AskarStoreManager)
      const askar = askarContext.resolve(AskarModuleConfig).askar

      const { store, profile } = await storeManager.getInitializedStoreWithProfile(askarContext)

      // We need to make sure that the drizzle storage is provisioned for the context
      // In case of root agent context this will alreayd be handled on initialization
      // but for tenants agents we need to make sure a row exists in the `Context` table
      await this.drizzleModule.onProvisionContext(drizzleContext)

      const scanOptions = { askar, store, profile, askarContext }

      // The record types are migrated one at a time, in the order of the foreign keys between their
      // tables, so that a record never references a record that is not inserted yet. The order of a
      // scan over all records depends on the database and can put a child record before its parent.
      let migratedRecordCount = 0
      for (const adapter of this.drizzleAdapters) {
        const recordType = adapter.recordClass.type
        this.logger.debug(
          `Migrating records of type '${recordType}' for context '${askarContext.contextCorrelationId}'`
        )

        const recordCount = await this.scanRecords({ ...scanOptions, category: recordType }, async (entryObject) => {
          const record = recordToInstance(entryObject, adapter.recordClass)

          if (record instanceof StorageVersionRecord && record.id === StorageVersionRecord.storageVersionRecordId) {
            this.logger.debug(
              `Updating record '${record.id}' with type '${record.type}' into drizzle storage for context '${askarContext.contextCorrelationId}'`
            )
            // A new storage version record is created when we first initialize the agent
            // so in this case we need to update the record
            await adapter.update(drizzleContext, record)
          } else {
            this.logger.debug(
              `Inserting record '${record.id}' with type '${record.type}' into drizzle storage for context '${askarContext.contextCorrelationId}'`
            )
            await adapter.insert(drizzleContext, record)
          }
        })

        this.logger.debug(
          `Migrated '${recordCount}' records of type '${recordType}' for context '${askarContext.contextCorrelationId}'`
        )
        migratedRecordCount += recordCount
      }

      // The scans above only return records of types with an adapter. A count of all records
      // shows whether the store holds records of other types.
      const totalRecordCount = await this.countRecords(scanOptions)
      const skippedRecordCount = totalRecordCount - migratedRecordCount
      const skippedRecordTypes = new Set<string>()
      if (skippedRecordCount > 0) {
        await this.scanRecords(scanOptions, async (entryObject) => {
          if (!this.getAdapterForRecordType(entryObject.category)) skippedRecordTypes.add(entryObject.category)
        })
        const recordTypes = [...skippedRecordTypes].map((recordType) => `'${recordType}'`).join(', ')

        if (!this.skipMigrationforMissingAdapter) {
          throw new AskarToDrizzleStorageMigrationError(
            `Could not find a registered drizzle adapter for record types ${recordTypes}. Make sure to register the record types in the DrizzleStorageModule.`
          )
        }

        this.logger.info(
          `Skipped migration of '${skippedRecordCount}' records with types ${recordTypes} due to missing drizzle adapter for context '${askarContext.contextCorrelationId}'.`
        )
      }

      this.logger.debug(
        `Succesfully migrated '${migratedRecordCount}' records from Askar to Drizzle for context '${askarContext.contextCorrelationId}'`,
        {
          migratedRecordCount,
          skippedRecordCount,
          skippedRecordTypes: [...skippedRecordTypes],
        }
      )
    } catch (error) {
      this.logger.error(`Migration failed for context '${askarContext.contextCorrelationId}'. ${error.message}`)
      throw new AskarToDrizzleStorageMigrationError(
        `Migration failed for context '${askarContext.contextCorrelationId}'. ${error.message}`,
        {
          cause: error,
        }
      )
    }
  }

  /**
   * Scans the records of one category, or of all categories, and calls `handleEntry` for each record.
   * Returns the number of records.
   */
  private async scanRecords(
    { askar, store, profile, askarContext, category }: ScanOptions & { category?: string },
    handleEntry: (entryObject: EntryObject) => Promise<void>
  ): Promise<number> {
    let scanHandle: ScanHandle | undefined
    let entryListHandle: EntryListHandle | null = null
    let recordCount = 0

    try {
      scanHandle = await askar.scanStart({
        storeHandle: store.handle,
        profile,
        category,
      })
      while (true) {
        entryListHandle = await askar.scanNext({ scanHandle })

        // We reached the end of the scan
        if (!entryListHandle) break

        const list = new EntryList({ handle: entryListHandle })
        this.logger.debug(
          `Retrieved batch of '${list.length}' records from askar storage for context '${askarContext.contextCorrelationId}'`
        )
        for (let index = 0; index < list.length; index++) {
          const entryObject = list.getEntryByIndex(index).toJson()
          this.logger.trace(
            `Retrieved record with index '${index}', id '${entryObject.name}' and type '${entryObject.category}' from batch for context '${askarContext.contextCorrelationId}'`
          )
          await handleEntry(entryObject)
          recordCount++
        }

        // Free and clear handle
        entryListHandle.free()
        entryListHandle = null
      }

      return recordCount
    } finally {
      // Free entry list handle if we didn't free it yet (in case of error)
      entryListHandle?.free()
      entryListHandle = null

      scanHandle?.free()
      scanHandle = undefined
    }
  }

  private async countRecords({ askar, store, profile }: ScanOptions): Promise<number> {
    const sessionHandle = await askar.sessionStart({ storeHandle: store.handle, profile, asTransaction: false })
    try {
      return await askar.sessionCount({ sessionHandle })
    } finally {
      await askar.sessionClose({ sessionHandle, commit: false })
    }
  }

  private async deleteForContext({ askarContext }: { askarContext: AgentContext }) {
    try {
      const storeManager = askarContext.resolve(AskarStoreManager)
      const { store, profile } = await storeManager.getInitializedStoreWithProfile(askarContext)

      this.logger.debug(
        `Removing all non-KMS records from askar storage for context '${askarContext.contextCorrelationId}'`
      )
      const session = await store.session(profile).open()
      try {
        await session.removeAll({})

        this.logger.debug(
          `Succesfully removed all non-KMS records from Askar for context '${askarContext.contextCorrelationId}'`
        )
      } finally {
        await session.close()
      }
    } catch (error) {
      this.logger.error(
        `Removing non-KMS records failed for context '${askarContext.contextCorrelationId}'. ${error.message}`
      )
      throw new AskarToDrizzleStorageMigrationError(
        `Removing non-KMS record failed for context '${askarContext.contextCorrelationId}'. ${error.message}`,
        {
          cause: error,
        }
      )
    }
  }
}

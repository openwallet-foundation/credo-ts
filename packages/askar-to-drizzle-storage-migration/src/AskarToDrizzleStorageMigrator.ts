import {
  Agent,
  AgentContext,
  type AgentDependencies,
  BaseRecord,
  ConsoleLogger,
  LogLevel,
  type Logger,
  StorageVersionRecord,
} from '@credo-ts/core'
import { EntryListHandle } from '@openwallet-foundation/askar-shared'

import { AskarModule, AskarModuleConfig } from '@credo-ts/askar'
import { AskarStoreManager } from '@credo-ts/askar'
import { recordToInstance } from '@credo-ts/askar'
import { BaseDrizzleRecordAdapter, DrizzleStorageModule, DrizzleStorageModuleConfig } from '@credo-ts/drizzle-storage'
import { TenantsModule } from '@credo-ts/tenants'
import { EntryList, ScanHandle } from '@openwallet-foundation/askar-shared'
import { AskarToDrizzleStorageMigrationError } from './errors/AskarToDrizzleStorageMigrationError'

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
  private drizzleAdapters = this.drizzleConfig.adapters

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
    logger = new ConsoleLogger(LogLevel.trace),
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

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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

  private async migrateForContext({
    drizzleContext,
    askarContext,
  }: { drizzleContext: AgentContext; askarContext: AgentContext }) {
    try {
      const storeManager = askarContext.resolve(AskarStoreManager)
      const askar = askarContext.resolve(AskarModuleConfig).askar

      const { store, profile } = await storeManager.getInitializedStoreWithProfile(askarContext)

      // We need to make sure that the drizzle storage is provisioned for the context
      // In case of root agent context this will alreayd be handled on initialization
      // but for tenants agents we need to make sure a row exists in the `Context` table
      await this.drizzleModule.onProvisionContext(drizzleContext)

      let scanHandle: ScanHandle | undefined = undefined
      let entryListHandle: EntryListHandle | null = null
      let migratedRecordCount = 0
      let skippedRecordCount = 0
      const skippedRecordTypes: string[] = []
      try {
        this.logger.debug(
          `Initializing retrieval of records from askar storage for context '${askarContext.contextCorrelationId}'`
        )
        scanHandle = await askar.scanStart({
          storeHandle: store.handle,
          profile,
        })
        while (true) {
          this.logger.debug(
            `Fetching batch of records from askar storage for context '${askarContext.contextCorrelationId}'`
          )
          entryListHandle = await askar.scanNext({ scanHandle })

          // We reached the end of the scan
          if (!entryListHandle) {
            this.logger.debug(
              `No records returned in batch from askar storage. No records left to migrate for context '${askarContext.contextCorrelationId}'`
            )
            break
          }

          const list = new EntryList({ handle: entryListHandle })
          this.logger.debug(
            `Retrieved batch of '${list.length}' records from askar storage for context '${askarContext.contextCorrelationId}'`
          )
          for (let index = 0; index < list.length; index++) {
            const entry = list.getEntryByIndex(index)
            const entryObject = entry.toJson()
            this.logger.trace(
              `Retrieved record with index '${index}', id '${entryObject.name}' and type '${entryObject.category}' from batch for context '${askarContext.contextCorrelationId}'`
            )

            const adapter = this.getAdapterForRecordType(entryObject.category)
            if (!adapter) {
              if (this.skipMigrationforMissingAdapter) {
                this.logger.info(
                  `Skippping migration of record '${entry.name}' with type '${entry.category}' due to missing drizzle adapter for context '${askarContext.contextCorrelationId}'.`
                )
                skippedRecordCount++
                skippedRecordTypes.push(entryObject.category)
                continue
              }

              throw new AskarToDrizzleStorageMigrationError(
                `Could not find a registered drizzle adapter for record type '${entry.category}'. Make sure to register the record type in the DrizzleStorageModule.`
              )
            }
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

            migratedRecordCount++
          }

          this.logger.debug(`Processed all records from batch for context '${askarContext.contextCorrelationId}'`)

          // Free and clear handle
          entryListHandle.free()
          entryListHandle = null
        }

        this.logger.debug(
          `Succesfully migrated '${migratedRecordCount}' records from Askar to Drizzle for context '${askarContext.contextCorrelationId}'`,
          {
            migratedRecordCount,
            skippedRecordCount,
            skippedRecordTypes,
          }
        )
      } finally {
        // Free entry list handle if we didn't free it yet (in case of error)
        entryListHandle?.free()
        entryListHandle = null

        scanHandle?.free()
        scanHandle = undefined
      }
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
}

import { DrizzleRecord } from './DrizzleRecord'
import { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'
import { getSchemaFromDrizzleRecords } from './combineSchemas'
import { DrizzleDatabase, createDrizzle } from './createDrizzle'

export interface DrizzleStorageModuleConfigDatabasePostgresOptions {
  type: 'postgres'

  /**
   * The postgres database url
   */
  databaseUrl: string
}

export interface DrizzleStorageModuleConfigDatabaseSqliteOptions {
  type: 'sqlite'

  /**
   * The path to the database file for the SQLite database
   */
  databaseUrl: string
}

export type DrizzleStorageModuleConfigDatabaseOptions =
  | DrizzleStorageModuleConfigDatabasePostgresOptions
  | DrizzleStorageModuleConfigDatabaseSqliteOptions

export interface DrizzleStorageModuleConfigOptions<DrizzleRecords extends DrizzleRecord[] = DrizzleRecord[]> {
  /**
   * Database configuration used for postgres.
   */
  database: DrizzleStorageModuleConfigDatabaseOptions

  /**
   * The drizzle records to register. Each drizzle record needs both an
   * sqlite and postgres definition, as well as an adapter.
   */
  records: DrizzleRecords
}

/**
 * @public
 */
export class DrizzleStorageModuleConfig {
  private options: DrizzleStorageModuleConfigOptions
  public readonly database: DrizzleDatabase
  public readonly adapters: AnyDrizzleAdapter[]

  public constructor(options: DrizzleStorageModuleConfigOptions) {
    this.options = options

    const schema = getSchemaFromDrizzleRecords(options.records, options.database.type) as Record<string, unknown>
    this.database = createDrizzle({
      ...options.database,
      schema,
    })

    this.adapters = options.records.map((record) => new record.adapter(this.database))
  }
}

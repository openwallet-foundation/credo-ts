import { DrizzleDatabase, getDrizzleDatabaseType } from './DrizzleDatabase'
import { DrizzleRecord } from './DrizzleRecord'
import { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'
import { getSchemaFromDrizzleRecords } from './combineSchemas'
import { coreDrizzleRecords } from './core'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type AnyDrizzleDatabase = DrizzleDatabase<any, any>

export interface DrizzleStorageModuleConfigOptions {
  /**
   * The drizzle database to use. To not depend on specific drivers and support different
   * environments you need to configure the database yourself.
   *
   * See https://orm.drizzle.team/docs/get-started for available drivers.
   * All SQLite and Postgres database are supported.
   */

  database: AnyDrizzleDatabase

  /**
   * The drizzle records to register. Each drizzle record needs both an
   * sqlite and postgres definition, as well as an adapter.
   */
  records: DrizzleRecord[]
}

/**
 * @public
 */
export class DrizzleStorageModuleConfig {
  public readonly database: AnyDrizzleDatabase
  public readonly adapters: AnyDrizzleAdapter[]
  public readonly schemas: Record<string, unknown>

  public constructor(options: DrizzleStorageModuleConfigOptions) {
    this.database = options.database

    const allRecords = Array.from(new Set([...coreDrizzleRecords, ...options.records]))
    this.adapters = allRecords.map((record) => new record.adapter(this.database))

    this.schemas = getSchemaFromDrizzleRecords(allRecords, getDrizzleDatabaseType(options.database))
  }
}

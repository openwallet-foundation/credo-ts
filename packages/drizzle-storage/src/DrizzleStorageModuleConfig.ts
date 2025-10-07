import { type DrizzleDatabase, getDrizzleDatabaseType } from './DrizzleDatabase'
import type { DrizzleRecord, DrizzleRecordBundle } from './DrizzleRecord'
import type { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'
import { getSchemaFromDrizzleRecords } from './combineSchemas'
import coreDrizzleBundle from './core/bundle'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyDrizzleDatabase = DrizzleDatabase<any, any>

export interface DrizzleStorageModuleConfigOptions<Database extends AnyDrizzleDatabase = AnyDrizzleDatabase> {
  /**
   * The drizzle database to use. To not depend on specific drivers and support different
   * environments you need to configure the database yourself.
   *
   * See https://orm.drizzle.team/docs/get-started for available drivers.
   * All SQLite and Postgres database are supported.
   */
  database: Database

  /**
   * The drizzle bundles to register. Each drizzle bundles consists of records, which need to contain both an
   * sqlite and postgres definition, as well as an adapter.
   */
  bundles: DrizzleRecordBundle[]
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

    // core MUST always be registered
    const allRecords: DrizzleRecord[] = Array.from(
      new Set([...coreDrizzleBundle.records, ...options.bundles.flatMap((bundle) => bundle.records)])
    )
    this.adapters = allRecords
      .map((record) => (record.adapter ? new record.adapter(this.database) : undefined))
      .filter((adapter) => adapter !== undefined)

    this.schemas = getSchemaFromDrizzleRecords(allRecords, getDrizzleDatabaseType(options.database))
  }
}

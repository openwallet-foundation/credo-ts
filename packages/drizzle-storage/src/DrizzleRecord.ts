import type { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'

export interface DrizzleRecordBundle {
  /**
   * The name of the drizzle record bundle. Ideally it should be simple but unique.
   *
   * E.g. `core` or `anoncreds` for internal modules. For custom modules we recommend
   * prefixing a scope. E.g. `my-org-custom-protocol`
   */
  name: string

  /**
   * The drizzle records part of this bundle. This should stay consistent, as migrations are
   * managed per drizzle record bundle. Removing migrations or records can result in data loss
   * or locked databases.
   */
  records: DrizzleRecord[]

  /**
   * Information related to generationg and applying migrations
   */
  migrations: {
    sqlite: {
      /**
       * A resolvable module that contains the drizzle SQLite schema definition for the complete bundle.
       */
      schemaPath: string

      /**
       * The migrations path where the migrations should be generated and retrieved. Note that the contents
       * of this directory must be published with your NPM package so it can be used to apply migrations.
       *
       * The path to the migrations directory MUST be abosulate.
       */
      migrationsPath: string
    }
    postgres: {
      /**
       * A resolvable path that contains the drizzle Postgres schema definition for the complete bundle.
       */
      schemaPath: string

      /**
       * The migrations path where the migrations should be generated and retrieved. Note that the contents
       * of this directory must be published with your NPM package so it can be used to apply migrations.
       *
       * The path to the migrations directory MUST be abosulate.
       */
      migrationsPath: string
    }
  }
}

export interface DrizzleRecord {
  postgres: Record<string, unknown>
  sqlite: Record<string, unknown>
  adapter?: new (
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    database: any
  ) => AnyDrizzleAdapter
}

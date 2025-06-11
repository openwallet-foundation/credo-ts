import { AnyDrizzleAdapter } from './adapter/BaseDrizzleRecordAdapter'

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
       *
       * NOTE: this MUST resolve to the TypeScript schema file, it cannot point to the built files. This
       * file will only be resolved during generation of migrations, and thus it's not needed to publish
       * the source files in your NPM package, as long as the module resolves during migration generation.
       */
      schemaModule: string

      /**
       * The migrations path where the migrations should be generated and retrieved. Note that the contents
       * of this directory must be published with your NPM package so it can be used to apply migrations.
       *
       * The path should be relative to the resolved `schemaModule`. Note that if you use `publishConfig` to
       * have different exports during development, this should still resolve to the generated migration files
       * in the generated packages, so it's recommended to place your migrations outside of the src folder
       */
      migrationsPath: string
    }
    postgres: {
      /**
       * A resolvable module that contains the drizzle SQLite schema definition for the complete bundle.
       *
       * NOTE: this MUST resolve to the TypeScript schema file, it cannot point to the built files. This
       * file will only be resolved during generation of migrations, and thus it's not needed to publish
       * the source files in your NPM package, as long as the module resolves during migration generation.
       */
      schemaModule: string

      /**
       * The migrations path where the migrations should be generated and retrieved. Note that the contents
       * of this directory must be published with your NPM package so it can be used to apply migrations.
       *
       * The path should be relative to the resolved `schemaModule`. Note that if you use `publishConfig` to
       * have different exports during development, this should still resolve to the generated migration files
       * in the generated packages, so it's recommended to place your migrations outside of the src folder
       */
      migrationsPath: string
    }
  }
}

export interface DrizzleRecord {
  postgres: Record<string, unknown>
  sqlite: Record<string, unknown>
  adapter: new (
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    database: any
  ) => AnyDrizzleAdapter
}

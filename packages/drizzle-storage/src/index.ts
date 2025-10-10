// Adapter
export {
  BaseDrizzleRecordAdapter,
  type AnyDrizzleAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from './adapter'

// Storage
export { DrizzleStorageService } from './storage'

// Module
export { DrizzleStorageModule } from './DrizzleStorageModule'
export { DrizzleStorageModuleConfig } from './DrizzleStorageModuleConfig'

export type { DrizzleDatabase } from './DrizzleDatabase'

export { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from './postgres'
export { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from './sqlite'

export type { DrizzleRecord, DrizzleRecordBundle } from './DrizzleRecord'

export { type GetSchemaFromDrizzleRecords, getSchemaFromDrizzleRecords } from './combineSchemas'

export {
  type ReactNativeDrizzleMigration,
  type ReactNativeDrizzleMigrationsOptions,
  applyReactNativeMigrations,
} from './applyReactNativeMigrations'

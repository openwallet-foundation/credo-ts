// Adapter
export {
  BaseDrizzleRecordAdapter,
  AnyDrizzleAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from './adapter'

// Storage
export { DrizzleStorageService } from './storage'

// Module
export { DrizzleStorageModule } from './DrizzleStorageModule'
export { DrizzleStorageModuleConfig } from './DrizzleStorageModuleConfig'

export { DrizzleDatabase } from './DrizzleDatabase'

export { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from './postgres'
export { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from './sqlite'

export type { DrizzleRecord, DrizzleRecordBundle } from './DrizzleRecord'

export { GetSchemaFromDrizzleRecords, getSchemaFromDrizzleRecords } from './combineSchemas'

export {
  ReactNativeDrizzleMigration,
  ReactNativeDrizzleMigrationsOptions,
  applyReactNativeMigrations,
} from './applyReactNativeMigrations'

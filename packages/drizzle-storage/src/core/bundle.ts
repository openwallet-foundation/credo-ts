import { DrizzleRecordBundle } from '../DrizzleRecord'
import { genericRecordDrizzleRecord } from './genericRecord'
import { mdocDrizzleRecord } from './mdoc'
import { sdJwtVcDrizzleRecord } from './sdJwtVc'
import { storageVersionDrizzleRecord } from './storageVersion'

export default {
  name: 'core',
  records: [sdJwtVcDrizzleRecord, mdocDrizzleRecord, storageVersionDrizzleRecord, genericRecordDrizzleRecord],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/core/postgres',
      migrationsPath: '../../migrations/core/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/core/sqlite',
      migrationsPath: '../../migrations/core/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

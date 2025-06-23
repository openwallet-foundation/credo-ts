import { DrizzleRecordBundle } from '../DrizzleRecord'
import { contextDrizzleRecord } from './context'
import { didDrizzleRecord } from './did'
import { genericRecordDrizzleRecord } from './genericRecord'
import { mdocDrizzleRecord } from './mdoc'
import { sdJwtVcDrizzleRecord } from './sdJwtVc'
import { singleContextLruCacheDrizzleRecord } from './singleContextLruCache'
import { storageVersionDrizzleRecord } from './storageVersion'
import { w3cCredentialDrizzleRecord } from './w3cCredential'

export default {
  name: 'core',
  records: [
    contextDrizzleRecord,
    sdJwtVcDrizzleRecord,
    mdocDrizzleRecord,
    storageVersionDrizzleRecord,
    genericRecordDrizzleRecord,
    didDrizzleRecord,
    w3cCredentialDrizzleRecord,
    singleContextLruCacheDrizzleRecord,
  ],
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

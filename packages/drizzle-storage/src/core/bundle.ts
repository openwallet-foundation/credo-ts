import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
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
  migrations: bundleMigrationDefinition('core'),
} as const satisfies DrizzleRecordBundle

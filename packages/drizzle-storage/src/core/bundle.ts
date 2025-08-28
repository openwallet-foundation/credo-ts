import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { contextDrizzleRecord } from './context-record'
import { didDrizzleRecord } from './did-record'
import { genericRecordDrizzleRecord } from './generic-record'
import { mdocDrizzleRecord } from './mdoc-record'
import { sdJwtVcDrizzleRecord } from './sd-jwt-vc-record'
import { singleContextLruCacheDrizzleRecord } from './single-context-lru-cache-record'
import { storageVersionDrizzleRecord } from './storage-version-record'
import { w3cCredentialDrizzleRecord } from './w3c-credential-record'

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

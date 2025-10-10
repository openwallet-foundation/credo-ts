import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { contextDrizzleRecord } from './context-record'
import { didDrizzleRecord } from './did-record'
import { genericRecordDrizzleRecord } from './generic-record'
import { mdocDrizzleRecord } from './mdoc-record'
import { sdJwtVcDrizzleRecord } from './sd-jwt-vc-record'
import { singleContextLruCacheDrizzleRecord } from './single-context-lru-cache-record'
import { storageVersionDrizzleRecord } from './storage-version-record'
import { w3cCredentialDrizzleRecord } from './w3c-credential-record'
import { w3cV2CredentialDrizzleRecord } from './w3c-v2-credential-record'

export const coreBundle = {
  name: 'core',
  records: [
    contextDrizzleRecord,
    sdJwtVcDrizzleRecord,
    mdocDrizzleRecord,
    storageVersionDrizzleRecord,
    genericRecordDrizzleRecord,
    didDrizzleRecord,
    w3cCredentialDrizzleRecord,
    w3cV2CredentialDrizzleRecord,
    singleContextLruCacheDrizzleRecord,
  ],
  migrations: bundleMigrationDefinition('core'),
} as const satisfies DrizzleRecordBundle

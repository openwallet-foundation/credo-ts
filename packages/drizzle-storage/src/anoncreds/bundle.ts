import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { anonCredsCredentialDrizzleRecord } from './credential'
import { anonCredsCredentialDefinitionDrizzleRecord } from './credential-definition'
import { anonCredsCredentialDefinitionPrivateDrizzleRecord } from './credential-definition-private'
import { anonCredsKeyCorrectnessProofDrizzleRecord } from './key-correctness-proof'
import { anonCredsLinkSecretDrizzleRecord } from './link-secret'
import { anonCredsRevocationRegistryDefinitionDrizzleRecord } from './revocation-registry-definition'
import { anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord } from './revocation-registry-definition-private'
import { anonCredsSchemaDrizzleRecord } from './schema'

export default {
  name: 'anoncreds',
  records: [
    anonCredsCredentialDrizzleRecord,
    anonCredsCredentialDefinitionDrizzleRecord,
    anonCredsCredentialDefinitionPrivateDrizzleRecord,
    anonCredsKeyCorrectnessProofDrizzleRecord,
    anonCredsLinkSecretDrizzleRecord,
    anonCredsRevocationRegistryDefinitionDrizzleRecord,
    anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord,
    anonCredsSchemaDrizzleRecord,
  ],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/anoncreds/postgres',
      migrationsPath: '../../migrations/anoncreds/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/anoncreds/sqlite',
      migrationsPath: '../../migrations/anoncreds/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle

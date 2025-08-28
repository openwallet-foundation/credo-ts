import type { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { anonCredsCredentialDefinitionPrivateDrizzleRecord } from './credential-definition-private-record'
import { anonCredsCredentialDefinitionDrizzleRecord } from './credential-definition-record'
import { anonCredsCredentialDrizzleRecord } from './credential-record'
import { anonCredsKeyCorrectnessProofDrizzleRecord } from './key-correctness-proof-record'
import { anonCredsLinkSecretDrizzleRecord } from './link-secret-record'
import { anonCredsRevocationRegistryDefinitionPrivateDrizzleRecord } from './revocation-registry-definition-private-record'
import { anonCredsRevocationRegistryDefinitionDrizzleRecord } from './revocation-registry-definition-record'
import { anonCredsSchemaDrizzleRecord } from './schema-record'

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

  migrations: bundleMigrationDefinition('anoncreds'),
} as const satisfies DrizzleRecordBundle

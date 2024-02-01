import type { BaseAgent } from '@credo-ts/core'

import { migrateAnonCredsCredentialDefinitionRecordToV0_4 } from './credentialDefinition'
import { migrateCredentialExchangeRecordToV0_4 } from './credentialExchangeRecord'
import { migrateLinkSecretToV0_4 } from './linkSecret'
import { migrateAnonCredsSchemaRecordToV0_4 } from './schema'

export async function updateAnonCredsModuleV0_3_1ToV0_4<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await migrateCredentialExchangeRecordToV0_4(agent)
  await migrateLinkSecretToV0_4(agent)
  await migrateAnonCredsCredentialDefinitionRecordToV0_4(agent)
  await migrateAnonCredsSchemaRecordToV0_4(agent)
}

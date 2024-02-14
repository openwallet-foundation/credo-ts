import type { BaseAgent } from '@credo-ts/core'

import { storeAnonCredsInW3cFormatV0_5 } from './anonCredsCredentialRecord'
import { migrateCredentialExchangeRecordToV0_5 } from './credentialExchangeRecord'
import { migrateProofExchangeRecordToV0_5 } from './proofExchangeRecord'

export async function updateAnonCredsModuleV0_4ToV0_5<Agent extends BaseAgent>(agent: Agent): Promise<void> {
  await storeAnonCredsInW3cFormatV0_5(agent)
  await migrateCredentialExchangeRecordToV0_5(agent)
  await migrateProofExchangeRecordToV0_5(agent)
}

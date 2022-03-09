import type { Agent } from '../../../../agent/Agent'

import { migrateCredentialRecordToV0_2 } from './credential'

export async function upgradeV0_1ToV0_2(agent: Agent): Promise<void> {
  await migrateCredentialRecordToV0_2(agent)
}

import type { Agent } from '../../../../agent/Agent'

import { migrateCredentialRecordToV20 } from './credential'

export async function upgradeV010ToV020(agent: Agent): Promise<void> {
  await migrateCredentialRecordToV20(agent)
}

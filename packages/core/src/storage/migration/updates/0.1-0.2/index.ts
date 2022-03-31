import type { Agent } from '../../../../agent/Agent'
import type { UpdateConfig } from '../../updates'

import { migrateCredentialRecordToV0_2 } from './credential'
import { migrateMediationRecordToV0_2 } from './mediation'

export interface V0_1ToV0_2UpdateConfig {
  mediationRoleUpdateStrategy: 'allMediator' | 'allRecipient' | 'recipientIfEndpoint' | 'doNotChange'
}

export async function updateV0_1ToV0_2(agent: Agent, config: UpdateConfig): Promise<void> {
  await migrateCredentialRecordToV0_2(agent)
  await migrateMediationRecordToV0_2(agent, config.v0_1ToV0_2)
}

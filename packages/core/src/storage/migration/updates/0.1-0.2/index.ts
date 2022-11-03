import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { UpdateConfig } from '../../updates'

import { migrateConnectionRecordToV0_2 } from './connection'
import { migrateCredentialRecordToV0_2 } from './credential'
import { migrateMediationRecordToV0_2 } from './mediation'

export interface V0_1ToV0_2UpdateConfig {
  mediationRoleUpdateStrategy: 'allMediator' | 'allRecipient' | 'recipientIfEndpoint' | 'doNotChange'
}

export async function updateV0_1ToV0_2<Agent extends BaseAgent>(agent: Agent, config: UpdateConfig): Promise<void> {
  await migrateCredentialRecordToV0_2(agent)
  await migrateMediationRecordToV0_2(agent, config.v0_1ToV0_2)
  await migrateConnectionRecordToV0_2(agent)
}

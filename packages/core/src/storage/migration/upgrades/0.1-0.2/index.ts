import type { Agent } from '../../../../agent/Agent'
import type { UpgradeOptions } from '../../upgrades'

import { migrateCredentialRecordToV0_2 } from './credential'
import { migrateMediationRecordToV0_2 } from './mediation'

export interface V0_1ToV0_2UpgradeConfig {
  mediationRoleUpdateStrategy: 'allMediator' | 'allRecipient' | 'recipientIfEndpoint' | 'doNotChange'
}

export async function upgradeV0_1ToV0_2(agent: Agent, config: UpgradeOptions): Promise<void> {
  await migrateCredentialRecordToV0_2(agent)
  await migrateMediationRecordToV0_2(agent, config.v0_1ToV0_2)
}

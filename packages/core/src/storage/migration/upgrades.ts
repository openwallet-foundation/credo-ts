import type { Agent } from '../../agent/Agent'
import type { VersionString } from './version'

import { upgradeV0_1ToV0_2 } from './upgrades/0.1-0.2'

export const INITIAL_STORAGE_VERSION = '0.1'

export interface Upgrade {
  fromVersion: VersionString
  toVersion: VersionString
  doUpgrade: (agent: Agent) => Promise<void>
}

export const supportedUpgrades: Upgrade[] = [
  {
    fromVersion: '0.1',
    toVersion: '0.2',
    doUpgrade: upgradeV0_1ToV0_2,
  },
]

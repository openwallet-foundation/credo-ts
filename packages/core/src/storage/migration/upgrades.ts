import type { Agent } from '../../agent/Agent'
import type { VersionString } from './version'

import { upgradeV010ToV020 } from './0.2'

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
    doUpgrade: upgradeV010ToV020,
  },
]

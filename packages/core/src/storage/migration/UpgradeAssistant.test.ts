import type { Logger } from '../../logger'
import type { WalletConfig } from '../../types'
import type { Upgrade } from './upgrades'

import { upgradeV010ToV020 } from './0.2'

export interface UpgradeConfig {
  walletConfig: WalletConfig
  logger?: Logger
}

const upgrades: Array<Upgrade> = [
  {
    fromVersion: '0.1',
    toVersion: '0.2',
    doUpgrade: upgradeV010ToV020,
  },
  // 0.2.0 -> 0.5.0 no upgrades needed
  {
    fromVersion: '0.2',
    toVersion: '0.6',
    doUpgrade: upgradeV010ToV020,
  },
  {
    fromVersion: '0.6',
    toVersion: '1.0',
    doUpgrade: upgradeV010ToV020,
  },
  // 1.0.0 -> 1.2.0 no updates needed
]

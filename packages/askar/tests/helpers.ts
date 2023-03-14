import type { AskarWalletPostgresStorageConfig } from '../src/wallet'
import type { InitConfig } from '@aries-framework/core'

import { LogLevel } from '@aries-framework/core'
import path from 'path'

import { TestLogger } from '../../core/tests/logger'
import { agentDependencies } from '../../node/src'
import { AskarModule } from '../src/AskarModule'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export function getPostgresAgentOptions(
  name: string,
  storageConfig: AskarWalletPostgresStorageConfig,
  extraConfig: Partial<InitConfig> = {}
) {
  const config: InitConfig = {
    label: `Agent: ${name} Postgres`,
    walletConfig: {
      id: `Wallet${name}`,
      key: `Key${name}`,
      storage: storageConfig,
    },
    autoAcceptConnections: true,
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: { askar: new AskarModule() },
  } as const
}

export function getSqliteAgentOptions(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name} SQLite`,
    walletConfig: {
      id: `Wallet${name}`,
      key: `Key${name}`,
      storage: { type: 'sqlite' },
    },
    autoAcceptConnections: true,
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: { askar: new AskarModule() },
  } as const
}

import type { AskarWalletPostgresStorageConfig } from '../src/wallet'
import type { InitConfig } from '@aries-framework/core'

import { ConnectionsModule, LogLevel, utils } from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import path from 'path'

import { TestLogger } from '../../core/tests/logger'
import { agentDependencies } from '../../node/src'
import { AskarModule } from '../src/AskarModule'
import { AskarModuleConfig } from '../src/AskarModuleConfig'

export const askarModuleConfig = new AskarModuleConfig({ ariesAskar })

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export function getPostgresAgentOptions(
  name: string,
  storageConfig: AskarWalletPostgresStorageConfig,
  extraConfig: Partial<InitConfig> = {}
) {
  const random = utils.uuid().slice(0, 4)
  const config: InitConfig = {
    label: `PostgresAgent: ${name} - ${random}`,
    walletConfig: {
      id: `PostgresWallet${name}${random}`,
      key: `Key${name}`,
      storage: storageConfig,
    },
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule(askarModuleConfig),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
    },
  } as const
}

export function getSqliteAgentOptions(name: string, extraConfig: Partial<InitConfig> = {}) {
  const random = utils.uuid().slice(0, 4)
  const config: InitConfig = {
    label: `SQLiteAgent: ${name} - ${random}`,
    walletConfig: {
      id: `SQLiteWallet${name} - ${random}`,
      key: `Key${name}`,
      storage: { type: 'sqlite' },
    },
    autoUpdateStorageOnStartup: false,
    logger: new TestLogger(LogLevel.off, name),
    ...extraConfig,
  }
  return {
    config,
    dependencies: agentDependencies,
    modules: {
      askar: new AskarModule(askarModuleConfig),
      connections: new ConnectionsModule({
        autoAcceptConnections: true,
      }),
    },
  } as const
}

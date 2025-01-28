import type { BaseAgent } from '../../../../agent/BaseAgent'
import type { FileSystem } from '../../../FileSystem'

import { InjectionSymbols } from '../../../../constants'
import { CredoError } from '../../../../error'

/**
 * Migrates the sqlite folder location from .afj to .credo in the storage directory in node and react native.
 *
 */
export async function migrateToCredoFolder<Agent extends BaseAgent>(agent: Agent) {
  const walletId = agent.config.walletConfig?.id

  if (!walletId) {
    throw new CredoError('Wallet id is required to migrate the wallet to .credo')
  }

  // Adding type assertion to get the storage config
  const storageConfig = agent.config.walletConfig?.storage as {
    config?: { inMemory?: boolean }
  }

  // If no storage config is provided, we set default as sqlite
  // https://github.com/openwallet-foundation/credo-ts/blob/main/packages/askar/src/utils/askarWalletConfig.ts#L35
  // and we only migrate the data folder if the storage config is not set to inMemory
  if (!storageConfig || (storageConfig.config && !storageConfig.config?.inMemory)) {
    return
  }

  agent.config.logger.info('Migrating data from .afj to .credo')

  const fileSystem = agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)

  await fileSystem.migrateWalletToCredoFolder(walletId)
  agent.config.logger.info('Migration completed successfully')
}

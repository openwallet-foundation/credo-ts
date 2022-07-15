import type { BaseAgent } from '../../agent/BaseAgent'
import type { FileSystem } from '../FileSystem'
import type { UpdateConfig } from './updates'

import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { isFirstVersionHigherThanSecond, parseVersionString } from '../../utils/version'
import { WalletError } from '../../wallet/error/WalletError'

import { StorageUpdateService } from './StorageUpdateService'
import { StorageUpdateError } from './error/StorageUpdateError'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, supportedUpdates } from './updates'

export class UpdateAssistant<Agent extends BaseAgent = BaseAgent> {
  private agent: Agent
  private storageUpdateService: StorageUpdateService
  private updateConfig: UpdateConfig
  private fileSystem: FileSystem

  public constructor(agent: Agent, updateConfig: UpdateConfig) {
    this.agent = agent
    this.updateConfig = updateConfig

    this.storageUpdateService = this.agent.dependencyManager.resolve(StorageUpdateService)
    this.fileSystem = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  }

  public async initialize() {
    if (this.agent.isInitialized) {
      throw new AriesFrameworkError("Can't initialize UpdateAssistant after agent is initialized")
    }

    // Initialize the wallet if not already done
    if (!this.agent.wallet.isInitialized && this.agent.config.walletConfig) {
      await this.agent.wallet.initialize(this.agent.config.walletConfig)
    } else if (!this.agent.wallet.isInitialized) {
      throw new WalletError(
        'Wallet config has not been set on the agent config. ' +
          'Make sure to initialize the wallet yourself before initializing the update assistant, ' +
          'or provide the required wallet configuration in the agent constructor'
      )
    }
  }

  public async isUpToDate() {
    return this.storageUpdateService.isUpToDate(this.agent.context)
  }

  public async getCurrentAgentStorageVersion() {
    return this.storageUpdateService.getCurrentStorageVersion(this.agent.context)
  }

  public static get frameworkStorageVersion() {
    return CURRENT_FRAMEWORK_STORAGE_VERSION
  }

  public async getNeededUpdates() {
    const currentStorageVersion = parseVersionString(
      await this.storageUpdateService.getCurrentStorageVersion(this.agent.context)
    )

    // Filter updates. We don't want older updates we already applied
    // or aren't needed because the wallet was created after the update script was made
    const neededUpdates = supportedUpdates.filter((update) => {
      const toVersion = parseVersionString(update.toVersion)

      // if an update toVersion is higher than currentStorageVersion we want to to include the update
      return isFirstVersionHigherThanSecond(toVersion, currentStorageVersion)
    })

    // The current storage version is too old to update
    if (
      neededUpdates.length > 0 &&
      isFirstVersionHigherThanSecond(parseVersionString(neededUpdates[0].fromVersion), currentStorageVersion)
    ) {
      throw new AriesFrameworkError(
        `First fromVersion is higher than current storage version. You need to use an older version of the framework to update to at least version ${neededUpdates[0].fromVersion}`
      )
    }

    return neededUpdates
  }

  public async update() {
    const updateIdentifier = Date.now().toString()

    try {
      this.agent.config.logger.info(`Starting update of agent storage with updateIdentifier ${updateIdentifier}`)
      const neededUpdates = await this.getNeededUpdates()

      if (neededUpdates.length == 0) {
        this.agent.config.logger.info('No update needed. Agent storage is up to date.')
        return
      }

      const fromVersion = neededUpdates[0].fromVersion
      const toVersion = neededUpdates[neededUpdates.length - 1].toVersion
      this.agent.config.logger.info(
        `Starting update process. Total of ${neededUpdates.length} update(s) will be applied to update the agent storage from version ${fromVersion} to version ${toVersion}`
      )

      // Create backup in case migration goes wrong
      await this.createBackup(updateIdentifier)

      try {
        for (const update of neededUpdates) {
          this.agent.config.logger.info(
            `Starting update of agent storage from version ${update.fromVersion} to version ${update.toVersion}`
          )
          await update.doUpdate(this.agent, this.updateConfig)

          // Update the framework version in storage
          await this.storageUpdateService.setCurrentStorageVersion(this.agent.context, update.toVersion)
          this.agent.config.logger.info(
            `Successfully updated agent storage from version ${update.fromVersion} to version ${update.toVersion}`
          )
        }
      } catch (error) {
        this.agent.config.logger.fatal('An error occurred while updating the wallet. Restoring backup', {
          error,
        })
        // In the case of an error we want to restore the backup
        await this.restoreBackup(updateIdentifier)

        throw error
      }
    } catch (error) {
      this.agent.config.logger.error(`Error updating storage (updateIdentifier: ${updateIdentifier})`, {
        cause: error,
      })

      throw new StorageUpdateError(`Error updating storage (updateIdentifier: ${updateIdentifier}): ${error.message}`, {
        cause: error,
      })
    }

    return updateIdentifier
  }

  private getBackupPath(backupIdentifier: string) {
    return `${this.fileSystem.basePath}/afj/migration/backup/${backupIdentifier}`
  }

  private async createBackup(backupIdentifier: string) {
    const backupPath = this.getBackupPath(backupIdentifier)

    const walletKey = this.agent.wallet.walletConfig?.key
    if (!walletKey) {
      throw new AriesFrameworkError("Could not extract wallet key from wallet module. Can't create backup")
    }

    await this.agent.wallet.export({ key: walletKey, path: backupPath })
    this.agent.config.logger.info('Created backup of the wallet', {
      backupPath,
    })
  }

  private async restoreBackup(backupIdentifier: string) {
    const backupPath = this.getBackupPath(backupIdentifier)

    const walletConfig = this.agent.wallet.walletConfig
    if (!walletConfig) {
      throw new AriesFrameworkError('Could not extract wallet config from wallet module. Cannot restore backup')
    }

    // Export and delete current wallet
    await this.agent.wallet.export({ key: walletConfig.key, path: `${backupPath}-error` })
    await this.agent.wallet.delete()

    // Import backup
    await this.agent.wallet.import(walletConfig, { key: walletConfig.key, path: backupPath })
    await this.agent.wallet.initialize(walletConfig)

    this.agent.config.logger.info(`Successfully restored wallet from backup ${backupIdentifier}`, {
      backupPath,
    })
  }
}

import type { BaseAgent } from '../../agent/BaseAgent'
import type { Module } from '../../plugins'
import type { FileSystem } from '../FileSystem'
import type { Update, UpdateConfig, UpdateToVersion } from './updates'

import { InjectionSymbols } from '../../constants'
import { CredoError } from '../../error'
import { isFirstVersionEqualToSecond, isFirstVersionHigherThanSecond, parseVersionString } from '../../utils/version'
import { WalletExportPathExistsError, WalletExportUnsupportedError } from '../../wallet/error'
import { WalletError } from '../../wallet/error/WalletError'

import { StorageUpdateService } from './StorageUpdateService'
import { StorageUpdateError } from './error/StorageUpdateError'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, DEFAULT_UPDATE_CONFIG, supportedUpdates } from './updates'

export interface UpdateAssistantUpdateOptions {
  updateToVersion?: UpdateToVersion
  backupBeforeStorageUpdate?: boolean
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export class UpdateAssistant<Agent extends BaseAgent<any> = BaseAgent> {
  private agent: Agent
  private storageUpdateService: StorageUpdateService
  private updateConfig: UpdateConfig
  private fileSystem: FileSystem

  public constructor(agent: Agent, updateConfig: UpdateConfig = DEFAULT_UPDATE_CONFIG) {
    this.agent = agent
    this.updateConfig = updateConfig

    this.storageUpdateService = this.agent.dependencyManager.resolve(StorageUpdateService)
    this.fileSystem = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  }

  public async initialize() {
    if (this.agent.isInitialized) {
      throw new CredoError("Can't initialize UpdateAssistant after agent is initialized")
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

  public async isUpToDate(updateToVersion?: UpdateToVersion) {
    return this.storageUpdateService.isUpToDate(this.agent.context, updateToVersion)
  }

  public async getCurrentAgentStorageVersion() {
    return this.storageUpdateService.getCurrentStorageVersion(this.agent.context)
  }

  public static get frameworkStorageVersion() {
    return CURRENT_FRAMEWORK_STORAGE_VERSION
  }

  public async getNeededUpdates(toVersion?: UpdateToVersion) {
    const currentStorageVersion = parseVersionString(
      await this.storageUpdateService.getCurrentStorageVersion(this.agent.context)
    )

    const parsedToVersion = toVersion ? parseVersionString(toVersion) : undefined

    // If the current storage version is higher or equal to the toVersion, we can't update, so return empty array
    if (
      parsedToVersion &&
      (isFirstVersionHigherThanSecond(currentStorageVersion, parsedToVersion) ||
        isFirstVersionEqualToSecond(currentStorageVersion, parsedToVersion))
    ) {
      return []
    }

    // Filter updates. We don't want older updates we already applied
    // or aren't needed because the wallet was created after the update script was made
    const neededUpdates = supportedUpdates.filter((update) => {
      const updateToVersion = parseVersionString(update.toVersion)

      // If the update toVersion is higher than the wanted toVersion, we skip the update
      if (parsedToVersion && isFirstVersionHigherThanSecond(updateToVersion, parsedToVersion)) {
        return false
      }

      // if an update toVersion is higher than currentStorageVersion we want to to include the update
      return isFirstVersionHigherThanSecond(updateToVersion, currentStorageVersion)
    })

    // The current storage version is too old to update
    if (
      neededUpdates.length > 0 &&
      isFirstVersionHigherThanSecond(parseVersionString(neededUpdates[0].fromVersion), currentStorageVersion)
    ) {
      throw new CredoError(
        `First fromVersion is higher than current storage version. You need to use an older version of the framework to update to at least version ${neededUpdates[0].fromVersion}`
      )
    }

    const lastUpdateToVersion = neededUpdates.length > 0 ? neededUpdates[neededUpdates.length - 1].toVersion : undefined
    if (toVersion && lastUpdateToVersion && lastUpdateToVersion !== toVersion) {
      throw new CredoError(
        `No update found for toVersion ${toVersion}. Make sure the toVersion is a valid version you can update to`
      )
    }

    return neededUpdates
  }

  public async update(options?: UpdateAssistantUpdateOptions) {
    const updateIdentifier = Date.now().toString()
    const updateToVersion = options?.updateToVersion

    // By default do a backup first (should be explicitly disabled in case the wallet backend does not support export)
    const createBackup = options?.backupBeforeStorageUpdate ?? true

    try {
      this.agent.config.logger.info(`Starting update of agent storage with updateIdentifier ${updateIdentifier}`)
      const neededUpdates = await this.getNeededUpdates(updateToVersion)

      const currentStorageVersion = parseVersionString(
        await this.storageUpdateService.getCurrentStorageVersion(this.agent.context)
      )
      const parsedToVersion = updateToVersion ? parseVersionString(updateToVersion) : undefined

      // If the current storage version is higher or equal to the toVersion, we can't update.
      if (
        parsedToVersion &&
        (isFirstVersionHigherThanSecond(currentStorageVersion, parsedToVersion) ||
          isFirstVersionEqualToSecond(currentStorageVersion, parsedToVersion))
      ) {
        throw new StorageUpdateError(
          `Can't update to version ${updateToVersion} because it is lower or equal to the current agent storage version ${currentStorageVersion[0]}.${currentStorageVersion[1]}}`
        )
      }

      if (neededUpdates.length === 0) {
        this.agent.config.logger.info('No update needed. Agent storage is up to date.')
        return
      }

      const fromVersion = neededUpdates[0].fromVersion
      const toVersion = neededUpdates[neededUpdates.length - 1].toVersion

      this.agent.config.logger.info(
        `Starting update process. Total of ${neededUpdates.length} update(s) will be applied to update the agent storage from version ${fromVersion} to version ${toVersion}`
      )

      // Create backup in case migration goes wrong
      if (createBackup) {
        await this.createBackup(updateIdentifier)
      }

      try {
        for (const update of neededUpdates) {
          const registeredModules = Object.values(this.agent.dependencyManager.registeredModules)
          const modulesWithUpdate: Array<{ module: Module; update: Update }> = []

          // Filter modules that have an update script for the current update
          for (const registeredModule of registeredModules) {
            const moduleUpdate = registeredModule.updates?.find(
              (module) => module.fromVersion === update.fromVersion && module.toVersion === update.toVersion
            )

            if (moduleUpdate) {
              modulesWithUpdate.push({
                module: registeredModule,
                update: moduleUpdate,
              })
            }
          }

          this.agent.config.logger.info(
            `Starting update of agent storage from version ${update.fromVersion} to version ${update.toVersion}. Found ${modulesWithUpdate.length} extension module(s) with update scripts`
          )
          await update.doUpdate(this.agent)

          this.agent.config.logger.info(
            `Finished update of core agent storage from version ${update.fromVersion} to version ${update.toVersion}. Starting update of extension modules`
          )

          for (const moduleWithUpdate of modulesWithUpdate) {
            this.agent.config.logger.info(
              `Starting update of extension module ${moduleWithUpdate.module.constructor.name} from version ${moduleWithUpdate.update.fromVersion} to version ${moduleWithUpdate.update.toVersion}`
            )
            await moduleWithUpdate.update.doUpdate(this.agent, this.updateConfig)
            this.agent.config.logger.info(
              `Finished update of extension module ${moduleWithUpdate.module.constructor.name} from version ${moduleWithUpdate.update.fromVersion} to version ${moduleWithUpdate.update.toVersion}`
            )
          }

          // Update the framework version in storage
          await this.storageUpdateService.setCurrentStorageVersion(this.agent.context, update.toVersion)
          this.agent.config.logger.info(
            `Successfully updated agent storage from version ${update.fromVersion} to version ${update.toVersion}`
          )
        }
        if (createBackup) {
          // Delete backup file, as it is not needed anymore
          await this.fileSystem.delete(this.getBackupPath(updateIdentifier))
        }
      } catch (error) {
        this.agent.config.logger.fatal('An error occurred while updating the wallet.', {
          error,
        })

        if (createBackup) {
          this.agent.config.logger.debug('Restoring backup.')
          // In the case of an error we want to restore the backup
          await this.restoreBackup(updateIdentifier)

          // Delete backup file, as wallet was already restored (backup-error file will persist though)
          await this.fileSystem.delete(this.getBackupPath(updateIdentifier))
        }

        throw error
      }
    } catch (error) {
      // Backup already exists at path
      if (error instanceof WalletExportPathExistsError) {
        const backupPath = this.getBackupPath(updateIdentifier)
        const errorMessage = `Error updating storage with updateIdentifier ${updateIdentifier} because the backup at path ${backupPath} already exists`
        this.agent.config.logger.fatal(errorMessage, {
          error,
          updateIdentifier,
          backupPath,
        })
        throw new StorageUpdateError(errorMessage, { cause: error })
      }
      // Wallet backend does not support export
      if (error instanceof WalletExportUnsupportedError) {
        const errorMessage = `Error updating storage with updateIdentifier ${updateIdentifier} because the wallet backend does not support exporting.
         Make sure to do a manual backup of your wallet and disable 'backupBeforeStorageUpdate' before proceeding.`
        this.agent.config.logger.fatal(errorMessage, {
          error,
          updateIdentifier,
        })
        throw new StorageUpdateError(errorMessage, { cause: error })
      }

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
    return `${this.fileSystem.dataPath}/migration/backup/${backupIdentifier}`
  }

  private async createBackup(backupIdentifier: string) {
    const backupPath = this.getBackupPath(backupIdentifier)

    const walletKey = this.agent.wallet.walletConfig?.key
    if (!walletKey) {
      throw new CredoError("Could not extract wallet key from wallet module. Can't create backup")
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
      throw new CredoError('Could not extract wallet config from wallet module. Cannot restore backup')
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

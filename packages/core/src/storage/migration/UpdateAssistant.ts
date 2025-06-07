import type { BaseAgent } from '../../agent/BaseAgent'
import type { Module } from '../../plugins'
import type { Update, UpdateConfig, UpdateToVersion } from './updates'

import { CredoError } from '../../error'
import { isFirstVersionEqualToSecond, isFirstVersionHigherThanSecond, parseVersionString } from '../../utils/version'

import { StorageUpdateService } from './StorageUpdateService'
import { StorageUpdateError } from './error/StorageUpdateError'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, DEFAULT_UPDATE_CONFIG, supportedUpdates } from './updates'

export interface UpdateAssistantUpdateOptions {
  updateToVersion?: UpdateToVersion
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export class UpdateAssistant<Agent extends BaseAgent<any> = BaseAgent> {
  private agent: Agent
  private storageUpdateService: StorageUpdateService
  private updateConfig: UpdateConfig

  public constructor(agent: Agent, updateConfig: UpdateConfig = DEFAULT_UPDATE_CONFIG) {
    this.agent = agent
    this.updateConfig = updateConfig

    this.storageUpdateService = this.agent.dependencyManager.resolve(StorageUpdateService)
  }

  public async initialize() {
    if (this.agent.isInitialized) {
      throw new CredoError("Can't initialize UpdateAssistant after agent is initialized")
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
      } catch (error) {
        this.agent.config.logger.fatal('An error occurred while updating the wallet.', {
          error,
        })

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
}

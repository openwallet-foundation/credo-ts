import type { Logger } from '../../logger'
import type { VersionString } from './version'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { StorageVersionRecord } from './repository/StorageVersionRecord'
import { StorageVersionRepository } from './repository/StorageVersionRepository'
import { supportedUpgrades, INITIAL_STORAGE_VERSION } from './upgrades'

@scoped(Lifecycle.ContainerScoped)
export class StorageUpgradeService {
  private static STORAGE_VERSION_RECORD_ID = 'STORAGE_VERSION_RECORD_ID'

  private logger: Logger
  private storageVersionRepository: StorageVersionRepository

  public constructor(agentConfig: AgentConfig, storageVersionRepository: StorageVersionRepository) {
    this.storageVersionRepository = storageVersionRepository
    this.logger = agentConfig.logger
  }

  public async isUpToDate() {
    const currentStorageVersion = await this.getCurrentStorageVersion()

    const isUpToDate = this.frameworkStorageVersion === currentStorageVersion

    return isUpToDate
  }

  public get frameworkStorageVersion(): VersionString {
    // Latest version is last toVersion from the supported upgrades
    const latestVersion = supportedUpgrades[supportedUpgrades.length - 1].toVersion

    return latestVersion
  }

  public async getCurrentStorageVersion(): Promise<VersionString> {
    const storageVersionRecord = await this.getStorageVersionRecord()

    return storageVersionRecord.storageVersion
  }

  public async setCurrentStorageVersion(storageVersion: VersionString) {
    this.logger.debug(`Setting current agent storage version to ${storageVersion}`)
    const storageVersionRecord = await this.storageVersionRepository.findById(
      StorageUpgradeService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      this.logger.trace('Storage upgrade record does not exist yet. Creating.')
      await this.storageVersionRepository.save(
        new StorageVersionRecord({
          id: StorageUpgradeService.STORAGE_VERSION_RECORD_ID,
          storageVersion,
        })
      )
    } else {
      this.logger.trace('Storage upgrade record already exists. Updating.')
      storageVersionRecord.storageVersion = storageVersion
      await this.storageVersionRepository.update(storageVersionRecord)
    }
  }

  /**
   * Retrieve the upgrade record, creating it if it doesn't exist already.
   *
   * The storageVersion will be set to the INITIAL_STORAGE_VERSION if it doesn't exist yet,
   * as we can assume the wallet was created before the upgrade record existed
   */
  public async getStorageVersionRecord() {
    let storageVersionRecord = await this.storageVersionRepository.findById(
      StorageUpgradeService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      storageVersionRecord = new StorageVersionRecord({
        id: StorageUpgradeService.STORAGE_VERSION_RECORD_ID,
        storageVersion: INITIAL_STORAGE_VERSION,
      })
      await this.storageVersionRepository.save(storageVersionRecord)
    }

    return storageVersionRecord
  }
}

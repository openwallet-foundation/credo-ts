import type { Logger } from '../../logger'
import type { VersionString } from '../../utils/version'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { StorageVersionRecord } from './repository/StorageVersionRecord'
import { StorageVersionRepository } from './repository/StorageVersionRepository'
import { INITIAL_STORAGE_VERSION, CURRENT_FRAMEWORK_STORAGE_VERSION } from './updates'

@scoped(Lifecycle.ContainerScoped)
export class StorageUpdateService {
  private static STORAGE_VERSION_RECORD_ID = 'STORAGE_VERSION_RECORD_ID'

  private logger: Logger
  private storageVersionRepository: StorageVersionRepository

  public constructor(agentConfig: AgentConfig, storageVersionRepository: StorageVersionRepository) {
    this.storageVersionRepository = storageVersionRepository
    this.logger = agentConfig.logger
  }

  public async isUpToDate() {
    const currentStorageVersion = await this.getCurrentStorageVersion()

    const isUpToDate = CURRENT_FRAMEWORK_STORAGE_VERSION === currentStorageVersion

    return isUpToDate
  }

  public async getCurrentStorageVersion(): Promise<VersionString> {
    const storageVersionRecord = await this.getStorageVersionRecord()

    return storageVersionRecord.storageVersion
  }

  public async setCurrentStorageVersion(storageVersion: VersionString) {
    this.logger.debug(`Setting current agent storage version to ${storageVersion}`)
    const storageVersionRecord = await this.storageVersionRepository.findById(
      StorageUpdateService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      this.logger.trace('Storage upgrade record does not exist yet. Creating.')
      await this.storageVersionRepository.save(
        new StorageVersionRecord({
          id: StorageUpdateService.STORAGE_VERSION_RECORD_ID,
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
   * Retrieve the update record, creating it if it doesn't exist already.
   *
   * The storageVersion will be set to the INITIAL_STORAGE_VERSION if it doesn't exist yet,
   * as we can assume the wallet was created before the udpate record existed
   */
  public async getStorageVersionRecord() {
    let storageVersionRecord = await this.storageVersionRepository.findById(
      StorageUpdateService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      storageVersionRecord = new StorageVersionRecord({
        id: StorageUpdateService.STORAGE_VERSION_RECORD_ID,
        storageVersion: INITIAL_STORAGE_VERSION,
      })
      await this.storageVersionRepository.save(storageVersionRecord)
    }

    return storageVersionRecord
  }
}

import type { AgentContext } from '../../agent'
import type { VersionString } from '../../utils/version'
import type { UpdateToVersion } from './updates'

import { InjectionSymbols } from '../../constants'
import { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'

import { isStorageUpToDate } from './isUpToDate'
import { StorageVersionRecord } from './repository/StorageVersionRecord'
import { StorageVersionRepository } from './repository/StorageVersionRepository'
import { INITIAL_STORAGE_VERSION } from './updates'

@injectable()
export class StorageUpdateService {
  private static STORAGE_VERSION_RECORD_ID = 'STORAGE_VERSION_RECORD_ID'

  private logger: Logger
  private storageVersionRepository: StorageVersionRepository

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    storageVersionRepository: StorageVersionRepository
  ) {
    this.logger = logger
    this.storageVersionRepository = storageVersionRepository
  }

  public async isUpToDate(agentContext: AgentContext, updateToVersion?: UpdateToVersion) {
    const currentStorageVersion = await this.getCurrentStorageVersion(agentContext)
    return isStorageUpToDate(currentStorageVersion, updateToVersion)
  }

  public async getCurrentStorageVersion(agentContext: AgentContext): Promise<VersionString> {
    const storageVersionRecord = await this.getStorageVersionRecord(agentContext)

    return storageVersionRecord.storageVersion
  }

  public async setCurrentStorageVersion(agentContext: AgentContext, storageVersion: VersionString) {
    this.logger.debug(`Setting current agent storage version to ${storageVersion}`)
    const storageVersionRecord = await this.storageVersionRepository.findById(
      agentContext,
      StorageUpdateService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      this.logger.trace('Storage upgrade record does not exist yet. Creating.')
      await this.storageVersionRepository.save(
        agentContext,
        new StorageVersionRecord({
          id: StorageUpdateService.STORAGE_VERSION_RECORD_ID,
          storageVersion,
        })
      )
    } else {
      this.logger.trace('Storage upgrade record already exists. Updating.')
      storageVersionRecord.storageVersion = storageVersion
      await this.storageVersionRepository.update(agentContext, storageVersionRecord)
    }
  }

  /**
   * Retrieve the update record, creating it if it doesn't exist already.
   *
   * The storageVersion will be set to the INITIAL_STORAGE_VERSION if it doesn't exist yet,
   * as we can assume the wallet was created before the update record existed
   */
  public async getStorageVersionRecord(agentContext: AgentContext) {
    let storageVersionRecord = await this.storageVersionRepository.findById(
      agentContext,
      StorageUpdateService.STORAGE_VERSION_RECORD_ID
    )

    if (!storageVersionRecord) {
      storageVersionRecord = new StorageVersionRecord({
        id: StorageUpdateService.STORAGE_VERSION_RECORD_ID,
        storageVersion: INITIAL_STORAGE_VERSION,
      })
      await this.storageVersionRepository.save(agentContext, storageVersionRecord)
    }

    return storageVersionRecord
  }
}

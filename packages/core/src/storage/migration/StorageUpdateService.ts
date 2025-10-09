import type { AgentContext } from '../../agent'
import type { VersionString } from '../../utils/version'
import type { UpdateToVersion } from './updates'

import { InjectionSymbols } from '../../constants'
import type { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'

import { isStorageUpToDate } from './isUpToDate'
import { StorageVersionRecord } from './repository/StorageVersionRecord'
import { StorageVersionRepository } from './repository/StorageVersionRepository'
import { CURRENT_FRAMEWORK_STORAGE_VERSION, INITIAL_STORAGE_VERSION } from './updates'

@injectable()
export class StorageUpdateService {
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

  public async hasStorageVersionRecord(agentContext: AgentContext) {
    const storageVersionRecord = await this.storageVersionRepository.findById(
      agentContext,
      StorageVersionRecord.storageVersionRecordId
    )

    return storageVersionRecord !== null
  }

  public async getCurrentStorageVersion(agentContext: AgentContext): Promise<VersionString> {
    const storageVersionRecord = await this.getStorageVersionRecord(agentContext)

    return storageVersionRecord.storageVersion
  }

  public static get frameworkStorageVersion() {
    return CURRENT_FRAMEWORK_STORAGE_VERSION
  }

  public async setCurrentStorageVersion(agentContext: AgentContext, storageVersion: VersionString) {
    this.logger.debug(`Setting current agent storage version to ${storageVersion}`)
    const storageVersionRecord = await this.storageVersionRepository.findById(
      agentContext,
      StorageVersionRecord.storageVersionRecordId
    )

    if (!storageVersionRecord) {
      this.logger.trace('Storage upgrade record does not exist yet. Creating.')
      await this.storageVersionRepository.save(
        agentContext,
        new StorageVersionRecord({
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
      StorageVersionRecord.storageVersionRecordId
    )

    if (!storageVersionRecord) {
      storageVersionRecord = new StorageVersionRecord({
        storageVersion: INITIAL_STORAGE_VERSION,
      })
      await this.storageVersionRepository.save(agentContext, storageVersionRecord)
    }

    return storageVersionRecord
  }
}

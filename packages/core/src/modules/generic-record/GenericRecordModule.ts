import type { Logger } from '../../logger'
import type { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import type { GenericRecordTags } from './repository/GenericRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { GenericRecordService } from './service/GenericRecordService'

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordModule {
  private genericRecordsService: GenericRecordService
  private logger: Logger
  public constructor(agentConfig: AgentConfig, genericRecordsService: GenericRecordService) {
    this.genericRecordsService = genericRecordsService
    this.logger = agentConfig.logger
  }

  public async saveRecord(message: string, tags?: GenericRecordTags, connectionRecord?: ConnectionRecord) {
    try {
      const record = await this.genericRecordsService.saveRecord(message, tags, connectionRecord)
      return record
    } catch (error) {
      this.logger.error('Error while saving generic-record', {
        error,
        encryptedMessage: message,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  public async findAllByQuery(query: Partial<GenericRecordTags>) {
    return this.genericRecordsService.findAllByQuery(query)
  }

  public async getAll() {
    return this.genericRecordsService.getAll()
  }
}

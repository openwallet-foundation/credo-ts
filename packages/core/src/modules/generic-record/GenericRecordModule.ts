import type { Logger } from '../../logger'
import type { GenericRecord, GenericRecordTags, SaveGenericRecordOption } from './repository/GenericRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'

import { GenericRecordService } from './service/GenericRecordService'

export type ContentType = {
  content: string
}

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordModule {
  private genericRecordsService: GenericRecordService
  private logger: Logger
  public constructor(agentConfig: AgentConfig, genericRecordsService: GenericRecordService) {
    this.genericRecordsService = genericRecordsService
    this.logger = agentConfig.logger
  }

  public async save({ message, tags }: SaveGenericRecordOption) {
    try {
      const record = await this.genericRecordsService.save({
        message: message,
        tags: tags,
      })
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

  public async delete(record: GenericRecord): Promise<void> {
    try {
      await this.genericRecordsService.delete(record)
    } catch (error) {
      this.logger.error('Error while saving generic-record', {
        error,
        encryptedMessage: record.content,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  public async update(record: GenericRecord): Promise<void> {
    try {
      await this.genericRecordsService.update(record)
    } catch (error) {
      this.logger.error('Error while update generic-record', {
        error,
        encryptedMessage: record.content,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  public async findById(id: string) {
    return this.genericRecordsService.findById(id)
  }

  public async findAllByQuery(query: Partial<GenericRecordTags>): Promise<GenericRecord[]> {
    return this.genericRecordsService.findAllByQuery(query)
  }

  public async getAll(): Promise<GenericRecord[]> {
    return this.genericRecordsService.getAll()
  }
}

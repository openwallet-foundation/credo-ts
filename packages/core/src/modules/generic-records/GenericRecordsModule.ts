import type { Logger } from '../../logger'
import type { DependencyManager } from '../../plugins'
import type { GenericRecord, GenericRecordTags, SaveGenericRecordOption } from './repository/GenericRecord'

import { AgentConfig } from '../../agent/AgentConfig'
import { injectable, module } from '../../plugins'

import { GenericRecordsRepository } from './repository/GenericRecordsRepository'
import { GenericRecordService } from './service/GenericRecordService'

export type ContentType = {
  content: string
}

@module()
@injectable()
export class GenericRecordsModule {
  private genericRecordsService: GenericRecordService
  private logger: Logger
  public constructor(agentConfig: AgentConfig, genericRecordsService: GenericRecordService) {
    this.genericRecordsService = genericRecordsService
    this.logger = agentConfig.logger
  }

  public async save({ content, tags }: SaveGenericRecordOption) {
    try {
      const record = await this.genericRecordsService.save({
        content: content,
        tags: tags,
      })
      return record
    } catch (error) {
      this.logger.error('Error while saving generic-record', {
        error,
        content,
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
        content: record.content,
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
        content: record.content,
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

  /**
   * Registers the dependencies of the generic records module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(GenericRecordsModule)

    // Services
    dependencyManager.registerSingleton(GenericRecordService)

    // Repositories
    dependencyManager.registerSingleton(GenericRecordsRepository)
  }
}

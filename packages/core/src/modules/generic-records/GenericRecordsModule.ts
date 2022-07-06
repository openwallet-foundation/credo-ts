import type { DependencyManager } from '../../plugins'
import type { GenericRecord, GenericRecordTags, SaveGenericRecordOption } from './repository/GenericRecord'

import { AgentContext } from '../../agent'
import { InjectionSymbols } from '../../constants'
import { Logger } from '../../logger'
import { inject, injectable, module } from '../../plugins'

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
  private agentContext: AgentContext

  public constructor(
    genericRecordsService: GenericRecordService,
    @inject(InjectionSymbols.Logger) logger: Logger,
    agentContext: AgentContext
  ) {
    this.genericRecordsService = genericRecordsService
    this.logger = logger
    this.agentContext = agentContext
  }

  public async save({ content, tags, id }: SaveGenericRecordOption) {
    try {
      const record = await this.genericRecordsService.save(this.agentContext, {
        id,
        content,
        tags,
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
      await this.genericRecordsService.delete(this.agentContext, record)
    } catch (error) {
      this.logger.error('Error while saving generic-record', {
        error,
        content: record.content,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  public async deleteById(id: string): Promise<void> {
    await this.genericRecordsService.deleteById(this.agentContext, id)
  }

  public async update(record: GenericRecord): Promise<void> {
    try {
      await this.genericRecordsService.update(this.agentContext, record)
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
    return this.genericRecordsService.findById(this.agentContext, id)
  }

  public async findAllByQuery(query: Partial<GenericRecordTags>): Promise<GenericRecord[]> {
    return this.genericRecordsService.findAllByQuery(this.agentContext, query)
  }

  public async getAll(): Promise<GenericRecord[]> {
    return this.genericRecordsService.getAll(this.agentContext)
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

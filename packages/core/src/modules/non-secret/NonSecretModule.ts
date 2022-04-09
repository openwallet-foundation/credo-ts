import { Lifecycle, scoped } from 'tsyringe'
import { AgentConfig } from '../../agent/AgentConfig'
import { Logger } from '../../logger'
import { ConnectionRecord } from '../connections/repository/ConnectionRecord'
import { NonSecretRecordTags } from './repository/NonSecretRecord'
import { NonSecretRecordService } from './service/NonSecretRecordService'

@scoped(Lifecycle.ContainerScoped)
export class NonSecretModule {
  private nonSecretService: NonSecretRecordService
  private logger: Logger
  public constructor(agentConfig: AgentConfig, nonSecretService: NonSecretRecordService) {
    this.nonSecretService = nonSecretService
    this.logger = agentConfig.logger
  }

  public async saveRecord(message: string, tags?: NonSecretRecordTags, connectionRecord?: ConnectionRecord) {
    try {
      const record = await this.nonSecretService.saveRecord(message, tags, connectionRecord)
      return record
    } catch (error) {
      this.logger.error('Error while saving non-secret', {
        error,
        encryptedMessage: message,
        errorMessage: error instanceof Error ? error.message : error,
      })
      throw error
    }
  }

  public async findAllByQuery(query: Partial<NonSecretRecordTags>) {
    return this.nonSecretService.findAllByQuery(query)
  }

  public async getAll() {
    return this.nonSecretService.getAll()
  }
}

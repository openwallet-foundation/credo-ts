import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { NonSecretRecordTags } from '../repository/NonSecretRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { NonSecretRecord } from '../repository/NonSecretRecord'
import { NonSecretRecordRepository } from '../repository/NonSecretRecordRepository'

@scoped(Lifecycle.ContainerScoped)
export class NonSecretRecordService {
  private nonSecretRepository: NonSecretRecordRepository

  public constructor(nonSecretRepository: NonSecretRecordRepository) {
    this.nonSecretRepository = nonSecretRepository
  }

  public async saveRecord(message: string, tags?: NonSecretRecordTags, connectionRecord?: ConnectionRecord) {
    const nonsecretRecord = new NonSecretRecord({
      content: message,
      connectionId: connectionRecord?.id,
      tags: tags,
    })

    try {
      await this.nonSecretRepository.save(nonsecretRecord)
      return nonsecretRecord
    } catch (error) {
      throw new AriesFrameworkError(`Unable to store the nonSecret record with id ${nonSecretRecord.id}. Message: ${error}`)
    }
  }

  public async findAllByQuery(query: Partial<NonSecretRecordTags>) {
    return this.nonSecretRepository.findByQuery(query)
  }

  public async getAll() {
    return this.nonSecretRepository.getAll()
  }
}

import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { GenericRecordTags, SaveGenericRecordOption } from '../repository/GenericRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { GenericRecord } from '../repository/GenericRecord'
import { GenericRecordRepository } from '../repository/GenericRecordRepository'

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordService {
  private genericRecordsRepository: GenericRecordRepository

  public constructor(genericRecordsRepository: GenericRecordRepository) {
    this.genericRecordsRepository = genericRecordsRepository
  }

  public async saveRecord({ message, tags, connectionRecord }: SaveGenericRecordOption) {
    const genericRecord = new GenericRecord({
      content: message,
      connectionId: connectionRecord?.id,
      tags: tags,
    })

    try {
      await this.genericRecordsRepository.save(genericRecord)
      return genericRecord
    } catch (error) {
      throw new AriesFrameworkError(
        `Unable to store the genericRecord record with id ${genericRecord.id}. Message: ${error}`
      )
    }
  }

  public async findAllByQuery(query: Partial<GenericRecordTags>) {
    return this.genericRecordsRepository.findByQuery(query)
  }

  public async getAll() {
    return this.genericRecordsRepository.getAll()
  }
}

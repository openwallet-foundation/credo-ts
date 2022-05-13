import type { GenericRecordTags, SaveGenericRecordOption } from '../repository/GenericRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../error'
import { GenericRecord } from '../repository/GenericRecord'
import { GenericRecordsRepository } from '../repository/GenericRecordsRepository'

@scoped(Lifecycle.ContainerScoped)
export class GenericRecordService {
  private genericRecordsRepository: GenericRecordsRepository

  public constructor(genericRecordsRepository: GenericRecordsRepository) {
    this.genericRecordsRepository = genericRecordsRepository
  }

  public async save({ message, tags }: SaveGenericRecordOption) {
    const genericRecord = new GenericRecord({
      content: message,
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

  public async delete(record: GenericRecord): Promise<void> {
    try {
      await this.genericRecordsRepository.delete(record)
    } catch (error) {
      throw new AriesFrameworkError(`Unable to delete the genericRecord record with id ${record.id}. Message: ${error}`)
    }
  }

  public async update(record: GenericRecord): Promise<void> {
    try {
      await this.genericRecordsRepository.update(record)
    } catch (error) {
      throw new AriesFrameworkError(`Unable to update the genericRecord record with id ${record.id}. Message: ${error}`)
    }
  }

  public async findAllByQuery(query: Partial<GenericRecordTags>) {
    return this.genericRecordsRepository.findByQuery(query)
  }

  public async findById(id: string): Promise<GenericRecord | null> {
    return this.genericRecordsRepository.findById(id)
  }

  public async getAll() {
    return this.genericRecordsRepository.getAll()
  }
}

import type { OutOfBandRecord } from './repository'

import { scoped, Lifecycle } from 'tsyringe'

import { OutOfBandRepository } from './repository'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private outOfBandRepository: OutOfBandRepository

  public constructor(outOfBandRepository: OutOfBandRepository) {
    this.outOfBandRepository = outOfBandRepository
  }

  public async save(outOfBandRecord: OutOfBandRecord) {
    return this.outOfBandRepository.save(outOfBandRecord)
  }

  public async findById(outOfBandRecordId: string) {
    return this.outOfBandRepository.findById(outOfBandRecordId)
  }

  public async findByMessageId(messageId: string) {
    return this.outOfBandRepository.findSingleByQuery({ messageId })
  }

  public async findByRecipientKey(recipientKey: string) {
    return this.outOfBandRepository.findSingleByQuery({ recipientKey })
  }
}

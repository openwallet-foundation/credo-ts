import type { Key } from '../dids/domain/Key'
import type { OutOfBandState } from './domain/OutOfBandState'
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

  public async updateState(outOfBandRecord: OutOfBandRecord, newState: OutOfBandState) {
    outOfBandRecord.state = newState
    return this.outOfBandRepository.update(outOfBandRecord)
  }

  public async findById(outOfBandRecordId: string) {
    return this.outOfBandRepository.findById(outOfBandRecordId)
  }

  public async findByMessageId(messageId: string) {
    return this.outOfBandRepository.findSingleByQuery({ messageId })
  }

  public async findByRecipientKey(recipientKey: Key) {
    return this.outOfBandRepository.findSingleByQuery({ recipientKeyFingerprints: [recipientKey.fingerprint] })
  }

  public async getAll() {
    return this.outOfBandRepository.getAll()
  }
}

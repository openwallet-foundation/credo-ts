import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import type { PartyState, StorageInterface, WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'

import AsyncLock from 'async-lock'
import { Lifecycle, scoped } from 'tsyringe'

import { WitnessStateRecord } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferStateService implements StorageInterface {
  private valueTransferStateRepository: ValueTransferStateRepository
  private witnessStateRepository: WitnessStateRepository
  private valueTransferStateRecord?: ValueTransferStateRecord
  private witnessStateRecord?: WitnessStateRecord
  private witnessStateLock: AsyncLock

  public constructor(
    valueTransferStateRepository: ValueTransferStateRepository,
    witnessStateRepository: WitnessStateRepository
  ) {
    this.valueTransferStateRepository = valueTransferStateRepository
    this.witnessStateRepository = witnessStateRepository
    this.witnessStateLock = new AsyncLock()
  }

  public async getPartyStateRecord(): Promise<ValueTransferStateRecord> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return this.valueTransferStateRecord
  }

  public async getPartyState(): Promise<PartyState> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return this.valueTransferStateRecord.partyState
  }

  public async storePartyState(partyState: PartyState): Promise<void> {
    const record = await this.valueTransferStateRepository.getSingleByQuery({})
    record.partyState = partyState
    await this.valueTransferStateRepository.update(record)
    this.valueTransferStateRecord = record
  }

  public async getWitnessStateRecord(): Promise<WitnessStateRecord> {
    if (!this.witnessStateRecord) {
      this.witnessStateRecord = await this.witnessStateRepository.getSingleByQuery({})
    }
    return this.witnessStateRecord
  }

  public async getWitnessState(): Promise<WitnessState> {
    if (!this.witnessStateRecord) {
      this.witnessStateRecord = await this.witnessStateRepository.getSingleByQuery({})
    }
    return this.witnessStateRecord.witnessState
  }

  public async storeWitnessState(witnessState: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.witnessState = witnessState
    await this.witnessStateRepository.update(record)
    this.witnessStateRecord = record
  }

  /** @inheritDoc {StorageService#safeMutation} */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async safeOperationWithWitnessState(operation: () => Promise<any>): Promise<any> {
    return this.witnessStateLock.acquire(
      WitnessStateRecord.id,
      async () => {
        return operation()
      },
      { maxOccupationTime: 60 * 1000 }
    )
  }
}

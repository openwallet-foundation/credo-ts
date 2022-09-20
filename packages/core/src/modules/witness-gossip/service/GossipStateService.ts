import type { WitnessState, WitnessGossipStorageInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import AsyncLock from 'async-lock'
import { Lifecycle, scoped } from 'tsyringe'

import { WitnessStateRecord, WitnessStateRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class WitnessGossipStateService implements WitnessGossipStorageInterface {
  private witnessStateRepository: WitnessStateRepository
  private witnessStateLock: AsyncLock

  public constructor(witnessStateRepository: WitnessStateRepository) {
    this.witnessStateRepository = witnessStateRepository
    this.witnessStateLock = new AsyncLock()
  }

  public async getWitnessStateRecord(): Promise<WitnessStateRecord> {
    return await this.witnessStateRepository.getSingleByQuery({})
  }

  public async getWitnessState(): Promise<WitnessState> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    return record.witnessState
  }

  public async storeWitnessState(witnessState: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.witnessState = witnessState
    await this.witnessStateRepository.update(record)
    // this.witnessStateRecord = record
  }

  /** @inheritDoc {StorageService#safeMutation} */
  public async safeOperationWithWitnessState<T>(operation: () => Promise<T>): Promise<T> {
    return this.witnessStateLock.acquire(
      WitnessStateRecord.id,
      async () => {
        return operation()
      },
      { maxOccupationTime: 60 * 1000 }
    )
  }
}

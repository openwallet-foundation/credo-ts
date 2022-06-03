import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import type { WitnessStateRecord } from '../repository/WitnessStateRecord'
import type { State, StorageInterface, WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferStateService implements StorageInterface {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private witnessStateRepository: WitnessStateRepository
  private valueTransferStateRecord?: ValueTransferStateRecord
  private witnessStateRecord?: WitnessStateRecord

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    witnessStateRepository: WitnessStateRepository
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.witnessStateRepository = witnessStateRepository
  }

  public async getState(): Promise<ValueTransferStateRecord> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return this.valueTransferStateRecord
  }

  public async storeState(state: State): Promise<void> {
    const record = await this.valueTransferStateRepository.getSingleByQuery({})
    record.verifiableNotes = state.verifiableNotes
    record.previousHash = state.previousHash
    this.valueTransferStateRecord = record
    await this.valueTransferStateRepository.update(record)
  }

  public async getWitnessState(): Promise<WitnessState> {
    if (!this.witnessStateRecord) {
      this.witnessStateRecord = await this.witnessStateRepository.getSingleByQuery({})
    }
    return this.witnessStateRecord
  }

  public async storeWitnessState(state: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.stateAccumulator = state.stateAccumulator
    this.witnessStateRecord = record
    await this.witnessStateRepository.update(record)
  }
}

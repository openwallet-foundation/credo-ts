import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
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
    return this.valueTransferStateRepository.getSingleByQuery({})
  }

  public async storeState(state: State): Promise<void> {
    const record = await this.valueTransferStateRepository.getSingleByQuery({})
    record.verifiableNotes = state.verifiableNotes
    record.previousHash = state.previousHash
    await this.valueTransferStateRepository.update(record)
  }

  public async getWitnessState(): Promise<WitnessState> {
    return this.witnessStateRepository.getSingleByQuery({})
  }

  public async storeWitnessState(state: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.stateAccumulator = state.stateAccumulator
    await this.witnessStateRepository.update(record)
  }
}

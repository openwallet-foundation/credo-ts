import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import type { WitnessStateRecord } from '../repository/WitnessStateRecord'
import type { State, StorageInterface, WitnessState } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { Buffer } from '../../../utils'
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

  public async getState(): Promise<State> {
    if (!this.valueTransferStateRecord) {
      this.valueTransferStateRecord = await this.valueTransferStateRepository.getSingleByQuery({})
    }
    return {
      previousHash: Uint8Array.from(Buffer.from(this.valueTransferStateRecord.previousHash, 'hex')),
      wallet: this.valueTransferStateRecord.wallet,
      proposedNextWallet: this.valueTransferStateRecord.proposedNextWallet,
    }
  }

  public async storeState(state: State): Promise<void> {
    const record = await this.valueTransferStateRepository.getSingleByQuery({})
    record.previousHash = Buffer.from(state.previousHash).toString('hex')
    record.wallet = state.wallet
    record.proposedNextWallet = state.proposedNextWallet
    await this.valueTransferStateRepository.update(record)
    this.valueTransferStateRecord = record
  }

  public async getWitnessState(): Promise<WitnessState> {
    if (!this.witnessStateRecord) {
      this.witnessStateRecord = await this.witnessStateRepository.getSingleByQuery({})
    }
    return {
      stateAccumulator: this.witnessStateRecord.stateAccumulator,
    }
  }

  public async storeWitnessState(state: WitnessState): Promise<void> {
    const record = await this.witnessStateRepository.getSingleByQuery({})
    record.stateAccumulator = state.stateAccumulator
    await this.witnessStateRepository.update(record)
    this.witnessStateRecord = record
  }
}

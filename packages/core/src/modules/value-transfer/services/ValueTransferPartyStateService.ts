import type { ValueTransferStateRecord } from '../repository/ValueTransferStateRecord'
import type { PartyState, Transaction, VtpPartyStorageInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferPartyStateService implements VtpPartyStorageInterface {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferStateRecord?: ValueTransferStateRecord

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
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

  public async addTransaction(transaction: Transaction): Promise<void> {
    const record = new ValueTransferRecord({
      id: transaction.id,
      transaction,
    })
    return this.valueTransferRepository.save(record)
  }

  public async findTransaction(id: string): Promise<Transaction | undefined> {
    const record = await this.valueTransferRepository.findById(id)
    return record?.transaction
  }

  public async getTransaction(id: string): Promise<Transaction> {
    const record = await this.valueTransferRepository.getById(id)
    return record?.transaction
  }

  public async updateTransaction(transaction: Transaction): Promise<void> {
    const record = await this.valueTransferRepository.getById(transaction.id)
    record.transaction = transaction
    await this.valueTransferRepository.update(record)
  }
}

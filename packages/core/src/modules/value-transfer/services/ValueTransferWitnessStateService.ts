import type {
  Transaction,
  WitnessStorageInterface,
  TransactionRecord,
  WitnessDetails,
} from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { GossipService } from '../../witness-gossip/service'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessStateService implements WitnessStorageInterface {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private gossipService: GossipService

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    gossipService: GossipService
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.gossipService = gossipService
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

  public async checkPartyStateHash(hash: Uint8Array): Promise<Uint8Array | undefined> {
    return this.gossipService.checkPartyStateHash(hash)
  }

  public async getWitnessDetails(): Promise<WitnessDetails> {
    return this.gossipService.getWitnessDetails()
  }

  public async settlePartyStateTransition(transactionRecord: TransactionRecord): Promise<void> {
    return this.gossipService.settlePartyStateTransition(transactionRecord)
  }
}

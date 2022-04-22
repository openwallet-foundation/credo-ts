import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import type { ValueTransferTags } from '../repository'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'

import { ValueTransfer } from '@value-transfer/value-transfer-lib'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'

import { AgentConfig, AriesFrameworkError, InjectionSymbols, Wallet } from '@aries-framework/core'
import { ValueTransferIdentityResolverService } from './ValueTransferIdentityResolverService'
import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStorageService } from './ValueTransferStorageService'
import { DidKey, Key } from '../../dids'
import { KeyType } from '../../../crypto'
import { RequestMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferService {
  private wallet: Wallet
  private config: AgentConfig
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferIdentityResolverService: ValueTransferIdentityResolverService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStorageService: ValueTransferStorageService
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    valueTransfer: ValueTransfer,
    valueTransferRepository: ValueTransferRepository,
    valueTransferIdentityResolverService: ValueTransferIdentityResolverService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStorageService: ValueTransferStorageService,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.valueTransfer = valueTransfer
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferIdentityResolverService = valueTransferIdentityResolverService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStorageService = valueTransferStorageService
    this.eventEmitter = eventEmitter
  }

  private async createDidKey(): Promise<DidKey> {
    const { verkey } = await this.wallet.createDid()
    return new DidKey(Key.fromPublicKeyBase58(verkey, KeyType.Ed25519))
  }

  public async createRequest(connectionRecord: ConnectionRecord, amount: number, giver?: string, witness?: string) {
    connectionRecord.assertReady()
    if (!connectionRecord.theirDid) {
      throw new AriesFrameworkError(`Connection record is not ready to be used.`)
    }

    const didKey = await this.createDidKey()

    const getter = this.valueTransfer.getter()
    const requestMessage = await getter.createRequest(didKey.did, amount, witness || this.config.witness, giver)

    const record = new ValueTransferRecord({
      id: requestMessage.payload.payment.txId,
      state: ValueTransferState.MyTxn,
      connectionId: connectionRecord.id,
      role: ValueTransferRole.Getter,
      requestMessage,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { message: record, previousState: null },
    })

    return record
  }

  public async processRequest(messageContext: InboundMessageContext<RequestMessage>): Promise<ValueTransferRecord> {
    const { message: requestMessage, connection } = messageContext

    let record: ValueTransferRecord = new ValueTransferRecord({
      id: requestMessage.payload.payment.txId,
      state: ValueTransferState.TheirTxn,
      connectionId: connection?.id,
      role: ValueTransferRole.Giver,
      requestMessage,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { message: record, previousState: null },
    })

    return record
  }

  public getAll(): Promise<ValueTransferRecord[]> {
    return this.valueTransferRepository.getAll()
  }

  public getById(recordId: string): Promise<ValueTransferRecord> {
    return this.valueTransferRepository.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferRepository.findByQuery(query)
  }

  public async update(record: ValueTransferRecord): Promise<void> {
    return this.valueTransferRepository.update(record)
  }
}

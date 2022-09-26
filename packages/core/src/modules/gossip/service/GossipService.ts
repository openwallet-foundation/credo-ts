import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ResumeValueTransferTransactionEvent, WitnessTableReceivedEvent } from '../../value-transfer'
import type { WitnessGossipMessage, WitnessTableQueryMessage } from '../messages'
import type { TransactionRecord } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Gossip, WitnessGossipInfo, WitnessState, WitnessDetails } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidMarker, DidService } from '../../dids'
import { ValueTransferEventTypes } from '../../value-transfer/ValueTransferEvents'
import { WitnessTableMessage } from '../messages'
import { WitnessStateRecord, WitnessStateRepository } from '../repository'

import { GossipCryptoService } from './GossipCryptoService'
import { GossipLoggerService } from './GossipLoggerService'
import { WitnessGossipStateService } from './GossipStateService'
import { GossipTransportService } from './GossipTransportService'

@scoped(Lifecycle.ContainerScoped)
export class GossipService {
  private gossip: Gossip
  private config: AgentConfig
  private eventEmitter: EventEmitter
  private witnessStateRepository: WitnessStateRepository
  private witnessGossipStateService: WitnessGossipStateService
  private didService: DidService
  private gossipingStarted = false

  public constructor(
    config: AgentConfig,
    gossipCryptoService: GossipCryptoService,
    gossipStateService: WitnessGossipStateService,
    gossipTransportService: GossipTransportService,
    gossipLoggerService: GossipLoggerService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.witnessStateRepository = witnessStateRepository
    this.witnessGossipStateService = gossipStateService
    this.didService = didService
    this.eventEmitter = eventEmitter

    this.gossip = new Gossip(
      {
        logger: gossipLoggerService,
        crypto: gossipCryptoService,
        storage: gossipStateService,
        transport: gossipTransportService,
        metrics: config.witnessGossipMetrics,
      },
      {
        label: config.label,
        redeliveryThreshold: config.witnessRedeliveryThreshold,
        historyThreshold: config.witnessHistoryThreshold,
      }
    )
  }

  public async init(): Promise<void> {
    await this.initState()
    await this.startGossiping()
  }

  private async initState(): Promise<void> {
    this.config.logger.info('> Witness Gossip state initialization started')

    const existingState = await this.witnessStateRepository.findSingleByQuery({})

    // witness has already been initialized
    if (existingState) return

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `Public` marker for static DID in the agent config.'
      )
    }

    const config = this.config.valueWitnessConfig

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provided.')
    }

    const info = new WitnessDetails({
      wid: config.wid,
      did: did.did,
    })

    const witnessState = new WitnessState({
      info,
      mappingTable: config.knownWitnesses,
    })

    const state = new WitnessStateRecord({
      witnessState,
    })

    await this.witnessStateRepository.save(state)

    this.config.logger.info('< Witness Gossip state initialization completed!')
  }

  private async startGossiping() {
    if (!this.gossipingStarted) await this.gossip.start()
    this.gossipingStarted = true
  }

  /**
   * Process a received {@link WitnessGossipMessage}.
   *   If it contains `tell` section - apply transaction updates
   *   If it contains `ask` section - return transaction updates handled since request time
   * */
  public async processWitnessGossipInfo(messageContext: InboundMessageContext<WitnessGossipMessage>): Promise<void> {
    const { message: witnessGossipMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process witness gossip info message from ${witnessGossipMessage.from}`
    )

    const witnessGossipInfo = new WitnessGossipInfo({ ...witnessGossipMessage })

    const operation = async () => {
      return this.gossip.processWitnessGossipInfo(witnessGossipInfo)
    }
    const { error } = await this.doSafeOperationWithWitnessSate(operation)
    if (error) {
      this.config.logger.info(`  < Witness ${this.config.label}: Unable to process transaction update. Error: ${error}`)
      return
    }

    if (witnessGossipMessage.body.tell && witnessGossipMessage.pthid) {
      // Resume VTP Transaction if exists -> this event will be caught in WitnessService
      this.eventEmitter.emit<ResumeValueTransferTransactionEvent>({
        type: ValueTransferEventTypes.ResumeTransaction,
        payload: {
          thid: witnessGossipMessage.pthid,
        },
      })
    }
  }

  public async checkPartyStateHash(hash: Uint8Array): Promise<Uint8Array | undefined> {
    return this.gossip.checkPartyStateHash(hash)
  }

  public async getWitnessDetails(): Promise<WitnessDetails> {
    return this.gossip.getWitnessDetails()
  }

  public async settlePartyStateTransition(transactionRecord: TransactionRecord): Promise<void> {
    return this.gossip.settlePartyStateTransition(transactionRecord)
  }

  public async askTransactionUpdates(id?: string) {
    return this.gossip.askTransactionUpdates(id)
  }

  public async processWitnessTableQuery(messageContext: InboundMessageContext<WitnessTableQueryMessage>): Promise<{
    message?: WitnessTableMessage
  }> {
    this.config.logger.info('> Witness process witness table query message')

    const { message: witnessTableQuery } = messageContext

    const { message, error } = await this.gossip.processWitnessTableQuery(witnessTableQuery)
    if (error || !message) {
      this.config.logger.error(`  Witness: Failed to process table query: ${error?.message}`)
      return {}
    }

    const witnessTableMessage = new WitnessTableMessage(message)

    this.config.logger.info('> Witness process witness table query message completed!')
    return { message: witnessTableMessage }
  }

  public async processWitnessTable(messageContext: InboundMessageContext<WitnessTableMessage>): Promise<void> {
    this.config.logger.info('> Witness process witness table message')

    const { message: witnessTable } = messageContext

    if (!witnessTable.from) {
      this.config.logger.info('   Unknown Witness Table sender')
      return
    }

    this.eventEmitter.emit<WitnessTableReceivedEvent>({
      type: ValueTransferEventTypes.WitnessTableReceived,
      payload: {
        witnesses: witnessTable.body.witnesses,
      },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async doSafeOperationWithWitnessSate(operation: () => Promise<any>): Promise<any> {
    // FIXME: `safeSateOperation` locks the whole WitnessState
    // I used it only for functions mutating the state to prevent concurrent updates
    // We need to discuss the list of read/write operations which should use this lock and how to do it properly
    return this.witnessGossipStateService.safeOperationWithWitnessState(operation.bind(this))
  }
}

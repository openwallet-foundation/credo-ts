import type { ValueTransferWitnessConfig } from '../../../types'
import type { ResumeValueTransferTransactionEvent, WitnessTableReceivedEvent } from '../../value-transfer'
import type {
  GossipInterface,
  TransactionRecord,
  GossipStorageOrmRepository,
  BaseGossipMessage,
} from '@sicpa-dlab/witness-gossip-protocol-ts'

import {
  makeOrmGossipStorage,
  WitnessGossipInfo,
  Gossip,
  initGossipSqlite,
  WitnessDetails,
  MappingTable,
  WitnessTable,
  selectTopWitnessToSendAsk,
  pickAllWitnessForTransactionUpdates,
} from '@sicpa-dlab/witness-gossip-protocol-ts'
import { GossipMessageDispatcher } from '@sicpa-dlab/witness-gossip-protocol-ts/build/gossip-message-dispatcher'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { DidMarker } from '../../dids/domain'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../../value-transfer/ValueTransferEvents'

import { GossipCryptoService } from './GossipCryptoService'
import { GossipLoggerService } from './GossipLoggerService'
import { GossipTransportService } from './GossipTransportService'

@injectable()
export class GossipService implements GossipInterface {
  private gossip!: Gossip
  private messageDispatcher!: GossipMessageDispatcher
  private gossipingStarted = false

  public constructor(
    private readonly config: AgentConfig,
    private readonly gossipCryptoService: GossipCryptoService,
    private readonly gossipTransportService: GossipTransportService,
    private readonly gossipLoggerService: GossipLoggerService,
    private readonly didService: DidService,
    private readonly eventEmitter: EventEmitter
  ) {}

  public getWitnessDetails(): Promise<WitnessDetails> {
    return this.gossip.getWitnessDetails()
  }

  public commitParticipantsTransition(giver: TransactionRecord, getter: TransactionRecord): Promise<void> {
    return this.gossip.commitParticipantsTransition(giver, getter)
  }

  public commitSingleParticipantTransition(start: Uint8Array | null, end: Uint8Array): Promise<void> {
    return this.gossip.commitSingleParticipantTransition(start, end)
  }

  public async init(dbConnectionString: string): Promise<void> {
    const orm = await initGossipSqlite(dbConnectionString, { debug: true })

    const generator = orm.getSchemaGenerator()
    await generator.refreshDatabase()

    const storage = makeOrmGossipStorage(orm).gossipStorage

    this.gossip = new Gossip(
      {
        logger: this.gossipLoggerService,
        crypto: this.gossipCryptoService,
        storage,
        outboundTransport: this.gossipTransportService,
        metrics: this.config.witnessGossipMetrics,
      },
      {
        label: this.config.label,
        tockTime: this.config.valueTransferConfig?.witness?.tockTime,
        cleanupTime: this.config.valueTransferConfig?.witness?.cleanupTime,
        redeliverTime: this.config.valueTransferConfig?.witness?.redeliverTime,
        historyThreshold: this.config.valueTransferConfig?.witness?.historyThreshold,
        redeliveryThreshold: this.config.valueTransferConfig?.witness?.redeliveryThreshold,
      },
      {
        selectWitnessToSendAskAlgorithm: selectTopWitnessToSendAsk,
        pickWitnessForGossipingTransactionUpdates: pickAllWitnessForTransactionUpdates,
      }
    )

    this.messageDispatcher = new GossipMessageDispatcher(this.gossip)

    await this.initState(storage)
    await this.startGossiping()
  }

  private async initState(gossipRepository: GossipStorageOrmRepository): Promise<void> {
    const config = this.config.valueWitnessConfig
    if (!config) throw new Error('Value transfer config is not available')

    await this.initGossipOrmState(config, gossipRepository)
  }

  private async initGossipOrmState(
    config: ValueTransferWitnessConfig,
    gossipRepository: GossipStorageOrmRepository
  ): Promise<void> {
    this.config.logger.info('> initGossipOrmState')
    const existingOrmState = await gossipRepository.isInitialized()

    if (existingOrmState) {
      this.config.logger.info('> initGossipOrmState already exists, returning')
      return
    }

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `Public` marker for static DID in the agent config.'
      )
    }

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provided.')
    }

    const info = new WitnessDetails({ wid: config.wid, did: did.did })
    const mappingTable = new MappingTable(config.knownWitnesses)

    await gossipRepository.setMyInfo(info)
    await gossipRepository.setMappingTable(mappingTable)

    this.config.logger.info('< initGossipOrmState completed!')
  }

  private async startGossiping() {
    if (!this.gossipingStarted) await this.gossip.start()
    this.gossipingStarted = true
  }

  public async checkPartyStateHash(hash: Uint8Array): Promise<Uint8Array | undefined> {
    return this.gossip.checkPartyStateHash(hash)
  }

  public async askTransactionUpdates(id?: string) {
    return this.gossip.askTransactionUpdates(id)
  }

  public async receiveAndHandleMessage(message: BaseGossipMessage): Promise<void> {
    await this.messageDispatcher.dispatchMessage(message)
    this.emitMessageEventIfNeeded(message)
  }

  private emitMessageEventIfNeeded(message: BaseGossipMessage): void {
    switch (message.type) {
      case WitnessTable.type: {
        const witnessTable = message as WitnessTable

        this.eventEmitter.emit<WitnessTableReceivedEvent>({
          type: ValueTransferEventTypes.WitnessTableReceived,
          payload: {
            witnesses: witnessTable.body.witnesses,
          },
        })

        break
      }
      case WitnessGossipInfo.type: {
        const witnessGossipInfo = message as WitnessGossipInfo
        if (!witnessGossipInfo.body.tell || !witnessGossipInfo.pthid) return

        // Resume VTP Transaction if exists -> this event will be caught in WitnessService
        this.eventEmitter.emit<ResumeValueTransferTransactionEvent>({
          type: ValueTransferEventTypes.ResumeTransaction,
          payload: {
            thid: witnessGossipInfo.pthid,
          },
        })

        break
      }
    }
  }
}

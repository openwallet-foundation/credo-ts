import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ResumeValueTransferTransactionEvent } from '../../value-transfer/ValueTransferEvents'
import type { WitnessStateRecord } from '../../value-transfer/repository/WitnessStateRecord'
import type { WitnessTableReceivedEvent } from '../GossipEvents'
import type { WitnessTableQueryMessage } from '../messages'
import type { Witness } from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { interval } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ValueTransferEventTypes } from '../../value-transfer/ValueTransferEvents'
import { WitnessStateRepository } from '../../value-transfer/repository/WitnessStateRepository'
import { ValueTransferCryptoService } from '../../value-transfer/services/ValueTransferCryptoService'
import { ValueTransferService } from '../../value-transfer/services/ValueTransferService'
import { ValueTransferStateService } from '../../value-transfer/services/ValueTransferStateService'
import { GossipEventTypes } from '../GossipEvents'
import { WitnessGossipMessage, WitnessTableMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class GossipService {
  private config: AgentConfig
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private eventEmitter: EventEmitter
  private witness: Witness

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.eventEmitter = eventEmitter

    this.witness = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).witness()
  }

  public async startGossiping(): Promise<void> {
    //init worker to propagate transaction updates
    interval(this.config.witnessTockTime)
      .pipe(takeUntil(this.config.stop$))
      .subscribe(async () => {
        try {
          await this.gossipSignedTransactions()
        } catch (error) {
          this.config.logger.info(`Witness: Unexpected error happened while gossiping transaction. Error: ${error}`)
        }
      })

    //init worker to clean up hangout gaps
    interval(this.config.witnessCleanupTime)
      .pipe(takeUntil(this.config.stop$))
      .subscribe(async () => {
        try {
          await this.cleanupState()
        } catch (error) {
          this.config.logger.info(`Witness: Unexpected error happened while cleaning state. Error: ${error}`)
        }
      })
  }

  /**
   * Build {@link WitnessGossipMessage} for requesting missing transactions from the top witness.
   * */
  public async requestMissingTransactions(pthid?: string): Promise<void> {
    this.config.logger.info(`> Witness: request transaction updates for paused transaction ${pthid}`)

    const state = await this.getWitnessState()

    const topWitness = state.topWitness

    // find last known state of top witness and request for transactions
    const tim = state.witnessState.lastUpdateTracker.get(topWitness.wid)
    if (tim === undefined) {
      this.config.logger.info(`VTP: Unable to find last witness state in tracker for wid: ${topWitness.wid}`)
      return
    }

    const message = new WitnessGossipMessage({
      from: state.gossipDid,
      to: topWitness.did,
      body: {
        ask: { since: tim },
      },
      pthid,
    })

    await this.valueTransferService.sendMessage(message)

    this.config.logger.info(`> Witness: request transaction updates for paused transaction ${pthid} sent!`)
  }

  /**
   * Gossip signed transaction updates to all known knownWitnesses
   */
  private async gossipSignedTransactions(): Promise<void> {
    this.config.logger.info(`> Witness: gossip transaction`)

    const state = await this.getWitnessState()

    const { transactionUpdate, error } = await this.witness.prepareTransactionUpdate()
    if (error) {
      this.config.logger.info(`  < Witness: Unable to prepare transaction update. Error: ${error}`)
      return
    }

    if (!transactionUpdate || !transactionUpdate.num) {
      // there is no WTP transactions signed by this witness - nothing to propagate
      this.config.logger.info(`   < Witness: There is no transactions to gossip`)
      return
    }

    const body = { tell: { id: state.witnessState.info.did } }
    const attachments = [
      WitnessGossipMessage.createTransactionUpdateJSONAttachment(state.witnessState.info.did, [transactionUpdate]),
    ]

    // prepare message and send to all known knownWitnesses
    for (const witness of state.knownWitnesses) {
      try {
        const message = new WitnessGossipMessage({
          from: state.gossipDid,
          to: witness.did,
          body,
          attachments,
        })
        await this.sendMessageToWitness(message)
      } catch (e) {
        // Failed to deliver message to witness - put in a failure queue
      }
    }

    this.config.logger.info(`   < Witness: gossip transaction completed!`)
    return
  }

  /**
   * Process a received {@link WitnessGossipMessage}.
   *   If it contains `tell` section - apply transaction updates
   *   If it contains `ask` section - return transaction updates handled since request time
   * */
  public async processWitnessGossipInfo(messageContext: InboundMessageContext<WitnessGossipMessage>): Promise<void> {
    const { message: witnessGossipMessage } = messageContext

    this.config.logger.info('> Witness: process gossip message')
    this.config.logger.info(`   Sender: ${witnessGossipMessage.from}`)
    this.config.logger.info(`   Body: ${witnessGossipMessage.body}`)

    if (!witnessGossipMessage.from) {
      this.config.logger.info('   > Witness: Unknown Transaction Update sender')
      return
    }

    const state = await this.getWitnessState()

    this.config.logger.info(`   Last state tracker: ${state.witnessState.lastUpdateTracker}`)
    this.config.logger.info(`   Registered state hashes : ${state.witnessState.partyStateHashes.size}`)

    // validate that message sender is one of known knownWitnesses
    const knownWitness = state.knownWitnesses.find((witness) => witness.did === witnessGossipMessage.from)
    if (!knownWitness) {
      this.config.logger.info(
        `   Transaction Updated received from an unknown Witness DID: ${witnessGossipMessage.from}`
      )
      return
    }

    const tell = witnessGossipMessage.body.tell
    if (tell) {
      // received Transaction updates which need to be applied
      await this.processReceivedTransactionUpdates(witnessGossipMessage)
      if (witnessGossipMessage.pthid) {
        // Resume VTP Transaction if exists -> this event will be caught in WitnessService
        this.eventEmitter.emit<ResumeValueTransferTransactionEvent>({
          type: ValueTransferEventTypes.ResumeTransaction,
          payload: {
            thid: witnessGossipMessage.pthid,
          },
        })
      }
    }

    const ask = witnessGossipMessage.body.ask
    if (ask) {
      // received ask for handled transactions
      await this.processReceivedAskForTransactionUpdates(state, witnessGossipMessage)
    }

    const stateAfter = await this.getWitnessState()
    this.config.logger.info('   < Witness: processing of gossip message completed')
    this.config.logger.info(`       Last state tracker: ${stateAfter.witnessState.lastUpdateTracker}`)
    this.config.logger.info(`       Register state hashes : ${stateAfter.witnessState.partyStateHashes.size}`)
    this.config.logger.info(`       Register state hashes : ${stateAfter.witnessState.partyStateHashes}`)
    this.config.logger.info(
      `       Register gap state hashes : ${stateAfter.witnessState.partyStateGapsTracker.length}`
    )
  }

  private async processReceivedTransactionUpdates(witnessGossipMessage: WitnessGossipMessage): Promise<void> {
    const transactionUpdates = witnessGossipMessage.transactionUpdates(witnessGossipMessage.body?.tell?.id)

    this.config.logger.info('> Witness: process transactions')
    this.config.logger.info(`   Sender: ${witnessGossipMessage.from}`)
    this.config.logger.info(`   Number of transactions: ${transactionUpdates?.length}`)

    // received Transaction updates which need to be applied
    if (!transactionUpdates) {
      this.config.logger.info('   Transaction Update not found in the attachment')
      return
    }

    // handle sequentially
    for (const transactionUpdate of transactionUpdates) {
      const { error } = await this.witness.processTransactionUpdate(transactionUpdate)
      if (error) {
        this.config.logger.info(`   VTP: Failed to process Transaction Update. Error: ${error}`)
        continue
      }
    }

    this.config.logger.info('< Witness: process transactions completed')
    return
  }

  private async processReceivedAskForTransactionUpdates(
    state: WitnessStateRecord,
    witnessGossipMessage: WitnessGossipMessage
  ): Promise<void> {
    const ask = witnessGossipMessage.body.ask
    if (!ask) return

    this.config.logger.info('> Witness: process ask for transactions')
    this.config.logger.info(`   Sender: ${witnessGossipMessage.from}`)
    this.config.logger.info(`   Ask since: ${ask.since}`)

    // filter all transaction by requested tock
    // ISSUE: tock is not time. each witness may have different tocks
    // How properly request transactions??
    const transactionUpdates = state.witnessState.transactionUpdatesHistory
      .filter((item) => item.transactionUpdate.tim > ask.since)
      .map((item) => item.transactionUpdate)

    this.config.logger.info(`   Number of transactions: ${transactionUpdates.length}`)

    if (state.witnessState.pendingTransactionRecords.length) {
      // FIXME: Should we share pending transaction as well??
    }

    const attachments = [WitnessGossipMessage.createTransactionUpdateJSONAttachment(state.wid, transactionUpdates)]

    const message = new WitnessGossipMessage({
      from: state.gossipDid,
      to: witnessGossipMessage.from,
      body: {
        tell: { id: state.wid },
      },
      attachments,
      pthid: witnessGossipMessage.pthid,
    })

    await this.sendMessageToWitness(message)

    this.config.logger.info('< Witness: process ask for transactions completed')
  }

  /**
   * Remove expired transactions from the history
   * */
  private async cleanupState(): Promise<void> {
    this.config.logger.info('> Witness: clean up hanged transaction updates')

    const state = await this.getWitnessState()

    const history = state.witnessState.transactionUpdatesHistory
    const threshold = this.config.witnessHistoryThreshold
    const now = Date.now()

    // FIXME: change the collection to be ordered by time - find index of first - slice rest
    state.witnessState.transactionUpdatesHistory = history.filter((txn) => now - txn.timestamp > threshold)

    await this.witnessStateRepository.update(state)

    this.config.logger.info('< Witness: clean up hanged transaction updates completed!')
    return
  }

  public async processWitnessTableQuery(
    messageContext: InboundMessageContext<WitnessTableQueryMessage>
  ): Promise<void> {
    this.config.logger.info('> Witness process witness table query message')

    const { message: witnessTableQuery } = messageContext

    if (!witnessTableQuery.from) {
      this.config.logger.info('   Unknown Witness Table Query sender')
      return
    }

    const state = await this.getWitnessState()

    const message = new WitnessTableMessage({
      from: state.gossipDid,
      to: witnessTableQuery.from,
      body: {
        witnesses: state.witnessState.mappingTable,
      },
      thid: witnessTableQuery.id,
    })

    await this.valueTransferService.sendMessage(message)
  }

  public async processWitnessTable(messageContext: InboundMessageContext<WitnessTableMessage>): Promise<void> {
    this.config.logger.info('> Witness process witness table message')

    const { message: witnessTable } = messageContext

    if (!witnessTable.from) {
      this.config.logger.info('   Unknown Witness Table sender')
      return
    }

    this.eventEmitter.emit<WitnessTableReceivedEvent>({
      type: GossipEventTypes.WitnessTableReceived,
      payload: {
        witnesses: witnessTable.body.witnesses,
      },
    })
  }

  private async sendMessageToWitness(message: DIDCommV2Message): Promise<void> {
    try {
      this.config.logger.info(`   >> Witness: send message to witness`)
      await this.valueTransferService.sendMessage(message)
    } catch (e) {
      this.config.logger.info('errrsend')
      // TODO: put into failed queue
    }
  }

  public async getWitnessState(): Promise<WitnessStateRecord> {
    const state = await this.findWitnessState()
    if (!state) {
      throw new AriesFrameworkError('Witness state is not found.')
    }
    return state
  }

  public async findWitnessState(): Promise<WitnessStateRecord | null> {
    return this.witnessStateRepository.findSingleByQuery({})
  }
}

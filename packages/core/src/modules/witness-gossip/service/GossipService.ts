import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ResumeValueTransferTransactionEvent } from '../../value-transfer/ValueTransferEvents'
import type { WitnessStateRecord } from '../../value-transfer/repository/WitnessStateRecord'
import type {
  Witness,
  TransactionUpdate,
  WitnessInfo,
  TransactionUpdateHistoryItem,
} from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { interval } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { ValueTransferEventTypes } from '../../value-transfer/ValueTransferEvents'
import { WitnessStateRepository } from '../../value-transfer/repository/WitnessStateRepository'
import { ValueTransferCryptoService } from '../../value-transfer/services/ValueTransferCryptoService'
import { ValueTransferStateService } from '../../value-transfer/services/ValueTransferStateService'
import { WitnessGossipMessage } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class GossipService {
  private config: AgentConfig
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private eventEmitter: EventEmitter
  private witness: Witness
  private messageSender: MessageSender
  private undeliveredMessages: { timestamp: number; message: DIDCommV2Message }[] = [] // FIXME: collection should be persisted

  public constructor(
    config: AgentConfig,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    eventEmitter: EventEmitter,
    messageSender: MessageSender
  ) {
    this.config = config
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.eventEmitter = eventEmitter
    this.messageSender = messageSender
    this.undeliveredMessages = []

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
          await this.doSafeOperationWithWitnessSate(this.cleanupState)
        } catch (error) {
          this.config.logger.info(`Witness: Unexpected error happened while cleaning state. Error: ${error}`)
        }
      })

    //init worker to resend undelivered messages
    interval(this.config.witnessRedeliverTime)
      .pipe(takeUntil(this.config.stop$))
      .subscribe(async () => {
        try {
          await this.resendUndeliveredMessages()
        } catch (error) {
          this.config.logger.info(
            `Witness: Unexpected error happened while re-sending undelivered messages. Error: ${error}`
          )
        }
      })
  }

  /**
   * Build {@link WitnessGossipMessage} for requesting missing transactions from the top witness.
   * */
  public async requestMissingTransactions(pthid?: string): Promise<void> {
    this.config.logger.info(`> Witness: request transaction updates for paused transaction ${pthid}`)

    const state = await this.valueTransferStateService.getWitnessStateRecord()

    const topWitness = state.topWitness

    // find last known state of top witness and request for transactions
    const tim = state.witnessState.lastUpdateTracker.get(topWitness.wid)
    if (tim === undefined) {
      this.config.logger.info(`VTP: Unable to find last witness state in tracker for wid: ${topWitness.wid}`)
      return
    }

    const message = new WitnessGossipMessage({
      from: state.gossipDid,
      to: topWitness.gossipDid,
      body: {
        ask: { since: tim },
      },
      pthid,
    })

    await this.sendMessage(message)

    this.config.logger.info(`> Witness: request transaction updates for paused transaction ${pthid} sent!`)
  }

  /**
   * Gossip signed transaction updates to all known knownWitnesses
   */
  private async gossipSignedTransactions(): Promise<void> {
    this.config.logger.info(`> Witness: gossip transaction`)

    const state = await this.valueTransferStateService.getWitnessStateRecord()

    const operation = async () => {
      return this.witness.prepareTransactionUpdate()
    }
    const { transactionUpdate, error } = await this.doSafeOperationWithWitnessSate(operation)
    if (error) {
      this.config.logger.info(`  < Witness: Unable to prepare transaction update. Error: ${error}`)
      return
    }

    if (!transactionUpdate || !transactionUpdate.num) {
      // there is no WTP transactions signed by this witness - nothing to propagate
      this.config.logger.info(`   < Witness: There is no transactions to gossip`)
      return
    }

    await this.gossipTransactionUpdate(state, transactionUpdate)

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

    const state = await this.valueTransferStateService.getWitnessStateRecord()

    this.config.logger.info(`   Last state tracker: ${state.witnessState.lastUpdateTracker}`)
    this.config.logger.info(`   Registered state hashes : ${state.witnessState.partyStateHashes.size}`)

    // validate that message sender is one of known knownWitnesses
    const knownWitness = state.knownWitnesses.find((witness) => witness.gossipDid === witnessGossipMessage.from)
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

      await this.resendTransactionUpdateIfNeed(state, witnessGossipMessage)
    }

    const ask = witnessGossipMessage.body.ask
    if (ask) {
      // received ask for handled transactions
      await this.processReceivedAskForTransactionUpdates(witnessGossipMessage)
    }

    const stateAfter = await this.valueTransferStateService.getWitnessStateRecord()
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

    // handle updates
    const operation = async () => {
      return this.witness.processTransactionUpdates(transactionUpdates)
    }
    await this.doSafeOperationWithWitnessSate(operation)

    this.config.logger.info('< Witness: process transactions completed')
    return
  }

  private async processReceivedAskForTransactionUpdates(witnessGossipMessage: WitnessGossipMessage): Promise<void> {
    const state = await this.doSafeOperationWithWitnessSate(this.valueTransferStateService.getWitnessStateRecord)

    const ask = witnessGossipMessage.body.ask
    if (!ask) return

    this.config.logger.info('> Witness: process ask for transactions')
    this.config.logger.info(`   Sender: ${witnessGossipMessage.from}`)
    this.config.logger.info(`   Ask since: ${ask.since}`)

    if (!witnessGossipMessage.from) {
      this.config.logger.info('   Unknown transaction update Reqeuster')
      return
    }

    const knownWitness = state.knownWitnesses.find(
      (witness: WitnessInfo) => witness.gossipDid === witnessGossipMessage.from
    )
    if (!knownWitness) {
      this.config.logger.info(
        `   Transaction Updated received from an unknown Witness DID: ${witnessGossipMessage.from}`
      )
      return
    }

    // filter all transaction by requested tock
    // ISSUE: tock is not time. each witness may have different tocks
    // How properly request transactions??
    const transactionUpdates = state.witnessState.transactionUpdatesHistory
      .filter((item: TransactionUpdateHistoryItem) => item.transactionUpdate.tim > ask.since)
      .map((item: TransactionUpdateHistoryItem) => item.transactionUpdate)

    this.config.logger.info(`   Number of transactions: ${transactionUpdates.length}`)

    let transactionUpdateForOtherWitnesses: TransactionUpdate | undefined = undefined

    if (state.witnessState.pendingTransactionRecords.length) {
      // there is signed receipt which were not included into tock yet
      // we need to generate new tock and gossip it
      this.config.logger.info(`  Witness: There is pending transactions: prepare transaction update and gossip it`)

      const { transactionUpdate, error } = await this.witness.prepareTransactionUpdate()
      if (transactionUpdate && !error && transactionUpdate.num) {
        // include transaction update into response for witness - requester
        transactionUpdates.push(transactionUpdate)
        transactionUpdateForOtherWitnesses = transactionUpdate
      }
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

    // gossip transaction update to other witnesses as well
    if (transactionUpdateForOtherWitnesses) {
      await this.gossipTransactionUpdate(state, transactionUpdateForOtherWitnesses, [witnessGossipMessage.from])
    }

    this.config.logger.info('< Witness: process ask for transactions completed')
  }

  /**
   * Remove expired transactions from the history
   * */
  private async cleanupState(): Promise<void> {
    this.config.logger.info('> Witness: clean up hanged transaction updates')

    const state = await this.valueTransferStateService.getWitnessStateRecord()

    const history = state.witnessState.transactionUpdatesHistory
    const threshold = this.config.witnessHistoryThreshold
    const now = Date.now()

    // FIXME: change the collection to be ordered by time - find index of first - slice rest
    state.witnessState.transactionUpdatesHistory = history.filter((txn) => now - txn.timestamp < threshold)

    await this.witnessStateRepository.update(state)

    this.config.logger.info('< Witness: clean up hanged transaction updates completed!')
    return
  }

  private async gossipTransactionUpdate(
    state: WitnessStateRecord,
    transactionUpdate: TransactionUpdate,
    exclude: string[] = []
  ): Promise<void> {
    // prepare message and send to all known knownWitnesses
    for (const witness of state.knownWitnesses) {
      if (!exclude.includes(witness.gossipDid)) {
        const body = { tell: { id: state.witnessState.info.gossipDid } }
        const attachments = [
          WitnessGossipMessage.createTransactionUpdateJSONAttachment(state.witnessState.info.gossipDid, [
            transactionUpdate,
          ]),
        ]
        const message = new WitnessGossipMessage({
          from: state.gossipDid,
          to: witness.gossipDid,
          body,
          attachments,
        })
        await this.sendMessageToWitness(message)
      }
    }
  }

  private async resendTransactionUpdateIfNeed(
    state: WitnessStateRecord,
    originalMessage: WitnessGossipMessage
  ): Promise<void> {
    // 1. message received from original initiator - not re-sent from other witness
    if (originalMessage.from !== originalMessage.body.tell?.id) return

    // 2. message is not received in response on ask
    if (originalMessage.thid) return

    // re-send received transaction updated to other witnesses
    for (const witness of state.knownWitnesses) {
      // 1. do not re-send to original sender
      if (originalMessage.from !== witness.gossipDid) continue
      const message = new WitnessGossipMessage({
        from: state.gossipDid,
        to: witness.gossipDid,
        body: originalMessage.body,
        attachments: originalMessage.attachments,
      })
      await this.sendMessageToWitness(message)
    }
  }

  /**
   * Try to re-send undelivered messages and clear expired
   * */
  private async resendUndeliveredMessages(): Promise<void> {
    this.config.logger.info('> Witness: re-send undelivered message to other witnesses')

    if (!this.undeliveredMessages.length) {
      this.config.logger.info(`   Witness: there is no messages to re-send`)
      return
    }

    const undeliveredMessages = []

    const threshold = this.config.witnessRedeliveryThreshold
    const now = Date.now()

    for (const message of this.undeliveredMessages) {
      if (now - message.timestamp > threshold) continue
      try {
        this.config.logger.info(
          `   Witness: trying to re-send ${message.message.type} to witnesses ${message.message.to}`
        )
        await this.sendMessage(message.message)
      } catch (error) {
        this.config.logger.warn(
          `> Witness: failed to deliver message ${message.message.type} to witnesses ${message.message.to}`
        )
        undeliveredMessages.push(message)
      }
    }

    this.undeliveredMessages = undeliveredMessages
    this.config.logger.info('< Witness: re-sending undelivered message to other witnesses completed!')

    return
  }

  private async sendMessageToWitness(message: DIDCommV2Message): Promise<void> {
    try {
      this.config.logger.info(`   >> Witness: send message to witness`)
      await this.sendMessage(message)
    } catch (e) {
      this.config.logger.info(`   >> Witness: failed to send message ${message.type} to witness ${message.to}`)
      this.undeliveredMessages.push({ timestamp: Date.now(), message })
    }
  }

  public async sendMessage(message: DIDCommV2Message) {
    this.config.logger.info(`Sending Gossip message with type '${message.type}' to DID ${message?.to}`)
    const sendingMessageType = message.to ? SendingMessageType.Encrypted : SendingMessageType.Signed
    await this.messageSender.sendDIDCommV2Message(message, sendingMessageType)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async doSafeOperationWithWitnessSate(operation: () => Promise<any>): Promise<any> {
    // FIXME: `safeSateOperation` locks the whole WitnessState
    // I used it only for functions mutating the state to prevent concurrent updates
    // We need to discuss the list of read/write operations which should use this lock and how to do it properly
    return this.valueTransferStateService.safeOperationWithWitnessState(operation.bind(this))
  }
}

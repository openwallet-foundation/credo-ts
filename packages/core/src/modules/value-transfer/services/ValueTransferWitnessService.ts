import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferStateChangedEvent, WitnessTableReceivedEvent } from '../ValueTransferEvents'
import type { WitnessTableQueryMessage } from '../messages'
import type { WitnessData } from '../repository'
import type { Witness } from '@sicpa-dlab/value-transfer-protocol-ts'

import {
  createVerifiableNotes,
  TransactionRecord,
  ValueTransfer,
  Wallet,
  WitnessState,
} from '@sicpa-dlab/value-transfer-protocol-ts'
import { ErrorCodes } from '@sicpa-dlab/value-transfer-protocol-ts/error'
import { WitnessInfo } from '@sicpa-dlab/value-transfer-protocol-ts/types/witness-state'
import { interval } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { AriesFrameworkError } from '../../../error'
import { WitnessType } from '../../../types'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import {
  CashAcceptedMessage,
  CashAcceptedWitnessedMessage,
  CashRemovedMessage,
  GetterReceiptMessage,
  GiverReceiptMessage,
  OfferAcceptedMessage,
  OfferAcceptedWitnessedMessage,
  ProblemReportMessage,
  RequestAcceptedMessage,
  RequestAcceptedWitnessedMessage,
  WitnessGossipMessage,
  WitnessTableMessage,
} from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository, ValueTransferTransactionStatus } from '../repository'
import { WitnessStateRecord } from '../repository/WitnessStateRecord'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private didService: DidService
  private eventEmitter: EventEmitter
  private witness: Witness
  private wellKnownService: WellKnownService

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    eventEmitter: EventEmitter,
    wellKnownService: WellKnownService
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.eventEmitter = eventEmitter
    this.wellKnownService = wellKnownService

    this.witness = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).witness()
  }

  public async init(): Promise<void> {
    await this.initState()
    await this.initWorkers()
  }

  private async initState(): Promise<void> {
    this.config.logger.info('> VTP Witness state initialization started')

    const existingState = await this.findWitnessState()

    // witness has already been initialized
    if (existingState) return

    const publicDid = await this.didService.findPublicDid()
    if (!publicDid) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `publicDidSeed` field in the agent config.'
      )
    }

    const config = this.config.valueWitnessConfig

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provide.')
    }

    const mappingTable = new Map<string, WitnessInfo>()
    const knownWitnesses: Array<string> = new Array<string>()
    let topWitness = config.knownWitnesses[0]

    const partyStateHashes = ValueTransferWitnessService.generateInitialPartyStateHashes(
      this.config.valueTransferParties
    )
    const transactionRecords = Array.from(partyStateHashes.values()).map(
      (partyStateHash) => new TransactionRecord({ start: null, end: partyStateHash })
    )

    for (const witness of config.knownWitnesses) {
      mappingTable.set(witness.wid, new WitnessInfo(witness))
      if (witness.wid !== config.wid) {
        knownWitnesses.push(witness.did)
      }

      if (witness.wid !== config.wid && witness.type === WitnessType.One) {
        topWitness = witness
      }
    }

    const witnessState = new WitnessState({
      wid: config.wid,
      mappingTable,
      partyStateHashes,
      transactionRecords,
    })

    const state = new WitnessStateRecord({
      did: publicDid.did,
      witnessState,
      knownWitnesses,
      topWitness,
    })

    await this.witnessStateRepository.save(state)

    this.config.logger.info('< VTP Witness state initialization completed!')
  }

  private async initWorkers(): Promise<void> {
    //init worker to propagate transaction updates
    interval(this.config.witnessTockTime)
      .pipe(takeUntil(this.config.stop$))
      .subscribe(async () => {
        try {
          await this.gossipSignedTransactions()
        } catch (error) {
          this.config.logger.error(`Witness: Unexpected error happened while gossiping transaction. Error: ${error}`)
        }
      })

    //init worker to clean up hangout gaps
    interval(this.config.witnessCleanupTime)
      .pipe(takeUntil(this.config.stop$))
      .subscribe(async () => {
        try {
          await this.cleanupState()
        } catch (error) {
          this.config.logger.error(`Witness: Unexpected error happened while cleaning state. Error: ${error}`)
        }
      })
  }

  /**
   * Process a received {@link OfferAcceptedMessage}.
   *    The original Offer message will be verified.
   *    Value transfer record with the information from the offer message will be created.
   *    The Offer message will be forwarded to Getter afterwards.
   *
   * @param messageContext The record context containing the offer message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Offer message
   */
  public async processOfferAcceptance(messageContext: InboundMessageContext<OfferAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
    message?: OfferAcceptedWitnessedMessage
    problemReport?: ProblemReportMessage
  }> {
    const { message: offerAcceptanceMessage } = messageContext

    this.config.logger.info(
      `> Witness: process offer acceptance message for VTP transaction ${offerAcceptanceMessage.thid}`
    )

    // Get Witness state
    const state = await this.getWitnessState()

    const valueTransferMessage = offerAcceptanceMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        from: state.did,
        to: offerAcceptanceMessage.from,
        pthid: offerAcceptanceMessage.id,
        body: {
          code: 'e.p.req.bad-offer-acceptance',
          comment: `Missing required base64 or json encoded attachment data for payment offer with thread id ${offerAcceptanceMessage.id}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { problemReport }
    }

    // Check if there is paused transaction
    const existingRecord = await this.valueTransferRepository.findByThread(offerAcceptanceMessage.thid)
    if (existingRecord) {
      if (existingRecord.status !== ValueTransferTransactionStatus.Paused) {
        this.config.logger.info('Transaction has already been processed')
        return {}
      }
    }

    const record =
      existingRecord ??
      new ValueTransferRecord({
        role: ValueTransferRole.Witness,
        state: ValueTransferState.OfferAcceptanceReceived,
        status: ValueTransferTransactionStatus.Pending,
        threadId: offerAcceptanceMessage.thid,
        receipt: valueTransferMessage,
      })

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processOfferAcceptance(state.did, valueTransferMessage)
    if (error || !receipt || !delta) {
      if (!existingRecord && error?.code === ErrorCodes.CurrentStateDoesNotExist) {
        // Pause transaction and request other witness for registered state
        // existingRecord means that we already try to handle message second time
        await this.valueTransferRepository.save(record)
        await this.pauseTransaction(record, offerAcceptanceMessage)
        return {}
      }

      // send problem report back to Getter
      const problemReport = new ProblemReportMessage({
        from: state.did,
        to: offerAcceptanceMessage.from,
        pthid: offerAcceptanceMessage.id,
        body: {
          code: error?.code || 'invalid-payment-offer-acceptance',
          comment: `Payment Offer verification failed. Error: ${error}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { problemReport }
    }

    // next protocol message
    const offerAcceptedWitnessedMessage = new OfferAcceptedWitnessedMessage({
      from: state.did,
      to: receipt.giver?.id,
      thid: offerAcceptanceMessage.thid,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    const getterInfo = await this.wellKnownService.resolve(receipt.getterId)
    const giverInfo = await this.wellKnownService.resolve(receipt.giverId)
    const witnessInfo = await this.wellKnownService.resolve(state.did)

    // Create Value Transfer record and raise event
    record.state = ValueTransferState.OfferAcceptanceSent
    record.status = ValueTransferTransactionStatus.InProgress
    record.receipt = receipt
    record.getter = getterInfo
    record.giver = giverInfo
    record.witness = witnessInfo

    if (existingRecord) {
      await this.valueTransferRepository.update(record)
    } else {
      await this.valueTransferRepository.save(record)
    }

    await this.valueTransferService.sendMessage(offerAcceptedWitnessedMessage)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    this.config.logger.info(
      `> Witness: process offer acceptance message for VTP transaction ${offerAcceptanceMessage.thid} completed!`
    )

    return { record, message: offerAcceptedWitnessedMessage }
  }

  /**
   * Process a received {@link RequestAcceptedMessage}.
   *
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the request message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Acceptance message
   */
  public async processRequestAcceptance(messageContext: InboundMessageContext<RequestAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
    message?: RequestAcceptedWitnessedMessage
    problemReport?: ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptanceMessage } = messageContext

    this.config.logger.info(
      `> Witness: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid}`
    )

    // Get Witness state
    const witnessDid = await this.didService.findPublicDid()
    if (!witnessDid) {
      throw new AriesFrameworkError(`Unable to find Witness public DID`)
    }

    const valueTransferMessage = requestAcceptanceMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        from: witnessDid.did,
        to: requestAcceptanceMessage.from,
        pthid: requestAcceptanceMessage.id,
        body: {
          code: 'e.p.req.bad-request-acceptance',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestAcceptanceMessage.id}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { problemReport }
    }

    // Check if there is paused transaction
    const existingRecord = await this.valueTransferRepository.findByThread(requestAcceptanceMessage.thid)
    if (existingRecord) {
      if (existingRecord.status !== ValueTransferTransactionStatus.Paused) {
        this.config.logger.info('Transaction has already been processed')
        return {}
      }
      this.config.logger.info('   resume paused VTP transaction')
    }

    const record =
      existingRecord ??
      new ValueTransferRecord({
        role: ValueTransferRole.Witness,
        state: ValueTransferState.RequestAcceptanceReceived,
        status: ValueTransferTransactionStatus.Pending,
        threadId: requestAcceptanceMessage.thid,
        receipt: valueTransferMessage,
      })

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processRequestAcceptance(witnessDid.did, valueTransferMessage)
    if (error || !receipt || !delta) {
      if (!existingRecord && error?.code === ErrorCodes.CurrentStateDoesNotExist) {
        await this.valueTransferRepository.save(record)
        await this.pauseTransaction(record, requestAcceptanceMessage)
        return {}
      }
      // send problem report back to Getter
      const problemReport = new ProblemReportMessage({
        from: witnessDid.did,
        to: requestAcceptanceMessage.from,
        pthid: requestAcceptanceMessage.id,
        body: {
          code: error?.code || 'invalid-payment-request-acceptance',
          comment: `Payment Request Acceptance verification failed. Error: ${error}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { problemReport }
    }

    // next protocol message
    const offerAcceptedWitnessedMessage = new RequestAcceptedWitnessedMessage({
      from: witnessDid.did,
      to: receipt.getter?.id,
      thid: requestAcceptanceMessage.thid,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    const getterInfo = await this.wellKnownService.resolve(valueTransferMessage.getterId)
    const giverInfo = await this.wellKnownService.resolve(valueTransferMessage.giverId)
    const witnessInfo = await this.wellKnownService.resolve(witnessDid.did)

    // Create Value Transfer record and raise event
    record.state = ValueTransferState.RequestAcceptanceSent
    record.status = ValueTransferTransactionStatus.InProgress
    record.receipt = receipt
    record.getter = getterInfo
    record.giver = giverInfo
    record.witness = witnessInfo

    if (existingRecord) {
      await this.valueTransferRepository.update(record)
    } else {
      await this.valueTransferRepository.save(record)
    }

    await this.valueTransferService.sendMessage(offerAcceptedWitnessedMessage)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    this.config.logger.info(
      `< Witness: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid} completed!`
    )

    return { record, message: offerAcceptedWitnessedMessage }
  }

  /**
   * Process a received {@link CashAcceptedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Cash Acceptance message
   */
  public async processCashAcceptance(messageContext: InboundMessageContext<CashAcceptedMessage>): Promise<{
    record: ValueTransferRecord
    message?: CashAcceptedWitnessedMessage
    problemReport?: ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage } = messageContext

    this.config.logger.info(
      `> Witness: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid}`
    )

    const record = await this.valueTransferRepository.getByThread(cashAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState([ValueTransferState.RequestAcceptanceSent])

    const valueTransferDelta = cashAcceptedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        to: record.giver?.did,
        pthid: cashAcceptedMessage.thid,
        body: {
          code: 'invalid-cash-acceptance',
          comment: `Missing required base64 or json encoded attachment data for cash acceptance with thread id ${record.threadId}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { record, problemReport }
    }

    // Witness: Call VTP package to process received cash acceptance
    const { error, receipt, delta } = await this.witness.processCashAcceptance(record.receipt, valueTransferDelta)
    // change state
    if (error || !receipt || !delta) {
      if (
        record.status !== ValueTransferTransactionStatus.Paused &&
        error?.code === ErrorCodes.CurrentStateDoesNotExist
      ) {
        await this.pauseTransaction(record, cashAcceptedMessage)
        return { record }
      }

      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        to: record.giver?.did,
        pthid: cashAcceptedMessage.thid,
        body: {
          code: error?.code || 'invalid-cash-acceptance',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReport
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      await this.valueTransferService.sendWitnessProblemReport(problemReport)
      return { record, problemReport }
    }

    // VTP message verification succeed
    const cashAcceptedWitnessedMessage = new CashAcceptedWitnessedMessage({
      ...cashAcceptedMessage,
      from: record.witness?.did,
      to: record.giver?.did,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.receipt = receipt
    record.status = ValueTransferTransactionStatus.InProgress

    await this.valueTransferService.sendMessage(cashAcceptedWitnessedMessage)

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )

    this.config.logger.info(
      `< Witness: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} completed!`
    )

    return { record, message: cashAcceptedWitnessedMessage }
  }

  /**
   * Process a received {@link CashRemovedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.@returns
   *    * Value Transfer record
   *    * Witnessed Cash Removal message
   */
  public async processCashRemoval(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record: ValueTransferRecord
    getterMessage?: GetterReceiptMessage
    giverMessage?: GiverReceiptMessage
    problemReport?: ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext

    this.config.logger.info(`> Witness: process cash removal message for VTP transaction ${cashRemovedMessage.thid}`)

    const record = await this.valueTransferRepository.getByThread(cashRemovedMessage.thid)

    record.assertState([ValueTransferState.CashAcceptanceSent, ValueTransferState.OfferAcceptanceSent])
    record.assertRole(ValueTransferRole.Witness)

    const valueTransferDelta = cashRemovedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        to: record.giver?.did,
        pthid: cashRemovedMessage.thid,
        body: {
          code: 'invalid-cash-removal',
          comment: `Missing required base64 or json encoded attachment data for cash removal with thread id ${record.threadId}`,
        },
      })
      await this.valueTransferService.sendWitnessProblemReport(problemReport, record)
      return { record, problemReport }
    }

    // Call VTP package to create receipt
    const { error, receipt, getterDelta, giverDelta } = await this.witness.createReceipt(
      record.receipt,
      valueTransferDelta
    )
    if (error || !receipt || !getterDelta || !giverDelta) {
      if (
        record.status !== ValueTransferTransactionStatus.Paused &&
        error?.code === ErrorCodes.CurrentStateDoesNotExist
      ) {
        await this.pauseTransaction(record, cashRemovedMessage)
        return { record }
      }
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        to: record.getter?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-state',
          comment: `Receipt creation failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReport
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      await this.valueTransferService.sendWitnessProblemReport(problemReport, record)
      return {
        record,
        problemReport,
      }
    }

    const getterReceiptMessage = new GetterReceiptMessage({
      from: record.witness?.did,
      to: record.getter?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(getterDelta)],
    })

    const giverReceiptMessage = new GiverReceiptMessage({
      from: record.witness?.did,
      to: record.giver?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(giverDelta)],
    })

    // Update Value Transfer record and raise event
    record.receipt = receipt
    record.status = ValueTransferTransactionStatus.InProgress

    await Promise.all([
      this.valueTransferService.sendMessage(getterReceiptMessage),
      this.valueTransferService.sendMessage(giverReceiptMessage),
    ])

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )

    this.config.logger.info(
      `< Witness: process cash removal message for VTP transaction ${cashRemovedMessage.thid} completed!`
    )

    return { record, getterMessage: getterReceiptMessage, giverMessage: giverReceiptMessage }
  }

  /**
   * Build {@link WitnessGossipMessage} for requesting missing transactions from the top witness.
   * */
  private async requestMissingTransactions(pthid?: string): Promise<void> {
    this.config.logger.info(`> Witness: request transaction updates for paused transaction ${pthid}`)

    const state = await this.getWitnessState()

    const topWitness = state.topWitness

    // find last known state of top witness and request for transactions
    const tim = state.witnessState.lastUpdateTracker.get(topWitness.wid)
    if (tim === undefined) {
      this.config.logger.error(`VTP: Unable to find last witness state in tracker for wid: ${topWitness.wid}`)
      return
    }

    const message = new WitnessGossipMessage({
      from: state.did,
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
      this.config.logger.error(`  < Witness: Unable to prepare transaction update. Error: ${error}`)
      return
    }

    if (!transactionUpdate || !transactionUpdate.num) {
      // there is no WTP transactions signed by this witness - nothing to propagate
      this.config.logger.info(`   < Witness: There is no transactions to gossip`)
      return
    }

    const body = { tell: { id: state.witnessState.wid } }
    const attachments = [
      WitnessGossipMessage.createTransactionUpdateJSONAttachment(state.witnessState.wid, [transactionUpdate]),
    ]

    // prepare message and send to all known knownWitnesses
    for (const witness of state.knownWitnesses) {
      try {
        const message = new WitnessGossipMessage({
          from: state.did,
          to: witness,
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
      this.config.logger.error('Unknown Transaction Update sender')
      return
    }

    const state = await this.getWitnessState()

    this.config.logger.info(`   Last state tracker: ${state.witnessState.lastUpdateTracker}`)
    this.config.logger.info(`   Registered state hashes : ${state.witnessState.partyStateHashes.size}`)

    // validate that message sender is one of known knownWitnesses
    const knownWitness = state.knownWitnesses.includes(witnessGossipMessage.from)
    if (!knownWitness) {
      this.config.logger.error(`Transaction Updated received from an unknown Witness DID: ${witnessGossipMessage.from}`)
      return
    }

    const tell = witnessGossipMessage.body.tell
    if (tell) {
      // received Transaction updates which need to be applied
      await this.processReceivedTransactionUpdates(witnessGossipMessage)
      if (witnessGossipMessage.pthid) {
        // Resume VTP Transaction if exists
        await this.resumeTransaction(witnessGossipMessage.pthid)
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
  }

  private async processReceivedTransactionUpdates(witnessGossipMessage: WitnessGossipMessage): Promise<void> {
    const transactionUpdates = witnessGossipMessage.transactionUpdates(witnessGossipMessage.body?.tell?.id)

    this.config.logger.info('> Witness: process transactions')
    this.config.logger.info(`   Sender: ${witnessGossipMessage.from}`)
    this.config.logger.info(`   Number of transactions: ${transactionUpdates?.length}`)

    // received Transaction updates which need to be applied
    if (!transactionUpdates) {
      this.config.logger.info('Transaction Update not found in the attachment')
      return
    }

    // handle sequentially
    for (const transactionUpdate of transactionUpdates) {
      const { error } = await this.witness.processTransactionUpdate(transactionUpdate)
      if (error) {
        this.config.logger.error(`VTP: Failed to process Transaction Update. Error: ${error}`)
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

    const attachments = [
      WitnessGossipMessage.createTransactionUpdateJSONAttachment(state.witnessState.wid, transactionUpdates),
    ]

    const message = new WitnessGossipMessage({
      from: state.did,
      to: witnessGossipMessage.from,
      body: {
        tell: { id: state.witnessState.wid },
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

    this.config.logger.info('<>> Witness: clean up hanged transaction updates completed!')
    return
  }

  /**
   * Pause VTP transaction processing and request for transactions from other witness
   * */
  private async pauseTransaction(record: ValueTransferRecord, message: ValueTransferBaseMessage): Promise<void> {
    this.config.logger.info(`> Witness: pause transaction '${record.threadId}' and request updates`)

    record.status = ValueTransferTransactionStatus.Paused
    record.lastMessage = message

    await this.valueTransferRepository.update(record)

    await this.requestMissingTransactions(record.threadId)

    this.config.logger.info(`< Witness: pause transaction '${record.threadId}' and request updates`)
    return
  }

  /**
   * Resume processing of VTP transaction
   * */
  public async resumeTransaction(thid: string): Promise<void> {
    this.config.logger.info(`> Witness: resume transaction '${thid}'`)

    const record = await this.valueTransferRepository.findByThread(thid)
    if (!record) return

    record.assertRole(ValueTransferRole.Witness)
    record.assertStatus(ValueTransferTransactionStatus.Paused)

    if (!record.lastMessage) {
      throw new AriesFrameworkError(`Unable to resume transaction because there is no last message in the context`)
    }

    if (record.state === ValueTransferState.RequestAcceptanceReceived) {
      const requestAcceptance = JsonTransformer.fromJSON(record.lastMessage, RequestAcceptedMessage)
      const context = new InboundMessageContext(requestAcceptance)
      await this.processRequestAcceptance(context)
      return
    }

    if (record.state === ValueTransferState.OfferAcceptanceReceived) {
      const requestAcceptance = JsonTransformer.fromJSON(record.lastMessage, OfferAcceptedMessage)
      const context = new InboundMessageContext(requestAcceptance)
      await this.processOfferAcceptance(context)
      return
    }

    if (record.state === ValueTransferState.RequestAcceptanceSent) {
      const requestAcceptance = JsonTransformer.fromJSON(record.lastMessage, CashAcceptedMessage)
      const context = new InboundMessageContext(requestAcceptance)
      await this.processCashAcceptance(context)
      return
    }

    if (
      record.state === ValueTransferState.CashAcceptanceSent ||
      record.state === ValueTransferState.OfferAcceptanceSent
    ) {
      const requestAcceptance = JsonTransformer.fromJSON(record.lastMessage, CashRemovedMessage)
      const context = new InboundMessageContext(requestAcceptance)
      await this.processCashRemoval(context)
      return
    }

    record.lastMessage = undefined
    await this.valueTransferRepository.update(record)

    this.config.logger.info(`< Witness: transaction resumed ${thid}`)
  }

  public async processWitnessTableQuery(
    messageContext: InboundMessageContext<WitnessTableQueryMessage>
  ): Promise<void> {
    this.config.logger.error('> Witness process witness table query message')

    const { message: witnessTableQuery } = messageContext

    if (!witnessTableQuery.from) {
      this.config.logger.error('Unknown Witness Table Query sender')
      return
    }

    const state = await this.getWitnessState()

    const witnesses: Array<WitnessData> = []
    for (const [wid, info] of state.witnessState.mappingTable) {
      witnesses.push({ wid, did: info.did, type: info.type })
    }

    const message = new WitnessTableMessage({
      from: state.did,
      to: witnessTableQuery.from,
      body: {
        witnesses,
      },
      thid: witnessTableQuery.id,
    })

    await this.valueTransferService.sendMessage(message)
  }

  public async processWitnessTable(messageContext: InboundMessageContext<WitnessTableMessage>): Promise<void> {
    this.config.logger.error('> Witness process witness table message')

    const { message: witnessTable } = messageContext

    if (!witnessTable.from) {
      this.config.logger.error('Unknown Witness Table sender')
      return
    }

    this.eventEmitter.emit<WitnessTableReceivedEvent>({
      type: ValueTransferEventTypes.WitnessTableReceived,
      payload: {
        witnesses: witnessTable.body.witnesses,
      },
    })
  }

  private async sendMessageToWitness(message: DIDCommV2Message): Promise<void> {
    try {
      await this.valueTransferService.sendMessage(message)
    } catch (e) {
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

  private static generateInitialPartyStateHashes(statesCount: number) {
    const partyStateHashes = new Set<Uint8Array>()

    for (let i = 0; i < statesCount; i++) {
      const startFromSno = i * 10
      const [, partyWallet] = new Wallet().receiveNotes(new Set(createVerifiableNotes(10, startFromSno)))
      partyStateHashes.add(partyWallet.rootHash())
    }

    return partyStateHashes
  }
}

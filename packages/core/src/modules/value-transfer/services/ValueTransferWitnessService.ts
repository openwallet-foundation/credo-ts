import type { ValueTransferStateChangedEvent, ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type { Witness } from '@sicpa-dlab/value-transfer-protocol-ts'

import {
  TransactionRecord,
  ValueTransfer,
  Wallet,
  WitnessState,
  ErrorCodes,
  WitnessInfo,
} from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { AriesFrameworkError } from '../../../error'
import { WitnessType } from '../../../types'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { GossipService } from '../../witness-gossip/service'
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
  private gossipService: GossipService
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
    gossipService: GossipService,
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
    this.gossipService = gossipService
    this.eventEmitter = eventEmitter
    this.wellKnownService = wellKnownService

    this.eventEmitter.on(
      ValueTransferEventTypes.ResumeTransaction,
      async (event: ResumeValueTransferTransactionEvent) => {
        await this.resumeTransaction(event.payload.thid)
      }
    )

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
    await this.gossipService.startGossiping()
  }

  private async initState(): Promise<void> {
    this.config.logger.info('> VTP Witness state initialization started')

    const existingState = await this.findWitnessState()

    // witness has already been initialized
    if (existingState) return

    const publicDid = await this.didService.findOnlineStaticDid()
    if (!publicDid) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `publicDidSeed` field in the agent config.'
      )
    }

    const config = this.config.valueWitnessConfig

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provide.')
    }

    const topWitness =
      config.knownWitnesses.find((witness) => witness.wid !== config.wid && witness.type === WitnessType.One) ??
      config.knownWitnesses[0]

    const partyStateHashes = this.generateInitialPartyStateHashes()
    const transactionRecords: TransactionRecord[] = []

    if (partyStateHashes.size) {
      partyStateHashes.forEach((partyStateHash) => {
        transactionRecords.push(new TransactionRecord({ start: null, end: partyStateHash }))
      })
    }

    const witnessState = new WitnessState({
      info: new WitnessInfo({ wid: config.wid, did: publicDid.did }),
      mappingTable: config.knownWitnesses,
      partyStateHashes,
      transactionRecords,
    })

    const state = new WitnessStateRecord({
      witnessState,
      topWitness,
    })

    await this.witnessStateRepository.save(state)

    this.config.logger.info('< VTP Witness state initialization completed!')
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
    const witnessDid = await this.didService.findOnlineStaticDid()
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
      await this.valueTransferService.sendWitnessProblemReport(problemReport, record)
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
      await this.valueTransferService.sendWitnessProblemReport(problemReport, record)
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
   * Pause VTP transaction processing and request for transactions from other witness
   * */
  private async pauseTransaction(record: ValueTransferRecord, message: ValueTransferBaseMessage): Promise<void> {
    this.config.logger.info(`> Witness: pause transaction '${record.threadId}' and request updates`)

    record.status = ValueTransferTransactionStatus.Paused
    record.lastMessage = message

    await this.valueTransferRepository.update(record)

    await this.gossipService.requestMissingTransactions(record.threadId)

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

  private generateInitialPartyStateHashes() {
    const partyStateHashes = new Set<Uint8Array>()
    const verifiableNotes = this.config.valueTransferInitialNotes

    const [, partyWallet] = new Wallet().receiveNotes(new Set(verifiableNotes))
    partyStateHashes.add(partyWallet.rootHash())
    return partyStateHashes
  }
}

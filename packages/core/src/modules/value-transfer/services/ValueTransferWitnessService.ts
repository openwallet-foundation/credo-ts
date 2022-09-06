import type { ValueTransferStateChangedEvent, ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type { WitnessTableQueryMessage } from '../messages'
import type { MintMessage } from '../messages/MintMessage'
import type { Witness, Receipt } from '@sicpa-dlab/value-transfer-protocol-ts'

import {
  ErrorCodes,
  TransactionRecord,
  ValueTransfer,
  WitnessInfo,
  WitnessState,
} from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { AriesFrameworkError } from '../../../error'
import { WitnessType } from '../../../types'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidMarker, DidService } from '../../dids'
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
  ProblemReportMessage,
  RequestAcceptedMessage,
  RequestAcceptedWitnessedMessage,
  WitnessData,
  WitnessTableMessage,
} from '../messages'
import { MintResponseMessage } from '../messages/MintResponseMessage'
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

    const publicDid = await this.didService.findStaticDid(DidMarker.Online)
    const gossipDid = await this.didService.findStaticDid(DidMarker.Restricted)
    if (!publicDid || !gossipDid) {
      throw new AriesFrameworkError(
        'Witness public DID not found. Please set `Online` and `Restricted` markers must be used in the agent config.'
      )
    }

    const config = this.config.valueWitnessConfig

    if (!config || !config?.knownWitnesses.length) {
      throw new AriesFrameworkError('Witness table must be provided.')
    }

    // search for first type one witness
    // else for type two
    // else any other
    const topWitness =
      config.knownWitnesses.find((witness) => witness.wid !== config.wid && witness.type === WitnessType.One) ??
      config.knownWitnesses.find((witness) => witness.wid !== config.wid && witness.type === WitnessType.Two) ??
      config.knownWitnesses.find((witness) => witness.wid !== config.wid) ??
      config.knownWitnesses[0]

    const info = new WitnessInfo({
      wid: config.wid,
      gossipDid: gossipDid.did,
      publicDid: publicDid.did,
    })

    const witnessState = new WitnessState({
      info,
      mappingTable: config.knownWitnesses,
    })

    const state = new WitnessStateRecord({
      witnessState,
      topWitness,
    })

    await this.witnessStateRepository.save(state)

    this.config.logger.info('< VTP Witness state initialization completed!')
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
    const witnessDid = await this.getTransactionDid()

    const valueTransferMessage = requestAcceptanceMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        from: witnessDid.did,
        pthid: requestAcceptanceMessage.thid,
        body: {
          code: 'e.p.req.bad-request-acceptance',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestAcceptanceMessage.id}`,
        },
      })
      await this.sendProblemReport(problemReport)
      return { problemReport }
    }

    // Check if there is paused transaction or duplicate
    const existingRecord = await this.valueTransferRepository.findByThread(requestAcceptanceMessage.thid)
    if (existingRecord) {
      if (existingRecord.status !== ValueTransferTransactionStatus.Paused) {
        this.config.logger.warn('   Transaction has already been processed')
        return {}
      }
      return await this.resumeRequestAcceptanceProcessing(existingRecord, valueTransferMessage)
    }

    const getterInfo = await this.wellKnownService.resolve(valueTransferMessage.getterId)
    const giverInfo = await this.wellKnownService.resolve(valueTransferMessage.giverId)
    const witnessInfo = await this.wellKnownService.resolve(witnessDid.did)

    const record = new ValueTransferRecord({
      role: ValueTransferRole.Witness,
      state: ValueTransferState.RequestAcceptanceReceived,
      status: ValueTransferTransactionStatus.Pending,
      threadId: requestAcceptanceMessage.thid,
      receipt: valueTransferMessage,
      getter: getterInfo,
      giver: giverInfo,
      witness: witnessInfo,
    })

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processRequestAcceptance(valueTransferMessage)
    if (error || !receipt || !delta) {
      if (error?.code === ErrorCodes.CurrentStateDoesNotExist) {
        await this.valueTransferRepository.save(record)
        await this.pauseTransaction(record, requestAcceptanceMessage)
        return {}
      }
      // send problem report back to Getter
      this.config.logger.error(`Payment Request Acceptance verification failed. Error: ${error}`)
      const problemReport = new ProblemReportMessage({
        from: witnessDid.did,
        pthid: requestAcceptanceMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-request-acceptance',
          comment: `Payment Request Acceptance verification failed. Error: ${error}`,
        },
      })
      await this.sendProblemReport(problemReport, record)
      return { problemReport }
    }

    // next protocol message
    const requestAcceptedWitnessedMessage = new RequestAcceptedWitnessedMessage({
      from: witnessDid.did,
      to: receipt.getter?.id,
      thid: requestAcceptanceMessage.thid,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    // Create Value Transfer record and raise event
    record.state = ValueTransferState.RequestAcceptanceSent
    record.status = ValueTransferTransactionStatus.InProgress
    record.receipt = receipt

    await this.valueTransferRepository.save(record)

    await this.valueTransferService.sendMessage(requestAcceptedWitnessedMessage)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    this.config.logger.info(
      `< Witness: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid} completed!`
    )

    return { record, message: requestAcceptedWitnessedMessage }
  }

  public async resumeRequestAcceptanceProcessing(
    record: ValueTransferRecord,
    valueTransferMessage: Receipt
  ): Promise<{
    record?: ValueTransferRecord
    message?: RequestAcceptedWitnessedMessage
    problemReport?: ProblemReportMessage
  }> {
    this.config.logger.info(
      `   > Witness: resume processing of request acceptance for VTP transaction ${record.threadId}`
    )

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processRequestAcceptance(valueTransferMessage)
    if (error || !receipt || !delta) {
      // send problem report back to Getter
      this.config.logger.error(`Payment Request Acceptance verification failed. Error: ${error}`)
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-payment-request-acceptance',
          comment: `Payment Request Acceptance verification failed. Error: ${error}`,
        },
      })
      await this.sendProblemReport(problemReport, record)
      return { problemReport }
    }

    // next protocol message
    const requestAcceptedWitnessedMessage = new RequestAcceptedWitnessedMessage({
      from: record.witness?.did,
      to: receipt.getter?.id,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    // Create Value Transfer record and raise event
    record.state = ValueTransferState.RequestAcceptanceSent
    record.status = ValueTransferTransactionStatus.InProgress
    record.receipt = receipt

    await this.valueTransferRepository.update(record)

    await this.valueTransferService.sendMessage(requestAcceptedWitnessedMessage)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    this.config.logger.info(
      `   < Witness: resume processing of request acceptance for VTP transaction ${record.threadId} completed!`
    )

    return { record, message: requestAcceptedWitnessedMessage }
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

    if (record.finished) {
      this.config.logger.warn(
        `> Witness: skipping cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} in ${record.state} state`
      )
      return { record }
    }

    record.assertRole(ValueTransferRole.Witness)
    record.assertState([ValueTransferState.RequestAcceptanceSent])

    const valueTransferDelta = cashAcceptedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        pthid: cashAcceptedMessage.thid,
        body: {
          code: 'invalid-cash-acceptance',
          comment: `Missing required base64 or json encoded attachment data for cash acceptance with thread id ${record.threadId}`,
        },
      })
      await this.sendProblemReport(problemReport, record)
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

      this.config.logger.error(`Cash Acceptance verification failed. Error: ${error}`)
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
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
      await this.sendProblemReport(problemReport)
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
   * @param messageContext The record context containing the message.
   *
   * @returns
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

    if (record.finished) {
      this.config.logger.warn(
        `> Witness: skipping cash removal message for VTP transaction ${cashRemovedMessage.thid} in ${record.state} state`
      )
      return { record }
    }

    record.assertState([ValueTransferState.CashAcceptanceSent, ValueTransferState.OfferAcceptanceSent])
    record.assertRole(ValueTransferRole.Witness)

    const valueTransferDelta = cashRemovedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
        pthid: cashRemovedMessage.thid,
        body: {
          code: 'invalid-cash-removal',
          comment: `Missing required base64 or json encoded attachment data for cash removal with thread id ${record.threadId}`,
        },
      })
      await this.sendProblemReport(problemReport, record)
      return { record, problemReport }
    }

    const operation = async () => {
      // Call VTP package to create receipt
      return this.witness.createReceipt(record.receipt, valueTransferDelta)
    }

    const { error, receipt, getterDelta, giverDelta } = await this.gossipService.doSafeOperationWithWitnessState(
      operation
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
      this.config.logger.error(`Receipt creation failed. Error: ${error}`)
      const problemReport = new ProblemReportMessage({
        from: record.witness?.did,
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
      await this.sendProblemReport(problemReport, record)
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
    this.config.logger.info(
      `< Witness: transaction completed in ${record.receipt.witness.getElapsedTimeInSeconds()} seconds`
    )

    return { record, getterMessage: getterReceiptMessage, giverMessage: giverReceiptMessage }
  }

  /**
   * Process a received {@link MintMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.@returns
   *    * Value Transfer record
   *    * Witnessed Cash Removal message
   */
  public async processCashMint(messageContext: InboundMessageContext<MintMessage>): Promise<MintResponseMessage> {
    this.config.logger.info(`> Witness: process cash mint request from '${messageContext.message.from}'`)

    const issuerDids = this.config.witnessIssuerDids
    if (!issuerDids) {
      throw new AriesFrameworkError(
        'Issuer DIDs are not specified. To enable cash minting support, please set `issuerDids` value in witness section of VTP config.'
      )
    }

    const { message: mintMessage } = messageContext

    if (!mintMessage.from || !issuerDids.includes(mintMessage.from)) {
      throw new AriesFrameworkError('Mint message sender DID do not match with any issuer DID')
    }

    const { startHash, endHash } = mintMessage.body

    const transactionRecord = new TransactionRecord({
      start: startHash,
      end: endHash,
    })

    const witnessState = await this.valueTransferStateService.getWitnessState()

    witnessState.settleTransaction([transactionRecord])

    const operation = async () => {
      return this.valueTransferStateService.storeWitnessState(witnessState)
    }

    await this.gossipService.doSafeOperationWithWitnessState(operation)

    const message = new MintResponseMessage({
      from: witnessState.info.publicDid,
      to: messageContext.message.from,
      thid: messageContext.message.id,
    })

    this.config.logger.info(`< Witness: process cash mint request from '${messageContext.message.from}' completed!`)

    return message
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

    // if (record.state === ValueTransferState.OfferAcceptanceReceived) {
    //   const requestAcceptance = JsonTransformer.fromJSON(record.lastMessage, OfferAcceptedMessage)
    //   const context = new InboundMessageContext(requestAcceptance)
    //   await this.processOfferAcceptance(context)
    //   return
    // }

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
    this.config.logger.info('> Witness process witness table query message')

    const { message: witnessTableQuery } = messageContext

    if (!witnessTableQuery.from) {
      this.config.logger.info('   Unknown Witness Table Query sender')
      return
    }

    const state = await this.valueTransferStateService.getWitnessStateRecord()

    const witnesses = state.witnessState.mappingTable.map(
      (witness) =>
        new WitnessData({
          did: witness.publicDid,
          type: witness.type,
          label: witness.label,
        })
    )

    const message = new WitnessTableMessage({
      from: state.gossipDid,
      to: witnessTableQuery.from,
      body: { witnesses },
      thid: witnessTableQuery.id,
    })

    await this.valueTransferService.sendMessage(message)
  }

  public async findWitnessState(): Promise<WitnessStateRecord | null> {
    return this.witnessStateRepository.findSingleByQuery({})
  }

  private async getTransactionDid() {
    const publicDid = await this.didService.findOnlineStaticDid()
    if (!publicDid) {
      throw new AriesFrameworkError('Witness public DID not found')
    }
    return publicDid
  }

  private async sendProblemReport(message: ProblemReportMessage, record?: ValueTransferRecord) {
    this.config.logger.warn(`Sending Witness Problem Report message to DID ${message?.to}. Message: `, message)
    const getterProblemReport = new ProblemReportMessage({
      ...message,
      to: record?.getter?.did,
    })
    const giverProblemReport = new ProblemReportMessage({
      ...message,
      to: record?.giver?.did,
    })

    await Promise.all([
      this.valueTransferService.sendMessage(getterProblemReport),
      this.valueTransferService.sendMessage(giverProblemReport),
    ])
  }
}

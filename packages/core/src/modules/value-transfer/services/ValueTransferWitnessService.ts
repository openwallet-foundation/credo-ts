import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestMessage, RequestAcceptedMessage, CashAcceptedMessage, CashRemovedMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@sicpa-dlab/value-transfer-protocol-ts'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Wallet } from '../../../wallet'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import {
  CashAcceptedWitnessedMessage,
  GetterReceiptMessage,
  GiverReceiptMessage,
  ProblemReportMessage,
  RequestAcceptedWitnessedMessage,
  RequestWitnessedMessage,
} from '../messages'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private wallet: Wallet
  private config: AgentConfig
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private didService: DidService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.didResolverService = didResolverService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter

    this.valueTransfer = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {
        sparseTree: verifiableNoteProofConfig,
      }
    )
  }

  /**
   * Process a received {@link RequestMessage}.
   *    The original Request message will be verified and populated with Witness specific data.
   *    Value transfer record with the information from the request message will be created.
   *    The populated Request message will be forwarded to Giver afterwards.
   *
   * @param messageContext The record context containing the request message.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request message
   *    * Connection to send message
   */
  public async processRequest(messageContext: InboundMessageContext<RequestMessage>): Promise<{
    record?: ValueTransferRecord
    message: RequestWitnessedMessage | ProblemReportMessage
  }> {
    const { message: requestMessage } = messageContext

    // Get Witness state
    const state = await this.witnessStateRepository.getState()

    const { getter, giver, witness } = requestMessage.body.payment

    // Check that witness request by Getter is corrected
    if (requestMessage.body.payment.isWitnessSet && state.publicDid !== witness) {
      const problemReport = new ProblemReportMessage({
        from: state.publicDid,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-witness',
          comment: `Requested witness ${requestMessage.body.payment.witness} is different`,
        },
      })
      return {
        message: problemReport,
      }
    }

    //Call VTP package to process received Payment Request request
    const { error, message } = await this.valueTransfer.witness().processRequest(state.publicDid, requestMessage.body)
    if (error || !message) {
      // send problem report back to Getter
      const problemReportMessage = new ProblemReportMessage({
        from: state.publicDid,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Payment Request verification failed. Error: ${error}`,
        },
      })

      return { message: problemReportMessage }
    }

    const giverDid = requestMessage.body.payment.isGiverSet ? giver : undefined

    // next protocol message
    const requestWitnessedMessage = new RequestWitnessedMessage({
      from: state.publicDid,
      to: giverDid,
      body: message,
      thid: requestMessage.id,
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Witness,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      valueTransferMessage: message,
      requestMessage,
      getter,
      giver: giverDid,
      witness: state.publicDid,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })
    return { record, message: requestWitnessedMessage }
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
    record: ValueTransferRecord
    message: RequestAcceptedWitnessedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(requestAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState(ValueTransferState.RequestSent)

    // Witness: Call VTP package to process received request acceptance
    const { error, message } = await this.valueTransfer.witness().processRequestAccepted(requestAcceptedMessage.body)
    // change state
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: requestAcceptedMessage.body.payment.witness,
        to: requestAcceptedMessage.body.payment.giver,
        pthid: requestAcceptedMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    const requestAcceptedWitnessedMessage = new RequestAcceptedWitnessedMessage({
      ...requestAcceptedMessage,
      from: requestAcceptedMessage.body.payment.witness,
      to: requestAcceptedMessage.body.payment.getter,
      body: message,
    })

    // Update Value Transfer record
    record.valueTransferMessage = message
    record.giverDid = requestAcceptedMessage.body.payment.giver

    await this.valueTransferService.updateState(record, ValueTransferState.RequestAcceptanceSent)
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
    message: CashAcceptedWitnessedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(cashAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    // Witness: Call VTP package to process received cash acceptance
    const { error, message } = await this.valueTransfer.witness().processCashAccepted(cashAcceptedMessage.body)
    // change state
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: cashAcceptedMessage.thid,
        body: {
          code: error?.code || 'invalid-cash-acceptance',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    const cashAcceptedWitnessedMessage = new CashAcceptedWitnessedMessage({
      ...cashAcceptedMessage,
      from: record.witnessDid,
      to: record.giverDid,
      body: message,
    })

    // Update Value Transfer record
    record.valueTransferMessage = message
    await this.valueTransferService.updateState(record, ValueTransferState.CashAcceptanceSent)
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
  public async processCashRemoved(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(cashRemovedMessage.thid)
    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Witness)

    // Call VTP package to process received cash removal
    const { error, message } = await this.valueTransfer.witness().processCashRemoved(cashRemovedMessage.body)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: cashRemovedMessage.thid,
        body: {
          code: error?.code || 'invalid-cash-removal',
          comment: `Cash Removal verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return {
        record,
        message: problemReportMessage,
      }
    }

    // VTP message verification succeed
    // Update Value Transfer record
    record.valueTransferMessage = message

    await this.valueTransferService.updateState(record, ValueTransferState.CashRemovalReceived)
    return { record, message: cashRemovedMessage }
  }

  /**
   * Finish Value Transfer as Witness and create Payment Receipt
   *
   * @param record Value Transfer record containing Cash Removal message to handle.
   *
   * @returns
   *    * Value Transfer record
   *    * Getter and Giver Receipt messages
   */
  public async createReceipt(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    getterReceiptMessage: GetterReceiptMessage | ProblemReportMessage
    giverReceiptMessage: GiverReceiptMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertState(ValueTransferState.CashRemovalReceived)
    record.assertRole(ValueTransferRole.Witness)

    // Call VTP package to create receipt
    const { error, message } = await this.valueTransfer.witness().createReceipt(record.valueTransferMessage)
    if (error || !message) {
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.getterDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Payment creation failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReport
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return {
        record,
        getterReceiptMessage: problemReport,
        giverReceiptMessage: problemReport,
      }
    }

    const getterReceiptMessage = new GetterReceiptMessage({
      from: record.witnessDid,
      to: record.getterDid,
      body: message,
      thid: record.threadId,
    })

    const giverReceiptMessage = new GiverReceiptMessage({
      from: record.witnessDid,
      to: record.giverDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record and raise event
    record.valueTransferMessage = message
    record.receipt = message

    await this.valueTransferService.updateState(record, ValueTransferState.Completed)
    return { record, getterReceiptMessage, giverReceiptMessage }
  }
}

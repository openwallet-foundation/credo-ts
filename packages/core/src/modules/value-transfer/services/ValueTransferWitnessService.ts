import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestMessage, RequestAcceptedMessage, CashAcceptedMessage, CashRemovedMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@value-transfer/value-transfer-lib'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
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
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private wallet: Wallet
  private config: AgentConfig
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
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
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.didResolverService = didResolverService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter

    this.valueTransfer = new ValueTransfer(
      {
        // @ts-ignore
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
    forward: ConnectionRecord
  }> {
    const { message: requestMessage, connection: getterConnection } = messageContext

    if (!getterConnection) {
      throw new AriesFrameworkError(`Connection not found in the message context`)
    }

    const giver = requestMessage.body.payment.giver

    // Get Witness state
    const state = await this.witnessStateRepository.getState()

    // Find connection for requested giver
    const giverConnection = await this.connectionService.findByTheirDid(giver)
    if (!giverConnection || !giverConnection.theirDid) {
      throw new AriesFrameworkError(`Connection not found for Giver DID: ${giver}`)
    }

    //Call VTP package to process received Payment Request request
    const { error, message } = await this.valueTransfer.witness().processRequest(state.publicDid, requestMessage.body)
    if (error || !message) {
      // send problem report back to Getter
      const problemReportMessage = new ProblemReportMessage({
        pthid: requestMessage.id,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Payment Request verification failed. Error: ${error}`,
        },
      })

      return { message: problemReportMessage, forward: getterConnection }
    }

    const requestWitnessedMessage = new RequestWitnessedMessage({
      from: giverConnection.did,
      to: giverConnection.theirDid,
      body: message,
      thid: requestMessage.id,
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: requestMessage.body.payment,
      role: ValueTransferRole.Witness,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      requestMessage,
      getterConnectionId: getterConnection?.id,
      giverConnectionId: giverConnection.id,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    return { record, message: requestWitnessedMessage, forward: giverConnection }
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
   *    * Connections to send message
   */
  public async processRequestAcceptance(messageContext: InboundMessageContext<RequestAcceptedMessage>): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedWitnessedMessage | ProblemReportMessage
    forward: {
      getterConnection: ConnectionRecord
      giverConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedMessage, connection: giverConnection } = messageContext

    if (!giverConnection) {
      throw new AriesFrameworkError(`Connection not found in the message context`)
    }

    let resultMessage: RequestAcceptedWitnessedMessage | ProblemReportMessage

    const record = await this.valueTransferRepository.getByThread(requestAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState(ValueTransferState.RequestSent)

    const previousState = record.state

    const getterConnection = await this.getConnection(record.getterConnectionId)

    // Witness: Call VTP package to process received request acceptance
    const { error, message } = await this.valueTransfer.witness().processRequestAccepted(requestAcceptedMessage.body)

    // change state
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        pthid: requestAcceptedMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      resultMessage = new RequestAcceptedWitnessedMessage({
        ...requestAcceptedMessage,
        from: getterConnection.did,
        to: getterConnection.theirDid,
        body: message,
      })

      // Update Value Transfer record
      record.payment = requestAcceptedMessage.body.payment
      record.requestAcceptedMessage = requestAcceptedMessage
      record.state = ValueTransferState.RequestAcceptanceSent
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: resultMessage,
      forward: {
        getterConnection,
        giverConnection,
      },
    }
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
   *    * Connections to send message
   */
  public async processCashAcceptance(messageContext: InboundMessageContext<CashAcceptedMessage>): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedWitnessedMessage | ProblemReportMessage
    forward: {
      getterConnection: ConnectionRecord
      giverConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage, connection: getterConnection } = messageContext

    if (!getterConnection) {
      throw new AriesFrameworkError(`Connection not found in the message context`)
    }

    let resultMessage: CashAcceptedWitnessedMessage | ProblemReportMessage

    const record = await this.valueTransferRepository.getByThread(cashAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    const previousState = record.state

    const giverConnection = await this.getConnection(record.giverConnectionId)

    // Witness: Call VTP package to process received cash acceptance
    const { error, message } = await this.valueTransfer.witness().processCashAccepted(cashAcceptedMessage.body)
    // change state
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        pthid: cashAcceptedMessage.thid,
        body: {
          code: error?.code || 'invalid-cash-acceptance',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      resultMessage = new CashAcceptedWitnessedMessage({
        ...cashAcceptedMessage,
        from: giverConnection.did,
        to: giverConnection.theirDid,
        body: message,
      })

      // Update Value Transfer record
      record.cashAcceptedMessage = cashAcceptedMessage
      record.state = ValueTransferState.CashAcceptanceSent
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: resultMessage,
      forward: {
        getterConnection,
        giverConnection,
      },
    }
  }

  /**
   * Process a received {@link CashRemovedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.@returns
   *    * Value Transfer record
   *    * Witnessed Cash Removal message
   *    * Connections to send message
   */
  public async processCashRemoved(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage | ProblemReportMessage
    forward: {
      getterConnection: ConnectionRecord
      giverConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage, connection: giverConnection } = messageContext

    if (!giverConnection) {
      throw new AriesFrameworkError(`Connection not found in the message context`)
    }

    let resultMessage: CashRemovedMessage | ProblemReportMessage

    const record = await this.valueTransferRepository.getByThread(cashRemovedMessage.thid)
    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Witness)

    const previousState = record.state

    const getterConnection = await this.getConnection(record.getterConnectionId)

    // Call VTP package to process received cash removal
    const { error, message } = await this.valueTransfer.witness().processCashRemoved(cashRemovedMessage.body)
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        pthid: cashRemovedMessage.thid,
        body: {
          code: error?.code || 'invalid-cash-removal',
          comment: `Cash Removal verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      cashRemovedMessage.body = message
      resultMessage = cashRemovedMessage

      // Update Value Transfer record
      record.cashRemovedMessage = cashRemovedMessage
      record.state = ValueTransferState.CashRemovalReceived
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })
    return {
      record,
      message: resultMessage,
      forward: {
        getterConnection,
        giverConnection,
      },
    }
  }

  /**
   * Finish Value Transfer as Witness and create Payment Receipt
   *
   * @param record Value Transfer record containing Cash Removal message to handle.
   * @param getterConnection Connection record representing communication channel with Getter.
   * @param giverConnection Connection record representing communication channel with Giver.
   *
   * @returns
   *    * Value Transfer record
   *    * Getter and Giver Receipt messages
   */
  public async createReceipt(
    record: ValueTransferRecord,
    getterConnection: ConnectionRecord,
    giverConnection: ConnectionRecord
  ): Promise<{
    record: ValueTransferRecord
    getterReceiptMessage: GetterReceiptMessage
    giverReceiptMessage: GiverReceiptMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertState(ValueTransferState.CashRemovalReceived)
    record.assertRole(ValueTransferRole.Witness)

    if (!record.cashRemovedMessage) {
      throw new AriesFrameworkError(`Cash Removal not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP package to create receipt
    const { error, message } = await this.valueTransfer.witness().createReceipt(record.cashRemovedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Witness: Failed to create Payment Receipt: ${error?.message}`)
    }

    const getterReceiptMessage = new GetterReceiptMessage({
      from: getterConnection.did,
      to: getterConnection.theirDid,
      body: message,
      thid: record.threadId,
    })

    const giverReceiptMessage = new GiverReceiptMessage({
      from: giverConnection.did,
      to: giverConnection.theirDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record and raise event
    record.getterReceiptMessage = getterReceiptMessage
    record.giverReceiptMessage = giverReceiptMessage
    record.state = ValueTransferState.Completed

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })
    return { record, getterReceiptMessage, giverReceiptMessage }
  }

  private async getConnection(connectionId?: string) {
    if (!connectionId) {
      throw new AriesFrameworkError(`Connection not found for ID: ${connectionId}`)
    }
    const connection = await this.connectionService.findById(connectionId)
    if (!connection || !connection.theirDid) {
      throw new AriesFrameworkError(`Connection not found for ID: ${connectionId}`)
    }
    return connection
  }
}

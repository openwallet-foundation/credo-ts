import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestWitnessedMessage, CashAcceptedWitnessedMessage, GiverReceiptMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@value-transfer/value-transfer-lib'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService } from '../../dids'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, RequestAcceptedMessage } from '../messages'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
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
   * For Witness:
   *    The original Request message will be verified and populated with Witness specific data.
   *    Value transfer record with the information from the request message will be created.
   *    The populated Request message will be forwarded to Giver afterwards.
   * For Giver:
   *    Value transfer record with the information from the request message will be created.
   *    Use {@link ValueTransferService.acceptRequest} after calling this method to accept payment request
   *
   * @param messageContext The record context containing the request message.
   * @returns Value Transfer record and Payment Request Message
   */
  public async processRequestWitnessed(messageContext: InboundMessageContext<RequestWitnessedMessage>): Promise<{
    record: ValueTransferRecord
    message: RequestWitnessedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    const { message: requestWitnessedMessage } = messageContext

    const giver = requestWitnessedMessage.body.payment.giver

    // Find connection with witness
    const witnessConnection = await this.connectionService.findByMyDid(giver)
    if (!witnessConnection) {
      throw new AriesFrameworkError(`Connection not found for Giver DID: ${giver}`)
    }

    // If connection doesn't contain remote info -> fill it
    // TODO: Think about more appropriate place for populating connection -> middleware?
    if (!witnessConnection.theirDid && messageContext.sender && witnessConnection.isOutOfBandConnection) {
      await this.connectionService.setOutOfBandConnectionTheirInfo(witnessConnection, messageContext.sender)
    }

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: requestWitnessedMessage.body.payment,
      role: ValueTransferRole.Giver,
      state: ValueTransferState.RequestReceived,
      threadId: requestWitnessedMessage.thid || requestWitnessedMessage.id,
      requestWitnessedMessage,
      witnessConnectionId: witnessConnection.id,
    })

    await this.valueTransferRepository.save(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    return { record, message: requestWitnessedMessage, forward: { witnessConnection } }
  }

  /**
   * Accept received {@link RequestMessage} as Giver by sending a payment request acceptance message.
   * @param witnessConnection Connection to Witness.
   * @param record Value Transfer record containing Payment Request to accept.
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptRequest(
    witnessConnection: ConnectionRecord,
    record: ValueTransferRecord
  ): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestReceived)

    const requestWitnessedMessage = record.requestWitnessedMessage
    if (!requestWitnessedMessage) {
      throw new AriesFrameworkError(`Payment Request not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP to accept payment request
    // TODO: Do we need to create a separate method for selecting notes and expose it in API?
    const notesToSpend = await this.valueTransfer.giver().pickNotesToSpend(requestWitnessedMessage.body.payment.amount)

    const { error, message } = await this.valueTransfer
      .giver()
      .acceptPaymentRequest(witnessConnection.did, requestWitnessedMessage.body, notesToSpend)
    if (error || !message) {
      throw new AriesFrameworkError(`VTP: Failed to accept Payment Request: ${error?.message}`)
    }

    const requestAcceptedMessage = new RequestAcceptedMessage({
      from: witnessConnection.did,
      to: witnessConnection.theirDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record and raise event
    record.payment = requestAcceptedMessage.body.payment
    record.requestAcceptedMessage = requestAcceptedMessage
    record.state = ValueTransferState.RequestAcceptanceSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record, previousState },
    })

    return {
      record,
      message: requestAcceptedMessage,
      forward: { witnessConnection },
    }
  }

  /**
   * Process a received {@link CashAcceptedMessage}.
   * For Witness:
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   * For Giver:
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Cash Accepted Message
   */
  public async processCashAcceptanceWitnessed(
    messageContext: InboundMessageContext<CashAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedWitnessedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedWitnessedMessage } = messageContext
    if (!cashAcceptedWitnessedMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Cash Accepted message.`)
    }
    const record = await this.valueTransferRepository.getByThread(cashAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    const previousState = record.state

    if (!record.witnessConnectionId) {
      throw new AriesFrameworkError(`Connection not found for Giver DID: ${record.payment.giver}`)
    }
    const witnessConnection = await this.connectionService.getById(record.witnessConnectionId)

    // Update Value Transfer record and raise event
    record.cashAcceptedWitnessedMessage = cashAcceptedWitnessedMessage
    record.state = ValueTransferState.CashAcceptanceReceived

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: cashAcceptedWitnessedMessage,
      forward: {
        witnessConnection,
      },
    }
  }

  /**
   * Remove cash as Giver from the Wallet.
   * @param witnessConnection Connection to Witness.
   * @param record Value Transfer record containing Cash Acceptance message to handle.
   * @returns Value Transfer record and Cash Removed Message
   */
  public async removeCash(
    witnessConnection: ConnectionRecord,
    record: ValueTransferRecord
  ): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage
    forward: {
      witnessConnection: ConnectionRecord
    }
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.CashAcceptanceReceived)

    const cashAcceptedWitnessedMessage = record.cashAcceptedWitnessedMessage
    if (!cashAcceptedWitnessedMessage) {
      throw new AriesFrameworkError(`Cash Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    const previousState = record.state

    // Call VTP package to remove cash
    const { error, message } = await this.valueTransfer.giver().removeCash(cashAcceptedWitnessedMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Failed to accept Payment Request: ${error?.message}`)
    }

    const cashRemovedMessage = new CashRemovedMessage({
      from: witnessConnection.did,
      to: witnessConnection.theirDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record and raise event
    record.cashRemovedMessage = cashRemovedMessage
    record.state = ValueTransferState.CashRemovalSent

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: cashRemovedMessage,
      forward: {
        witnessConnection,
      },
    }
  }

  /**
   * Process a received {@link GiverReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns Value Transfer record and Payment Receipt Message
   */
  public async processReceipt(
    messageContext: InboundMessageContext<GiverReceiptMessage>
  ): Promise<{ record: ValueTransferRecord; message: GiverReceiptMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: receiptMessage } = messageContext
    if (!receiptMessage.thid) {
      throw new AriesFrameworkError(`Thread id not found in the Receipt message.`)
    }

    const record = await this.valueTransferRepository.getByThread(receiptMessage.thid)

    record.assertState(ValueTransferState.CashRemovalSent)
    record.assertRole(ValueTransferRole.Giver)

    const previousState = record.state

    // Call VTP to process Receipt
    const { error, message } = await this.valueTransfer.giver().processReceipt(receiptMessage.body)
    if (error || !message) {
      throw new AriesFrameworkError(`Giver: Failed to store Receipt: ${error?.message}`)
    }

    // Update Value Transfer record and raise event
    receiptMessage.body = message
    record.giverReceiptMessage = receiptMessage
    record.state = ValueTransferState.Completed

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: receiptMessage }
  }
}

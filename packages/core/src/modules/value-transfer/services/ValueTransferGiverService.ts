import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestWitnessedMessage, CashAcceptedWitnessedMessage, GiverReceiptMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService, DidService, DidType } from '../../dids'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, ProblemReportMessage, RequestAcceptedMessage } from '../messages'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private valueTransfer: ValueTransfer
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService
  private didService: DidService
  private eventEmitter: EventEmitter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didResolverService = didResolverService
    this.connectionService = connectionService
    this.didService = didService
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
   *    Value transfer record with the information from the request message will be created.
   *    Use {@link ValueTransferGiverService.acceptRequest} after calling this method to accept payment request.
   *
   * @param messageContext The context of the received message.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Message
   *    * Witness Connection record
   */
  public async processRequestWitnessed(messageContext: InboundMessageContext<RequestWitnessedMessage>): Promise<{
    record?: ValueTransferRecord
    message: RequestWitnessedMessage | ProblemReportMessage
  }> {
    const { message: requestWitnessedMessage } = messageContext

    const { getter, giver, witness } = requestWitnessedMessage.body.payment

    if (requestWitnessedMessage.body.payment.isGiverSet) {
      // ensure that DID exist in the wallet
      const did = await this.didService.findById(giver)
      if (!did) {
        const problemReport = new ProblemReportMessage({
          to: requestWitnessedMessage.from,
          pthid: requestWitnessedMessage.id,
          body: {
            code: 'e.p.req.bad-giver',
            comment: `Requested giver '${giver}' does not exist in the wallet`,
          },
        })
        return {
          message: problemReport,
        }
      }
    }

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Giver,
      state: ValueTransferState.RequestReceived,
      threadId: requestWitnessedMessage.thid,
      valueTransferMessage: requestWitnessedMessage.body,
      requestWitnessedMessage,
      getter,
      witness,
      giver,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })
    return { record, message: requestWitnessedMessage }
  }

  /**
   * Accept received {@link RequestMessage} as Giver by sending a payment request acceptance message.
   *
   * @param record Value Transfer record containing Payment Request to accept.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Acceptance Message
   */
  public async acceptRequest(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestReceived)

    const giver = record.valueTransferMessage.payment.isGiverSet
      ? record.valueTransferMessage.payment.giver
      : (await this.didService.createDID(DidType.PeerDid)).id

    // Call VTP to accept payment request
    const notesToSpend = await this.valueTransfer.giver().pickNotesToSpend(record.valueTransferMessage.payment.amount)

    const { error, message } = await this.valueTransfer
      .giver()
      .acceptPaymentRequest(giver, record.valueTransferMessage, notesToSpend)
    if (error || !message) {
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: giver,
        to: record.witnessDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Request verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReport
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return {
        record,
        message: problemReport,
      }
    }

    // VTP message verification succeed
    const requestAcceptedMessage = new RequestAcceptedMessage({
      from: giver,
      to: record.witnessDid,
      body: message,
      thid: record.threadId,
    })

    // Update Value Transfer record
    record.giverDid = giver
    record.valueTransferMessage = message
    await this.valueTransferService.updateState(record, ValueTransferState.RequestAcceptanceSent)
    return { record, message: requestAcceptedMessage }
  }

  /**
   * Process a received {@link CashAcceptedWitnessedMessage}.
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Cash Acceptance Message
   */
  public async processCashAcceptanceWitnessed(
    messageContext: InboundMessageContext<CashAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedWitnessedMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedWitnessedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(cashAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    // Update Value Transfer record and raise event
    record.valueTransferMessage = cashAcceptedWitnessedMessage.body
    await this.valueTransferService.updateState(record, ValueTransferState.CashAcceptanceReceived)
    return { record, message: cashAcceptedWitnessedMessage }
  }

  /**
   * Remove cash as Giver from the Wallet.
   *
   * @param record Value Transfer record containing Cash Acceptance message to handle.
   *
   * @returns
   *    * Value Transfer record
   *    * Cash Removed Message
   */
  public async removeCash(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.CashAcceptanceReceived)

    // Call VTP package to remove cash
    const { error, message } = await this.valueTransfer.giver().removeCash(record.valueTransferMessage)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-cash-accepted',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    const cashRemovedMessage = new CashRemovedMessage({
      from: record.giverDid,
      to: record.witnessDid,
      thid: record.threadId,
      body: message,
    })

    // Update Value Transfer record
    record.valueTransferMessage = message
    await this.valueTransferService.updateState(record, ValueTransferState.CashRemovalSent)
    return { record, message: cashRemovedMessage }
  }

  /**
   * Process a received {@link GiverReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   *
   * @returns
   *    * Value Transfer record
   *    * Cash Removed Message
   */
  public async processReceipt(messageContext: InboundMessageContext<GiverReceiptMessage>): Promise<{
    record: ValueTransferRecord
    message: GiverReceiptMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: receiptMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(receiptMessage.thid)

    record.assertState(ValueTransferState.CashRemovalSent)
    record.assertRole(ValueTransferRole.Giver)

    // Call VTP to process Receipt
    const { error, message } = await this.valueTransfer.giver().processReceipt(receiptMessage.body)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        pthid: receiptMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-receipt',
          comment: `Receipt verification failed. Error: ${error}`,
        },
      })

      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    record.valueTransferMessage = message
    record.receipt = message

    await this.valueTransferService.updateState(record, ValueTransferState.Completed)
    return { record, message: receiptMessage }
  }
}

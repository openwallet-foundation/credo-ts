import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestWitnessedMessage, CashAcceptedWitnessedMessage, GiverReceiptMessage } from '../messages'
import type { Giver } from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidService, DidType } from '../../dids'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, ProblemReportMessage, RequestAcceptedMessage } from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didService: DidService
  private eventEmitter: EventEmitter
  private giver: Giver

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.eventEmitter = eventEmitter

    this.giver = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).giver()
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

    const valueTransferMessage = requestWitnessedMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        to: requestWitnessedMessage.from,
        pthid: requestWitnessedMessage.id,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestWitnessedMessage.thid}`,
        },
      })
      return { message: problemReport }
    }

    if (valueTransferMessage.isGiverSet) {
      // ensure that DID exist in the wallet
      const did = await this.didService.findById(valueTransferMessage.giverId)
      if (!did) {
        const problemReport = new ProblemReportMessage({
          to: requestWitnessedMessage.from,
          pthid: requestWitnessedMessage.id,
          body: {
            code: 'e.p.req.bad-giver',
            comment: `Requested giver '${valueTransferMessage.giverId}' does not exist in the wallet`,
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
      valueTransferMessage,
      getter: valueTransferMessage.getterId,
      witness: valueTransferMessage.witnessId,
      giver: valueTransferMessage.giverId,
      amount: valueTransferMessage.amount,
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

    const giver = record.valueTransferMessage.isGiverSet
      ? record.valueTransferMessage.giverId
      : (await this.didService.createDID(DidType.PeerDid)).id

    // Call VTP to accept payment request
    const { error: pickNotesError, notes: notesToSpend } = await this.giver.pickNotesToSpend(
      record.valueTransferMessage.amount
    )
    if (pickNotesError || !notesToSpend) {
      throw new AriesFrameworkError(`Not enough notes to pay: ${record.valueTransferMessage.amount}`)
    }

    const { error, message, delta } = await this.giver.acceptPaymentRequest(
      giver,
      record.valueTransferMessage,
      notesToSpend
    )
    if (error || !message || !delta) {
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
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
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
    message: CashRemovedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedWitnessedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(cashAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestAcceptanceSent)

    const valueTransferDelta = cashAcceptedWitnessedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.giverDid,
        to: record.witnessDid,
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-cash-acceptance',
          comment: `Missing required base64 or json encoded attachment data for cash acceptance with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP package to remove cash
    const { error, message, delta } = await this.giver.signReceipt(record.valueTransferMessage, valueTransferDelta)
    if (error || !message || !delta) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.giverDid,
        to: record.witnessDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-cash-accepted',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      await this.giver.abortTransaction()
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
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
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

    const valueTransferDelta = receiptMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        pthid: record.threadId,
        body: {
          code: 'invalid-payment-receipt',
          comment: `Missing required base64 or json encoded attachment data for receipt with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP to process Receipt
    const { error, message } = await this.giver.processReceipt(record.valueTransferMessage, valueTransferDelta)
    if (error || !message) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        pthid: receiptMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-receipt',
          comment: `Receipt verification failed. Error: ${error}`,
        },
      })

      await this.giver.abortTransaction()
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

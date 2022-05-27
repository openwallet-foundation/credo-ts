import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestWitnessedMessage, CashAcceptedWitnessedMessage, GiverReceiptMessage } from '../messages'

import { ValueTransfer, verifiableNoteProofConfig } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService, DidService, DidType } from '../../dids'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, ProblemReportMessage, RequestAcceptedMessage } from '../messages'
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
  private didService: DidService
  private eventEmitter: EventEmitter

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    didService: DidService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
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

    let giverDID: string
    if (giver !== 'giver') {
      // FIXME: Import default giver placeholder from vtp package or even provide helper functino there
      const didRecord = await this.didService.findById(giver)
      if (!didRecord) {
        return {
          message: new ProblemReportMessage({
            to: requestWitnessedMessage.from,
            pthid: requestWitnessedMessage.id,
            body: {
              code: 'e.p.req.bad-giver',
              comment: `Requested giver ${giver} does not exist in the wallet`,
            },
          }),
        }
      }
      giverDID = giver
    } else {
      // create new DID record
      giverDID = (await this.didService.createDID(DidType.PeerDid)).id
    }

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      payment: requestWitnessedMessage.body.payment,
      role: ValueTransferRole.Giver,
      state: ValueTransferState.RequestReceived,
      threadId: requestWitnessedMessage.thid,
      requestWitnessedMessage,
      getter,
      witness,
      giver: giverDID,
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
   *    * Witness Connection record
   */
  public async acceptRequest(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.RequestReceived)

    const requestWitnessedMessage = record.requestWitnessedMessage
    if (!requestWitnessedMessage || !record.giverDid) {
      throw new AriesFrameworkError(`Payment Request not found for Value Transfer with thread id ${record.threadId}`)
    }

    let resultMessage: RequestAcceptedMessage | ProblemReportMessage

    const previousState = record.state

    // Call VTP to accept payment request
    // TODO: Do we need to create a separate method for selecting notes and expose it in API?
    const notesToSpend = await this.valueTransfer.giver().pickNotesToSpend(requestWitnessedMessage.body.payment.amount)

    const { error, message } = await this.valueTransfer
      .giver()
      .acceptPaymentRequest(record.giverDid, requestWitnessedMessage.body, notesToSpend)
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        from: record.giverDid,
        to: record.witnessDid,
        pthid: requestWitnessedMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Request verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      resultMessage = new RequestAcceptedMessage({
        from: record.giverDid,
        to: record.witnessDid,
        body: message,
        thid: record.threadId,
      })

      // Update Value Transfer record
      record.payment = resultMessage.body.payment
      record.requestAcceptedMessage = resultMessage
      record.state = ValueTransferState.RequestAcceptanceSent
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record, previousState },
    })

    return {
      record,
      message: resultMessage,
    }
  }

  /**
   * Process a received {@link CashAcceptedWitnessedMessage}.
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Cash Acceptance Message
   *    * Witness Connection record
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

    const previousState = record.state

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
    }
  }

  /**
   * Remove cash as Giver from the Wallet.
   *
   * @param record Value Transfer record containing Cash Acceptance message to handle.
   *
   * @returns
   *    * Value Transfer record
   *    * Cash Removed Message
   *    * Witness Connection record
   */
  public async removeCash(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.CashAcceptanceReceived)

    const cashAcceptedWitnessedMessage = record.cashAcceptedWitnessedMessage
    if (!cashAcceptedWitnessedMessage) {
      throw new AriesFrameworkError(`Cash Acceptance not found for Value Transfer with thread id ${record.threadId}`)
    }

    let resultMessage: CashRemovedMessage | ProblemReportMessage

    const previousState = record.state

    // Call VTP package to remove cash
    const { error, message } = await this.valueTransfer.giver().removeCash(cashAcceptedWitnessedMessage.body)
    if (error || !message) {
      // VTP message verification failed
      resultMessage = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-cash-accepted',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = resultMessage
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      resultMessage = new CashRemovedMessage({
        from: record.giverDid,
        to: record.witnessDid,
        thid: record.threadId,
        body: message,
      })

      // Update Value Transfer record
      record.cashRemovedMessage = resultMessage
      record.state = ValueTransferState.CashRemovalSent
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return {
      record,
      message: resultMessage,
    }
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
  public async processReceipt(
    messageContext: InboundMessageContext<GiverReceiptMessage>
  ): Promise<{ record: ValueTransferRecord; message: GiverReceiptMessage }> {
    // Verify that we are in appropriate state to perform action
    const { message: receiptMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(receiptMessage.thid)

    record.assertState(ValueTransferState.CashRemovalSent)
    record.assertRole(ValueTransferRole.Giver)

    const previousState = record.state

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
      record.state = ValueTransferState.Failed
    } else {
      // VTP message verification succeed
      receiptMessage.body = message
      record.giverReceiptMessage = receiptMessage
      record.state = ValueTransferState.Completed
    }

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record, previousState },
    })

    return { record, message: receiptMessage }
  }
}

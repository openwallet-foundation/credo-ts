import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { CashAcceptedWitnessedMessage, GiverReceiptMessage, RequestWitnessedMessage } from '../messages'
import type { Giver } from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService, DidService, DidType } from '../../dids'
import { DidInfo, WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, ProblemReportMessage, RequestAcceptedMessage } from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferTransactionStatus, ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didResolverService: DidResolverService
  private connectionService: ConnectionService
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter
  private giver: Giver

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didResolverService: DidResolverService,
    connectionService: ConnectionService,
    didService: DidService,
    wellKnownService: WellKnownService,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didResolverService = didResolverService
    this.connectionService = connectionService
    this.didService = didService
    this.wellKnownService = wellKnownService
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

    const getterInfo = await this.wellKnownService.resolve(valueTransferMessage.getterId)
    const witnessInfo = new DidInfo({ did: valueTransferMessage.witnessId })
    const giverInfo = valueTransferMessage.isGiverSet ? new DidInfo({ did: valueTransferMessage.giverId }) : undefined

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Giver,
      state: ValueTransferState.RequestReceived,
      status: ValueTransferTransactionStatus.Pending,
      threadId: requestWitnessedMessage.thid,
      valueTransferMessage,
      getter: getterInfo,
      witness: witnessInfo,
      giver: giverInfo,
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

    const giverDid = record.giver ? record.giver.did : (await this.didService.createDID(DidType.PeerDid)).id

    const activeTransaction = await this.valueTransferService.getActiveTransaction()
    if (activeTransaction.record) {
      throw new AriesFrameworkError(
        `Request cannot be accepted as there is another active transaction: ${activeTransaction.record?.id}`
      )
    }

    // Call VTP to accept payment request
    const { error: pickNotesError, notes: notesToSpend } = await this.giver.pickNotesToSpend(
      record.valueTransferMessage.amount
    )
    if (pickNotesError || !notesToSpend) {
      throw new AriesFrameworkError(`Not enough notes to pay: ${record.valueTransferMessage.amount}`)
    }

    const { error, message, delta } = await this.giver.acceptPaymentRequest(
      giverDid,
      record.valueTransferMessage,
      notesToSpend
    )
    if (error || !message || !delta) {
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: giverDid,
        to: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-payment-request',
          comment: `Request verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReport
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return {
        record,
        message: problemReport,
      }
    }

    // VTP message verification succeed
    const requestAcceptedMessage = new RequestAcceptedMessage({
      from: giverDid,
      to: record.witness?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.giver = new DidInfo({ did: giverDid })
    record.valueTransferMessage = message
    await this.valueTransferService.updateState(
      record,
      ValueTransferState.RequestAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )
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
        from: record.giver?.did,
        to: record.witness?.did,
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
        from: record.giver?.did,
        to: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-cash-accepted',
          comment: `Cash Acceptance verification failed. Error: ${error}`,
        },
      })

      await this.giver.abortTransaction()
      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    const cashRemovedMessage = new CashRemovedMessage({
      from: record.giver?.did,
      to: record.witness?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.valueTransferMessage = message

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashSignatureSent,
      ValueTransferTransactionStatus.InProgress
    )
    return { record, message: cashRemovedMessage }
  }

  /**
   * Remove cash committed for spending from the wallet.
   * This function must be called once the signature delta was successfully sent.
   *
   * @returns void
   */
  public async removeCash(record: ValueTransferRecord): Promise<{
    record: ValueTransferRecord
  }> {
    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.CashSignatureSent)

    // Call VTP package to remove cash
    const { error } = await this.giver.removeCash()
    if (error) {
      // VTP cash removal failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.giver?.did,
        to: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'unable-to-remove-cash',
          comment: `Failed to remove cash from the wallet. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return { record }
    }

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.WaitingReceipt,
      ValueTransferTransactionStatus.Finished
    )
    return { record }
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

    record.assertState(ValueTransferState.WaitingReceipt)
    record.assertRole(ValueTransferRole.Giver)

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.ReceiptReceived,
      ValueTransferTransactionStatus.InProgress
    )

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
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    record.valueTransferMessage = message
    record.receipt = message

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )
    return { record, message: receiptMessage }
  }
}

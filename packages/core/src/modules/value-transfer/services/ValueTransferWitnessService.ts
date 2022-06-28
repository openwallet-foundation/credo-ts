import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { RequestMessage, RequestAcceptedMessage, CashAcceptedMessage, CashRemovedMessage } from '../messages'
import type { Witness } from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
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
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository } from '../repository'
import { WitnessStateRepository } from '../repository/WitnessStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private witnessStateRepository: WitnessStateRepository
  private eventEmitter: EventEmitter
  private witness: Witness

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    eventEmitter: EventEmitter
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.eventEmitter = eventEmitter

    this.witness = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).witness()
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

    const valueTransferMessage = requestMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        from: state.publicDid,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestMessage.id}`,
        },
      })
      return {
        message: problemReport,
      }
    }

    // Check that witness request by Getter is corrected
    if (valueTransferMessage.isWitnessSet && state.publicDid !== valueTransferMessage.witnessId) {
      const problemReport = new ProblemReportMessage({
        from: state.publicDid,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-witness',
          comment: `Requested witness ${valueTransferMessage.witnessId} is different`,
        },
      })
      return {
        message: problemReport,
      }
    }

    //Call VTP package to process received Payment Request request
    const { error, message } = await this.witness.processRequest(state.publicDid, valueTransferMessage)
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

    const giverDid = valueTransferMessage.isGiverSet ? valueTransferMessage.giverId : undefined

    // next protocol message
    const requestWitnessedMessage = new RequestWitnessedMessage({
      from: state.publicDid,
      to: giverDid,
      thid: requestMessage.id,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(message)],
    })

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Witness,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      valueTransferMessage: message,
      getter: valueTransferMessage.getterId,
      giver: giverDid,
      witness: state.publicDid,
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
    const { message: requestAcceptedMessage, sender } = messageContext

    const record = await this.valueTransferRepository.getByThread(requestAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState(ValueTransferState.RequestSent)

    const valueTransferDelta = requestAcceptedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: requestAcceptedMessage.thid,
        body: {
          code: 'invalid-payment-acceptance',
          comment: `Missing required base64 or json encoded attachment data for receipt with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Witness: Call VTP package to process received request acceptance
    const { error, message, delta } = await this.witness.processRequestAccepted(
      record.valueTransferMessage,
      valueTransferDelta
    )
    // change state
    if (error || !message || !delta) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.witnessDid,
        to: sender,
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
      from: record.witnessDid,
      to: record.getterDid,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.valueTransferMessage = message
    record.giverDid = message.giverId

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

    const valueTransferDelta = cashAcceptedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: cashAcceptedMessage.thid,
        body: {
          code: 'invalid-cash-acceptance',
          comment: `Missing required base64 or json encoded attachment data for cash acceptance with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Witness: Call VTP package to process received cash acceptance
    const { error, message, delta } = await this.witness.processCashAccepted(
      record.valueTransferMessage,
      valueTransferDelta
    )
    // change state
    if (error || !message || !delta) {
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
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
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
    getterMessage: GetterReceiptMessage | ProblemReportMessage
    giverMessage: GiverReceiptMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(cashRemovedMessage.thid)
    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Witness)

    const valueTransferDelta = cashRemovedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const getterProblemReport = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.giverDid,
        pthid: cashRemovedMessage.thid,
        body: {
          code: 'invalid-cash-removal',
          comment: `Missing required base64 or json encoded attachment data for cash removal with thread id ${record.threadId}`,
        },
      })
      const giverProblemReport = new ProblemReportMessage({
        ...getterProblemReport,
        to: record.giverDid,
      })
      return { record, getterMessage: getterProblemReport, giverMessage: giverProblemReport }
    }

    // Call VTP package to create receipt
    const {
      error,
      message: receipt,
      getterDelta,
      giverDelta,
    } = await this.witness.createReceipt(record.valueTransferMessage, valueTransferDelta)
    if (error || !receipt || !getterDelta || !giverDelta) {
      // VTP message verification failed
      const getterProblemReport = new ProblemReportMessage({
        from: record.witnessDid,
        to: record.getterDid,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-state',
          comment: `Receipt creation failed. Error: ${error}`,
        },
      })
      const giverProblemReport = new ProblemReportMessage({
        ...getterProblemReport,
        to: record.giverDid,
      })

      // Update Value Transfer record
      record.problemReportMessage = getterProblemReport
      await this.valueTransferService.updateState(record, ValueTransferState.Failed)
      return {
        record,
        getterMessage: getterProblemReport,
        giverMessage: giverProblemReport,
      }
    }

    const getterReceiptMessage = new GetterReceiptMessage({
      from: record.witnessDid,
      to: record.getterDid,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(getterDelta)],
    })

    const giverReceiptMessage = new GiverReceiptMessage({
      from: record.witnessDid,
      to: record.giverDid,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(giverDelta)],
    })

    // Update Value Transfer record and raise event
    record.valueTransferMessage = receipt
    record.receipt = receipt

    await this.valueTransferService.updateState(record, ValueTransferState.Completed)
    return { record, getterMessage: getterReceiptMessage, giverMessage: giverReceiptMessage }
  }
}

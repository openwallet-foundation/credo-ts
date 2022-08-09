import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { CashAcceptedMessage, CashRemovedMessage, OfferAcceptedMessage, RequestAcceptedMessage } from '../messages'
import type { Witness } from '@sicpa-dlab/value-transfer-protocol-ts'

import { ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids'
import { WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import {
  CashAcceptedWitnessedMessage,
  GetterReceiptMessage,
  GiverReceiptMessage,
  OfferAcceptedWitnessedMessage,
  ProblemReportMessage,
  RequestAcceptedWitnessedMessage,
} from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository, ValueTransferTransactionStatus } from '../repository'
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
  private didService: DidService
  private eventEmitter: EventEmitter
  private witness: Witness
  private wellKnownService: WellKnownService

  public constructor(
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    witnessStateRepository: WitnessStateRepository,
    didService: DidService,
    eventEmitter: EventEmitter,
    wellKnownService: WellKnownService
  ) {
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.witnessStateRepository = witnessStateRepository
    this.didService = didService
    this.eventEmitter = eventEmitter
    this.wellKnownService = wellKnownService

    this.witness = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).witness()
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

    // Get Witness state
    const did = await this.didService.findOnlineStaticDid()
    if (!did) {
      throw new AriesFrameworkError(`Unable to find Witness public DID`)
    }

    const valueTransferMessage = offerAcceptanceMessage.valueTransferMessage
    if (!valueTransferMessage) {
      const problemReport = new ProblemReportMessage({
        from: did.did,
        to: offerAcceptanceMessage.from,
        pthid: offerAcceptanceMessage.id,
        body: {
          code: 'e.p.req.bad-offer-acceptance',
          comment: `Missing required base64 or json encoded attachment data for payment offer with thread id ${offerAcceptanceMessage.id}`,
        },
      })
      return { problemReport }
    }

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processOfferAcceptance(did.did, valueTransferMessage)
    if (error || !receipt || !delta) {
      // send problem report back to Getter
      const problemReport = new ProblemReportMessage({
        from: did.did,
        to: offerAcceptanceMessage.from,
        pthid: offerAcceptanceMessage.id,
        body: {
          code: error?.code || 'invalid-payment-offer-acceptance',
          comment: `Payment Offer verification failed. Error: ${error}`,
        },
      })

      return { problemReport }
    }

    // next protocol message
    const offerAcceptedWitnessedMessage = new OfferAcceptedWitnessedMessage({
      from: did.did,
      to: receipt.giver?.id,
      thid: offerAcceptanceMessage.thid,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    const getterInfo = await this.wellKnownService.resolve(receipt.getterId)
    const giverInfo = await this.wellKnownService.resolve(receipt.giverId)
    const witnessInfo = await this.wellKnownService.resolve(did.did)

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Witness,
      state: ValueTransferState.OfferAcceptanceSent,
      status: ValueTransferTransactionStatus.InProgress,
      threadId: offerAcceptanceMessage.thid,
      receipt,
      getter: getterInfo,
      giver: giverInfo,
      witness: witnessInfo,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

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
      return { problemReport }
    }

    //Call VTP package to process received Payment Request request
    const { error, receipt, delta } = await this.witness.processRequestAcceptance(witnessDid.did, valueTransferMessage)
    if (error || !receipt || !delta) {
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
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Witness,
      state: ValueTransferState.RequestAcceptanceSent,
      status: ValueTransferTransactionStatus.InProgress,
      threadId: requestAcceptanceMessage.thid,
      receipt,
      getter: getterInfo,
      giver: giverInfo,
      witness: witnessInfo,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

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

    const record = await this.valueTransferRepository.getByThread(cashAcceptedMessage.thid)

    record.assertRole(ValueTransferRole.Witness)
    record.assertState([ValueTransferState.RequestAcceptanceSent, ValueTransferState.OfferAcceptanceSent])

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
      return { record, problemReport }
    }

    // Witness: Call VTP package to process received cash acceptance
    const { error, receipt, delta } = await this.witness.processCashAcceptance(record.receipt, valueTransferDelta)
    // change state
    if (error || !receipt || !delta) {
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
    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
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
      return { record, problemReport }
    }

    // Call VTP package to create receipt
    const { error, receipt, getterDelta, giverDelta } = await this.witness.createReceipt(
      record.receipt,
      valueTransferDelta
    )
    if (error || !receipt || !getterDelta || !giverDelta) {
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

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )
    return { record, getterMessage: getterReceiptMessage, giverMessage: giverReceiptMessage }
  }
}

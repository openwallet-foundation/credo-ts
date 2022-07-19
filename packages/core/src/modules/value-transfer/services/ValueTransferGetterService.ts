import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type { GetterReceiptMessage, RequestAcceptedWitnessedMessage, OfferMessage } from '../messages'
import type { Getter, Timeouts } from '@sicpa-dlab/value-transfer-protocol-ts'

import { TaggedPrice, ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidType } from '../../dids'
import { DidService } from '../../dids/services/DidService'
import { DidInfo, WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashAcceptedMessage, OfferAcceptedMessage, ProblemReportMessage, RequestMessage } from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository, ValueTransferTransactionStatus } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGetterService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter
  private getter: Getter

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferStateService,
    didService: DidService,
    wellKnownService: WellKnownService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferStateRepository = valueTransferStateRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.didService = didService
    this.wellKnownService = wellKnownService
    this.eventEmitter = eventEmitter

    this.getter = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).getter()
  }

  /**
   * Initiate a new value transfer exchange as Getter by sending a payment request message
   * to the known Witness which transfers record later to Giver.
   *
   * @param params Options to use for request creation -
   * {
   *  amount - Amount to pay
   *  unitOfAmount - (Optional) Currency code that represents the unit of account
   *  witness - (Optional) DID of witness if it's known in advance
   *  giver - (Optional) DID of giver if it's known in advance
   *  usePublicDid - (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   *  timeouts - (Optional) Giver timeouts to which value transfer must fit
   * }
   *
   * @returns
   *    * Value Transfer record
   *    * Payment Request Message
   */
  public async createRequest(params: {
    amount: number
    unitOfAmount?: string
    witness?: string
    giver?: string
    usePublicDid?: boolean
    timeouts?: Timeouts
  }): Promise<{
    record: ValueTransferRecord
    message: RequestMessage
  }> {
    // Get payment public DID from the storage or generate a new one if requested
    const usePublicDid = params.usePublicDid || true
    const getter = await this.didService.getPublicOrCrateNewDid(DidType.PeerDid, usePublicDid)

    // Call VTP package to create payment request
    const givenTotal = new TaggedPrice({ amount: params.amount, uoa: params.unitOfAmount })
    const { error, receipt } = await this.getter.createRequest({
      getterId: getter.did,
      witnessId: params.witness,
      giverId: params.giver,
      givenTotal,
      timeouts: params.timeouts,
    })
    if (error || !receipt) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage({
      from: getter.did,
      to: params.witness,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(receipt)],
    })

    const getterInfo = await this.wellKnownService.resolve(getter.did)
    const witnessInfo = await this.wellKnownService.resolve(params.witness)
    const giverInfo = await this.wellKnownService.resolve(params.giver)

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Getter,
      state: ValueTransferState.RequestSent,
      threadId: requestMessage.id,
      receipt,
      getter: getterInfo,
      witness: witnessInfo,
      giver: giverInfo,
      status: ValueTransferTransactionStatus.Pending,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })
    return { record, message: requestMessage }
  }

  /**
   * Process a received {@link OfferMessage}.
   *    Value transfer record with the information from the offer message will be created.
   *    Use {@link ValueTransferGetterService.acceptOffer} after calling this method to accept payment request.
   *
   * @param messageContext The context of the received message.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Offer Message
   */
  public async processOffer(messageContext: InboundMessageContext<OfferMessage>): Promise<{
    record?: ValueTransferRecord
    message: OfferMessage | ProblemReportMessage
  }> {
    const { message: offerMessage } = messageContext

    const receipt = offerMessage.valueTransferMessage
    if (!receipt) {
      const problemReport = new ProblemReportMessage({
        to: offerMessage.from,
        pthid: offerMessage.id,
        body: {
          code: 'e.p.req.bad-offer',
          comment: `Missing required base64 or json encoded attachment data for payment offer with thread id ${offerMessage.thid}`,
        },
      })
      return { message: problemReport }
    }

    // ensure that DID exist in the wallet
    const did = await this.didService.findById(receipt.getterId)
    if (!did) {
      const problemReport = new ProblemReportMessage({
        to: offerMessage.from,
        pthid: offerMessage.id,
        body: {
          code: 'e.p.req.bad-getter',
          comment: `Requested getter '${receipt.getterId}' does not exist in the wallet`,
        },
      })
      return {
        message: problemReport,
      }
    }

    const getterInfo = await this.wellKnownService.resolve(receipt.getterId)
    const witnessInfo = await this.wellKnownService.resolve(receipt.witnessId)
    const giverInfo = await this.wellKnownService.resolve(receipt.giverId)

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Getter,
      state: ValueTransferState.OfferReceived,
      status: ValueTransferTransactionStatus.Pending,
      threadId: offerMessage.id,
      receipt,
      getter: getterInfo,
      witness: witnessInfo,
      giver: giverInfo,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })
    return { record, message: offerMessage }
  }

  /**
   * Accept received {@link OfferMessage} as Getter by sending a cash acceptance message.
   *
   * @param record Value Transfer record containing Payment Offer to accept.
   * @param witnessDid (Optional) DID ot the Witness which must process transaction (or will be taken from the framework config)
   * @param timeouts (Optional) Getter timeouts to which value transfer must fit
   *
   * @returns
   *    * Value Transfer record
   *    * Cash Acceptance Message
   */
  public async acceptOffer(
    record: ValueTransferRecord,
    witnessDid?: string,
    timeouts?: Timeouts
  ): Promise<{
    record: ValueTransferRecord
    message: OfferAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.OfferReceived)

    const witness = witnessDid || this.config.valueTransferConfig?.witnessDid
    if (!witness) {
      throw new AriesFrameworkError(`Unable to accept payment offer without specifying of Witness DID.`)
    }

    const activeTransaction = await this.valueTransferService.getActiveTransaction()
    if (activeTransaction.record) {
      throw new AriesFrameworkError(
        `Offer cannot be accepted as there is another active transaction: ${activeTransaction.record?.id}`
      )
    }

    if (!record.getter?.did) {
      throw new AriesFrameworkError(`Offer cannot be accepted as there is no getterDID in the record`)
    }

    const { error, receipt, delta } = await this.getter.acceptOffer({
      getterId: record.getter?.did,
      receipt: record.receipt,
      witnessId: witness,
      timeouts,
    })
    if (error || !receipt || !delta) {
      // VTP message verification failed
      const problemReport = new ProblemReportMessage({
        from: record.getter?.did,
        to: witness,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-payment-offer',
          comment: `Offer verification failed. Error: ${error}`,
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
    const offerAcceptedMessage = new OfferAcceptedMessage({
      from: record.getter?.did,
      to: witness,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(receipt)],
    })

    const witnessInfo = await this.wellKnownService.resolve(witness)

    // Update Value Transfer record
    record.receipt = receipt
    record.witness = witnessInfo
    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )
    return { record, message: offerAcceptedMessage }
  }

  /**
   * Process a received {@link RequestAcceptedWitnessedMessage}.
   * Update Value Transfer record with the information from the received message.
   *
   * @param messageContext The received message context.
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Accepted Message
   */
  public async processRequestAcceptanceWitnessed(
    messageContext: InboundMessageContext<RequestAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: CashAcceptedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedWitnessedMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(requestAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Getter)
    record.assertState(ValueTransferState.RequestSent)

    const valueTransferDelta = requestAcceptedWitnessedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.getter?.did,
        to: requestAcceptedWitnessedMessage.from,
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestAcceptedWitnessedMessage.thid}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP to accept cash
    const { error, receipt, delta } = await this.getter.acceptCash(record.receipt, valueTransferDelta)
    if (error || !receipt || !delta) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.getter?.did,
        to: record.witness?.did,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-request-acceptance',
          comment: `Request Acceptance verification failed. Error: ${error}`,
        },
      })

      // Update Value Transfer record
      record.problemReportMessage = problemReportMessage
      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return {
        record,
        message: problemReportMessage,
      }
    }

    // VTP message verification succeed
    const cashAcceptedMessage = new CashAcceptedMessage({
      from: record.getter?.did,
      to: record.witness?.did,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createValueTransferJSONAttachment(delta)],
    })

    // Update Value Transfer record
    // Update Value Transfer record and raise event

    const witnessInfo = record.witness?.did ? record.witness : new DidInfo({ did: receipt.witnessId })
    const giverInfo = record.giver?.did ? record.giver : await this.wellKnownService.resolve(receipt.giverId)

    record.receipt = receipt
    record.witness = witnessInfo
    record.giver = giverInfo

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )
    return { record, message: cashAcceptedMessage }
  }

  /**
   * Process a received {@link GetterReceiptMessage} and finish Value Transfer.
   * Update Value Transfer record with the information from the message.
   *
   * @param messageContext The context of the received message.
   * @returns
   *    * Value Transfer record
   *    * Receipt Message
   */
  public async processReceipt(messageContext: InboundMessageContext<GetterReceiptMessage>): Promise<{
    record: ValueTransferRecord
    message: GetterReceiptMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: getterReceiptMessage } = messageContext

    const record = await this.valueTransferRepository.getByThread(getterReceiptMessage.thid)

    record.assertState(ValueTransferState.CashAcceptanceSent)
    record.assertRole(ValueTransferRole.Getter)

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.ReceiptReceived,
      ValueTransferTransactionStatus.InProgress
    )

    const valueTransferDelta = getterReceiptMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-receipt',
          comment: `Missing required base64 or json encoded attachment data for receipt with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP to process Receipt
    const { error, receipt } = await this.getter.processReceipt(record.receipt, valueTransferDelta)
    if (error || !receipt) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        pthid: getterReceiptMessage.thid,
        body: {
          code: error?.code || 'invalid-payment-receipt',
          comment: `Receipt verification failed. Error: ${error}`,
        },
      })

      await this.getter.abortTransaction()
      record.problemReportMessage = problemReportMessage

      await this.valueTransferService.updateState(
        record,
        ValueTransferState.Failed,
        ValueTransferTransactionStatus.Finished
      )
      return { record, message: problemReportMessage }
    }

    // VTP message verification succeed
    record.receipt = receipt

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )
    return { record, message: getterReceiptMessage }
  }
}

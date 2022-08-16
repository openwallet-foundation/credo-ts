import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ValueTransferStateChangedEvent } from '../ValueTransferEvents'
import type {
  CashAcceptedWitnessedMessage,
  GiverReceiptMessage,
  OfferAcceptedWitnessedMessage,
  RequestMessage,
} from '../messages'
import type { Giver, Timeouts } from '@sicpa-dlab/value-transfer-protocol-ts'

import { PartyDescriptor, Receipt, TaggedPrice, ValueTransfer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { DidService } from '../../dids'
import { DidInfo, WellKnownService } from '../../well-known'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { ValueTransferRole } from '../ValueTransferRole'
import { ValueTransferState } from '../ValueTransferState'
import { CashRemovedMessage, OfferMessage, ProblemReportMessage, RequestAcceptedMessage } from '../messages'
import { ValueTransferBaseMessage } from '../messages/ValueTransferBaseMessage'
import { ValueTransferRecord, ValueTransferRepository, ValueTransferTransactionStatus } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferStateService } from './ValueTransferStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferStateRepository: ValueTransferStateRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferStateService
  private didService: DidService
  private wellKnownService: WellKnownService
  private eventEmitter: EventEmitter
  private giver: Giver

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

    this.giver = new ValueTransfer(
      {
        crypto: this.valueTransferCryptoService,
        storage: this.valueTransferStateService,
      },
      {}
    ).giver()
  }

  /**
   * Initiate a new value transfer exchange as Giver by sending a payment offer message
   * to the known Witness which transfers record later to Getter.
   *
   * @param params Options to use for request creation -
   * {
   *  amount - Amount to pay
   *  unitOfAmount - (Optional) Currency code that represents the unit of account
   *  witness - (Optional) DID of witness
   *  getter - (Optional) DID of getter
   *  usePublicDid - (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   *  timeouts - (Optional) Giver timeouts to which value transfer must fit
   * }
   *
   * @returns
   *    * Value Transfer record
   *    * Payment Offer Message
   */
  public async offerPayment(params: {
    amount: number
    getter?: string
    unitOfAmount?: string
    witness?: string
    usePublicDid?: boolean
    timeouts?: Timeouts
    attachment?: Record<string, unknown>
  }): Promise<{
    record: ValueTransferRecord
    message: OfferMessage
  }> {
    const id = v4()

    this.config.logger.info(`> Giver: offer payment VTP transaction with ${id}`)

    // Get payment public DID from the storage or generate a new one if requested
    const giver = await this.valueTransferService.getTransactionDid(params.usePublicDid)

    // Create offer receipt
    const receipt = new Receipt({
      giver: new PartyDescriptor({
        id: giver.did,
        timeout_time: params.timeouts?.timeout_time,
        timeout_elapsed: params.timeouts?.timeout_elapsed,
      }),
      getter: params.getter ? new PartyDescriptor({ id: params.getter }) : undefined,
      witness: params.witness ? new PartyDescriptor({ id: params.witness }) : undefined,
      given_total: new TaggedPrice({ amount: params.amount, uoa: params.unitOfAmount }),
    })

    const attachments = [ValueTransferBaseMessage.createVtpReceiptJSONAttachment(receipt)]
    if (params.attachment) {
      attachments.push(ValueTransferBaseMessage.createCustomJSONAttachment(params.attachment))
    }

    const offerMessage = new OfferMessage({
      id,
      from: giver.did,
      to: params.getter,
      attachments,
    })

    const getterInfo = await this.wellKnownService.resolve(params.getter)
    const witnessInfo = await this.wellKnownService.resolve(params.witness)
    const giverInfo = await this.wellKnownService.resolve(giver.did)

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Giver,
      state: ValueTransferState.OfferSent,
      threadId: offerMessage.id,
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

    this.config.logger.info(`< Giver: offer payment VTP transaction with ${id} completed!`)

    return { record, message: offerMessage }
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
  public async processPaymentRequest(messageContext: InboundMessageContext<RequestMessage>): Promise<{
    record?: ValueTransferRecord
    message: RequestMessage | ProblemReportMessage
  }> {
    const { message: requestMessage } = messageContext

    this.config.logger.info(`> Giver: process payment request message for VTP transaction ${requestMessage.id}`)

    const duplicateRecord = await this.valueTransferRepository.findByThread(requestMessage.id)
    if (duplicateRecord) {
      this.config.logger.info(`> Giver: request ${requestMessage.id} has already been processed`)
      throw new AriesFrameworkError(`Payment request ${requestMessage.id} has already been processed`)
    }

    if (requestMessage.thid) {
      const existingOffer = await this.valueTransferRepository.findByThread(requestMessage.thid)
      if (existingOffer) {
        return await this.processOutOfBandPaymentRequest(existingOffer, requestMessage)
      }
    }

    const receipt = requestMessage.valueTransferMessage
    if (!receipt) {
      const problemReport = new ProblemReportMessage({
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestMessage.thid}`,
        },
      })
      return { message: problemReport }
    }

    if (receipt.isGiverSet) {
      // ensure that DID exist in the wallet
      const did = await this.didService.findById(receipt.giverId)
      if (!did) {
        const problemReport = new ProblemReportMessage({
          to: requestMessage.from,
          pthid: requestMessage.id,
          body: {
            code: 'e.p.req.bad-giver',
            comment: `Requested giver '${receipt.giverId}' does not exist in the wallet`,
          },
        })
        return {
          message: problemReport,
        }
      }
    }

    const getterInfo = await this.wellKnownService.resolve(receipt.getterId)
    const witnessInfo = await this.wellKnownService.resolve(receipt.witnessId)
    const giverInfo = receipt.isGiverSet ? await this.wellKnownService.resolve(receipt.giverId) : undefined

    // Create Value Transfer record and raise event
    const record = new ValueTransferRecord({
      role: ValueTransferRole.Giver,
      state: ValueTransferState.RequestReceived,
      status: ValueTransferTransactionStatus.Pending,
      threadId: requestMessage.id,
      receipt,
      getter: getterInfo,
      witness: witnessInfo,
      giver: giverInfo,
      attachment: requestMessage.getCustomAttachment,
    })

    await this.valueTransferRepository.save(record)
    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record },
    })

    this.config.logger.info(
      `< Giver: process payment request message for VTP transaction ${requestMessage.id} completed!`
    )

    return { record, message: requestMessage }
  }

  public async processOutOfBandPaymentRequest(
    record: ValueTransferRecord,
    requestMessage: RequestMessage
  ): Promise<{
    record?: ValueTransferRecord
    message: RequestMessage | ProblemReportMessage
  }> {
    this.config.logger.info(
      `> Giver: process out-of-band payment request message for VTP transaction ${requestMessage.id}`
    )

    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.OfferSent)

    const receipt = requestMessage.valueTransferMessage
    if (!receipt) {
      const problemReport = new ProblemReportMessage({
        from: record.giver?.did,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Missing required base64 or json encoded attachment data for payment request with thread id ${requestMessage.thid}`,
        },
      })
      return { message: problemReport }
    }

    if (!receipt.isGiverSet || receipt.giverId !== record.giver?.did) {
      const problemReport = new ProblemReportMessage({
        from: record.giver?.did,
        to: requestMessage.from,
        pthid: requestMessage.id,
        body: {
          code: 'e.p.req.bad-request',
          comment: `Payment Request contains DID ${receipt.giverId} different from offer ${record.giver?.did}`,
        },
      })
      return { message: problemReport }
    }

    const getterInfo = await this.wellKnownService.resolve(receipt.getterId)
    const witnessInfo = await this.wellKnownService.resolve(receipt.witnessId)

    const state =
      record.givenTotal.amount === receipt.given_total.amount
        ? ValueTransferState.RequestForOfferReceived
        : ValueTransferState.RequestReceived

    // Update  Value Transfer record and raise event
    record.state = state
    record.status = ValueTransferTransactionStatus.Pending
    record.receipt = receipt
    record.getter = getterInfo
    record.witness = witnessInfo

    await this.valueTransferRepository.update(record)

    this.eventEmitter.emit<ValueTransferStateChangedEvent>({
      type: ValueTransferEventTypes.ValueTransferStateChanged,
      payload: { record: record },
    })

    this.config.logger.info(
      `< Giver: process out-of-band payment request message for VTP transaction ${requestMessage.thid} completed!`
    )

    return { message: requestMessage, record }
  }

  /**
   * Accept received {@link RequestMessage} as Giver by sending a payment request acceptance message.
   *
   * @param record Value Transfer record containing Payment Request to accept.
   * @param timeouts (Optional) Giver timeouts to which value transfer must fit
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Acceptance Message
   */
  public async acceptRequest(
    record: ValueTransferRecord,
    timeouts?: Timeouts
  ): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    this.config.logger.info(`> Giver: accept payment request message for VTP transaction ${record.threadId}`)

    // Verify that we are in appropriate state to perform action
    record.assertRole(ValueTransferRole.Giver)
    record.assertState([ValueTransferState.RequestReceived, ValueTransferState.RequestForOfferReceived])

    const giverDid = record.giver?.did ?? (await this.valueTransferService.getTransactionDid()).id

    const activeTransaction = await this.valueTransferService.getActiveTransaction()
    if (activeTransaction.record) {
      throw new AriesFrameworkError(
        `Request cannot be accepted as there is another active transaction: ${activeTransaction.record?.id}`
      )
    }

    // Call VTP to accept payment request
    const { error: pickNotesError, notes: notesToSpend } = await this.giver.pickNotesToSpend(record.receipt.amount)
    if (pickNotesError || !notesToSpend) {
      throw new AriesFrameworkError(`Not enough notes to pay: ${record.receipt.amount}`)
    }

    const { error, receipt } = await this.giver.acceptPaymentRequest({
      giverId: giverDid,
      receipt: record.receipt,
      notesToSpend,
      timeouts,
    })
    if (error || !receipt) {
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
      attachments: [ValueTransferBaseMessage.createVtpReceiptJSONAttachment(receipt)],
    })

    // Update Value Transfer record
    record.giver = new DidInfo({ did: giverDid })
    record.receipt = receipt
    await this.valueTransferService.updateState(
      record,
      ValueTransferState.RequestAcceptanceSent,
      ValueTransferTransactionStatus.InProgress
    )

    this.config.logger.info(`< Giver: accept payment request message for VTP transaction ${record.threadId} completed!`)

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
  public async processOfferAcceptanceWitnessed(
    messageContext: InboundMessageContext<OfferAcceptedWitnessedMessage>
  ): Promise<{
    record: ValueTransferRecord
    message: CashRemovedMessage | ProblemReportMessage
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: offerAcceptedWitnessedMessage } = messageContext

    this.config.logger.info(
      `> Giver: process offer acceptance message for VTP transaction ${offerAcceptedWitnessedMessage.thid}`
    )

    const record = await this.valueTransferRepository.getByThread(offerAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Giver)
    record.assertState(ValueTransferState.OfferSent)

    const valueTransferDelta = offerAcceptedWitnessedMessage.valueTransferDelta
    if (!valueTransferDelta) {
      const problemReport = new ProblemReportMessage({
        from: record.giver?.did,
        to: messageContext.sender,
        pthid: record.threadId,
        body: {
          code: 'e.p.req.bad-offer-acceptance',
          comment: `Missing required base64 or json encoded attachment data for cash acceptance with thread id ${record.threadId}`,
        },
      })
      return { record, message: problemReport }
    }

    // Call VTP package to remove cash
    const { error, receipt, delta } = await this.giver.signReceipt(record.receipt, valueTransferDelta)
    if (error || !receipt || !delta) {
      // VTP message verification failed
      const problemReportMessage = new ProblemReportMessage({
        from: record.giver?.did,
        to: messageContext.sender,
        pthid: record.threadId,
        body: {
          code: error?.code || 'invalid-offer-accepted',
          comment: `Offer Acceptance verification failed. Error: ${error}`,
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
      to: receipt.witnessId,
      thid: record.threadId,
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.receipt = receipt
    record.witness = await this.wellKnownService.resolve(receipt.witnessId)

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashSignatureSent,
      ValueTransferTransactionStatus.InProgress
    )

    this.config.logger.info(
      `< Giver: process offer acceptance message for VTP transaction ${offerAcceptedWitnessedMessage.thid} completed!`
    )

    return { record, message: cashRemovedMessage }
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

    this.config.logger.info(
      `> Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.thid}`
    )

    const record = await this.valueTransferRepository.getByThread(cashAcceptedWitnessedMessage.thid)

    record.assertRole(ValueTransferRole.Giver)
    record.assertState([ValueTransferState.RequestAcceptanceSent, ValueTransferState.OfferSent])

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
    const { error, receipt, delta } = await this.giver.signReceipt(record.receipt, valueTransferDelta)
    if (error || !receipt || !delta) {
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
      attachments: [ValueTransferBaseMessage.createVtpDeltaJSONAttachment(delta)],
    })

    // Update Value Transfer record
    record.receipt = receipt

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.CashSignatureSent,
      ValueTransferTransactionStatus.InProgress
    )

    this.config.logger.info(
      `< Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.thid} completed!`
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
    this.config.logger.info(`> Giver: remove cash for VTP transaction ${record.threadId}`)

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

    this.config.logger.info(`> Giver: remove cash for VTP transaction ${record.threadId} completed!`)

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

    this.config.logger.info(`> Giver: process receipt message for VTP transaction ${receiptMessage.thid}`)

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
    const { error, receipt } = await this.giver.processReceipt(record.receipt, valueTransferDelta)
    if (error || !receipt) {
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
    record.receipt = receipt

    await this.valueTransferService.updateState(
      record,
      ValueTransferState.Completed,
      ValueTransferTransactionStatus.Finished
    )

    this.config.logger.info(`< Giver: process receipt message for VTP transaction ${receiptMessage.thid} completed!`)

    return { record, message: receiptMessage }
  }
}

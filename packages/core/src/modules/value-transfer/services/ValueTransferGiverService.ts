import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Transports } from '../../routing/types'
import type { CashAcceptedWitnessedMessage, RequestMessage, GiverReceiptMessage } from '../messages'
import type { ValueTransferRecord } from '../repository'
import type { Timeouts } from '@sicpa-dlab/value-transfer-protocol-ts'

import { CashAcceptanceWitnessed, Giver, GiverReceipt, Request } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { OfferMessage } from '../messages'
import { ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferPartyStateService } from './ValueTransferPartyStateService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGiverService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private valueTransferCryptoService: ValueTransferCryptoService
  private valueTransferStateService: ValueTransferPartyStateService
  private eventEmitter: EventEmitter
  private giver: Giver

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferPartyStateService,
    valueTransferTransportService: ValueTransferTransportService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.valueTransferCryptoService = valueTransferCryptoService
    this.valueTransferStateService = valueTransferStateService
    this.eventEmitter = eventEmitter

    this.giver = new Giver(
      {
        crypto: valueTransferCryptoService,
        storage: valueTransferStateService,
        transport: valueTransferTransportService,
        logger: this.config.logger,
      },
      {
        witness: config.valueTransferWitnessDid,
        label: config.label,
      }
    )
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
    witness?: string
    unitOfAmount?: string
    usePublicDid?: boolean
    timeouts?: Timeouts
    attachment?: Record<string, unknown>
    transport?: Transports
  }): Promise<{
    record: ValueTransferRecord
    message: OfferMessage
  }> {
    const id = v4()

    this.config.logger.info(`> Giver: offer payment VTP transaction with ${id}`)

    // Get payment public DID from the storage or generate a new one if requested
    const giver = await this.valueTransferService.getTransactionDid(params.usePublicDid)

    const { error, transaction, message } = await this.giver.createOffer({
      giverId: giver.did,
      getterId: params.getter,
      witnessId: params.witness,
      send: false,
      ...params,
    })
    if (error || !transaction || !message) {
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request: ${error?.message}`)
    }

    const offerMessage = new OfferMessage(message)

    if (params.transport) {
      await this.valueTransferService.sendMessage(offerMessage, params.transport)
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

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
  }> {
    const { message: requestMessage } = messageContext

    this.config.logger.info(`> Giver: process payment request message for VTP transaction ${requestMessage.id}`)

    const request = new Request(requestMessage)
    const { error, transaction, message } = await this.giver.processRequest(request)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Giver: process request message for VTP transaction ${requestMessage.id} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Giver: process payment request message for VTP transaction ${requestMessage.id} completed!`
    )

    return { record }
  }

  /**
   * Accept received {@link RequestMessage} as Giver by sending a payment request acceptance message.
   *
   * @param record Value Transfer record containing Payment Request to accept.
   * @param timeouts (Optional) Giver timeouts to which value transfer must fit.
   *
   * @returns
   *    * Value Transfer record
   *    * Witnessed Request Acceptance Message
   */
  public async acceptRequest(
    record: ValueTransferRecord,
    timeouts?: Timeouts
  ): Promise<{
    record?: ValueTransferRecord
  }> {
    this.config.logger.info(
      `> Giver: accept payment request message for VTP transaction ${record.transaction.threadId}`
    )

    const { error, transaction, message } = await this.giver.acceptRequest(record.transaction.id, timeouts)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Giver: accept request message for VTP transaction ${record.transaction.threadId} failed. Error: ${error}`
      )
      return {}
    }

    const updatedRecord = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(`< Giver: accept payment request message for VTP transaction ${record.id} completed!`)

    return { record: updatedRecord }
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
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedWitnessedMessage } = messageContext

    this.config.logger.info(
      `> Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.thid}`
    )

    const cashAcceptanceWitnessed = new CashAcceptanceWitnessed(cashAcceptedWitnessedMessage)
    const { error, transaction, message } = await this.giver.processCashAcceptance(cashAcceptanceWitnessed)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.thid} completed!`
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
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: receiptMessage } = messageContext

    this.config.logger.info(`> Giver: process receipt message for VTP transaction ${receiptMessage.thid}`)

    const receipt = new GiverReceipt(receiptMessage)
    const { error, transaction, message } = await this.giver.processReceipt(receipt)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Giver: process receipt message for VTP transaction ${receiptMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(`< Giver: process receipt message for VTP transaction ${receiptMessage.thid} completed!`)

    return { record }
  }
}

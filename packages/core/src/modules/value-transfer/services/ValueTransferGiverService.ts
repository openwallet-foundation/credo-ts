import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { Transports } from '../../routing/types'
import type { CashAcceptedWitnessedMessage, RequestMessage, GiverReceiptMessage } from '../messages'
import type { ValueTransferRecord } from '../repository'
import type { Timeouts } from '@sicpa-dlab/value-transfer-protocol-ts'

import { CashAcceptanceWitnessed, Giver, GiverReceipt, Request } from '@sicpa-dlab/value-transfer-protocol-ts'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { OfferMessage } from '../messages'
import { ValueTransferRepository } from '../repository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferPartyStateService } from './ValueTransferPartyStateService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@injectable()
export class ValueTransferGiverService {
  private readonly logger: Logger
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
    this.logger = config.logger.createContextLogger('VTP-GiverService')
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
        logger: this.logger.createContextLogger('Giver'),
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
    this.logger.info(`> Giver: offer payment VTP transaction`)

    // Get party public DID from the storage if requested
    const giver = params.usePublicDid ? await this.valueTransferService.getPartyPublicDid() : undefined

    // Call VTP library to create offer
    const { error, transaction, message } = await this.giver.createOffer({
      giverId: giver?.did,
      getterId: params.getter,
      witnessId: params.witness,
      amount: params.amount,
      unitOfAmount: params.unitOfAmount,
      attachment: params.attachment,
      timeouts: params.timeouts,
      send: false,
    })
    if (error || !transaction || !message) {
      this.logger.error(`Failed to create Payment Offer`, { error })
      throw new AriesFrameworkError(`VTP: Failed to create Payment Request. Error: ${error?.message}`)
    }

    const offerMessage = new OfferMessage(message)

    // Send message if transport specified
    if (params.transport) {
      await this.valueTransferService.sendMessage(offerMessage, params.transport)
    }

    const record = await this.valueTransferService.getById(transaction.id)

    // Save second party Did
    record.secondPartyDid = offerMessage.to?.length ? offerMessage.to[0] : undefined
    await this.valueTransferRepository.update(record)

    // Raise event
    await this.valueTransferService.emitStateChangedEvent(record.id)

    this.logger.info(`< Giver: offer payment VTP transaction completed!`)

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
   */
  public async processPaymentRequest(messageContext: InboundMessageContext<RequestMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    const { message: requestMessage } = messageContext

    this.logger.info(`> Giver: process payment request message for VTP transaction ${requestMessage.id}`)

    // Call VTP library to handle request
    const { error, transaction } = await this.giver.processRequest(new Request(requestMessage))
    if (!transaction) {
      this.logger.error(` Giver: process request message for VTP transaction ${requestMessage.id} failed.`, { error })
      return {}
    }

    const record = await this.valueTransferService.getById(transaction.id)

    // Save second party Did
    record.secondPartyDid = requestMessage.from
    await this.valueTransferRepository.update(record)

    // Raise event
    await this.valueTransferService.emitStateChangedEvent(record.id)

    this.logger.info(`< Giver: process payment request message for VTP transaction ${requestMessage.id} completed!`)

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
   */
  public async acceptRequest(
    record: ValueTransferRecord,
    timeouts?: Timeouts
  ): Promise<{
    record?: ValueTransferRecord
  }> {
    this.logger.info(`> Giver: accept payment request message for VTP transaction ${record.transaction.id}`)

    // Call VTP library to accept request
    const { error, transaction } = await this.giver.acceptRequest(record.transaction.id, timeouts)
    if (!transaction) {
      this.logger.error(` Giver: accept request message for VTP transaction ${record.transaction.id} failed.`, {
        error,
      })
      return {}
    }

    // Raise event
    const updatedRecord = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(`< Giver: accept payment request message for VTP transaction ${record.transaction.id} completed!`)

    return { record: updatedRecord }
  }

  /**
   * Process a received {@link CashAcceptedWitnessedMessage}.
   *   Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   * @returns
   *    * Value Transfer record
   */
  public async processCashAcceptanceWitnessed(
    messageContext: InboundMessageContext<CashAcceptedWitnessedMessage>
  ): Promise<{
    record?: ValueTransferRecord
  }> {
    const { message: cashAcceptedWitnessedMessage } = messageContext

    this.logger.info(`> Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.id}`)

    // Call VTP library to handle cash acceptance
    const cashAcceptanceWitnessed = new CashAcceptanceWitnessed(cashAcceptedWitnessedMessage)
    const { error, transaction } = await this.giver.processCashAcceptance(cashAcceptanceWitnessed)
    if (!transaction) {
      this.logger.error(` Giver: process cash acceptance message ${cashAcceptedWitnessedMessage.id} failed.`, { error })
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Giver: process cash acceptance message for VTP transaction ${cashAcceptedWitnessedMessage.id} completed!`
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
   */
  public async processReceipt(messageContext: InboundMessageContext<GiverReceiptMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: receiptMessage } = messageContext

    this.logger.info(`> Giver: process receipt message for VTP transaction ${receiptMessage.id}`)

    // Call VTP library to handle receipt
    const receipt = new GiverReceipt(receiptMessage)
    const { error, transaction } = await this.giver.processReceipt(receipt)
    if (!transaction) {
      this.logger.error(` Giver: process receipt message ${receiptMessage.id} failed.`, { error })
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(`< Giver: process receipt message for VTP transaction ${receiptMessage.id} completed!`)

    return { record }
  }
}

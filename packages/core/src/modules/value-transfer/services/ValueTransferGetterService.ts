import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Transports } from '../../routing/types'
import type { OfferMessage, RequestAcceptedWitnessedMessage, GetterReceiptMessage } from '../messages'
import type { ValueTransferRecord } from '../repository'
import type { Timeouts } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Getter, GetterReceipt, Offer, RequestAcceptanceWitnessed } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { RequestMessage } from '../messages'
import { ValueTransferRepository } from '../repository'
import { ValueTransferStateRepository } from '../repository/ValueTransferStateRepository'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferPartyStateService } from './ValueTransferPartyStateService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferGetterService {
  private config: AgentConfig
  private valueTransferRepository: ValueTransferRepository
  private valueTransferService: ValueTransferService
  private eventEmitter: EventEmitter
  private getter: Getter

  public constructor(
    config: AgentConfig,
    valueTransferRepository: ValueTransferRepository,
    valueTransferStateRepository: ValueTransferStateRepository,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferStateService: ValueTransferPartyStateService,
    valueTransferTransportService: ValueTransferTransportService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferRepository = valueTransferRepository
    this.valueTransferService = valueTransferService
    this.eventEmitter = eventEmitter

    this.getter = new Getter(
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
   * Initiate a new value transfer exchange as Getter by sending a payment request message
   * to the known Witness which transfers record later to Giver.
   *
   * @param params Options to use for request creation -
   * {
   *  amount - Amount to pay
   *  witness - DID of witness validating and signing transaction
   *  unitOfAmount - (Optional) Currency code that represents the unit of account
   *  witness - DID of witness validating and signing transaction
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
    attachment?: Record<string, unknown>
    transport?: Transports
  }): Promise<{
    record: ValueTransferRecord
    message: RequestMessage
  }> {
    const id = v4()
    this.config.logger.info(`> Getter: request payment VTP transaction with ${id}`)

    // Get payment public DID from the storage or generate a new one if requested
    const getter = await this.valueTransferService.getTransactionDid(params.usePublicDid)

    // Call VTP package to create payment request
    const { error, transaction, message } = await this.getter.createRequest({
      getterId: getter.did,
      giverId: params.giver,
      witnessId: params.witness,
      send: false,
      ...params,
    })
    if (error || !transaction || !message) {
      this.config.logger.error(`Failed to create Payment Request: ${error?.message}`)
      throw new AriesFrameworkError(`Failed to create Payment Request: ${error?.message}`)
    }

    const requestMessage = new RequestMessage(message)

    if (params.transport) {
      await this.valueTransferService.sendMessage(requestMessage, params.transport)
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(`< Getter: request payment VTP transaction with ${id} completed`)

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
  }> {
    const { message: offerMessage } = messageContext

    this.config.logger.info(`> Getter: process offer message for VTP transaction ${offerMessage.id}`)

    const offer = new Offer(offerMessage)
    const { error, transaction, message } = await this.getter.processOffer(offer)
    if (error || !transaction || !message) {
      this.config.logger.error(
        ` Getter: process offer message for VTP transaction ${offerMessage.id} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(`< Getter: process offer message for VTP transaction ${offerMessage.thid} completed!`)
    return { record }
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
  }> {
    this.config.logger.info(`> Getter: accept offer message for VTP transaction ${record.id}`)

    const { error, transaction, message } = await this.getter.acceptOffer(record.transaction.id, witnessDid, timeouts)
    if (error || !transaction || !message) {
      this.config.logger.error(`VTP: Failed to accept Payment Offer: ${error?.message}`)
      return { record }
    }

    const updatedRecord = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(`> Getter: accept offer message for VTP transaction ${record.id} completed!`)
    return { record: updatedRecord }
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
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptedWitnessedMessage } = messageContext

    this.config.logger.info(
      `> Getter: process request acceptance message for VTP transaction ${requestAcceptedWitnessedMessage.thid}`
    )

    const requestAcceptanceWitnessed = new RequestAcceptanceWitnessed(requestAcceptedWitnessedMessage)
    const { error, transaction, message } = await this.getter.acceptCash(requestAcceptanceWitnessed)
    if (error || !transaction || !message) {
      this.config.logger.error(`VTP: Failed to process Request Acceptance: ${error?.message}`)
      return {}
    }

    const updatedRecord = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Getter: process request acceptance message for VTP transaction ${requestAcceptedWitnessedMessage.thid}`
    )
    return { record: updatedRecord }
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
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: getterReceiptMessage } = messageContext

    this.config.logger.info(`> Getter: process receipt message for VTP transaction ${getterReceiptMessage.thid}`)

    const receipt = new GetterReceipt(getterReceiptMessage)
    const { error, transaction, message } = await this.getter.processReceipt(receipt)
    if (error || !transaction || !message) {
      this.config.logger.error(`VTP: Failed to process Receipt: ${error?.message}`)
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Getter: process receipt message for VTP transaction ${getterReceiptMessage.thid} completed!`
    )
    return { record }
  }
}

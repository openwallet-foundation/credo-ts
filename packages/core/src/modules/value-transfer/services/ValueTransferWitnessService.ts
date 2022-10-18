import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type { CashAcceptedMessage, CashRemovedMessage, RequestAcceptedMessage } from '../messages'
import type { MintMessage } from '../messages/MintMessage'
import type { ValueTransferRecord } from '../repository'

import { Witness, RequestAcceptance, CashRemoval, CashAcceptance, Mint } from '@sicpa-dlab/value-transfer-protocol-ts'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { GossipService } from '../../gossip/service/GossipService'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { MintResponseMessage } from '../messages/MintResponseMessage'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'
import { ValueTransferWitnessStateService } from './ValueTransferWitnessStateService'

@injectable()
export class ValueTransferWitnessService {
  private readonly logger: Logger
  private readonly label: string
  private valueTransferService: ValueTransferService
  private eventEmitter: EventEmitter
  private witness: Witness
  private gossipService: GossipService

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferWitnessStateService: ValueTransferWitnessStateService,
    valueTransferTransportService: ValueTransferTransportService,
    gossipService: GossipService,
    eventEmitter: EventEmitter
  ) {
    this.logger = config.logger.createContextLogger('VTP-WitnessService')
    this.label = config.label
    this.valueTransferService = valueTransferService
    this.eventEmitter = eventEmitter
    this.gossipService = gossipService

    this.eventEmitter.on(
      ValueTransferEventTypes.ResumeTransaction,
      async (event: ResumeValueTransferTransactionEvent) => {
        await this.resumeTransaction(event.payload.thid)
      }
    )

    this.witness = new Witness(
      {
        crypto: valueTransferCryptoService,
        storage: valueTransferWitnessStateService,
        transport: valueTransferTransportService,
        logger: this.logger.createContextLogger('Witness'),
        gossip: gossipService,
      },
      {
        label: config.label,
        issuers: config.witnessIssuerDids,
      }
    )
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
   */
  public async processRequestAcceptance(messageContext: InboundMessageContext<RequestAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    const { message: requestAcceptanceMessage } = messageContext

    this.logger.info(
      `> Witness ${this.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid}`
    )

    // Call VTP library to handle request acceptance
    const requestAcceptance = new RequestAcceptance(requestAcceptanceMessage)
    const { error, transaction } = await this.witness.processRequestAcceptance(requestAcceptance)
    if (error || !transaction) {
      throw new AriesFrameworkError(`Failed to create Payment Request: ${error?.message}`)
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid} completed!`
    )

    return { record }
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
   */
  public async processCashAcceptance(messageContext: InboundMessageContext<CashAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    const { message: cashAcceptedMessage } = messageContext

    this.logger.info(
      `> Witness ${this.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid}`
    )

    // Call VTP library to handle cash acceptance
    const cashAcceptance = new CashAcceptance(cashAcceptedMessage)
    const { error, transaction } = await this.witness.processCashAcceptance(cashAcceptance)
    if (error || !transaction) {
      this.logger.error(
        ` Giver: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    // Rasie event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} completed!`
    )

    return { record }
  }

  /**
   * Process a received {@link CashRemovedMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.
   *
   * @returns
   *    * Value Transfer record
   */
  public async processCashRemoval(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    const { message: cashRemovedMessage } = messageContext

    this.logger.info(
      `> Witness ${this.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid}`
    )

    // Call VTP library to handle cash removal and create receipt
    const cashRemoval = new CashRemoval(cashRemovedMessage)

    const operation = async () => {
      return this.witness.createReceipt(cashRemoval)
    }
    const { error, transaction } = await this.gossipService.doSafeOperationWithWitnessSate(operation)
    if (error || !transaction) {
      this.logger.error(
        ` Giver: process cash removal message for VTP transaction ${cashRemovedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid} completed!`
    )

    return { record }
  }

  /**
   * Process a received {@link MintMessage}.
   *    Verify correctness of message
   *    Update Value Transfer record with the information from the message.
   *
   * @param messageContext The record context containing the message.@returns
   *    * Value Transfer record
   */
  public async processCashMint(messageContext: InboundMessageContext<MintMessage>): Promise<{
    message?: MintResponseMessage
  }> {
    this.logger.info(`> Witness ${this.label}: process cash mint request from '${messageContext.message.from}'`)

    const { message: mintMessage } = messageContext

    // Call VTP library to handle cash mint
    const mint = new Mint(mintMessage)
    const operation = async () => {
      return await this.witness.processCashMint(mint)
    }
    const { error, message } = await this.gossipService.doSafeOperationWithWitnessSate(operation)
    if (error || !message) {
      this.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      return {}
    }

    const mintResponseMessage = new MintResponseMessage(message)

    this.logger.info(
      `< Witness ${this.label}: process cash mint request from '${messageContext.message.from}' completed!`
    )

    return { message: mintResponseMessage }
  }

  /**
   * Resume processing of VTP transaction
   * */
  public async resumeTransaction(id: string): Promise<void> {
    this.logger.info(`> Witness ${this.label}: resume transaction '${id}'`)

    // Call VTP library to resume transaction
    await this.witness.resumeTransaction(id)

    this.logger.info(`< Witness ${this.label}: transaction resumed ${id}`)
  }
}

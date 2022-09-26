import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type { CashAcceptedMessage, CashRemovedMessage, RequestAcceptedMessage } from '../messages'
import type { MintMessage } from '../messages/MintMessage'
import type { ValueTransferRecord } from '../repository'

import { Witness, RequestAcceptance, CashRemoval, CashAcceptance } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { GossipService } from '../../gossip/service'
import { ValueTransferEventTypes } from '../ValueTransferEvents'
import { MintResponseMessage } from '../messages/MintResponseMessage'

import { ValueTransferCryptoService } from './ValueTransferCryptoService'
import { ValueTransferService } from './ValueTransferService'
import { ValueTransferTransportService } from './ValueTransferTransportService'
import { ValueTransferWitnessStateService } from './ValueTransferWitnessStateService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferWitnessService {
  private config: AgentConfig
  private valueTransferService: ValueTransferService
  private eventEmitter: EventEmitter
  private witness: Witness

  public constructor(
    config: AgentConfig,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferWitnessStateService: ValueTransferWitnessStateService,
    valueTransferTransportService: ValueTransferTransportService,
    gossipService: GossipService,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.valueTransferService = valueTransferService
    this.eventEmitter = eventEmitter

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
        logger: config.logger,
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
   *    * Witnessed Request Acceptance message
   */
  public async processRequestAcceptance(messageContext: InboundMessageContext<RequestAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: requestAcceptanceMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid}`
    )

    const requestAcceptance = new RequestAcceptance(requestAcceptanceMessage)
    const { error, transaction } = await this.witness.processRequestAcceptance(requestAcceptance)
    if (error || !transaction) {
      throw new AriesFrameworkError(`Failed to create Payment Request: ${error?.message}`)
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.thid} completed!`
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
   *    * Witnessed Cash Acceptance message
   */
  public async processCashAcceptance(messageContext: InboundMessageContext<CashAcceptedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashAcceptedMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid}`
    )

    const cashAcceptance = new CashAcceptance(cashAcceptedMessage)
    const { error, transaction } = await this.witness.processCashAcceptance(cashAcceptance)
    if (error || !transaction) {
      this.config.logger.error(
        ` Giver: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.thid} completed!`
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
   *    * Witnessed Cash Removal message
   */
  public async processCashRemoval(messageContext: InboundMessageContext<CashRemovedMessage>): Promise<{
    record?: ValueTransferRecord
  }> {
    // Verify that we are in appropriate state to perform action
    const { message: cashRemovedMessage } = messageContext

    this.config.logger.info(
      `> Witness ${this.config.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid}`
    )

    const cashRemoval = new CashRemoval(cashRemovedMessage)
    const { error, transaction } = await this.witness.createReceipt(cashRemoval)
    if (error || !transaction) {
      this.config.logger.error(
        ` Giver: process cash removal message for VTP transaction ${cashRemovedMessage.thid} failed. Error: ${error}`
      )
      return {}
    }

    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash removal message for VTP transaction ${cashRemovedMessage.thid} completed!`
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
   *    * Witnessed Cash Removal message
   */
  public async processCashMint(messageContext: InboundMessageContext<MintMessage>): Promise<{
    message?: MintResponseMessage
  }> {
    this.config.logger.info(
      `> Witness ${this.config.label}: process cash mint request from '${messageContext.message.from}'`
    )

    const { message: mintMessage } = messageContext

    const { error, message } = await this.witness.processCashMint(mintMessage)
    if (error || !message) {
      this.config.logger.error(`  Issuer: Failed to mint cash: ${error?.message}`)
      return {}
    }

    const mintResponseMessage = new MintResponseMessage(message)

    this.config.logger.info(
      `< Witness ${this.config.label}: process cash mint request from '${messageContext.message.from}' completed!`
    )

    return { message: mintResponseMessage }
  }

  /**
   * Resume processing of VTP transaction
   * */
  public async resumeTransaction(id: string): Promise<void> {
    this.config.logger.info(`> Witness ${this.config.label}: resume transaction '${id}'`)

    await this.witness.resumeTransaction(id)

    this.config.logger.info(`< Witness ${this.config.label}: transaction resumed ${id}`)
  }
}

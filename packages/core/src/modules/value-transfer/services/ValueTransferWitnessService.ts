import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ResumeValueTransferTransactionEvent } from '../ValueTransferEvents'
import type { CashAcceptedMessage, CashRemovedMessage, RequestAcceptedMessage } from '../messages'
import type { MintMessage } from '../messages/MintMessage'
import type { ValueTransferRecord } from '../repository'

import { Witness, RequestAcceptance, CashRemoval, CashAcceptance, Mint } from '@sicpa-dlab/value-transfer-protocol-ts'
import { GossipInterface } from '@sicpa-dlab/witness-gossip-types-ts'
import { container, delay } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { injectable, inject, DependencyManager } from '../../../plugins'
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

  public constructor(
    config: AgentConfig,
    dependencyManager: DependencyManager,
    valueTransferService: ValueTransferService,
    valueTransferCryptoService: ValueTransferCryptoService,
    valueTransferWitnessStateService: ValueTransferWitnessStateService,
    valueTransferTransportService: ValueTransferTransportService,
    eventEmitter: EventEmitter
  ) {
    this.logger = config.logger.createContextLogger('VTP-WitnessService')
    this.label = config.label
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
        logger: this.logger.createContextLogger('Witness'),
        gossipProvider: () => dependencyManager.resolve(InjectionSymbols.GossipService),
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
      `> Witness ${this.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.id}`
    )

    // Call VTP library to handle request acceptance
    const requestAcceptance = new RequestAcceptance(requestAcceptanceMessage)
    const { error, transaction } = await this.witness.processRequestAcceptance(requestAcceptance)
    if (!transaction) {
      this.logger.error(` Witness: process request acceptance message ${requestAcceptanceMessage.id} failed.`, {
        error,
      })
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process request acceptance message for VTP transaction ${requestAcceptanceMessage.id} completed!`
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
      `> Witness ${this.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.id}`
    )

    // Call VTP library to handle cash acceptance
    const cashAcceptance = new CashAcceptance(cashAcceptedMessage)
    const { error, transaction } = await this.witness.processCashAcceptance(cashAcceptance)
    if (!transaction) {
      this.logger.error(` Witness: process cash acceptance message ${cashAcceptedMessage.id} failed.`, { error })
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process cash acceptance message for VTP transaction ${cashAcceptedMessage.id} completed!`
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
      `> Witness ${this.label}: process cash removal message for VTP transaction ${cashRemovedMessage.id}`
    )

    // Call VTP library to handle cash removal and create receipt
    const cashRemoval = new CashRemoval(cashRemovedMessage)

    // FIXME: We need to have a lock on Witness state here
    const { error, transaction } = await this.witness.createReceipt(cashRemoval)

    if (!transaction) {
      this.logger.error(` Witness: process cash removal message ${cashRemovedMessage.id} failed.`, { error })
      return {}
    }

    // Raise event
    const record = await this.valueTransferService.emitStateChangedEvent(transaction.id)

    this.logger.info(
      `< Witness ${this.label}: process cash removal message for VTP transaction ${cashRemovedMessage.id} completed!`
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

    // FIXME: We need to have a lock on Witness state here
    const { error, message } = await this.witness.processCashMint(mint)

    if (error || !message) {
      this.logger.error(`Issuer: processCashMint failed`, { error })
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

import type { RequestMessage, ProblemReportMessage, RequestAcceptedMessage } from './messages'
import type { ValueTransferTags, ValueTransferRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundDIDCommV2Message } from '../../agent/helpers'
import { ConnectionService } from '../connections'
import { DidResolverService } from '../dids'

import { ValueTransferResponseCoordinator } from './ValueTransferResponseCoordinator'
import { RequestHandler } from './handlers'
import { CashAcceptedHandler } from './handlers/CashAcceptedHandler'
import { CashAcceptedWitnessedHandler } from './handlers/CashAcceptedWitnessedHandler'
import { CashRemovedHandler } from './handlers/CashRemovedHandler'
import { GetterReceiptHandler } from './handlers/GetterReceiptHandler'
import { GiverReceiptHandler } from './handlers/GiverReceiptHandler'
import { ProblemReportHandler } from './handlers/ProblemReportHandler'
import { RequestAcceptedHandler } from './handlers/RequestAcceptedHandler'
import { RequestAcceptedWitnessedHandler } from './handlers/RequestAcceptedWitnessedHandler'
import { RequestWitnessedHandler } from './handlers/RequestWitnessedHandler'
import { ValueTransferService } from './services'
import { ValueTransferGetterService } from './services/ValueTransferGetterService'
import { ValueTransferGiverService } from './services/ValueTransferGiverService'
import { ValueTransferWitnessService } from './services/ValueTransferWitnessService'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferModule {
  private config: AgentConfig
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private resolverService: DidResolverService
  private valueTransferService: ValueTransferService
  private valueTransferGetterService: ValueTransferGetterService
  private valueTransferGiverService: ValueTransferGiverService
  private valueTransferWitnessService: ValueTransferWitnessService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public constructor(
    dispatcher: Dispatcher,
    config: AgentConfig,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    resolverService: DidResolverService,
    valueTransferService: ValueTransferService,
    valueTransferGetterService: ValueTransferGetterService,
    valueTransferGiverService: ValueTransferGiverService,
    valueTransferWitnessService: ValueTransferWitnessService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.config = config
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.resolverService = resolverService
    this.valueTransferService = valueTransferService
    this.valueTransferGetterService = valueTransferGetterService
    this.valueTransferGiverService = valueTransferGiverService
    this.valueTransferWitnessService = valueTransferWitnessService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.registerHandlers(dispatcher)
  }

  /**
   * Initiate a new value transfer exchange as Getter by sending a Payment Request message
   * to the Witness which transfers record later to the known Giver.
   *
   * @param amount Amount to pay
   * @param giver DID of Giver. Must be known in advance.
   * @param witness (Optional) DID of Witness. Must be omitted and set by Witness later.
   * @param usePublicDid (Optional) Whether to use public DID of Getter in the request or create a new random one (True by default)
   *
   * @returns Value Transfer record and Payment Request Message
   */
  public async requestPayment(
    amount: number,
    witness?: string,
    giver?: string,
    usePublicDid = true
  ): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Create Payment Request and Value Transfer record
    const { message, record } = await this.valueTransferGetterService.createRequest(
      amount,
      witness,
      giver,
      usePublicDid
    )

    // Send Payment Request to Witness
    const outboundMessage = createOutboundDIDCommV2Message(message)
    await this.messageSender.sendDIDCommV2Message(outboundMessage)
    return { message, record }
  }

  /**
   * Accept received Payment Request as Giver.
   *
   * @param recordId Id of Value Transfer record
   *
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptPaymentRequest(recordId: string): Promise<{
    record: ValueTransferRecord
    message: RequestAcceptedMessage | ProblemReportMessage
  }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(recordId)

    // Accept Payment Request
    const { message, record: updatedRecord } = await this.valueTransferGiverService.acceptRequest(record)

    // Send Payment Request Acceptance to Witness
    const outboundMessage = createOutboundDIDCommV2Message(message)
    const transport = this.config.valueTransferConfig?.witnessTransport
    await this.messageSender.sendDIDCommV2Message(outboundMessage, transport)

    return { record: updatedRecord, message }
  }

  /**
   * Wait until Value Transfer exchange complete.
   *
   * @param recordId Id of Value Transfer record
   *
   * @returns Value Transfer record
   */
  public async returnWhenIsCompleted(recordId: string, options?: { timeoutMs: number }): Promise<ValueTransferRecord> {
    return this.valueTransferService.returnWhenIsCompleted(recordId, options?.timeoutMs)
  }

  /**
   * Get current wallet balance.
   *
   * @returns wallet balance
   */
  public async getBalance(): Promise<number> {
    return this.valueTransferService.getBalance()
  }

  public async getById(recordId: string): Promise<ValueTransferRecord> {
    return this.valueTransferService.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferService.findAllByQuery(query)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerDIDCommV2Handler(
      new RequestHandler(this.config, this.valueTransferService, this.valueTransferWitnessService)
    )
    dispatcher.registerDIDCommV2Handler(
      new RequestWitnessedHandler(
        this.config,
        this.valueTransferService,
        this.valueTransferGiverService,
        this.valueTransferResponseCoordinator
      )
    )
    dispatcher.registerDIDCommV2Handler(
      new RequestAcceptedHandler(this.config, this.valueTransferService, this.valueTransferWitnessService)
    )
    dispatcher.registerDIDCommV2Handler(
      new RequestAcceptedWitnessedHandler(this.config, this.valueTransferService, this.valueTransferGetterService)
    )
    dispatcher.registerDIDCommV2Handler(
      new CashAcceptedHandler(this.config, this.valueTransferService, this.valueTransferWitnessService)
    )
    dispatcher.registerDIDCommV2Handler(
      new CashAcceptedWitnessedHandler(this.config, this.valueTransferService, this.valueTransferGiverService)
    )
    dispatcher.registerDIDCommV2Handler(
      new CashRemovedHandler(this.config, this.valueTransferService, this.valueTransferWitnessService)
    )
    dispatcher.registerDIDCommV2Handler(new GetterReceiptHandler(this.valueTransferGetterService))
    dispatcher.registerDIDCommV2Handler(new GiverReceiptHandler(this.valueTransferGiverService))
    dispatcher.registerDIDCommV2Handler(new ProblemReportHandler(this.valueTransferService))
  }
}

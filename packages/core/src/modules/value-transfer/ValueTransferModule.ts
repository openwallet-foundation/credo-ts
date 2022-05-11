import type { ValueTransferConfig } from '../../types'
import type { RequestAcceptedMessage, RequestMessage } from './messages'
import type { ValueTransferTags, ValueTransferRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { AriesFrameworkError } from '../../error'
import { ConnectionService } from '../connections'
import { DidResolverService } from '../dids'

import { ValueTransferResponseCoordinator } from './ValueTransferResponseCoordinator'
import { RequestHandler } from './handlers'
import { CashAcceptedHandler } from './handlers/CashAcceptedHandler'
import { CashRemovedHandler } from './handlers/CashRemovedHandler'
import { ReceiptHandler } from './handlers/ReceiptHandler'
import { RejectHandler } from './handlers/RejectHandler'
import { RequestAcceptedHandler } from './handlers/RequestAcceptedHandler'
import { ValueTransferService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferModule {
  private config: AgentConfig
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private resolverService: DidResolverService
  private valueTransferService: ValueTransferService
  private valueTransferResponseCoordinator: ValueTransferResponseCoordinator

  public constructor(
    dispatcher: Dispatcher,
    config: AgentConfig,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    resolverService: DidResolverService,
    valueTransferService: ValueTransferService,
    valueTransferResponseCoordinator: ValueTransferResponseCoordinator
  ) {
    this.config = config
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.resolverService = resolverService
    this.valueTransferService = valueTransferService
    this.valueTransferResponseCoordinator = valueTransferResponseCoordinator
    this.registerHandlers(dispatcher)
  }

  /**
   * Initiate a new value transfer exchange as Getter by sending a payment request message
   * to the known Witness which transfers record later to Giver.
   *
   * @param connectionId Id of Connection to Witness
   * @param amount Amount to pay
   * @param giver DID of giver
   * @param witness DID of witness
   * @param usePublicDid Whether to use public DID on a new one
   * @returns Value Transfer record and Payment Request Message
   */
  public async requestPayment(
    connectionId: string,
    amount: number,
    giver: string,
    witness?: string,
    usePublicDid?: boolean
  ): Promise<{ record: ValueTransferRecord; message: RequestMessage }> {
    // Get witness connection record
    const witnessConnection = await this.connectionService.findById(connectionId)
    if (!witnessConnection) {
      throw new AriesFrameworkError(`Connection not found for ID: ${connectionId}`)
    }

    // Create Payment Request and Value Transfer record
    const { message, record } = await this.valueTransferService.createRequest(
      witnessConnection,
      amount,
      giver,
      witness,
      usePublicDid
    )

    // Send Payment Request to Witness
    const outboundMessage = createOutboundMessage(witnessConnection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return { message, record }
  }

  /**
   * Accept Payment Request as Getter.
   *
   * @param recordId Id of Value Transfer record
   * @returns Value Transfer record and Payment Request Acceptance Message
   */
  public async acceptPaymentRequest(
    recordId: string
  ): Promise<{ record: ValueTransferRecord; message: RequestAcceptedMessage }> {
    // Get Value Transfer record
    const record = await this.valueTransferService.getById(recordId)

    // Get witness connection record
    if (!record.witnessConnectionId) {
      throw new AriesFrameworkError(`Connection not found for ID: ${record.witnessConnectionId}`)
    }
    const witnessConnection = await this.connectionService.findById(record?.witnessConnectionId)
    if (!witnessConnection || !witnessConnection.theirDid) {
      throw new AriesFrameworkError(`Connection not found for ID: ${record.witnessConnectionId}`)
    }

    // Accept Payment Request
    const { message, record: updatedRecord } = await this.valueTransferService.acceptRequest(witnessConnection, record)
    if (!record.witnessConnectionId) {
      throw new AriesFrameworkError(`No witness connectionId found for proof record '${record.id}'.`)
    }

    // Send Payment Request Acceptance to Witness
    const outboundMessage = createOutboundMessage(witnessConnection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return { message, record: updatedRecord }
  }

  public async returnWhenIsCompleted(recordId: string, options?: { timeoutMs: number }): Promise<ValueTransferRecord> {
    return this.valueTransferService.returnWhenIsCompleted(recordId, options?.timeoutMs)
  }

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
      new RequestHandler(
        this.config,
        this.valueTransferService,
        this.valueTransferResponseCoordinator,
        this.connectionService
      )
    )
    dispatcher.registerDIDCommV2Handler(
      new RequestAcceptedHandler(
        this.config,
        this.valueTransferService,
        this.valueTransferResponseCoordinator,
        this.connectionService
      )
    )
    dispatcher.registerDIDCommV2Handler(
      new CashAcceptedHandler(
        this.config,
        this.valueTransferService,
        this.valueTransferResponseCoordinator,
        this.connectionService
      )
    )
    dispatcher.registerDIDCommV2Handler(
      new CashRemovedHandler(
        this.config,
        this.valueTransferService,
        this.valueTransferResponseCoordinator,
        this.connectionService,
        this.messageSender
      )
    )
    dispatcher.registerDIDCommV2Handler(new ReceiptHandler(this.valueTransferService))
    dispatcher.registerDIDCommV2Handler(new RejectHandler(this.valueTransferService))
  }
}

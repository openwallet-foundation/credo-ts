import type { ValueTransferRecord, ValueTransferTags } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections'
import { DidResolverService } from '../dids'

import { ValueTransferService } from './services'
import { RequestHandler } from './handlers'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferModule {
  private valueTransferService: ValueTransferService
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private resolverService: DidResolverService

  public constructor(
    dispatcher: Dispatcher,
    valueTransferService: ValueTransferService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    resolverService: DidResolverService
  ) {
    this.valueTransferService = valueTransferService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.resolverService = resolverService
    this.registerHandlers(dispatcher)
  }

  public async requestPayment(connectionId: string, amount: number, giver?: string, witness?: string) {
    const connection = await this.connectionService.getById(connectionId)

    const requestMessage = await this.valueTransferService.createRequest(connection, amount, giver, witness)
    const outboundMessage = createOutboundMessage(connection, requestMessage)
    await this.messageSender.sendMessage(outboundMessage)
  }

  public async acceptPaymentRequest(recordId: string): Promise<ValueTransferRecord> {
    return await this.valueTransferService.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ValueTransferTags>) {
    return this.valueTransferService.findAllByQuery(query)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new RequestHandler(this.valueTransferService))
  }
}

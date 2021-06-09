import type { Dispatcher } from '../../agent/Dispatcher'
import type { MessageSender } from '../../agent/MessageSender'
import type { ConnectionRecord } from '../connections'
import type { BasicMessageService } from './services'
import type { WalletQuery } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { BasicMessageHandler } from './handlers'

@scoped(Lifecycle.ContainerScoped)
export class BasicMessagesModule {
  private basicMessageService: BasicMessageService
  private messageSender: MessageSender

  public constructor(dispatcher: Dispatcher, basicMessageService: BasicMessageService, messageSender: MessageSender) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  public async sendMessage(connection: ConnectionRecord, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection)
    await this.messageSender.sendMessage(outboundMessage)
  }

  public async findAllByQuery(query: WalletQuery) {
    return this.basicMessageService.findAllByQuery(query)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService))
  }
}

import type { ConnectionRecord } from '../connections'
import type { BasicMessageTags } from './repository/BasicMessageRecord'

import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'

import { BasicMessageHandler } from './handlers'
import { BasicMessageService } from './services'

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

  public async findAllByQuery(query: Partial<BasicMessageTags>) {
    return this.basicMessageService.findAllByQuery(query)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService))
  }
}

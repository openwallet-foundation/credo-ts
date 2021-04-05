import type { WalletQuery } from 'indy-sdk'
import { EventEmitter } from 'events'
import { BasicMessageService } from './services'
import { MessageSender } from '../../agent/MessageSender'
import { ConnectionRecord } from '../connections'
import { Dispatcher } from '../../agent/Dispatcher'
import { BasicMessageHandler } from './handlers'

export class BasicMessagesModule {
  private basicMessageService: BasicMessageService
  private messageSender: MessageSender

  public constructor(dispatcher: Dispatcher, basicMessageService: BasicMessageService, messageSender: MessageSender) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the basic message service. Will emit message received events
   * when basic messages are received.
   *
   * @returns event emitter for basic message related events
   */
  public get events(): EventEmitter {
    return this.basicMessageService
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

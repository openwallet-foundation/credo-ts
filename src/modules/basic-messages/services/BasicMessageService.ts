import type { Verkey, WalletQuery } from 'indy-sdk'
import { EventEmitter } from 'events'
import { OutboundMessage } from '../../../types'
import { createOutboundMessage } from '../../../agent/helpers'
import { Repository } from '../../../storage/Repository'
import { BasicMessageRecord } from '../repository/BasicMessageRecord'
import { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { BasicMessage } from '../messages'

export enum BasicMessageEventType {
  MessageReceived = 'messageReceived',
}

export interface BasicMessageReceivedEvent {
  message: BasicMessage
  verkey: Verkey
}

export class BasicMessageService extends EventEmitter {
  private basicMessageRepository: Repository<BasicMessageRecord>

  public constructor(basicMessageRepository: Repository<BasicMessageRecord>) {
    super()
    this.basicMessageRepository = basicMessageRepository
  }

  public async send(message: string, connection: ConnectionRecord): Promise<OutboundMessage<BasicMessage>> {
    const basicMessage = new BasicMessage({
      content: message,
    })

    const basicMessageRecord = new BasicMessageRecord({
      id: basicMessage.id,
      sentTime: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      tags: { from: connection.did || '', to: connection.theirDid || '' },
    })

    await this.basicMessageRepository.save(basicMessageRecord)
    return createOutboundMessage(connection, basicMessage)
  }

  /**
   * @todo use connection from message context
   */
  public async save({ message }: InboundMessageContext<BasicMessage>, connection: ConnectionRecord) {
    const basicMessageRecord = new BasicMessageRecord({
      id: message.id,
      sentTime: message.sentTime.toISOString(),
      content: message.content,
      tags: { from: connection.theirDid || '', to: connection.did || '' },
    })

    await this.basicMessageRepository.save(basicMessageRecord)
    const event: BasicMessageReceivedEvent = {
      message,
      verkey: connection.verkey,
    }
    this.emit(BasicMessageEventType.MessageReceived, event)
  }

  public async findAllByQuery(query: WalletQuery) {
    return this.basicMessageRepository.findByQuery(query)
  }
}

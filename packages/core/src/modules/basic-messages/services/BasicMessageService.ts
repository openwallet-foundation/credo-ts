import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { BasicMessageStateChangedEvent } from '../BasicMessageEvents'
import type { BasicMessageTags } from '../repository'

import { EventEmitter } from '../../../agent/EventEmitter'
import { injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils'
import { BasicMessageEventTypes } from '../BasicMessageEvents'
import { BasicMessageRole } from '../BasicMessageRole'
import { BasicMessage } from '../messages'
import { BasicMessageRecord, BasicMessageRepository } from '../repository'

@injectable()
export class BasicMessageService {
  private basicMessageRepository: BasicMessageRepository
  private eventEmitter: EventEmitter

  public constructor(basicMessageRepository: BasicMessageRepository, eventEmitter: EventEmitter) {
    this.basicMessageRepository = basicMessageRepository
    this.eventEmitter = eventEmitter
  }

  public async createMessage(message: string, connectionRecord: ConnectionRecord) {
    connectionRecord.assertReady()
    const basicMessage = new BasicMessage({ content: message })

    const basicMessageRecord = new BasicMessageRecord({
      sentTime: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      connectionId: connectionRecord.id,
      role: BasicMessageRole.Sender,
    })

    await this.basicMessageRepository.save(basicMessageRecord)
    this.emitStateChangedEvent(basicMessageRecord, basicMessage)

    return basicMessage
  }

  /**
   * @todo use connection from message context
   */
  public async save({ message }: InboundMessageContext<BasicMessage>, connection: ConnectionRecord) {
    const basicMessageRecord = new BasicMessageRecord({
      sentTime: message.sentTime.toISOString(),
      content: message.content,
      connectionId: connection.id,
      role: BasicMessageRole.Receiver,
    })

    await this.basicMessageRepository.save(basicMessageRecord)
    this.emitStateChangedEvent(basicMessageRecord, message)
  }

  private emitStateChangedEvent(basicMessageRecord: BasicMessageRecord, basicMessage: BasicMessage) {
    const clonedBasicMessageRecord = JsonTransformer.clone(basicMessageRecord)
    this.eventEmitter.emit<BasicMessageStateChangedEvent>({
      type: BasicMessageEventTypes.BasicMessageStateChanged,
      payload: { message: basicMessage, basicMessageRecord: clonedBasicMessageRecord },
    })
  }

  public async findAllByQuery(query: Partial<BasicMessageTags>) {
    return this.basicMessageRepository.findByQuery(query)
  }
}

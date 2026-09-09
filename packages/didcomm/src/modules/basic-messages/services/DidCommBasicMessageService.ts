import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable } from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../DidCommMessageHandlerRegistry'
import type { DidCommInboundMessageContext } from '../../../models'
import { DidCommProtocol } from '../../../models'
import type { DidCommConnectionRecord } from '../../connections'
import type { DidCommBasicMessageStateChangedEvent } from '../DidCommBasicMessageEvents'
import { DidCommBasicMessageEventTypes } from '../DidCommBasicMessageEvents'
import { DidCommBasicMessageRole } from '../DidCommBasicMessageRole'
import { DidCommBasicMessage } from '../protocol/v1'
import { DidCommBasicMessageHandler } from '../protocol/v1/handlers'
import { DidCommBasicMessageRecord, DidCommBasicMessageRepository } from '../repository'
import { DidCommBaseBasicMessageService } from './DidCommBaseBasicMessageService'

@injectable()
export class DidCommBasicMessageService extends DidCommBaseBasicMessageService {
  public readonly version = 'v1'

  // biome-ignore lint/complexity/noUselessConstructor: tsyringe needs an own constructor for design:paramtypes
  public constructor(basicMessageRepository: DidCommBasicMessageRepository, eventEmitter: EventEmitter) {
    super(basicMessageRepository, eventEmitter)
  }

  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DidCommBasicMessageHandler(this))
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/basicmessage/1.0',
        roles: [DidCommBasicMessageRole.Sender, DidCommBasicMessageRole.Receiver],
      })
    )
  }

  public async createMessage(
    agentContext: AgentContext,
    message: string,
    connectionRecord: DidCommConnectionRecord,
    parentThreadId?: string
  ) {
    const basicMessage = new DidCommBasicMessage({ content: message })

    // If no parentThreadid is defined, there is no need to explicitly send a thread decorator
    if (parentThreadId) {
      basicMessage.setThread({ parentThreadId })
    }

    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      connectionId: connectionRecord.id,
      role: DidCommBasicMessageRole.Sender,
      threadId: basicMessage.threadId,
      parentThreadId,
      protocolVersion: 'v1',
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, basicMessage)

    return { message: basicMessage, record: basicMessageRecord }
  }

  /**
   * @todo use connection from message context
   */
  public async save(
    { message, agentContext }: DidCommInboundMessageContext<DidCommBasicMessage>,
    connection: DidCommConnectionRecord
  ) {
    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: message.sentTime.toISOString(),
      content: message.content,
      connectionId: connection.id,
      role: DidCommBasicMessageRole.Receiver,
      threadId: message.threadId,
      parentThreadId: message.thread?.parentThreadId,
      protocolVersion: 'v1',
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, message)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    basicMessageRecord: DidCommBasicMessageRecord,
    basicMessage: DidCommBasicMessage
  ) {
    this.eventEmitter.emit<DidCommBasicMessageStateChangedEvent>(agentContext, {
      type: DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
      payload: { message: basicMessage, basicMessageRecord: basicMessageRecord.clone() },
    })
  }
}

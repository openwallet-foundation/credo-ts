import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable } from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import type { DidCommInboundMessageContext } from '../../../../models'
import { DidCommProtocol } from '../../../../models'
import type { DidCommConnectionRecord } from '../../../connections'
import type { DidCommBasicMessageV2StateChangedEvent } from '../../DidCommBasicMessageEvents'
import { DidCommBasicMessageEventTypes } from '../../DidCommBasicMessageEvents'
import { DidCommBasicMessageRole } from '../../DidCommBasicMessageRole'
import { DidCommBasicMessageRecord, DidCommBasicMessageRepository } from '../../repository'
import { DidCommBaseBasicMessageService } from '../../services/DidCommBaseBasicMessageService'
import { DidCommBasicMessageV2Handler } from './handlers'
import { DidCommBasicMessageV2 } from './messages'

@injectable()
export class DidCommBasicMessageV2Service extends DidCommBaseBasicMessageService {
  public readonly version = 'v2'

  // biome-ignore lint/complexity/noUselessConstructor: tsyringe needs an own constructor for design:paramtypes
  public constructor(basicMessageRepository: DidCommBasicMessageRepository, eventEmitter: EventEmitter) {
    super(basicMessageRepository, eventEmitter)
  }

  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry) {
    messageHandlerRegistry.registerMessageHandler(new DidCommBasicMessageV2Handler(this))
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/basicmessage/2.0',
        roles: [DidCommBasicMessageRole.Sender, DidCommBasicMessageRole.Receiver],
      })
    )
  }

  public async createMessage(
    agentContext: AgentContext,
    content: string,
    connectionRecord: DidCommConnectionRecord,
    parentThreadId?: string
  ) {
    const basicMessage = new DidCommBasicMessageV2({ content, parentThreadId })

    const sentTimeIso = new Date(basicMessage.createdTime * 1000).toISOString()

    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: sentTimeIso,
      content: basicMessage.content,
      connectionId: connectionRecord.id,
      role: DidCommBasicMessageRole.Sender,
      threadId: basicMessage.threadId,
      parentThreadId,
      protocolVersion: 'v2',
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, basicMessage)

    return { message: basicMessage, record: basicMessageRecord }
  }

  public async save(
    { message, agentContext }: DidCommInboundMessageContext<DidCommBasicMessageV2>,
    connection: DidCommConnectionRecord
  ) {
    const sentTimeIso = new Date(message.createdTime * 1000).toISOString()

    const basicMessageRecord = new DidCommBasicMessageRecord({
      sentTime: sentTimeIso,
      content: message.content,
      connectionId: connection.id,
      role: DidCommBasicMessageRole.Receiver,
      threadId: message.threadId,
      parentThreadId: message.thread?.parentThreadId,
      protocolVersion: 'v2',
    })

    await this.basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, message)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    basicMessageRecord: DidCommBasicMessageRecord,
    basicMessage: DidCommBasicMessageV2
  ) {
    this.eventEmitter.emit<DidCommBasicMessageV2StateChangedEvent>(agentContext, {
      type: DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged,
      payload: { message: basicMessage, basicMessageRecord: basicMessageRecord.clone() },
    })
  }
}

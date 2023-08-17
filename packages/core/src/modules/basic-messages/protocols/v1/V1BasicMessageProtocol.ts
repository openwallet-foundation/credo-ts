import type { AgentContext } from '../../../../agent'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../../plugins'
import type { ConnectionRecord } from '../../../connections/repository/ConnectionRecord'
import type { BasicMessageStateChangedEvent } from '../../BasicMessageEvents'
import type { CreateMessageOptions } from '../BasicMessageProtocolOptions'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { Protocol } from '../../../../agent/models'
import { injectable } from '../../../../plugins'
import { BasicMessageEventTypes } from '../../BasicMessageEvents'
import { BasicMessageRole } from '../../BasicMessageRole'
import { BasicMessageRecord, BasicMessageRepository } from '../../repository'
import { BaseBasicMessageProtocol } from '../BaseBasicMessageProtocol'

import { V1BasicMessageHandler } from './handlers'
import { V1BasicMessage } from './messages'

@injectable()
export class V1BasicMessageProtocol extends BaseBasicMessageProtocol {
  /**
   * The version of Basic Messages this class supports
   */
  public readonly version = 'v1' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Register message handlers for Basic Message V1 Protocol
    dependencyManager.registerMessageHandlers([new V1BasicMessageHandler(this)])

    // Register in feature registry, with supported roles
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/basicmessage/1.0',
        roles: [BasicMessageRole.Sender, BasicMessageRole.Receiver],
      })
    )
  }

  public async createMessage(agentContext: AgentContext, options: CreateMessageOptions) {
    const { content, parentThreadId, connectionRecord } = options
    const basicMessage = new V1BasicMessage({ content })

    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)

    // If no parentThreadid is defined, there is no need to explicitly send a thread decorator
    if (parentThreadId) {
      basicMessage.setThread({ parentThreadId })
    }

    const basicMessageRecord = new BasicMessageRecord({
      sentTime: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      connectionId: connectionRecord.id,
      role: BasicMessageRole.Sender,
      threadId: basicMessage.threadId,
      parentThreadId,
    })

    await basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, basicMessage)

    return { message: basicMessage, record: basicMessageRecord }
  }

  /**
   * @todo use connection from message context
   */
  public async save({ message, agentContext }: InboundMessageContext<V1BasicMessage>, connection: ConnectionRecord) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)

    const basicMessageRecord = new BasicMessageRecord({
      sentTime: message.sentTime.toISOString(),
      content: message.content,
      connectionId: connection.id,
      role: BasicMessageRole.Receiver,
      threadId: message.threadId,
      parentThreadId: message.thread?.parentThreadId,
    })

    await basicMessageRepository.save(agentContext, basicMessageRecord)
    this.emitStateChangedEvent(agentContext, basicMessageRecord, message)
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    basicMessageRecord: BasicMessageRecord,
    basicMessage: V1BasicMessage
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
    eventEmitter.emit<BasicMessageStateChangedEvent>(agentContext, {
      type: BasicMessageEventTypes.BasicMessageStateChanged,
      payload: { message: basicMessage, basicMessageRecord: basicMessageRecord.clone() },
    })
  }
}

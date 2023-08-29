import type { AgentContext } from '../../../../agent'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../../plugins'
import type { ConnectionRecord } from '../../../connections/repository/ConnectionRecord'
import type { CreateMessageOptions } from '../BasicMessageProtocolOptions'

import { Protocol } from '../../../../agent/models'
import { injectable } from '../../../../plugins'
import { BasicMessageRole } from '../../BasicMessageRole'
import { BasicMessageRecord, BasicMessageRepository } from '../../repository'
import { BaseBasicMessageProtocol } from '../BaseBasicMessageProtocol'

import { V2BasicMessageHandler } from './handlers'
import { V2BasicMessage } from './messages'

@injectable()
export class V2BasicMessageProtocol extends BaseBasicMessageProtocol {
  /**
   * The version of Basic Messages this class supports
   */
  public readonly version = 'v2' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Register message handlers for Basic Message V2 Protocol
    dependencyManager.registerMessageHandlers([new V2BasicMessageHandler(this)])

    // Register in feature registry, with supported roles
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/basicmessage/2.0',
        roles: [BasicMessageRole.Sender, BasicMessageRole.Receiver],
      })
    )
  }

  public async createMessage(agentContext: AgentContext, options: CreateMessageOptions) {
    const { content, parentThreadId, connectionRecord } = options
    const basicMessage = new V2BasicMessage({ content })

    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)

    // If no parentThreadid is defined, there is no need to explicitly send a thread decorator
    if (parentThreadId) {
      basicMessage.parentThreadId = parentThreadId
    }

    const basicMessageRecord = new BasicMessageRecord({
      sentTime: new Date(basicMessage.createdTime).toISOString(),
      content: basicMessage.body.content,
      connectionId: connectionRecord.id,
      role: BasicMessageRole.Sender,
      threadId: basicMessage.threadId,
      parentThreadId,
    })

    await basicMessageRepository.save(agentContext, basicMessageRecord)
    // TODO: Emit BasicStateChangedEvent when it is updated to accept V2 Basic Messages

    return { message: basicMessage, record: basicMessageRecord }
  }

  /**
   * @todo use connection from message context
   */
  public async save({ message, agentContext }: InboundMessageContext<V2BasicMessage>, connection: ConnectionRecord) {
    const basicMessageRepository = agentContext.dependencyManager.resolve(BasicMessageRepository)

    const basicMessageRecord = new BasicMessageRecord({
      sentTime: new Date(message.createdTime).toISOString(),
      content: message.body.content,
      connectionId: connection.id,
      role: BasicMessageRole.Receiver,
      threadId: message.threadId,
      parentThreadId: message.parentThreadId,
    })

    await basicMessageRepository.save(agentContext, basicMessageRecord)
    // TODO: Emit BasicStateChangedEvent when it is updated to accept V2 Basic Messages
  }
}

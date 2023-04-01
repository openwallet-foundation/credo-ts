import type { AgentContext } from '../../../../agent'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../../plugins'
import type { MessageRepository } from '../../../../storage/MessageRepository'
import type { PickupMessagesProtocolOptions, PickupMessagesProtocolReturnType } from '../MessagePickupProtocolOptions'

import { OutboundMessageContext, Protocol } from '../../../../agent/models'
import { InjectionSymbols } from '../../../../constants'
import { injectable } from '../../../../plugins'
import { MessagePickupModuleConfig } from '../../MessagePickupModuleConfig'
import { BaseMessagePickupProtocol } from '../BaseMessagePickupProtocol'

import { V1BatchHandler, V1BatchPickupHandler } from './handlers'
import { V1BatchMessage, BatchMessageMessage, V1BatchPickupMessage } from './messages'

@injectable()
export class V1MessagePickupProtocol extends BaseMessagePickupProtocol {
  public constructor() {
    super()
  }

  /**
   * The version of the message pickup protocol this class supports
   */
  public readonly version = 'v1' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void {
    dependencyManager.registerMessageHandlers([new V1BatchPickupHandler(this), new V1BatchHandler()])

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/messagepickup/1.0',
        roles: ['message_holder', 'recipient', 'batch_sender', 'batch_recipient'],
      })
    )
  }

  public async pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<AgentMessage>> {
    const { connectionRecord, batchSize } = options
    connectionRecord.assertReady()

    const config = agentContext.dependencyManager.resolve(MessagePickupModuleConfig)
    const message = new V1BatchPickupMessage({
      batchSize: batchSize ?? config.maximumBatchSize,
    })

    return { message }
  }

  public async processBatchPickup(messageContext: InboundMessageContext<V1BatchPickupMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext

    const messageRepository = messageContext.agentContext.dependencyManager.resolve<MessageRepository>(
      InjectionSymbols.MessageRepository
    )

    const messages = await messageRepository.takeFromQueue(connection.id, message.batchSize)

    // TODO: each message should be stored with an id. to be able to conform to the id property
    // of batch message
    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageMessage({
          message: msg,
        })
    )

    const batchMessage = new V1BatchMessage({
      messages: batchMessages,
    })

    return new OutboundMessageContext(batchMessage, { agentContext: messageContext.agentContext, connection })
  }
}

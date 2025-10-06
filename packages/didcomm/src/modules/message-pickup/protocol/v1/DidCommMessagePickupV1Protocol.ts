import type { AgentContext } from '@credo-ts/core'
import type { DidCommMessageReceivedEvent } from '../../../../DidCommEvents'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import type { DidCommInboundMessageContext } from '../../../../models'
import type { MessagePickupCompletedEvent } from '../../DidCommMessagePickupEvents'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolReturnType,
} from '../DidCommMessagePickupProtocolOptions'

import { CredoError, EventEmitter, injectable } from '@credo-ts/core'

import { DidCommEventTypes } from '../../../../DidCommEvents'
import { DidCommOutboundMessageContext, DidCommProtocol } from '../../../../models'
import { DidCommMessagePickupEventTypes } from '../../DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from '../../DidCommMessagePickupModuleConfig'
import { DidCommBaseMessagePickupProtocol } from '../DidCommBaseMessagePickupProtocol'

import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommBatchHandler, DidCommBatchPickupHandler } from './handlers'
import { DidCommBatchMessage, DidCommBatchMessageMessage, DidCommBatchPickupMessage } from './messages'

@injectable()
export class DidCommMessagePickupV1Protocol extends DidCommBaseMessagePickupProtocol {
  /**
   * The version of the message pickup protocol this class supports
   */
  public readonly version = 'v1' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void {
    messageHandlerRegistry.registerMessageHandlers([new DidCommBatchPickupHandler(this), new DidCommBatchHandler(this)])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/messagepickup/1.0',
        roles: ['message_holder', 'recipient', 'batch_sender', 'batch_recipient'],
      })
    )
  }

  public async createPickupMessage(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommMessage>> {
    const { connectionRecord, batchSize } = options
    connectionRecord.assertReady()

    const config = agentContext.dependencyManager.resolve(DidCommMessagePickupModuleConfig)
    const message = new DidCommBatchPickupMessage({
      batchSize: batchSize ?? config.maximumBatchSize,
    })

    return { message }
  }

  public async createDeliveryMessage(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<DidCommMessage> | undefined> {
    const { connectionRecord, batchSize, messages } = options
    connectionRecord.assertReady()

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const messagesToDeliver =
      messages ??
      (await queueTransportRepository.takeFromQueue(agentContext, {
        connectionId: connectionRecord.id,
        limit: batchSize, // TODO: Define as config parameter for message holder side
        deleteMessages: true,
      }))

    const batchMessages = messagesToDeliver.map(
      (msg) =>
        new DidCommBatchMessageMessage({
          id: msg.id,
          message: msg.encryptedMessage,
        })
    )

    if (messagesToDeliver.length > 0) {
      const message = new DidCommBatchMessage({
        messages: batchMessages,
      })

      return { message }
    }
  }

  public async setLiveDeliveryMode(): Promise<SetLiveDeliveryModeProtocolReturnType<DidCommMessage>> {
    throw new CredoError('Live Delivery mode not supported in Message Pickup V1 protocol')
  }

  public async processBatchPickup(messageContext: DidCommInboundMessageContext<DidCommBatchPickupMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { message, agentContext } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const messages = await queueTransportRepository.takeFromQueue(agentContext, {
      connectionId: connection.id,
      limit: message.batchSize,
      deleteMessages: true,
    })

    const batchMessages = messages.map(
      (msg) =>
        new DidCommBatchMessageMessage({
          id: msg.id,
          message: msg.encryptedMessage,
        })
    )

    const batchMessage = new DidCommBatchMessage({
      messages: batchMessages,
      threadId: message.threadId,
    })

    return new DidCommOutboundMessageContext(batchMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async processBatch(messageContext: DidCommInboundMessageContext<DidCommBatchMessage>) {
    const { message: batchMessage, agentContext } = messageContext
    const { messages } = batchMessage

    const connection = messageContext.assertReadyConnection()

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    for (const message of messages) {
      eventEmitter.emit<DidCommMessageReceivedEvent>(messageContext.agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: message.message,
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
        },
      })
    }

    // A Batch message without messages at all means that we are done with the
    // message pickup process (Note: this is not optimal since we'll always doing an extra
    // Batch Pickup. However, it is safer and should be faster than waiting an entire loop
    // interval to retrieve more messages)
    if (messages.length === 0) {
      eventEmitter.emit<MessagePickupCompletedEvent>(messageContext.agentContext, {
        type: DidCommMessagePickupEventTypes.MessagePickupCompleted,
        payload: {
          connection,
          threadId: batchMessage.threadId,
        },
      })
      return null
    }

    return (await this.createPickupMessage(agentContext, { connectionRecord: connection })).message
  }
}

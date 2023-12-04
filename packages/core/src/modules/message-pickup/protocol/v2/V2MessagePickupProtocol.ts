import type { AgentContext } from '../../../../agent'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { AgentMessageReceivedEvent } from '../../../../agent/Events'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../../plugins'
import type { MessageRepository } from '../../../../storage/MessageRepository'
import type { EncryptedMessage } from '../../../../types'
import type { PickupMessagesProtocolOptions, PickupMessagesProtocolReturnType } from '../MessagePickupProtocolOptions'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { AgentEventTypes } from '../../../../agent/Events'
import { MessageSender } from '../../../../agent/MessageSender'
import { OutboundMessageContext, Protocol } from '../../../../agent/models'
import { InjectionSymbols } from '../../../../constants'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { injectable } from '../../../../plugins'
import { ConnectionService } from '../../../connections'
import { ProblemReportError } from '../../../problem-reports'
import { RoutingProblemReportReason } from '../../../routing/error'
import { MessagePickupModuleConfig } from '../../MessagePickupModuleConfig'
import { BaseMessagePickupProtocol } from '../BaseMessagePickupProtocol'

import {
  V2DeliveryRequestHandler,
  V2MessageDeliveryHandler,
  V2MessagesReceivedHandler,
  V2StatusHandler,
  V2StatusRequestHandler,
} from './handlers'
import {
  V2MessageDeliveryMessage,
  V2StatusMessage,
  V2DeliveryRequestMessage,
  V2MessagesReceivedMessage,
  V2StatusRequestMessage,
} from './messages'

@injectable()
export class V2MessagePickupProtocol extends BaseMessagePickupProtocol {
  public constructor() {
    super()
  }

  /**
   * The version of the message pickup protocol this class supports
   */
  public readonly version = 'v2' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry): void {
    dependencyManager.registerMessageHandlers([
      new V2StatusRequestHandler(this),
      new V2DeliveryRequestHandler(this),
      new V2MessagesReceivedHandler(this),
      new V2StatusHandler(this),
      new V2MessageDeliveryHandler(this),
    ])

    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/messagepickup/2.0',
        roles: ['mediator', 'recipient'],
      })
    )
  }

  public async pickupMessages(
    agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<AgentMessage>> {
    const { connectionRecord, recipientKey } = options
    connectionRecord.assertReady()

    const message = new V2StatusRequestMessage({
      recipientKey,
    })

    return { message }
  }

  public async processStatusRequest(messageContext: InboundMessageContext<V2StatusRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const messageRepository = messageContext.agentContext.dependencyManager.resolve<MessageRepository>(
      InjectionSymbols.MessageRepository
    )

    if (messageContext.message.recipientKey) {
      throw new AriesFrameworkError('recipient_key parameter not supported')
    }

    const statusMessage = new V2StatusMessage({
      threadId: messageContext.message.threadId,
      messageCount: await messageRepository.getAvailableMessageCount(connection.id),
    })

    return new OutboundMessageContext(statusMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async processDeliveryRequest(messageContext: InboundMessageContext<V2DeliveryRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    if (messageContext.message.recipientKey) {
      throw new AriesFrameworkError('recipient_key parameter not supported')
    }

    const { message } = messageContext

    const messageRepository = messageContext.agentContext.dependencyManager.resolve<MessageRepository>(
      InjectionSymbols.MessageRepository
    )

    // Get available messages from queue, but don't delete them
    const messages = await messageRepository.takeFromQueue(connection.id, message.limit, true)

    // TODO: each message should be stored with an id. to be able to conform to the id property
    // of delivery message
    const attachments = messages.map(
      (msg) =>
        new Attachment({
          data: {
            json: msg,
          },
        })
    )

    const outboundMessageContext =
      messages.length > 0
        ? new V2MessageDeliveryMessage({
            threadId: messageContext.message.threadId,
            attachments,
          })
        : new V2StatusMessage({
            threadId: messageContext.message.threadId,
            messageCount: 0,
          })

    return new OutboundMessageContext(outboundMessageContext, { agentContext: messageContext.agentContext, connection })
  }

  public async processMessagesReceived(messageContext: InboundMessageContext<V2MessagesReceivedMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext

    const messageRepository = messageContext.agentContext.dependencyManager.resolve<MessageRepository>(
      InjectionSymbols.MessageRepository
    )

    // TODO: Add Queued Message ID
    await messageRepository.takeFromQueue(
      connection.id,
      message.messageIdList ? message.messageIdList.length : undefined
    )

    const statusMessage = new V2StatusMessage({
      threadId: messageContext.message.threadId,
      messageCount: await messageRepository.getAvailableMessageCount(connection.id),
    })

    return new OutboundMessageContext(statusMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async processStatus(messageContext: InboundMessageContext<V2StatusMessage>) {
    const connection = messageContext.assertReadyConnection()
    const { message: statusMessage } = messageContext
    const { messageCount, recipientKey } = statusMessage

    const connectionService = messageContext.agentContext.dependencyManager.resolve(ConnectionService)
    const messageSender = messageContext.agentContext.dependencyManager.resolve(MessageSender)
    const messagePickupModuleConfig = messageContext.agentContext.dependencyManager.resolve(MessagePickupModuleConfig)

    //No messages to be sent
    if (messageCount === 0) {
      const { message, connectionRecord } = await connectionService.createTrustPing(
        messageContext.agentContext,
        connection,
        {
          responseRequested: false,
        }
      )

      // FIXME: check where this flow fits, as it seems very particular for the AFJ-ACA-Py combination
      const websocketSchemes = ['ws', 'wss']

      await messageSender.sendMessage(
        new OutboundMessageContext(message, {
          agentContext: messageContext.agentContext,
          connection: connectionRecord,
        }),
        {
          transportPriority: {
            schemes: websocketSchemes,
            restrictive: true,
            // TODO: add keepAlive: true to enforce through the public api
            // we need to keep the socket alive. It already works this way, but would
            // be good to make more explicit from the public facing API.
            // This would also make it easier to change the internal API later on.
            // keepAlive: true,
          },
        }
      )

      return null
    }
    const { maximumBatchSize: maximumMessagePickup } = messagePickupModuleConfig
    const limit = messageCount < maximumMessagePickup ? messageCount : maximumMessagePickup

    const deliveryRequestMessage = new V2DeliveryRequestMessage({
      limit,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  public async processDelivery(messageContext: InboundMessageContext<V2MessageDeliveryMessage>) {
    messageContext.assertReadyConnection()

    const { appendedAttachments } = messageContext.message

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    if (!appendedAttachments)
      throw new ProblemReportError('Error processing attachments', {
        problemCode: RoutingProblemReportReason.ErrorProcessingAttachments,
      })

    const ids: string[] = []
    for (const attachment of appendedAttachments) {
      ids.push(attachment.id)

      eventEmitter.emit<AgentMessageReceivedEvent>(messageContext.agentContext, {
        type: AgentEventTypes.AgentMessageReceived,
        payload: {
          message: attachment.getDataAsJson<EncryptedMessage>(),
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
        },
      })
    }

    return new V2MessagesReceivedMessage({
      messageIdList: ids,
    })
  }
}

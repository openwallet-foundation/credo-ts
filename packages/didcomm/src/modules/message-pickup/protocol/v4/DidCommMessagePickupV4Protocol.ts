import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable, JsonEncoder } from '@credo-ts/core'
import type { DidCommMessageReceivedEvent } from '../../../../DidCommEvents'
import { DidCommEventTypes } from '../../../../DidCommEvents'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import type { DidCommInboundMessageContext } from '../../../../models'
import { DidCommOutboundMessageContext, DidCommProtocol } from '../../../../models'
import type { DidCommEncryptedMessage } from '../../../../types'
import { assertDidCommV2Connection } from '../../../../util/didcommVersion'
import type { MessagePickupCompletedEvent } from '../../DidCommMessagePickupEvents'
import { DidCommMessagePickupEventTypes } from '../../DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from '../../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionRole } from '../../DidCommMessagePickupSession'
import { DidCommMessagePickupSessionService } from '../../services'
import { DidCommBaseMessagePickupProtocol } from '../DidCommBaseMessagePickupProtocol'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolOptions,
  SetLiveDeliveryModeProtocolReturnType,
} from '../DidCommMessagePickupProtocolOptions'
import { DidCommMessagePickupV4ProblemReportError, DidCommMessagePickupV4ProblemReportReason } from './errors'
import {
  DidCommDeliveryRequestV4Handler,
  DidCommLiveDeliveryChangeV4Handler,
  DidCommMessageDeliveryV4Handler,
  DidCommMessagePickupV4ProblemReportHandler,
  DidCommMessagesReceivedV4Handler,
  DidCommStatusRequestV4Handler,
  DidCommStatusV4Handler,
} from './handlers'
import {
  DidCommDeliveryRequestV4Message,
  DidCommLiveDeliveryChangeV4Message,
  DidCommMessageDeliveryV4Message,
  DidCommMessagesReceivedV4Message,
  DidCommStatusRequestV4Message,
  DidCommStatusV4Message,
} from './messages'

@injectable()
export class DidCommMessagePickupV4Protocol extends DidCommBaseMessagePickupProtocol {
  public readonly version = 'v4' as const

  public register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void {
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommStatusRequestV4Handler(this),
      new DidCommDeliveryRequestV4Handler(this),
      new DidCommMessagesReceivedV4Handler(this),
      new DidCommStatusV4Handler(this),
      new DidCommMessageDeliveryV4Handler(this),
      new DidCommLiveDeliveryChangeV4Handler(this),
      new DidCommMessagePickupV4ProblemReportHandler(),
    ])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/message-pickup/4.0',
        roles: ['mediator', 'recipient'],
      })
    )
  }

  public async createPickupMessage(
    _agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommMessage>> {
    const { connectionRecord, recipientDid } = options
    connectionRecord.assertReady()
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 4.0')

    const message = new DidCommStatusRequestV4Message({
      recipientDid,
    })

    return { message }
  }

  public async createDeliveryMessage(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<DidCommMessage> | undefined> {
    const { connectionRecord, recipientKey, recipientDid, messages } = options
    connectionRecord.assertReady()
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 4.0')

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const recipientDidForQueue = recipientDid ?? recipientKey

    const messagesToDeliver =
      messages ??
      (await queueTransportRepository.takeFromQueue(agentContext, {
        connectionId: connectionRecord.id,
        recipientDid: recipientDidForQueue,
        limit: 10,
      }))

    if (messagesToDeliver.length === 0) {
      return
    }

    const attachments = messagesToDeliver.map(
      (msg) =>
        new DidCommAttachment({
          id: msg.id,
          lastmodTime: msg.receivedAt,
          data: {
            base64: JsonEncoder.toBase64(msg.encryptedMessage),
          },
        })
    )

    return {
      message: new DidCommMessageDeliveryV4Message({
        attachments,
        recipientDid: recipientDidForQueue,
      }),
    }
  }

  public async setLiveDeliveryMode(
    _agentContext: AgentContext,
    options: SetLiveDeliveryModeProtocolOptions
  ): Promise<SetLiveDeliveryModeProtocolReturnType<DidCommMessage>> {
    const { connectionRecord, liveDelivery } = options
    connectionRecord.assertReady()
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 4.0')

    return {
      message: new DidCommLiveDeliveryChangeV4Message({
        liveDelivery,
      }),
    }
  }

  public async processStatusRequest(
    messageContext: DidCommInboundMessageContext<DidCommStatusRequestV4Message>
  ): Promise<DidCommOutboundMessageContext | undefined> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const recipientDid = messageContext.message.recipientDid
    const agentContext = messageContext.agentContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const statusMessage = new DidCommStatusV4Message({
      threadId: messageContext.message.threadId,
      recipientDid,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
        recipientDid,
      }),
    })

    return new DidCommOutboundMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processDeliveryRequest(
    messageContext: DidCommInboundMessageContext<DidCommDeliveryRequestV4Message>
  ): Promise<DidCommOutboundMessageContext> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const recipientDid = messageContext.message.recipientDid
    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const messages = await queueTransportRepository.takeFromQueue(agentContext, {
      connectionId: connection.id,
      recipientDid,
      limit: message.messageCountLimit,
    })

    const attachments = messages.map(
      (msg) =>
        new DidCommAttachment({
          id: msg.id,
          lastmodTime: msg.receivedAt,
          data: {
            base64: JsonEncoder.toBase64(msg.encryptedMessage),
          },
        })
    )

    // Pickup 4.0: an empty queue is answered with a delivery carrying an empty attachments array
    const deliveryMessage = new DidCommMessageDeliveryV4Message({
      threadId: messageContext.message.threadId,
      recipientDid,
      attachments,
    })

    return new DidCommOutboundMessageContext(deliveryMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processMessagesReceived(
    messageContext: DidCommInboundMessageContext<DidCommMessagesReceivedV4Message>
  ): Promise<void> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    // Pickup 4.0: messages-received is a fire-and-forget ack; remove the messages and send no status back.
    if (message.messageIdList.length) {
      await queueTransportRepository.removeMessages(agentContext, {
        connectionId: connection.id,
        messageIds: message.messageIdList,
      })
    }
  }

  public async processStatus(
    messageContext: DidCommInboundMessageContext<DidCommStatusV4Message>
  ): Promise<DidCommDeliveryRequestV4Message | null> {
    const { message: statusMessage } = messageContext
    const { messageCount, recipientDid } = statusMessage

    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const messagePickupModuleConfig = messageContext.agentContext.dependencyManager.resolve(
      DidCommMessagePickupModuleConfig
    )

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    if (messageCount === 0) {
      eventEmitter.emit<MessagePickupCompletedEvent>(messageContext.agentContext, {
        type: DidCommMessagePickupEventTypes.MessagePickupCompleted,
        payload: {
          connection,
          threadId: statusMessage.threadId,
        },
      })
      return null
    }

    const { maximumBatchSize: maximumMessagePickup } = messagePickupModuleConfig
    const limit = messageCount < maximumMessagePickup ? messageCount : maximumMessagePickup

    return new DidCommDeliveryRequestV4Message({
      messageCountLimit: limit,
      recipientDid,
    })
  }

  public async processLiveDeliveryChange(
    messageContext: DidCommInboundMessageContext<DidCommLiveDeliveryChangeV4Message>
  ): Promise<DidCommOutboundMessageContext> {
    const { agentContext, message, sessionId } = messageContext

    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const sessionService = messageContext.agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)

    if (message.liveDelivery) {
      if (!sessionId) {
        throw new DidCommMessagePickupV4ProblemReportError('Connection does not support Live Delivery', {
          problemCode: DidCommMessagePickupV4ProblemReportReason.LiveModeNotSupported,
        })
      }
      sessionService.saveLiveSession(agentContext, {
        connectionId: connection.id,
        protocolVersion: 'v4',
        role: DidCommMessagePickupSessionRole.MessageHolder,
        transportSessionId: sessionId,
      })
    } else {
      sessionService.removeLiveSession(agentContext, { connectionId: connection.id })
    }

    const statusMessage = new DidCommStatusV4Message({
      threadId: message.threadId,
      liveDelivery: message.liveDelivery,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
      }),
    })

    return new DidCommOutboundMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processDelivery(
    messageContext: DidCommInboundMessageContext<DidCommMessageDeliveryV4Message>
  ): Promise<DidCommMessagesReceivedV4Message | undefined> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 4.0')

    const { appendedAttachments } = messageContext.message

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    // Pickup 4.0: an empty delivery means the queue is drained; signal completion and send no ack
    if (!appendedAttachments || appendedAttachments.length === 0) {
      eventEmitter.emit<MessagePickupCompletedEvent>(messageContext.agentContext, {
        type: DidCommMessagePickupEventTypes.MessagePickupCompleted,
        payload: { connection, threadId: messageContext.message.threadId },
      })
      return undefined
    }

    const ids: string[] = []
    for (const attachment of appendedAttachments) {
      ids.push(attachment.id)

      const encryptedMessage = attachment.getDataAsJson<DidCommEncryptedMessage>()

      eventEmitter.emit<DidCommMessageReceivedEvent>(messageContext.agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: encryptedMessage,
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
          receivedAt: attachment.lastmodTime,
        },
      })
    }

    return new DidCommMessagesReceivedV4Message({
      messageIdList: ids,
    })
  }
}

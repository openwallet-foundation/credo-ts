import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable, JsonEncoder } from '@credo-ts/core'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import { DidCommProblemReportError } from '../../../../errors'
import type { DidCommInboundMessageContext } from '../../../../models'
import { DidCommOutboundMessageContext, DidCommProtocol } from '../../../../models'
import type { DidCommEncryptedMessage } from '../../../../types'
import { DidCommRoutingProblemReportReason } from '../../../routing/error'
import { DidCommEventTypes } from '../../../../DidCommEvents'
import type { DidCommMessageReceivedEvent } from '../../../../DidCommEvents'
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
import {
  DidCommDeliveryRequestV3Handler,
  DidCommLiveDeliveryChangeV3Handler,
  DidCommMessageDeliveryV3Handler,
  DidCommMessagesReceivedV3Handler,
  DidCommStatusRequestV3Handler,
  DidCommStatusV3Handler,
} from './handlers'
import {
  DidCommDeliveryRequestV3Message,
  DidCommLiveDeliveryChangeV3Message,
  DidCommMessageDeliveryV3Message,
  DidCommMessagesReceivedV3Message,
  DidCommStatusRequestV3Message,
  DidCommStatusV3Message,
} from './messages'

@injectable()
export class DidCommMessagePickupV3Protocol extends DidCommBaseMessagePickupProtocol {
  public readonly version = 'v3' as const

  public register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void {
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommStatusRequestV3Handler(this),
      new DidCommDeliveryRequestV3Handler(this),
      new DidCommMessagesReceivedV3Handler(this),
      new DidCommStatusV3Handler(this),
      new DidCommMessageDeliveryV3Handler(this),
      new DidCommLiveDeliveryChangeV3Handler(this),
    ])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/messagepickup/3.0',
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
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 3.0')

    const message = new DidCommStatusRequestV3Message({
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
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 3.0')

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
      message: new DidCommMessageDeliveryV3Message({
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
    assertDidCommV2Connection(connectionRecord, 'Message Pickup 3.0')

    return {
      message: new DidCommLiveDeliveryChangeV3Message({
        liveDelivery,
      }),
    }
  }

  public async processStatusRequest(
    messageContext: DidCommInboundMessageContext<DidCommStatusRequestV3Message>
  ): Promise<DidCommOutboundMessageContext | undefined> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 3.0')

    const recipientDid = messageContext.message.recipientDid
    const agentContext = messageContext.agentContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const statusMessage = new DidCommStatusV3Message({
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
    messageContext: DidCommInboundMessageContext<DidCommDeliveryRequestV3Message>
  ): Promise<DidCommOutboundMessageContext> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 3.0')

    const recipientDid = messageContext.message.recipientDid
    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const messages = await queueTransportRepository.takeFromQueue(agentContext, {
      connectionId: connection.id,
      recipientDid,
      limit: message.limit,
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

    const outboundMessageContext =
      messages.length > 0
        ? new DidCommMessageDeliveryV3Message({
            threadId: messageContext.message.threadId,
            recipientDid,
            attachments,
          })
        : new DidCommStatusV3Message({
            threadId: messageContext.message.threadId,
            recipientDid,
            messageCount: 0,
          })

    return new DidCommOutboundMessageContext(outboundMessageContext, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processMessagesReceived(
    messageContext: DidCommInboundMessageContext<DidCommMessagesReceivedV3Message>
  ): Promise<DidCommOutboundMessageContext> {
    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 3.0')

    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    if (message.messageIdList.length) {
      await queueTransportRepository.removeMessages(agentContext, {
        connectionId: connection.id,
        messageIds: message.messageIdList,
      })
    }

    const statusMessage = new DidCommStatusV3Message({
      threadId: messageContext.message.threadId,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
      }),
    })

    return new DidCommOutboundMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processStatus(
    messageContext: DidCommInboundMessageContext<DidCommStatusV3Message>
  ): Promise<DidCommDeliveryRequestV3Message | null> {
    const { message: statusMessage } = messageContext
    const { messageCount, recipientDid } = statusMessage

    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 3.0')

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

    return new DidCommDeliveryRequestV3Message({
      limit,
      recipientDid,
    })
  }

  public async processLiveDeliveryChange(
    messageContext: DidCommInboundMessageContext<DidCommLiveDeliveryChangeV3Message>
  ): Promise<DidCommOutboundMessageContext> {
    const { agentContext, message, sessionId } = messageContext

    const connection = messageContext.assertReadyConnection()
    assertDidCommV2Connection(connection, 'Message Pickup 3.0')

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const sessionService = messageContext.agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)

    if (message.liveDelivery) {
      if (!sessionId) {
        throw new DidCommProblemReportError('Connection does not support Live Delivery', {
          problemCode: 'e.m.live-mode-not-supported',
        })
      }
      sessionService.saveLiveSession(agentContext, {
        connectionId: connection.id,
        protocolVersion: 'v3',
        role: DidCommMessagePickupSessionRole.MessageHolder,
        transportSessionId: sessionId,
      })
    } else {
      sessionService.removeLiveSession(agentContext, { connectionId: connection.id })
    }

    const statusMessage = new DidCommStatusV3Message({
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
    messageContext: DidCommInboundMessageContext<DidCommMessageDeliveryV3Message>
  ): Promise<DidCommMessagesReceivedV3Message> {
    messageContext.assertReadyConnection()
    assertDidCommV2Connection(messageContext.connection!, 'Message Pickup 3.0')

    const { appendedAttachments } = messageContext.message

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    if (!appendedAttachments)
      throw new DidCommProblemReportError('Error processing attachments', {
        problemCode: DidCommRoutingProblemReportReason.ErrorProcessingAttachments,
      })

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

    return new DidCommMessagesReceivedV3Message({
      messageIdList: ids,
    })
  }
}

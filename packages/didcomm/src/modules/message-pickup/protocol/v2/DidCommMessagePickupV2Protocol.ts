import type { AgentContext } from '@credo-ts/core'
import type { DidCommMessageReceivedEvent } from '../../../../DidCommEvents'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import type { DidCommInboundMessageContext } from '../../../../models'
import type { DidCommEncryptedMessage } from '../../../../types'
import type { MessagePickupCompletedEvent } from '../../DidCommMessagePickupEvents'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolOptions,
  SetLiveDeliveryModeProtocolReturnType,
} from '../DidCommMessagePickupProtocolOptions'

import { EventEmitter, injectable, verkeyToDidKey } from '@credo-ts/core'

import { DidCommEventTypes } from '../../../../DidCommEvents'
import { DidCommAttachment } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommProblemReportError } from '../../../../errors'
import { DidCommProtocol, DidCommOutboundMessageContext } from '../../../../models'
import { DidCommRoutingProblemReportReason } from '../../../routing/error'
import { DidCommMessagePickupEventTypes } from '../../DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from '../../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionRole } from '../../DidCommMessagePickupSession'
import { DidCommMessagePickupSessionService } from '../../services'
import { DidCommBaseMessagePickupProtocol } from '../DidCommBaseMessagePickupProtocol'

import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import {
  DidCommDeliveryRequestV2Handler,
  DidCommLiveDeliveryChangeV2Handler,
  DidCommMessageDeliveryV2Handler,
  DidCommMessagesReceivedV2Handler,
  DidCommStatusV2Handler,
  DidCommStatusRequestV2Handler,
} from './handlers'
import {
  DidCommDeliveryRequestV2Message,
  DidCommLiveDeliveryChangeV2Message,
  DidCommMessageDeliveryV2Message,
  DidCommMessagesReceivedV2Message,
  DidCommStatusV2Message,
  DidCommStatusRequestV2Message,
} from './messages'

@injectable()
export class DidCommMessagePickupV2Protocol extends DidCommBaseMessagePickupProtocol {
  /**
   * The version of the message pickup protocol this class supports
   */
  public readonly version = 'v2' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    featureRegistry: DidCommFeatureRegistry
  ): void {
    messageHandlerRegistry.registerMessageHandlers([
      new DidCommStatusRequestV2Handler(this),
      new DidCommDeliveryRequestV2Handler(this),
      new DidCommMessagesReceivedV2Handler(this),
      new DidCommStatusV2Handler(this),
      new DidCommMessageDeliveryV2Handler(this),
      new DidCommLiveDeliveryChangeV2Handler(this),
    ])

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/messagepickup/2.0',
        roles: ['mediator', 'recipient'],
      })
    )
  }

  public async createPickupMessage(
    _agentContext: AgentContext,
    options: PickupMessagesProtocolOptions
  ): Promise<PickupMessagesProtocolReturnType<DidCommMessage>> {
    const { connectionRecord, recipientDid: recipientKey } = options
    connectionRecord.assertReady()

    const message = new DidCommStatusRequestV2Message({
      recipientKey,
    })

    return { message }
  }

  public async createDeliveryMessage(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<DidCommMessage> | undefined> {
    const { connectionRecord, recipientKey, messages } = options
    connectionRecord.assertReady()

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    // Get available messages from queue, but don't delete them
    const messagesToDeliver =
      messages ??
      (await queueTransportRepository.takeFromQueue(agentContext, {
        connectionId: connectionRecord.id,
        recipientDid: recipientKey,
        limit: 10, // TODO: Define as config parameter
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
            json: msg.encryptedMessage,
          },
        })
    )

    return {
      message: new DidCommMessageDeliveryV2Message({
        attachments,
      }),
    }
  }

  public async setLiveDeliveryMode(
    _agentContext: AgentContext,
    options: SetLiveDeliveryModeProtocolOptions
  ): Promise<SetLiveDeliveryModeProtocolReturnType<DidCommMessage>> {
    const { connectionRecord, liveDelivery } = options
    connectionRecord.assertReady()
    return {
      message: new DidCommLiveDeliveryChangeV2Message({
        liveDelivery,
      }),
    }
  }

  public async processStatusRequest(messageContext: DidCommInboundMessageContext<DidCommStatusRequestV2Message>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()
    const recipientKey = messageContext.message.recipientKey
    const agentContext = messageContext.agentContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const statusMessage = new DidCommStatusV2Message({
      threadId: messageContext.message.threadId,
      recipientKey,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
        recipientDid: recipientKey ? verkeyToDidKey(recipientKey) : undefined,
      }),
    })

    return new DidCommOutboundMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processDeliveryRequest(messageContext: DidCommInboundMessageContext<DidCommDeliveryRequestV2Message>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()
    const recipientKey = messageContext.message.recipientKey

    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    // Get available messages from queue, but don't delete them
    const messages = await queueTransportRepository.takeFromQueue(agentContext, {
      connectionId: connection.id,
      recipientDid: recipientKey ? verkeyToDidKey(recipientKey) : undefined,
      limit: message.limit,
    })

    const attachments = messages.map(
      (msg) =>
        new DidCommAttachment({
          id: msg.id,
          lastmodTime: msg.receivedAt,
          data: {
            json: msg.encryptedMessage,
          },
        })
    )

    const outboundMessageContext =
      messages.length > 0
        ? new DidCommMessageDeliveryV2Message({
            threadId: messageContext.message.threadId,
            recipientKey,
            attachments,
          })
        : new DidCommStatusV2Message({
            threadId: messageContext.message.threadId,
            recipientKey,
            messageCount: 0,
          })

    return new DidCommOutboundMessageContext(outboundMessageContext, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processMessagesReceived(messageContext: DidCommInboundMessageContext<DidCommMessagesReceivedV2Message>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { agentContext, message } = messageContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    if (message.messageIdList.length) {
      await queueTransportRepository.removeMessages(agentContext, {
        connectionId: connection.id,
        messageIds: message.messageIdList,
      })
    }

    const statusMessage = new DidCommStatusV2Message({
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

  public async processStatus(messageContext: DidCommInboundMessageContext<DidCommStatusV2Message>) {
    const { message: statusMessage } = messageContext
    const { messageCount, recipientKey } = statusMessage

    const connection = messageContext.assertReadyConnection()

    const messagePickupModuleConfig = messageContext.agentContext.dependencyManager.resolve(
      DidCommMessagePickupModuleConfig
    )

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    //No messages to be retrieved: message pick-up is completed
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

    const deliveryRequestMessage = new DidCommDeliveryRequestV2Message({
      limit,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  public async processLiveDeliveryChange(messageContext: DidCommInboundMessageContext<DidCommLiveDeliveryChangeV2Message>) {
    const { agentContext, message, sessionId } = messageContext

    const connection = messageContext.assertReadyConnection()

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const sessionService = messageContext.agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)

    if (message.liveDelivery && sessionId) {
      sessionService.saveLiveSession(agentContext, {
        connectionId: connection.id,
        protocolVersion: 'v2',
        role: DidCommMessagePickupSessionRole.MessageHolder,
        transportSessionId: sessionId,
      })
    } else {
      sessionService.removeLiveSession(agentContext, { connectionId: connection.id })
    }

    const statusMessage = new DidCommStatusV2Message({
      threadId: message.threadId,
      liveDelivery: message.liveDelivery,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
      }),
    })

    return new DidCommOutboundMessageContext(statusMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async processDelivery(messageContext: DidCommInboundMessageContext<DidCommMessageDeliveryV2Message>) {
    messageContext.assertReadyConnection()

    const { appendedAttachments } = messageContext.message

    const eventEmitter = messageContext.agentContext.dependencyManager.resolve(EventEmitter)

    if (!appendedAttachments)
      throw new DidCommProblemReportError('Error processing attachments', {
        problemCode: DidCommRoutingProblemReportReason.ErrorProcessingAttachments,
      })

    const ids: string[] = []
    for (const attachment of appendedAttachments) {
      ids.push(attachment.id)

      eventEmitter.emit<DidCommMessageReceivedEvent>(messageContext.agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: attachment.getDataAsJson<DidCommEncryptedMessage>(),
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
          receivedAt: attachment.lastmodTime,
        },
      })
    }

    return new DidCommMessagesReceivedV2Message({
      messageIdList: ids,
    })
  }
}

import type { AgentContext } from '@credo-ts/core'
import type { DidCommMessage } from '../../../../DidCommMessage'
import type { DidCommMessageReceivedEvent } from '../../../../DidCommEvents'
import type { DidCommFeatureRegistry } from '../../../../DidCommFeatureRegistry'
import type { DidCommMessageHandlerRegistry } from '../../../../DidCommMessageHandlerRegistry'
import type { InboundDidCommMessageContext } from '../../../../models'
import type { EncryptedDidCommMessage } from '../../../../types'
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
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { ProblemReportError } from '../../../../errors'
import { OutboundDidCommMessageContext, DidCommProtocol } from '../../../../models'
import { RoutingProblemReportReason } from '../../../routing/error'
import { DidCommMessagePickupEventTypes } from '../../DidCommMessagePickupEvents'
import { DidCommMessagePickupModuleConfig } from '../../DidCommMessagePickupModuleConfig'
import { DidCommMessagePickupSessionRole } from '../../DidCommMessagePickupSession'
import { DidCommMessagePickupSessionService } from '../../services'
import { BaseDidCommMessagePickupProtocol } from '../BaseDidCommMessagePickupProtocol'

import { DidCommModuleConfig } from '../../../../DidCommModuleConfig'
import {
  V2DeliveryRequestHandler,
  V2LiveDeliveryChangeHandler,
  V2MessageDeliveryHandler,
  V2MessagesReceivedHandler,
  V2StatusHandler,
  V2StatusRequestHandler,
} from './handlers'
import {
  V2DeliveryRequestMessage,
  V2LiveDeliveryChangeMessage,
  V2MessageDeliveryMessage,
  V2MessagesReceivedMessage,
  V2StatusMessage,
  V2StatusRequestMessage,
} from './messages'

@injectable()
export class V2DidCommMessagePickupProtocol extends BaseDidCommMessagePickupProtocol {
  /**
   * The version of the message pickup protocol this class supports
   */
  public readonly version = 'v2' as const

  /**
   * Registers the protocol implementation (handlers, feature registry) on the agent.
   */
  public register(messageHandlerRegistry: DidCommMessageHandlerRegistry, featureRegistry: DidCommFeatureRegistry): void {
    messageHandlerRegistry.registerMessageHandlers([
      new V2StatusRequestHandler(this),
      new V2DeliveryRequestHandler(this),
      new V2MessagesReceivedHandler(this),
      new V2StatusHandler(this),
      new V2MessageDeliveryHandler(this),
      new V2LiveDeliveryChangeHandler(this),
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

    const message = new V2StatusRequestMessage({
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
        new Attachment({
          id: msg.id,
          lastmodTime: msg.receivedAt,
          data: {
            json: msg.encryptedMessage,
          },
        })
    )

    return {
      message: new V2MessageDeliveryMessage({
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
      message: new V2LiveDeliveryChangeMessage({
        liveDelivery,
      }),
    }
  }

  public async processStatusRequest(messageContext: InboundDidCommMessageContext<V2StatusRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()
    const recipientKey = messageContext.message.recipientKey
    const agentContext = messageContext.agentContext

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const statusMessage = new V2StatusMessage({
      threadId: messageContext.message.threadId,
      recipientKey,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
        recipientDid: recipientKey ? verkeyToDidKey(recipientKey) : undefined,
      }),
    })

    return new OutboundDidCommMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processDeliveryRequest(messageContext: InboundDidCommMessageContext<V2DeliveryRequestMessage>) {
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
        new Attachment({
          id: msg.id,
          lastmodTime: msg.receivedAt,
          data: {
            json: msg.encryptedMessage,
          },
        })
    )

    const outboundMessageContext =
      messages.length > 0
        ? new V2MessageDeliveryMessage({
            threadId: messageContext.message.threadId,
            recipientKey,
            attachments,
          })
        : new V2StatusMessage({
            threadId: messageContext.message.threadId,
            recipientKey,
            messageCount: 0,
          })

    return new OutboundDidCommMessageContext(outboundMessageContext, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processMessagesReceived(messageContext: InboundDidCommMessageContext<V2MessagesReceivedMessage>) {
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

    const statusMessage = new V2StatusMessage({
      threadId: messageContext.message.threadId,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
      }),
    })

    return new OutboundDidCommMessageContext(statusMessage, {
      agentContext: messageContext.agentContext,
      connection,
    })
  }

  public async processStatus(messageContext: InboundDidCommMessageContext<V2StatusMessage>) {
    const { message: statusMessage } = messageContext
    const { messageCount, recipientKey } = statusMessage

    const connection = messageContext.assertReadyConnection()

    const messagePickupModuleConfig = messageContext.agentContext.dependencyManager.resolve(DidCommMessagePickupModuleConfig)

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

    const deliveryRequestMessage = new V2DeliveryRequestMessage({
      limit,
      recipientKey,
    })

    return deliveryRequestMessage
  }

  public async processLiveDeliveryChange(messageContext: InboundDidCommMessageContext<V2LiveDeliveryChangeMessage>) {
    const { agentContext, message } = messageContext

    const connection = messageContext.assertReadyConnection()

    const queueTransportRepository =
      agentContext.dependencyManager.resolve(DidCommModuleConfig).queueTransportRepository

    const sessionService = messageContext.agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)

    if (message.liveDelivery) {
      sessionService.saveLiveSession(agentContext, {
        connectionId: connection.id,
        protocolVersion: 'v2',
        role: DidCommMessagePickupSessionRole.MessageHolder,
      })
    } else {
      sessionService.removeLiveSession(agentContext, { connectionId: connection.id })
    }

    const statusMessage = new V2StatusMessage({
      threadId: message.threadId,
      liveDelivery: message.liveDelivery,
      messageCount: await queueTransportRepository.getAvailableMessageCount(agentContext, {
        connectionId: connection.id,
      }),
    })

    return new OutboundDidCommMessageContext(statusMessage, { agentContext: messageContext.agentContext, connection })
  }

  public async processDelivery(messageContext: InboundDidCommMessageContext<V2MessageDeliveryMessage>) {
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

      eventEmitter.emit<DidCommMessageReceivedEvent>(messageContext.agentContext, {
        type: DidCommEventTypes.DidCommMessageReceived,
        payload: {
          message: attachment.getDataAsJson<EncryptedDidCommMessage>(),
          contextCorrelationId: messageContext.agentContext.contextCorrelationId,
          receivedAt: attachment.lastmodTime,
        },
      })
    }

    return new V2MessagesReceivedMessage({
      messageIdList: ids,
    })
  }
}

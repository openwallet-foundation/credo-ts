import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingReceivedEvent, TrustPingResponseReceivedEvent } from '../TrustPingEvents'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { AgentContext } from '../../../agent/context/AgentContext'
import { OutboundMessageContext } from '../../../agent/models'
import { InjectionSymbols } from '../../../constants'
import { injectable } from '../../../plugins'
import { MessagePickupSessionRole } from '../../message-pickup/MessagePickupSession'
import { MessagePickupSessionService } from '../../message-pickup/services/MessagePickupSessionService'
import { MessagePickupRepository } from '../../message-pickup/storage/MessagePickupRepository'
import { MediatorModuleConfig } from '../../routing/MediatorModuleConfig'
import { MessageForwardingStrategy } from '../../routing/MessageForwardingStrategy'
import { TrustPingEventTypes } from '../TrustPingEvents'
import { TrustPingResponseMessage } from '../messages'

@injectable()
export class TrustPingService {
  private eventEmitter: EventEmitter

  public constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
  }

  public processPing({ message, agentContext }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    this.eventEmitter.emit<TrustPingReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.TrustPingReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })

    this.handleBackwardsCompatibilityImplicitPickup(agentContext, connection)

    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.threadId,
      })

      return new OutboundMessageContext(response, { agentContext, connection })
    }
  }

  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    const { agentContext, message } = inboundMessage

    const connection = inboundMessage.assertReadyConnection()

    this.eventEmitter.emit<TrustPingResponseReceivedEvent>(agentContext, {
      type: TrustPingEventTypes.TrustPingResponseReceivedEvent,
      payload: {
        connectionRecord: connection,
        message: message,
      },
    })
  }

  private handleBackwardsCompatibilityImplicitPickup(agentContext: AgentContext, connection: ConnectionRecord) {
    const config = agentContext.dependencyManager.resolve(MediatorModuleConfig)

    if (config.messageForwardingStrategy !== MessageForwardingStrategy.QueueAndLiveModeDelivery) {
      return
    }

    const pickupLiveSessionService = agentContext.dependencyManager.resolve(MessagePickupSessionService)
    const messagePickupRepository = agentContext.dependencyManager.resolve<MessagePickupRepository>(
      InjectionSymbols.MessagePickupRepository
    )
    const messageSender = agentContext.dependencyManager.resolve(MessageSender)

    // Allow session creation before creating the live pickup session
    setTimeout(async () => {
      try {
        if (!pickupLiveSessionService.getLiveSessionByConnectionId(agentContext, { connectionId: connection.id })) {
          pickupLiveSessionService.saveLiveSession(agentContext, {
            connectionId: connection.id,
            protocolVersion: 'v2',
            role: MessagePickupSessionRole.MessageHolder,
          })
        }

        const messagesToDeliver = await messagePickupRepository.takeFromQueue({
          connectionId: connection.id,
          limit: 10,
          deleteMessages: true,
        })

        if (messagesToDeliver.length === 0) return

        for (const message of messagesToDeliver) {
          await messageSender.sendPackage(agentContext, {
            connection,
            recipientKey: connection.did ?? connection.id,
            encryptedMessage: message.encryptedMessage,
            options: { transportPriority: { schemes: ['ws', 'wss'], restrictive: true } },
          })
        }
      } catch (error) {
        agentContext.config.logger?.error(`Error during implicit pickup for connection ${connection.id}`, { error })
      }
    }, 100)
  }
}

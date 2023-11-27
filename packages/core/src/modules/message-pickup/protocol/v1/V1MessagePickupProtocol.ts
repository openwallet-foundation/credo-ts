import type { AgentContext } from '../../../../agent'
import type { AgentMessage } from '../../../../agent/AgentMessage'
import type { FeatureRegistry } from '../../../../agent/FeatureRegistry'
import type { InboundMessageContext } from '../../../../agent/models/InboundMessageContext'
import type { DependencyManager } from '../../../../plugins'
import type { MessagePickupRepository } from '../../storage/MessagePickupRepository'
import type {
  DeliverMessagesProtocolOptions,
  DeliverMessagesProtocolReturnType,
  PickupMessagesProtocolOptions,
  PickupMessagesProtocolReturnType,
  SetLiveDeliveryModeProtocolOptions,
  SetLiveDeliveryModeProtocolReturnType,
} from '../MessagePickupProtocolOptions'

import { OutboundMessageContext, Protocol } from '../../../../agent/models'
import { InjectionSymbols } from '../../../../constants'
import { AriesFrameworkError } from '../../../../error'
import { injectable } from '../../../../plugins'
import { MessagePickupModuleConfig } from '../../MessagePickupModuleConfig'
import { BaseMessagePickupProtocol } from '../BaseMessagePickupProtocol'

import { V1BatchHandler, V1BatchPickupHandler } from './handlers'
import { V1BatchMessage, BatchMessageMessage, V1BatchPickupMessage } from './messages'

@injectable()
export class V1MessagePickupProtocol extends BaseMessagePickupProtocol {
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

  public async deliverMessages(
    agentContext: AgentContext,
    options: DeliverMessagesProtocolOptions
  ): Promise<DeliverMessagesProtocolReturnType<AgentMessage> | void> {
    const { connectionRecord, batchSize } = options
    connectionRecord.assertReady()

    const pickupMessageQueue = agentContext.dependencyManager.resolve<MessagePickupRepository>(
      InjectionSymbols.MessagePickupRepository
    )

    const messages = await pickupMessageQueue.takeFromQueue({
      connectionId: connectionRecord.id,
      limit: batchSize, // TODO: Define as config parameter for message holder side
    })

    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageMessage({
          id: msg.id,
          message: msg.encryptedMessage,
        })
    )

    if (messages.length > 0) {
      const message = new V1BatchMessage({
        messages: batchMessages,
      })

      return { message }
    }
  }

  public async setLiveDeliveryMode(
    agentContext: AgentContext,
    options: SetLiveDeliveryModeProtocolOptions
  ): Promise<SetLiveDeliveryModeProtocolReturnType<AgentMessage>> {
    throw new AriesFrameworkError('Live Delivery mode not supported in Message Pickup V1 protocol')
  }

  public async processBatchPickup(messageContext: InboundMessageContext<V1BatchPickupMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext

    const pickupMessageQueue = messageContext.agentContext.dependencyManager.resolve<MessagePickupRepository>(
      InjectionSymbols.MessagePickupRepository
    )

    const messages = await pickupMessageQueue.takeFromQueue({ connectionId: connection.id, limit: message.batchSize })

    const batchMessages = messages.map(
      (msg) =>
        new BatchMessageMessage({
          id: msg.id,
          message: msg.encryptedMessage,
        })
    )

    const batchMessage = new V1BatchMessage({
      messages: batchMessages,
    })

    return new OutboundMessageContext(batchMessage, { agentContext: messageContext.agentContext, connection })
  }
}

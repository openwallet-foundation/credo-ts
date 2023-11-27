import type {
  DeliverQueuedMessagesOptions,
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
  SetLiveDeliveryModeOptions,
  SetLiveDeliveryModeReturnType,
} from './MessagePickupApiOptions'
import type { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'
import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { MessagePickupRepository } from './storage/MessagePickupRepository'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger/Logger'
import { inject, injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'
import { MessagePickupSessionService } from './services/MessagePickupSessionService'

export interface MessagePickupApi<MPPs extends MessagePickupProtocol[]> {
  queueMessage(options: QueueMessageOptions): Promise<QueueMessageReturnType>
  pickupMessages(options: PickupMessagesOptions<MPPs>): Promise<PickupMessagesReturnType>
}

@injectable()
export class MessagePickupApi<MPPs extends MessagePickupProtocol[] = [V1MessagePickupProtocol, V2MessagePickupProtocol]>
  implements MessagePickupApi<MPPs>
{
  public config: MessagePickupModuleConfig<MPPs>

  private messageSender: MessageSender
  private agentContext: AgentContext
  private connectionService: ConnectionService
  private messagePickupSessionService: MessagePickupSessionService
  private logger: Logger

  public constructor(
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    messagePickupSessionService: MessagePickupSessionService,
    config: MessagePickupModuleConfig<MPPs>,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
    this.messagePickupSessionService = messagePickupSessionService
    this.logger = logger
  }

  public async initialize() {
    this.messagePickupSessionService.start(this.agentContext)
  }

  private getProtocol<MPP extends MPPs[number]['version']>(protocolVersion: MPP): MessagePickupProtocol {
    const protocol = this.config.protocols.find((protocol) => protocol.version === protocolVersion)

    if (!protocol) {
      throw new AriesFrameworkError(`No message pickup protocol registered for protocol version ${protocolVersion}`)
    }

    return protocol
  }

  /**
   * Add an encrypted message to the message pickup queue
   *
   * @param options: connectionId associated to the message and the encrypted message itself
   */
  public async queueMessage(options: QueueMessageOptions): Promise<QueueMessageReturnType> {
    this.logger.debug('Queuing message...')
    const { connectionId, message, recipientKey } = options
    const connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)

    const messagePickupRepository = this.agentContext.dependencyManager.resolve<MessagePickupRepository>(
      InjectionSymbols.MessagePickupRepository
    )

    await messagePickupRepository.addMessage({ connectionId: connectionRecord.id, recipientKey, payload: message })
  }

  /**
   * Deliver messages in the Message Pickup Queue for a given connection and key (if specified).
   *
   * Note that this is only available when there is an active session with the recipient. Message
   * Pickup protocol messages themselves are not added to pickup queue
   *
   */
  public async deliverQueuedMessages(options: DeliverQueuedMessagesOptions) {
    this.logger.debug('Deliverying queried message...')

    const { connectionId, recipientKey } = options
    const connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)

    const activePickupSession = this.messagePickupSessionService.getLiveSession(this.agentContext, {
      connectionId: connectionRecord.id,
    })

    if (activePickupSession) {
      const protocol = this.getProtocol(activePickupSession.protocolVersion)

      const deliverMessagesReturn = await protocol.deliverMessages(this.agentContext, {
        connectionRecord,
        recipientKey,
      })

      if (deliverMessagesReturn) {
        await this.messageSender.sendMessage(
          new OutboundMessageContext(deliverMessagesReturn.message, {
            agentContext: this.agentContext,
            connection: connectionRecord,
          })
        )
      }
    } else {
      this.logger.debug('No live mode session')
    }
  }

  /**
   * Pickup queued messages from a message holder. It attempts to retrieve all current messages from the
   * queue, receiving up to `batchSize` messages per batch retrieval.
   *
   * @param options connectionId, protocol version to use and batch size
   */
  public async pickupMessages(options: PickupMessagesOptions<MPPs>): Promise<PickupMessagesReturnType> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const protocol = this.getProtocol(options.protocolVersion)
    const { message } = await protocol.pickupMessages(this.agentContext, {
      connectionRecord,
      batchSize: options.batchSize,
      recipientKey: options.recipientKey,
    })

    await this.messageSender.sendMessage(
      new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    )
  }

  /**
   * Enable or disable Live Delivery mode as a recipient. If there were previous queued messages, it will pick-up them
   * automatically.
   *
   * @param options connectionId, protocol version to use and boolean to enable/disable Live Mode
   */
  public async setLiveDeliveryMode(options: SetLiveDeliveryModeOptions): Promise<SetLiveDeliveryModeReturnType> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const protocol = this.getProtocol(options.protocolVersion)
    const { message } = await protocol.setLiveDeliveryMode(this.agentContext, {
      connectionRecord,
      liveDelivery: options.liveDelivery,
    })

    await this.messageSender.sendMessage(
      new OutboundMessageContext(message, {
        agentContext: this.agentContext,
        connection: connectionRecord,
      })
    )
  }
}

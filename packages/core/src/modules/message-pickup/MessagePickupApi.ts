import type {
  DeliverMessagesOptions,
  DeliverMessagesFromQueueOptions,
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
  SetLiveDeliveryModeOptions,
  SetLiveDeliveryModeReturnType,
} from './MessagePickupApiOptions'
import type { MessagePickupSessionRole } from './MessagePickupSession'
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
    const { connectionId, message, recipientKeys } = options
    const connectionRecord = await this.connectionService.getById(this.agentContext, connectionId)

    const messagePickupRepository = this.agentContext.dependencyManager.resolve<MessagePickupRepository>(
      InjectionSymbols.MessagePickupRepository
    )

    await messagePickupRepository.addMessage({ connectionId: connectionRecord.id, recipientKeys, payload: message })
  }

  /**
   * Get current active live mode message pickup session for a given connection. Undefined if no active session found
   *
   * @param options connection id and optional role
   * @returns live mode session
   */
  public async getLiveModeSession(options: { connectionId: string; role?: MessagePickupSessionRole }) {
    const { connectionId, role } = options
    return this.messagePickupSessionService.getLiveSessionByConnectionId(this.agentContext, { connectionId, role })
  }

  /**
   * Deliver specific messages to an active live mode pickup session through message pickup protocol.
   *
   * This will deliver the messages regardless of the state of the message pickup queue, meaning that
   * any message stuck there should be sent separately (e.g. using deliverQU).
   *
   * @param options: pickup session id and the messages to deliver
   */
  public async deliverMessages(options: DeliverMessagesOptions) {
    const { pickupSessionId, messages } = options

    const session = this.messagePickupSessionService.getLiveSession(this.agentContext, pickupSessionId)

    if (!session) {
      this.logger.debug(`No active live mode session found with id ${pickupSessionId}`)
      return
    }
    const connectionRecord = await this.connectionService.getById(this.agentContext, session.connectionId)

    const protocol = this.getProtocol(session.protocolVersion)

    const createDeliveryReturn = await protocol.createDeliveryMessage(this.agentContext, {
      connectionRecord,
      messages,
    })

    if (createDeliveryReturn) {
      await this.messageSender.sendMessage(
        new OutboundMessageContext(createDeliveryReturn.message, {
          agentContext: this.agentContext,
          connection: connectionRecord,
        })
      )
    }
  }

  /**
   * Deliver messages in the Message Pickup Queue for a given live mode session and key (if specified).
   *
   * This will retrieve messages up to 'batchSize' messages from the queue and deliver it through the
   * corresponding Message Pickup protocol. If there are more than 'batchSize' messages in the queue,
   * the recipient may request remaining messages after receiving the first batch of messages.
   *
   */
  public async deliverMessagesFromQueue(options: DeliverMessagesFromQueueOptions) {
    this.logger.debug('Deliverying queued messages')

    const { pickupSessionId, recipientKey, batchSize } = options

    const session = this.messagePickupSessionService.getLiveSession(this.agentContext, pickupSessionId)

    if (!session) {
      this.logger.debug(`No active live mode session found with id ${pickupSessionId}`)
      return
    }
    const connectionRecord = await this.connectionService.getById(this.agentContext, session.connectionId)

    const protocol = this.getProtocol(session.protocolVersion)

    const deliverMessagesReturn = await protocol.createDeliveryMessage(this.agentContext, {
      connectionRecord,
      recipientKey,
      batchSize,
    })

    if (deliverMessagesReturn) {
      await this.messageSender.sendMessage(
        new OutboundMessageContext(deliverMessagesReturn.message, {
          agentContext: this.agentContext,
          connection: connectionRecord,
        })
      )
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
    const { message } = await protocol.createPickupMessage(this.agentContext, {
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

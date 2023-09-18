import type {
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
} from './MessagePickupApiOptions'
import type { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'
import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'
import type { MessageRepository } from '../../storage/MessageRepository'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger/Logger'
import { inject, injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'

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
  private logger: Logger

  public constructor(
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    config: MessagePickupModuleConfig<MPPs>,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
    this.logger = logger
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
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const messageRepository = this.agentContext.dependencyManager.resolve<MessageRepository>(
      InjectionSymbols.MessageRepository
    )

    await messageRepository.add(connectionRecord.id, options.message)
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
}

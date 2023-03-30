import type {
  PickupMessagesOptions,
  PickupMessagesReturnType,
  QueueMessageOptions,
  QueueMessageReturnType,
} from './MessagePickupApiOptions'
import type { V1MessagePickupProtocol, V2MessagePickupProtocol } from './protocol'
import type { MessagePickupProtocol } from './protocol/MessagePickupProtocol'

import { AgentContext } from '../../agent'
import { MessageSender } from '../../agent/MessageSender'
import { OutboundMessageContext } from '../../agent/models'
import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { ConnectionService } from '../connections/services'

import { MessagePickupModuleConfig } from './MessagePickupModuleConfig'

export interface MessagePickupApi<MPPs extends MessagePickupProtocol[]> {
  queueMessage(options: QueueMessageOptions<MPPs>): Promise<QueueMessageReturnType>
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

  public constructor(
    messageSender: MessageSender,
    agentContext: AgentContext,
    connectionService: ConnectionService,
    config: MessagePickupModuleConfig<MPPs>
  ) {
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
  }

  private getProtocol<MPP extends MPPs[number]['version']>(protocolVersion: MPP): MessagePickupProtocol {
    const protocol = this.config.protocols.find((protocol) => protocol.version === protocolVersion)

    if (!protocol) {
      throw new AriesFrameworkError(`No message pickup protocol registered for protocol version ${protocolVersion}`)
    }

    return protocol
  }

  public async queueMessage(options: QueueMessageOptions<MPPs>): Promise<QueueMessageReturnType> {
    const connectionRecord = await this.connectionService.getById(this.agentContext, options.connectionId)

    const protocol = this.getProtocol(options.protocolVersion)

    await protocol.queueMessage(this.agentContext, { connectionRecord, message: options.message })
  }

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

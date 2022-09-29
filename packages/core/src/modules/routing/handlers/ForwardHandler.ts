import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ConnectionService } from '../../connections/services'
import type { MediatorService } from '../services'

import { ForwardMessageV2 } from '../messages'

export class ForwardHandler implements Handler<typeof DIDCommV2Message> {
  private mediatorService: MediatorService
  private connectionService: ConnectionService
  private messageSender: MessageSender

  public supportedMessages = [ForwardMessageV2]

  public constructor(
    mediatorService: MediatorService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.mediatorService = mediatorService
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    const { encryptedMessage } = await this.mediatorService.processForwardMessage(messageContext)

    // The message inside the forward message is packed so we just send the packed
    // message to the connection associated with it
    const service = await this.messageSender.findCommonSupportedService(undefined, messageContext.message.body.next)
    if (service) {
      await this.messageSender.sendMessage(encryptedMessage, service, messageContext.message.body.next)
    }
  }
}

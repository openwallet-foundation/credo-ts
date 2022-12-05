import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { MessageSender } from '../../../../../../agent/MessageSender'
import type { ConnectionService } from '../../../../../connections/services'
import type { RoutingService } from '../RoutingService'

import { ForwardMessage } from '../messages'

export class ForwardHandler implements Handler {
  private routingService: RoutingService
  private connectionService: ConnectionService
  private messageSender: MessageSender

  public supportedMessages = [ForwardMessage]

  public constructor(
    routingService: RoutingService,
    connectionService: ConnectionService,
    messageSender: MessageSender
  ) {
    this.routingService = routingService
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerInboundMessage<ForwardHandler>) {
    const { encryptedMessage, mediationRecord } = await this.routingService.processForwardMessage(messageContext)
    if (!mediationRecord.connectionId) return

    const connectionRecord = await this.connectionService.getById(
      messageContext.agentContext,
      mediationRecord.connectionId
    )

    // The message inside the forward message is packed so we just send the packed
    // message to the connection associated with it
    await this.messageSender.sendPackage(messageContext.agentContext, {
      connection: connectionRecord,
      encryptedMessage,
    })
  }
}

import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { ConnectionRecord } from '../../../../repository/ConnectionRecord'
import type { ConnectionService } from '../../../../services/ConnectionService'
import type { V2TrustPingService } from '../V2TrustPingService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { DidExchangeRole, DidExchangeState, HandshakeProtocol } from '../../../../models'
import { TrustPingMessage } from '../messages/TrustPingMessage'

export class TrustPingMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  private connectionService: ConnectionService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: V2TrustPingService, connectionService: ConnectionService) {
    this.v2TrustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<TrustPingMessageHandler>) {
    let connection: ConnectionRecord | undefined = messageContext.connection

    // If we received a thrust ping for nonexisting connection record,
    // create a connection record when the corresponding option is set in the config
    const recipient = messageContext.message.firstRecipient
    if (!messageContext.connection && messageContext.agentContext.config.autoCreateConnectionOnPing && recipient) {
      connection = await this.connectionService.createConnection(messageContext.agentContext, {
        protocol: HandshakeProtocol.V2DidExchange,
        role: DidExchangeRole.Requester,
        state: DidExchangeState.Completed,
        theirDid: messageContext.message.from,
        did: recipient,
      })
    }

    const message = await this.v2TrustPingService.processPing(messageContext)

    if (message) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}

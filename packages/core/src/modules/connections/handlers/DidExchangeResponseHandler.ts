import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { DidExchangeResponseMessage } from '../messages'

export class DidExchangeResponseHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private agentConfig: AgentConfig
  public supportedMessages = [DidExchangeResponseMessage]

  public constructor(didExchangeProtocol: DidExchangeProtocol, agentConfig: AgentConfig) {
    this.didExchangeProtocol = didExchangeProtocol
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeResponseHandler>) {
    const { connection: connectionRecord } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection is missing in message context`)
    }

    const { protocol } = connectionRecord
    if (protocol !== 'did-exchange') {
      throw new AriesFrameworkError(`Connection record protol is ${protocol} but handler supports only did-exchange.`)
    }

    const connection = await this.didExchangeProtocol.processResponse(messageContext)

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const message = await this.didExchangeProtocol.createComplete(connection)
      return createOutboundMessage(connection, message)
    }
  }
}

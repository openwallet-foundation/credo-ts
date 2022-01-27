import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'
import type { ConnectionService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { DidExchangeResponseMessage } from '../messages'

export class DidExchangeResponseHandler implements Handler {
  private didExchangeProtocol: DidExchangeProtocol
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  public supportedMessages = [DidExchangeResponseMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    connectionService: ConnectionService,
    agentConfig: AgentConfig
  ) {
    this.didExchangeProtocol = didExchangeProtocol
    this.connectionService = connectionService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeResponseHandler>) {
    // const { connection: connectionRecord } = messageContext

    // if (!connectionRecord) {
    //   throw new AriesFrameworkError(`Connection is missing in message context`)
    // }

    if (!messageContext.recipientVerkey || !messageContext.senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    const connectionRecord = await this.connectionService.findByVerkey(messageContext.recipientVerkey)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const { protocol } = connectionRecord
    if (protocol !== 'did-exchange') {
      throw new AriesFrameworkError(`Connection record protol is ${protocol} but handler supports only did-exchange.`)
    }

    // TODO
    //
    // A connection request message is the only case when I can use the connection record found
    // only based on recipient key without checking that `theirKey` is equal to sender key.
    //
    // The question is if we should do it here in this way or rather somewhere else to keep
    // responsibility of all handlers aligned.
    //
    messageContext.connection = connectionRecord
    const connection = await this.didExchangeProtocol.processResponse(messageContext)

    this.agentConfig.logger.debug('Handler continues with', { connection, agentConfig: this.agentConfig })

    // TODO: should we only send ping message in case of autoAcceptConnection or always?
    // In AATH we have a separate step to send the ping. So for now we'll only do it
    // if auto accept is enable
    if (connection.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const message = await this.didExchangeProtocol.createComplete(connection)
      return createOutboundMessage(connection, message)
    }
  }
}

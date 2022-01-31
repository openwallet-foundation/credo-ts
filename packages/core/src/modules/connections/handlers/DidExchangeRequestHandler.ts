import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'
import type { ConnectionService, Routing } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
  private logger: Logger
  private didExchangeProtocol: DidExchangeProtocol
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [DidExchangeRequestMessage]

  public constructor(
    didExchangeProtocol: DidExchangeProtocol,
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.logger = agentConfig.logger
    this.didExchangeProtocol = didExchangeProtocol
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<DidExchangeRequestHandler>) {
    if (!messageContext.recipientVerkey || !messageContext.senderVerkey) {
      throw new AriesFrameworkError('Unable to process connection request without senderVerkey or recipientVerkey')
    }

    let connectionRecord = await this.connectionService.findByVerkey(messageContext.recipientVerkey)
    if (!connectionRecord) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    const { protocol } = connectionRecord
    if (protocol !== 'did-exchange') {
      throw new AriesFrameworkError(`Connection record protol is ${protocol} but handler supports only did-exchange.`)
    }

    let routing: Routing | undefined

    // routing object is required for multi use invitation, because we're creating a
    // new keypair that possibly needs to be registered at a mediator
    if (connectionRecord.multiUseInvitation) {
      routing = await this.mediationRecipientService.getRouting()
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
    connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, routing)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const message = await this.didExchangeProtocol.createResponse(connectionRecord, routing)
      return createOutboundMessage(connectionRecord, message)
    }
  }
}

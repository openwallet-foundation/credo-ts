import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { DidExchangeProtocol } from '../DidExchangeProtocol'
import type { ConnectionService, Routing } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { DidExchangeRequestMessage } from '../messages'

export class DidExchangeRequestHandler implements Handler {
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

    // TODO if (connectionRecord !== 'did-exchange) throw error

    let routing: Routing | undefined

    // routing object is required for multi use invitation, because we're creating a
    // new keypair that possibly needs to be registered at a mediator
    if (connectionRecord.multiUseInvitation) {
      routing = await this.mediationRecipientService.getRouting()
    }

    connectionRecord = await this.didExchangeProtocol.processRequest(messageContext, routing)

    if (connectionRecord?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const message = await this.didExchangeProtocol.createResponse(connectionRecord)
      return createOutboundMessage(connectionRecord, message)
    }
  }
}

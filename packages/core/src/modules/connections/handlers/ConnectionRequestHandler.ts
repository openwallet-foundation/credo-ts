import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService, Routing } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error'
import { ConnectionRequestMessage } from '../messages'

export class ConnectionRequestHandler implements Handler {
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [ConnectionRequestMessage]

  public constructor(
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    if (!messageContext.connection) {
      throw new AriesFrameworkError(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }

    let routing: Routing | undefined

    // routing object is required for multi use invitation, because we're creating a
    // new keypair that possibly needs to be registered at a mediator
    if (messageContext.connection.multiUseInvitation) {
      const mediationRecord = await this.mediationRecipientService.discoverMediation()
      routing = await this.mediationRecipientService.getRouting(mediationRecord)
    }

    const connection = await this.connectionService.processRequest(messageContext, routing)

    if (connection?.autoAcceptConnection ?? this.agentConfig.autoAcceptConnections) {
      const { message } = await this.connectionService.createResponse(connection.id)
      return createOutboundMessage(connection, message)
    }
  }
}

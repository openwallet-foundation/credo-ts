import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService } from '../services/ConnectionService'

import { createOutboundMessage } from '../../../agent/helpers'
import { ConnectionInvitationMessage } from '../messages'

export class ConnectionInvitationHandler implements Handler {
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [ConnectionInvitationMessage]

  public constructor(
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerInboundMessage<ConnectionInvitationHandler>) {
    if (!this.agentConfig.autoAcceptConnections) return

    // TODO Discuss: Do we need to auto accept invitations in case Offline transports only?

    // only if auto accept is enabled -> handle invitation
    const routing = await this.mediationRecipientService.getRouting()

    const connection = await this.connectionService.processInvitation(messageContext.message, {
      autoAcceptConnection: this.agentConfig.autoAcceptConnections,
      alias: this.agentConfig.label,
      routing,
      transport: messageContext?.transport,
    })

    const { message, connectionRecord: connectionRecord } = await this.connectionService.createRequest(connection.id, {
      autoAcceptConnection: connection.autoAcceptConnection,
    })
    return createOutboundMessage(connectionRecord, message)
  }
}

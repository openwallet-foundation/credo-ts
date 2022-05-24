import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { ConnectionService } from '../services/ConnectionService'

import { OutOfBandInvitationMessage } from '../messages/OutOfBandInvitationMessage'

export class OutOfBandInvitationHandler implements HandlerV2 {
  private connectionService: ConnectionService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [OutOfBandInvitationMessage]

  public constructor(
    connectionService: ConnectionService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService
  ) {
    this.connectionService = connectionService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
  }

  public async handle(messageContext: HandlerV2InboundMessage<OutOfBandInvitationHandler>) {
    if (!this.agentConfig.autoAcceptConnections) return

    // TODO Discuss: Do we need to auto accept invitations in case Offline transports only?

    // only if auto accept is enabled -> handle invitation
    const routing = await this.mediationRecipientService.getRouting()

    await this.connectionService.acceptOutOfBandInvitation(messageContext.message, {
      alias: this.agentConfig.label,
      transport: messageContext?.transport,
      routing,
    })
  }
}

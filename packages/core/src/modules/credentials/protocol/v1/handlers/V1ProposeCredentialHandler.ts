import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(credentialService: V1CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    const shouldAutoAcceptProposal = await this.credentialService.shouldAutoRespondToProposal({
      credentialRecord,
      proposalMessage: messageContext.message,
    })

    if (shouldAutoAcceptProposal) {
      return await this.acceptProposal(credentialRecord, messageContext)
    }
  }

  private async acceptProposal(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const { message } = await this.credentialService.acceptProposal({
      credentialRecord,
    })

    return createOutboundMessage(messageContext.connection, message)
  }
}

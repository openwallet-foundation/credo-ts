import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { OfferCredentialMessage } from '../messages'

import { AutoRespondHandler } from './AutoRespondHandler'

export class OfferCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [OfferCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    return await new AutoRespondHandler(this.credentialService).shouldAutoRespondToOffer(
      messageContext,
      credentialRecord,
      this.agentConfig
    )
  }
}

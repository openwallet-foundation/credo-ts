import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { ProposeCredentialMessage } from '../messages'

import { AutoRespondHandler } from './AutoRespondHandler'

export class ProposeCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [ProposeCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)
    return await new AutoRespondHandler(this.credentialService).shoudlAutoRespondToProposal(
      messageContext,
      credentialRecord,
      this.agentConfig
    )
  }
}

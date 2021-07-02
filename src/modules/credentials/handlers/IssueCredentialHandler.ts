import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { IssueCredentialMessage } from '../messages'

import { AutoRespondHandler } from './AutoRespondHandler'

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [IssueCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext)
    return await new AutoRespondHandler(this.credentialService).shouldAutoRespondToIssue(
      messageContext,
      credentialRecord,
      this.agentConfig
    )
  }
}

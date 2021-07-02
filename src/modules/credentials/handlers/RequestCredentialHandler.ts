import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { RequestCredentialMessage } from '../messages'

import { AutoRespondHandler } from './AutoRespondHandler'

export class RequestCredentialHandler implements Handler {
  private agentConfig: AgentConfig
  private credentialService: CredentialService
  public supportedMessages = [RequestCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    return await new AutoRespondHandler(this.credentialService).shouldAutoRespondToRequest(
      messageContext,
      credentialRecord,
      this.agentConfig
    )
  }
}

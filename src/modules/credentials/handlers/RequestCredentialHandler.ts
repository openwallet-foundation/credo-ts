import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptCredential } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'
import { RequestCredentialMessage } from '../messages'

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

    const autoAccept = CredentialUtils.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.always || autoAccept === AutoAcceptCredential.contentApproved) {
      const { message } = await this.credentialService.createCredential(credentialRecord)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return createOutboundMessage(messageContext.connection!, message)
    }
  }
}

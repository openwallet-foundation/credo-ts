import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { AutoAcceptCredentialAndProof } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'
import { IssueCredentialMessage } from '../messages'

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

    const autoAccept = CredentialUtils.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    // Always accept any credential no matter what
    if (autoAccept === AutoAcceptCredentialAndProof.always) {
      const { message } = await this.credentialService.createAck(credentialRecord)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return createOutboundMessage(messageContext.connection!, message)
    } else if (autoAccept === AutoAcceptCredentialAndProof.contentNotChanged) {
      // Detect change in credentialRecord messages
      throw new AriesFrameworkError('contentNotChanged is not implemented yet!')
    }
  }
}

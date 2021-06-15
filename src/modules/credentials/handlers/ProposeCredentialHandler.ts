/* eslint-disable no-console */
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialService } from '../services'

import { AriesFrameworkError } from '../../../error'
import { AutoAcceptCredentialAndProof } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'
import { ProposeCredentialMessage } from '../messages'

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

    const autoAccept = CredentialUtils.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    // Always accept any credential no matter what
    if (autoAccept === AutoAcceptCredentialAndProof.always) {
      if (!credentialRecord.proposalMessage?.credentialProposal) {
        throw new AriesFrameworkError(
          `Credential record with id ${credentialRecord.id} is missing required credential proposal`
        )
      }
      if (!credentialRecord.proposalMessage.credentialDefinitionId) {
        throw new AriesFrameworkError('Missing required credential definition id')
      }
      await this.credentialService.createOfferAsResponse(credentialRecord, {
        credentialDefinitionId: credentialRecord.proposalMessage.credentialDefinitionId,
        preview: credentialRecord.proposalMessage.credentialProposal,
      })
      // Here we should call the next function to continue the flow
    } else if (autoAccept === AutoAcceptCredentialAndProof.contentNotChanged) {
      // Detect change in credentialRecord messages
      throw new AriesFrameworkError('contentNotChanged is not implemented yet!')
    }
  }
}

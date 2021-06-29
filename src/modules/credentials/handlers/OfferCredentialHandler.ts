import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { AutoAcceptCredential } from '../../../types'
import { CredentialUtils } from '../CredentialUtils'
import { OfferCredentialMessage } from '../messages'

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

    const autoAccept = CredentialUtils.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      this.agentConfig.autoAcceptCredentials
    )

    if (autoAccept === AutoAcceptCredential.always) {
      return await this.nextStep(credentialRecord, messageContext)
    } else if (autoAccept === AutoAcceptCredential.contentApproved) {
      if (credentialRecord.proposalMessage && credentialRecord.offerMessage) {
        const proposalValues = CredentialUtils.convertAttributesToValues(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          credentialRecord.proposalMessage.credentialProposal!.attributes
        )

        const proposalCredentialDefinitionId = credentialRecord.proposalMessage.credentialDefinitionId

        const offerValues = CredentialUtils.convertAttributesToValues(
          credentialRecord.offerMessage.credentialPreview.attributes
        )

        const offerCredentialDefinitionId = credentialRecord.offerMessage.indyCredentialOffer?.cred_def_id

        if (
          CredentialUtils.checkValuesMatch(proposalValues, offerValues) &&
          proposalCredentialDefinitionId === offerCredentialDefinitionId
        ) {
          return await this.nextStep(credentialRecord, messageContext)
        }
      }
    }
  }

  private async nextStep(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<OfferCredentialHandler>
  ) {
    const { message } = await this.credentialService.createRequest(credentialRecord)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createOutboundMessage(messageContext.connection!, message)
  }
}

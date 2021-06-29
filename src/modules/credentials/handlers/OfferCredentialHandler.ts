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

    // Always accept any credential no matter what
    if (autoAccept === AutoAcceptCredential.always) {
      return await this.nextStep(credentialRecord, messageContext)
    } else if (autoAccept === AutoAcceptCredential.contentApproved) {
      // Detect change in credentialRecord messages
      // throw new AriesFrameworkError('contentNotChanged is not implemented yet!')
      if (credentialRecord.proposalMessage && credentialRecord.offerMessage) {
        // Check if the values in the messages are the same
        const proposalValues = CredentialUtils.convertAttributesToValues(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          credentialRecord.proposalMessage.credentialProposal!.attributes
        )
        const offerValues = CredentialUtils.convertAttributesToValues(
          credentialRecord.offerMessage.credentialPreview.attributes
        )
        if (CredentialUtils.checkValuesMatch(proposalValues, offerValues)) {
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

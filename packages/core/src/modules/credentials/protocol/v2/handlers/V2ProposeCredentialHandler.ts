import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { ServiceOfferCredentialOptions } from '../../../CredentialServiceOptions'
import type { AcceptProposalOptions } from '../../../CredentialsModuleOptions'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error'
import { createOutboundMessage } from '../../../../../agent/helpers'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'

export class V2ProposeCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public supportedMessages = [V2ProposeCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2ProposeCredentialMessage>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    let offerMessage: V2OfferCredentialMessage | undefined
    let proposalMessage: V2ProposeCredentialMessage | undefined

    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      throw new AriesFrameworkError('Missing proposal message in V2RequestCredentialHandler')
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen sometimes
    }

    const shouldAutoRespond = this.credentialService.shouldAutoRespondToProposal(
      credentialRecord,
      proposalMessage,
      offerMessage ? offerMessage : undefined
    )
    if (shouldAutoRespond) {
      return await this.createOffer(credentialRecord, messageContext)
    }
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const proposal: AcceptProposalOptions = await this.credentialService.createAcceptProposalOptions(credentialRecord)

    const options: ServiceOfferCredentialOptions = {
      credentialFormats: proposal.credentialFormats,
      protocolVersion: CredentialProtocolVersion.V2,
      credentialRecordId: proposal.connectionId ? proposal.connectionId : '',
      comment: proposal.comment,
    }

    const message = await this.credentialService.createOfferAsResponse(credentialRecord, options)

    return createOutboundMessage(messageContext.connection, message)
  }
}

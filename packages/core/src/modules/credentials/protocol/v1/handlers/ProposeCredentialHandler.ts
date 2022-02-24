import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type { CredentialFormatService, CredProposeOfferRequestFormat } from '../../../formats/CredentialFormatService'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { OfferCredentialMessage, ProposeCredentialMessage } from '../messages'

export class ProposeCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [ProposeCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    let proposalMessage: ProposeCredentialMessage | undefined
    let offerMessage: OfferCredentialMessage | undefined
    // note that these two messages can be present (or not) and there is no
    // guarantee which one is present so we need two try-catch blocks
    try {
      proposalMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen sometimes
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen sometimes
    }
    let offerPayload: CredProposeOfferRequestFormat | undefined
    let proposalPayload: CredProposeOfferRequestFormat | undefined
    let proposalValues: CredentialPreviewAttribute[] | undefined

    if (!proposalMessage || !proposalMessage.credentialProposal || !proposalMessage.credentialProposal.attributes) {
      throw Error('Missing attributes in proposal message')
    }
    const formatService: CredentialFormatService = this.credentialService.getFormatService()

    if (proposalMessage && proposalMessage.genericAttachments) {
      proposalValues = proposalMessage.credentialProposal.attributes
      const attachment = proposalMessage.genericAttachments[0] // MJR: is this right for propose messages?
      if (attachment) {
        proposalPayload = formatService.getCredentialPayload(attachment)
      }
    }
    if (offerMessage) {
      const attachment = offerMessage.getAttachmentIncludingFormatId('indy')
      if (attachment) {
        offerPayload = formatService.getCredentialPayload(attachment)
      }
    }
    if (
      formatService.shouldAutoRespondToProposal(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        proposalValues,
        proposalPayload,
        offerPayload
      )
    ) {
      return await this.createOffer(credentialRecord, messageContext, proposalMessage)
    }
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<ProposeCredentialHandler>,
    proposalMessage?: ProposeCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }
    if (!proposalMessage?.credentialProposal) {
      this.agentConfig.logger.error(
        `Proposal message with id ${credentialRecord.id} is missing required credential proposal`
      )
      return
    }

    if (!proposalMessage.credentialDefinitionId) {
      this.agentConfig.logger.error('Missing required credential definition id')
      return
    }

    const { message } = await this.credentialService.createOfferAsResponse(credentialRecord, {
      credentialDefinitionId: proposalMessage.credentialDefinitionId,
      preview: proposalMessage.credentialProposal,
    })
    return createOutboundMessage(messageContext.connection, message)
  }
}

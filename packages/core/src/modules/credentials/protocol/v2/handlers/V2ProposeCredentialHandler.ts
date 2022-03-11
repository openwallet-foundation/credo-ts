import type { Attachment } from '../../../../../../src/decorators/attachment/Attachment'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { AcceptProposalOptions } from '../../../interfaces'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error'
import { createOutboundMessage } from '../../../../../agent/helpers'
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
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2ProposeCredentialMessage,
    })

    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen sometimes
    }

    if (!proposalMessage) {
      throw new AriesFrameworkError(`No proposal message found for credential record ${credentialRecord.id}`)
    }
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      proposalMessage.formats
    )

    let shouldAutoRespond = true
    let proposalValues: CredentialPreviewAttribute[] | undefined
    for (const formatService of formatServices) {
      let proposalAttachment, offerAttachment: Attachment | undefined
      if (proposalMessage && proposalMessage.appendedAttachments) {
        proposalAttachment = formatService.getAttachment(proposalMessage)
        proposalValues = proposalMessage.credentialProposal?.attributes
      }
      if (offerMessage) {
        offerAttachment = formatService.getAttachment(proposalMessage)
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        messageAttributes: proposalValues,
        proposalAttachment,
        offerAttachment,
      }
      const formatShouldAutoRespond = formatService.shouldAutoRespondToProposal(handlerOptions)
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
      if (shouldAutoRespond) {
        const offerAttachment = formatService.getAttachment(proposalMessage)
        return await this.createOffer(credentialRecord, messageContext, offerAttachment)
      }
    }
  }

  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2ProposeCredentialHandler>,
    offerAttachment?: Attachment
  ) {
    this.agentConfig.logger.info(
      `Automatically sending offer with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error('No connection on the messageContext, aborting auto accept')
      return
    }

    const options: AcceptProposalOptions = await this.credentialService.createAcceptProposalOptions(credentialRecord)
    options.offerAttachment = offerAttachment
    const message = await this.credentialService.createOfferAsResponse(credentialRecord, options)
    return createOutboundMessage(messageContext.connection, message)
  }
}

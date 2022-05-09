import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { Attachment } from '../../../../../decorators/attachment/Attachment'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage } from '../../../../../agent/helpers'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { AutoAcceptCredential } from '../../../CredentialAutoAcceptType'
import { V1OfferCredentialMessage, V1ProposeCredentialMessage } from '../messages'

export class V1ProposeCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1ProposeCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>) {
    const credentialRecord = await this.credentialService.processProposal(messageContext)

    // note that these two messages can be present (or not) and there is no
    // guarantee which one is present so we need two try-catch blocks
    const proposalMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    let proposalValues: CredentialPreviewAttribute[] | undefined

    if (!proposalMessage || !proposalMessage.credentialProposal || !proposalMessage.credentialProposal.attributes) {
      throw new AriesFrameworkError('Missing attributes in proposal message')
    }
    let proposalAttachment, offerAttachment: Attachment | undefined
    if (proposalMessage) {
      proposalValues = proposalMessage.credentialProposal.attributes
    }
    if (offerMessage) {
      offerAttachment = offerMessage.getAttachmentById('indy')
    }
    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      messageAttributes: proposalValues,
      proposalAttachment,
      offerAttachment,
      credentialDefinitionId: proposalMessage.credentialDefinitionId,
    }
    if (
      this.agentConfig.autoAcceptCredentials === AutoAcceptCredential.Always ||
      credentialRecord.autoAcceptCredential === AutoAcceptCredential.Always ||
      (await this.credentialService.shouldAutoRespondToProposal(handlerOptions))
    ) {
      return await this.createOffer(credentialRecord, messageContext, proposalMessage)
    }
  }
  private async createOffer(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1ProposeCredentialHandler>,
    proposalMessage?: V1ProposeCredentialMessage
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

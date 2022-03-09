import type { Attachment } from '../../../../../../src/decorators/attachment/Attachment'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { ServiceAcceptRequestOptions } from '../../../CredentialServiceOptions'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  V1ProposeCredentialMessage,
  V1RequestCredentialMessage,
  V1OfferCredentialMessage,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
} from '../messages'

export class V1RequestCredentialHandler implements Handler {
  private agentConfig: AgentConfig
  private credentialService: V1CredentialService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1RequestCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1RequestCredentialMessage,
    })

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    const proposeMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    const formatService: CredentialFormatService = this.credentialService.getFormatService()

    let proposalAttachment, offerAttachment, requestAttachment: Attachment | undefined
    if (proposeMessage && proposeMessage.appendedAttachments) {
      proposalAttachment = proposeMessage.appendedAttachments[0] // MJR: is this right for propose messages?
    }
    if (offerMessage) {
      offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
    }
    if (requestMessage) {
      requestAttachment = requestMessage.getAttachmentIncludingFormatId(INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID)
    }
    const handlerOptions: HandlerAutoAcceptOptions = {
      credentialRecord,
      autoAcceptType: this.agentConfig.autoAcceptCredentials,
      proposalAttachment,
      offerAttachment,
      requestAttachment,
    }
    if (formatService.shouldAutoRespondToRequest(handlerOptions)) {
      return await this.createCredential(credentialRecord, messageContext, offerMessage, requestMessage)
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1RequestCredentialHandler>,
    offerMessage?: V1OfferCredentialMessage | null,
    requestMessage?: V1RequestCredentialMessage | null
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    const options: ServiceAcceptRequestOptions = {
      attachId: INDY_CREDENTIAL_ATTACHMENT_ID,
      credentialRecordId: record.id,
      comment: 'V1 Indy Credential',
    }
    const { message, credentialRecord } = await this.credentialService.createCredential(record, options)

    if (messageContext.connection) {
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage?.service && offerMessage?.service) {
      const recipientService = requestMessage.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)

      await this.credentialService.update(credentialRecord)
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })
      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }
    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}

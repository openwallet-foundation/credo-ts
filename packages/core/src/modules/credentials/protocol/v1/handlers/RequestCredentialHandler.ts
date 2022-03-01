import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredProposeOfferRequestFormat, CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { AcceptRequestOptions } from '../../../interfaces'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { CredentialProtocolVersion } from '../../../CredentialProtocolVersion'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  OfferCredentialMessage,
  V1ProposeCredentialMessage,
  V1RequestCredentialMessage,
} from '../messages'

export class RequestCredentialHandler implements Handler {
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

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    let requestMessage: V1RequestCredentialMessage | undefined
    let offerMessage: OfferCredentialMessage | undefined
    let proposeMessage: V1ProposeCredentialMessage | undefined
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1RequestCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }
    try {
      proposeMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }
    let offerPayload: CredProposeOfferRequestFormat | undefined
    let proposalPayload: CredProposeOfferRequestFormat | undefined
    let requestPayload: CredProposeOfferRequestFormat | undefined

    const formatService: CredentialFormatService = this.credentialService.getFormatService()

    if (proposeMessage) {
      proposalPayload = proposeMessage.credentialPayload
    }
    if (offerMessage) {
      const attachment = offerMessage.getAttachmentIncludingFormatId('indy')
      if (attachment) {
        offerPayload = formatService.getCredentialPayload(attachment)
      }
    }
    if (requestMessage) {
      const attachment = requestMessage.getAttachmentIncludingFormatId('indy')
      if (attachment) {
        requestPayload = formatService.getCredentialPayload(attachment)
      }
    }
    if (
      formatService.shouldAutoRespondToRequest(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        requestPayload,
        offerPayload,
        proposalPayload
      )
    ) {
      return await this.createCredential(credentialRecord, messageContext, offerMessage, requestMessage)
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<RequestCredentialHandler>,
    offerMessage?: OfferCredentialMessage,
    requestMessage?: V1RequestCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    const options: AcceptRequestOptions = {
      attachId: INDY_CREDENTIAL_ATTACHMENT_ID,
      protocolVersion: CredentialProtocolVersion.V1,
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

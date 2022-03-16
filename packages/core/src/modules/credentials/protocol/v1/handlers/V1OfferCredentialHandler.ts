import type { Attachment } from '../../../../../../src/decorators/attachment/Attachment'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { MediationRecipientService } from '../../../../routing/services/MediationRecipientService'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { HandlerAutoAcceptOptions } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V1OfferCredentialMessage, V1ProposeCredentialMessage } from '../messages'

export class V1OfferCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1OfferCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1OfferCredentialMessage,
    })

    const proposeMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1ProposeCredentialMessage,
    })

    // let offerPayload: CredProposeOfferRequestFormat | undefined
    // let proposalPayload: CredProposeOfferRequestFormat | undefined
    let offerValues: CredentialPreviewAttribute[] | undefined

    const formatService: CredentialFormatService = this.credentialService.getFormatService()

    if (offerMessage) {
      let proposalAttachment, offerAttachment: Attachment | undefined
      if (proposeMessage && proposeMessage.appendedAttachments) {
        proposalAttachment = proposeMessage.appendedAttachments[0] // MJR: is this right for propose messages?
      }
      if (offerMessage) {
        offerAttachment = offerMessage.getAttachmentById(INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)
        offerValues = offerMessage.credentialPreview?.attributes
      }
      const handlerOptions: HandlerAutoAcceptOptions = {
        credentialRecord,
        autoAcceptType: this.agentConfig.autoAcceptCredentials,
        messageAttributes: offerValues,
        proposalAttachment,
        offerAttachment,
      }
      if (formatService.shouldAutoRespondToProposal(handlerOptions)) {
        return await this.createRequest(credentialRecord, messageContext, offerMessage)
      }
    }
  }

  private async createRequest(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1OfferCredentialHandler>,
    offerMessage?: V1OfferCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    if (messageContext.connection) {
      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        holderDid: messageContext.connection.did,
      })
      await this.didCommMessageRepository.saveAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      return createOutboundMessage(messageContext.connection, message)
    } else if (offerMessage?.service) {
      const routing = await this.mediationRecipientService.getRouting()
      const ourService = new ServiceDecorator({
        serviceEndpoint: routing.endpoints[0],
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
      const recipientService = offerMessage.service

      const { message, credentialRecord } = await this.credentialService.createRequest(record, {
        holderDid: ourService.recipientKeys[0],
      })

      // Set and save ~service decorator to record (to remember our verkey)
      message.service = ourService
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

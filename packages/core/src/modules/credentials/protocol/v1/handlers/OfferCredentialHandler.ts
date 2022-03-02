import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { MediationRecipientService } from '../../../../routing/services/MediationRecipientService'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { CredProposeOfferRequestFormat } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { V1OfferCredentialMessage, V1ProposeCredentialMessage } from '../messages'

export class OfferCredentialHandler implements Handler {
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

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    let offerMessage: V1OfferCredentialMessage | undefined
    let proposeMessage: V1ProposeCredentialMessage | undefined
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V1OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen
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
    let offerValues: CredentialPreviewAttribute[] | undefined

    const formatService: CredentialFormatService = this.credentialService.getFormatService()

    if (proposeMessage && proposeMessage.credentialProposal && proposeMessage.appendedAttachments) {
      proposalPayload = proposeMessage.credentialPayload
    }
    if (offerMessage) {
      const attachment = offerMessage.getAttachmentIncludingFormatId('indy')
      if (attachment) {
        offerPayload = formatService.getCredentialPayload(attachment)
      }
      offerValues = offerMessage.credentialPreview?.attributes
    }

    if (
      formatService.shouldAutoRespondToOffer(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        offerPayload,
        offerValues,
        proposalPayload
      )
    ) {
      return await this.createRequest(credentialRecord, messageContext, offerMessage)
    }
  }

  private async createRequest(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<OfferCredentialHandler>,
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

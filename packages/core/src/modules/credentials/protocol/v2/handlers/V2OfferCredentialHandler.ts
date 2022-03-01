import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { MediationRecipientService } from '../../../../routing/services/MediationRecipientService'
import type { CredentialFormatService } from '../../../formats/CredentialFormatService'
import type { CredProposeOfferRequestFormat } from '../../../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../../../models/CredentialPreviewAttributes'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { DidCommMessageRole } from '../../../../../storage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2ProposeCredentialMessage } from '../messages/V2ProposeCredentialMessage'

export class V2OfferCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  public supportedMessages = [V2OfferCredentialMessage]

  private didCommMessageRepository: DidCommMessageRepository

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2OfferCredentialMessage>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    let offerMessage: V2OfferCredentialMessage | undefined
    let proposeMessage: V2ProposeCredentialMessage | undefined
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen
    }
    try {
      proposeMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: V2ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }
    // 1. Get all formats for this message
    if (!offerMessage) {
      throw Error('Missing offer message in V2OfferCredentialHandler')
    }
    let offerPayload: CredProposeOfferRequestFormat | undefined
    let proposalPayload: CredProposeOfferRequestFormat | undefined
    let offerValues: CredentialPreviewAttribute[] | undefined

    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(offerMessage.formats)
    // 2. loop through found formats
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      if (proposeMessage) {
        const attachment = this.credentialService.getAttachment(proposeMessage)
        if (attachment) {
          proposalPayload = formatService.getCredentialPayload(attachment)
        }
      }
      const attachment = this.credentialService.getAttachment(offerMessage)
      if (attachment) {
        offerPayload = formatService.getCredentialPayload(attachment)
      }
      offerValues = offerMessage.credentialPreview?.attributes

      const formatShouldAutoRespond = formatService.shouldAutoRespondToOffer(
        credentialRecord,
        this.agentConfig.autoAcceptCredentials,
        offerPayload,
        offerValues,
        proposalPayload
      )

      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createRequest(credentialRecord, messageContext, offerMessage)
    }
  }

  private async createRequest(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2OfferCredentialHandler>,
    offerMessage?: V2OfferCredentialMessage
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
        role: DidCommMessageRole.Receiver,
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
      // await this.didCommMessageRepository.saveAgentMessage({
      //   agentMessage: message,
      //   role: DidCommMessageRole.Sender,
      //   associatedRecordId: credentialRecord.id,
      // })
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

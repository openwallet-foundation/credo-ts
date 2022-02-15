import type { DidCommMessageRepository } from '../../../../../storage'
import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { MediationRecipientService } from '../../../../routing/services/MediationRecipientService'
import type { CredentialResponseCoordinator } from '../../../CredentialResponseCoordinator'
import type { CredentialExchangeRecord } from '../../../repository/CredentialRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { DidCommMessageRole } from '../../../../../storage'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { ServiceDecorator } from '../../../../../decorators/service/ServiceDecorator'
import { OfferCredentialMessage, ProposeCredentialMessage } from '../messages'

export class OfferCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private mediationRecipientService: MediationRecipientService
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [OfferCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    mediationRecipientService: MediationRecipientService,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.mediationRecipientService = mediationRecipientService
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    let offerMessage: OfferCredentialMessage | undefined
    let proposeMessage: ProposeCredentialMessage | undefined
    try {
      offerMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: OfferCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen
    }
    try {
      proposeMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }

    if (this.credentialResponseCoordinator.shouldAutoRespondToOffer(credentialRecord, proposeMessage, offerMessage)) {
      return await this.createRequest(credentialRecord, messageContext, offerMessage)
    }
  }

  private async createRequest(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<OfferCredentialHandler>,
    offerMessage?: OfferCredentialMessage
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

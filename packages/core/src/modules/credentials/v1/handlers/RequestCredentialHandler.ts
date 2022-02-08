import type { V1LegacyCredentialService } from '../..'
import type { DidCommMessageRepository } from '../../../../../src/storage'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'

import { DidCommMessageRole } from '../../../../../src/storage'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../agent/helpers'
import { OfferCredentialMessage, ProposeCredentialMessage, RequestCredentialMessage } from '../messages'

export class RequestCredentialHandler implements Handler {
  private agentConfig: AgentConfig
  private credentialService: V1LegacyCredentialService
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [RequestCredentialMessage]

  public constructor(
    credentialService: V1LegacyCredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    let requestMessage: RequestCredentialMessage | undefined
    let offerMessage: OfferCredentialMessage | undefined
    let proposeMessage: ProposeCredentialMessage | undefined
    try {
      requestMessage = await this.didCommMessageRepository.getAgentMessage({
        associatedRecordId: credentialRecord.id,
        messageClass: RequestCredentialMessage,
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
        messageClass: ProposeCredentialMessage,
      })
    } catch (RecordNotFoundError) {
      // can happen in normal processing
    }

    if (
      this.credentialResponseCoordinator.shouldAutoRespondToRequest(
        credentialRecord,
        proposeMessage,
        offerMessage,
        requestMessage
      )
    ) {
      return await this.createCredential(credentialRecord, messageContext, offerMessage, requestMessage)
    }
  }

  private async createCredential(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<RequestCredentialHandler>,
    offerMessage?: OfferCredentialMessage,
    requestMessage?: RequestCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    const { message, credentialRecord } = await this.credentialService.createCredential(record)

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

import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { V1RequestCredentialMessage } from '../messages'

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

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToRequest({
      credentialRecord,
      requestMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptRequest(credentialRecord, messageContext)
    }
  }

  private async acceptRequest(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1RequestCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    const offerMessage = await this.credentialService.findOfferMessage(credentialRecord.id)

    const { message } = await this.credentialService.acceptRequest({
      credentialRecord,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (messageContext.message.service && offerMessage?.service) {
      const recipientService = messageContext.message.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)

      await this.didCommMessageRepository.saveOrUpdateAgentMessage({
        agentMessage: message,
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
      })

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create credential request`)
  }
}

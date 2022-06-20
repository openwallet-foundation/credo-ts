import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
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
    messageContext: InboundMessageContext<V2RequestCredentialMessage>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const offerMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

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
        associatedRecordId: credentialRecord.id,
        role: DidCommMessageRole.Sender,
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

import type { Handler } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../../logger/Logger'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2RequestCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private didCommMessageRepository: DidCommMessageRepository
  private logger: Logger

  public supportedMessages = [V2RequestCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    didCommMessageRepository: DidCommMessageRepository,
    logger: Logger
  ) {
    this.credentialService = credentialService
    this.didCommMessageRepository = didCommMessageRepository
    this.logger = logger
  }

  public async handle(messageContext: InboundMessageContext<V2RequestCredentialMessage>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToRequest(messageContext.agentContext, {
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
    this.logger.info(
      `Automatically sending credential with autoAccept on ${messageContext.agentContext.config.autoAcceptCredentials}`
    )

    const offerMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V2OfferCredentialMessage,
    })

    const { message } = await this.credentialService.acceptRequest(messageContext.agentContext, {
      credentialRecord,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (messageContext.message.service && offerMessage?.service) {
      const recipientService = messageContext.message.service
      const ourService = offerMessage.service

      // Set ~service, update message in record (for later use)
      message.setService(ourService)
      await this.didCommMessageRepository.saveOrUpdateAgentMessage(messageContext.agentContext, {
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

    this.logger.error(`Could not automatically create credential request`)
  }
}

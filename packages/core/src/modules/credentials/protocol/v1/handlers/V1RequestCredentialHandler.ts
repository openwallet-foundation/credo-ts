import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { Logger } from '../../../../../logger'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { DidCommMessageRole } from '../../../../../storage'
import { V1RequestCredentialMessage } from '../messages'

export class V1RequestCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private didCommMessageRepository: DidCommMessageRepository
  private logger: Logger
  public supportedMessages = [V1RequestCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    didCommMessageRepository: DidCommMessageRepository,
    logger: Logger
  ) {
    this.credentialService = credentialService
    this.logger = logger
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1RequestCredentialHandler>) {
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
    messageContext: HandlerInboundMessage<V1RequestCredentialHandler>
  ) {
    this.logger.info(
      `Automatically sending credential with autoAccept on ${messageContext.agentContext.config.autoAcceptCredentials}`
    )

    const offerMessage = await this.credentialService.findOfferMessage(messageContext.agentContext, credentialRecord.id)

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
        role: DidCommMessageRole.Sender,
        associatedRecordId: credentialRecord.id,
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

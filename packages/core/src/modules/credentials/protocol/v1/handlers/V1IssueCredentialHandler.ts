import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { Logger } from '../../../../../logger'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { V1IssueCredentialMessage, V1RequestCredentialMessage } from '../messages'

export class V1IssueCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private didCommMessageRepository: DidCommMessageRepository
  private logger: Logger
  public supportedMessages = [V1IssueCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    didCommMessageRepository: DidCommMessageRepository,
    logger: Logger
  ) {
    this.credentialService = credentialService
    this.didCommMessageRepository = didCommMessageRepository
    this.logger = logger
  }

  public async handle(messageContext: HandlerInboundMessage<V1IssueCredentialHandler>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext)

    const shouldAutoRespond = await this.credentialService.shouldAutoRespondToCredential(messageContext.agentContext, {
      credentialRecord,
      credentialMessage: messageContext.message,
    })

    if (shouldAutoRespond) {
      return await this.acceptCredential(credentialRecord, messageContext)
    }
  }

  private async acceptCredential(
    credentialRecord: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V1IssueCredentialHandler>
  ) {
    this.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${messageContext.agentContext.config.autoAcceptCredentials}`
    )
    const { message } = await this.credentialService.acceptCredential(messageContext.agentContext, {
      credentialRecord,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V1RequestCredentialMessage,
    })

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (messageContext.message.service && requestMessage.service) {
      const recipientService = messageContext.message.service
      const ourService = requestMessage.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.resolvedDidCommService,
        senderKey: ourService.resolvedDidCommService.recipientKeys[0],
      })
    }

    this.logger.error(`Could not automatically create credential ack`)
  }
}

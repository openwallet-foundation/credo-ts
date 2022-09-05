import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../../../logger'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2IssueCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private didCommMessageRepository: DidCommMessageRepository
  private logger: Logger

  public supportedMessages = [V2IssueCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    didCommMessageRepository: DidCommMessageRepository,
    logger: Logger
  ) {
    this.credentialService = credentialService
    this.didCommMessageRepository = didCommMessageRepository
    this.logger = logger
  }

  public async handle(messageContext: InboundMessageContext<V2IssueCredentialMessage>) {
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
    messageContext: HandlerInboundMessage<V2IssueCredentialHandler>
  ) {
    this.logger.info(`Automatically sending acknowledgement with autoAccept`)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage(messageContext.agentContext, {
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    const { message } = await this.credentialService.acceptCredential(messageContext.agentContext, {
      credentialRecord,
    })
    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage?.service && messageContext.message.service) {
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

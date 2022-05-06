import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V2CredentialService } from '../V2CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2IssueCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository

  public supportedMessages = [V2IssueCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }
  public async handle(messageContext: InboundMessageContext<V2IssueCredentialMessage>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext)
    const credentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2IssueCredentialMessage,
    })

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    if (!credentialMessage) {
      throw new AriesFrameworkError(`Missing credential message from credential record ${credentialRecord.id}`)
    }

    const shouldAutoRespond = this.credentialService.shouldAutoRespondToCredential(credentialRecord, credentialMessage)
    if (shouldAutoRespond) {
      return await this.createAck(credentialRecord, messageContext, requestMessage ?? undefined, credentialMessage)
    }
  }

  private async createAck(
    record: CredentialExchangeRecord,
    messageContext: HandlerInboundMessage<V2IssueCredentialHandler>,
    requestMessage?: V2RequestCredentialMessage,
    credentialMessage?: V2IssueCredentialMessage
  ) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const { message } = await this.credentialService.createAck(record)

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (requestMessage?.service && credentialMessage?.service) {
      const recipientService = credentialMessage.service
      const ourService = requestMessage.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create credential ack`)
  }
}

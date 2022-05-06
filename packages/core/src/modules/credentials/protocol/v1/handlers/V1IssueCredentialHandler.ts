import type { AgentConfig } from '../../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../../agent/Handler'
import type { DidCommMessageRepository } from '../../../../../storage'
import type { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import type { V1CredentialService } from '../V1CredentialService'

import { AriesFrameworkError } from '../../../../../../src/error/AriesFrameworkError'
import { createOutboundMessage, createOutboundServiceMessage } from '../../../../../agent/helpers'
import { V1IssueCredentialMessage, V1RequestCredentialMessage } from '../messages'

export class V1IssueCredentialHandler implements Handler {
  private credentialService: V1CredentialService
  private agentConfig: AgentConfig
  private didCommMessageRepository: DidCommMessageRepository
  public supportedMessages = [V1IssueCredentialMessage]

  public constructor(
    credentialService: V1CredentialService,
    agentConfig: AgentConfig,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.didCommMessageRepository = didCommMessageRepository
  }

  public async handle(messageContext: HandlerInboundMessage<V1IssueCredentialHandler>) {
    const credentialRecord = await this.credentialService.processCredential(messageContext)
    const credentialMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1IssueCredentialMessage,
    })
    if (!credentialMessage) {
      throw new AriesFrameworkError('Missing credential message in V2RequestCredentialHandler')
    }
    if (this.credentialService.shouldAutoRespondToCredential(credentialRecord, credentialMessage)) {
      return await this.createAck(credentialRecord, credentialMessage, messageContext)
    }
  }

  private async createAck(
    record: CredentialExchangeRecord,
    credentialMessage: V1IssueCredentialMessage | null,
    messageContext: HandlerInboundMessage<V1IssueCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const { message, credentialRecord } = await this.credentialService.createAck(record)

    const requestMessage = await this.didCommMessageRepository.findAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V1RequestCredentialMessage,
    })
    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (credentialMessage?.service && requestMessage?.service) {
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

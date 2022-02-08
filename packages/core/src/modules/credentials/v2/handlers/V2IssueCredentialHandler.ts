import type { InboundMessageContext } from '../../../../../src/agent/models/InboundMessageContext'
import type { DidCommMessageRepository } from '../../../../../src/storage'
import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../agent/helpers'
import { unitTestLogger } from '../../../../logger'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'
import { V2RequestCredentialMessage } from '../messages/V2RequestCredentialMessage'

export class V2IssueCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  private didCommMessageRepository: DidCommMessageRepository

  public supportedMessages = [V2IssueCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator,
    didCommMessageRepository: DidCommMessageRepository
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
    this.didCommMessageRepository = didCommMessageRepository
  }
  public async handle(messageContext: InboundMessageContext<V2IssueCredentialMessage>) {
    unitTestLogger('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR ISSUE CREDENTIAL')

    const credentialRecord = await this.credentialService.processCredential(messageContext)
    const credentialMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2IssueCredentialMessage,
    })

    const requestMessage = await this.didCommMessageRepository.getAgentMessage({
      associatedRecordId: credentialRecord.id,
      messageClass: V2RequestCredentialMessage,
    })

    // 1. Get all formats for this message
    const formatServices: CredentialFormatService[] = this.credentialService.getFormatsFromMessage(
      credentialMessage.formats
    )

    // 2. loop through found formats
    let shouldAutoRespond = true
    for (const formatService of formatServices) {
      // 3. Call format.shouldRespondToProposal for each one
      const formatShouldAutoRespond = formatService.shouldAutoRespondToIssue(
        credentialRecord,
        credentialMessage,
        this.agentConfig.autoAcceptCredentials
      )
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createAck(credentialRecord, messageContext, requestMessage, credentialMessage)
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

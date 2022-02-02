import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import type { CredentialRecord } from '../../repository/CredentialRecord'
import type { V2CredentialService } from '../V2CredentialService'
import type { CredentialFormatService } from '../formats/CredentialFormatService'
import type { InboundMessageContext } from 'packages/core/src/agent/models/InboundMessageContext'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../../agent/helpers'
import { unitTestLogger } from '../../../../logger'
import { V2IssueCredentialMessage } from '../messages/V2IssueCredentialMessage'

export class V2IssueCredentialHandler implements Handler {
  private credentialService: V2CredentialService
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [V2IssueCredentialMessage]

  public constructor(
    credentialService: V2CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
  }
  public async handle(messageContext: InboundMessageContext<V2IssueCredentialMessage>) {
    unitTestLogger('----------------------------- >>>>TEST-DEBUG WE ARE IN THE v2 HANDLER FOR ISSUE CREDENTIAL')

    const credentialRecord = await this.credentialService.processCredential(messageContext)

    const credentialMessage: V2IssueCredentialMessage = credentialRecord.credentialMessage as V2IssueCredentialMessage

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
        this.agentConfig.autoAcceptCredentials
      )
      shouldAutoRespond = shouldAutoRespond && formatShouldAutoRespond
    }
    // 4. if all formats are eligibile for auto response then call create offer
    if (shouldAutoRespond) {
      return await this.createAck(credentialRecord, messageContext)
    }
  }

  private async createAck(record: CredentialRecord, messageContext: HandlerInboundMessage<V2IssueCredentialHandler>) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )
    const { message, credentialRecord } = await this.credentialService.createAck(record)

    if (messageContext.connection) {
      return createOutboundMessage(messageContext.connection, message)
    } else if (credentialRecord.credentialMessage?.service && credentialRecord.requestMessage?.service) {
      const recipientService = credentialRecord.credentialMessage.service
      const ourService = credentialRecord.requestMessage.service

      return createOutboundServiceMessage({
        payload: message,
        service: recipientService.toDidCommService(),
        senderKey: ourService.recipientKeys[0],
      })
    }

    this.agentConfig.logger.error(`Could not automatically create credential ack`)
  }
}

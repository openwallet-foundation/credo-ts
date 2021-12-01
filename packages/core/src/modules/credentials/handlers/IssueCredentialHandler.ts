import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage, createOutboundServiceMessage } from '../../../agent/helpers'
import { CredentialProblemReportMessage, IssueCredentialMessage } from '../messages'

import { CredentialProblemReportError } from './../errors/CredentialProblemReportError'

export class IssueCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  private credentialResponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [IssueCredentialMessage]

  public constructor(
    credentialService: CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
    try {
      const credentialRecord = await this.credentialService.processCredential(messageContext)
      if (this.credentialResponseCoordinator.shouldAutoRespondToIssue(credentialRecord)) {
        return await this.createAck(credentialRecord, messageContext)
      }
    } catch (error) {
      if (error instanceof CredentialProblemReportError) {
        const credentialProblemReportMessage = new CredentialProblemReportMessage({
          description: {
            en: error.message,
            code: error.problemCode,
          },
        })
        credentialProblemReportMessage.setThread({
          threadId: messageContext.message.threadId,
        })
        return createOutboundMessage(messageContext.connection!, credentialProblemReportMessage)
      }
    }
  }

  private async createAck(record: CredentialRecord, messageContext: HandlerInboundMessage<IssueCredentialHandler>) {
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

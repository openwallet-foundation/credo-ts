import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { IssueCredentialMessage } from '../messages'

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
    const credentialRecord = await this.credentialService.processCredential(messageContext)
    if (this.credentialResponseCoordinator.shouldAutoRespondToIssue(credentialRecord)) {
      return await this.createAck(credentialRecord, messageContext)
    }
  }

  private async createAck(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<IssueCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending acknowledgement with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error(`No connection on the messageContext`)
      return
    }
    const { message } = await this.credentialService.createAck(credentialRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}

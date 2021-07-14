import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestCredentialMessage } from '../messages'

export class RequestCredentialHandler implements Handler {
  private agentConfig: AgentConfig
  private credentialService: CredentialService
  private credentialResponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [RequestCredentialMessage]

  public constructor(
    credentialService: CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialResponseCoordinator = credentialResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    if (this.credentialResponseCoordinator.shouldAutoRespondToRequest(credentialRecord)) {
      return await this.createCredential(credentialRecord, messageContext)
    }
  }

  private async createCredential(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<RequestCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending credential with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error(`No connection on the messageContext`)
      return
    }

    const { message } = await this.credentialService.createCredential(credentialRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}

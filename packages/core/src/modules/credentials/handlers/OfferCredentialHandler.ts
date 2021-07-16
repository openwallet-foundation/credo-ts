import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialResponseCoordinator } from '../CredentialResponseCoordinator'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { OfferCredentialMessage } from '../messages'

export class OfferCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  private credentialReponseCoordinator: CredentialResponseCoordinator
  public supportedMessages = [OfferCredentialMessage]

  public constructor(
    credentialService: CredentialService,
    agentConfig: AgentConfig,
    credentialResponseCoordinator: CredentialResponseCoordinator
  ) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
    this.credentialReponseCoordinator = credentialResponseCoordinator
  }

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    if (this.credentialReponseCoordinator.shouldAutoRespondToOffer(credentialRecord)) {
      return await this.createRequest(credentialRecord, messageContext)
    }
  }

  private async createRequest(
    credentialRecord: CredentialRecord,
    messageContext: HandlerInboundMessage<OfferCredentialHandler>
  ) {
    this.agentConfig.logger.info(
      `Automatically sending request with autoAccept on ${this.agentConfig.autoAcceptCredentials}`
    )

    if (!messageContext.connection) {
      this.agentConfig.logger.error(`No connection on the messageContext`)
      return
    }

    const { message } = await this.credentialService.createRequest(credentialRecord)

    return createOutboundMessage(messageContext.connection, message)
  }
}

import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { OfferCredentialMessage } from '../messages'

import { AutoResponseHandler } from './AutoResponseHandler'

export class OfferCredentialHandler implements Handler {
  private credentialService: CredentialService
  private agentConfig: AgentConfig
  public supportedMessages = [OfferCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<OfferCredentialHandler>) {
    const credentialRecord = await this.credentialService.processOffer(messageContext)

    if (await AutoResponseHandler.shouldAutoRespondToOffer(credentialRecord, this.agentConfig.autoAcceptCredentials)) {
      return await this.sendRequest(credentialRecord, messageContext)
    }
  }

  /**
   * Sends a request to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @returns a message that will be send to the other agent
   */
  private async sendRequest(
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

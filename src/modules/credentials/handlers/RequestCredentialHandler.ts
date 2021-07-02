import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { CredentialRecord } from '../repository/CredentialRecord'
import type { CredentialService } from '../services'

import { createOutboundMessage } from '../../../agent/helpers'
import { RequestCredentialMessage } from '../messages'

import { AutoResponseHandler } from './AutoResponseHandler'

export class RequestCredentialHandler implements Handler {
  private agentConfig: AgentConfig
  private credentialService: CredentialService
  public supportedMessages = [RequestCredentialMessage]

  public constructor(credentialService: CredentialService, agentConfig: AgentConfig) {
    this.credentialService = credentialService
    this.agentConfig = agentConfig
  }

  public async handle(messageContext: HandlerInboundMessage<RequestCredentialHandler>) {
    const credentialRecord = await this.credentialService.processRequest(messageContext)
    if (
      await AutoResponseHandler.shouldAutoRespondToRequest(credentialRecord, this.agentConfig.autoAcceptCredentials)
    ) {
      return await this.sendCredential(credentialRecord, messageContext)
    }
  }

  /**
   * Sends a credential message to the other agent
   *
   * @param credentialRecord The credentialRecord that contains the message(s) to respond to
   * @param messageContext The context that is needed to respond on
   * @returns a message that will be send to the other agent
   */
  private async sendCredential(
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
